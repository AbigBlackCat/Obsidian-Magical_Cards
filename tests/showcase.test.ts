import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { App as ObsidianApp } from 'obsidian';
import type { CustomCardModule, ShowcaseCard } from '../src/types';
import type * as Mock from './obsidian-mock';

const directory = dirname(fileURLToPath(import.meta.url));
const bundle = await build({ stdin: { contents: "export * from '../src/showcase'; export * from '../src/showcase-markdown'; export * from '../src/store'; export * from './obsidian-mock';", resolveDir: directory, loader: 'ts' }, alias: { obsidian: resolve(directory, 'obsidian-mock.ts') }, bundle: true, platform: 'node', format: 'cjs', write: false });
const module = { exports: {} }; new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const implementation = module.exports as typeof Mock & typeof import('../src/showcase') & typeof import('../src/showcase-markdown') & typeof import('../src/store');
const note = (body = '') => `---\nmc_showcase_module: photos\nmc_showcase_version: 1\nfuture: keep\n---\n\n用户前言  \n${body}\n用户结尾  \n`;
const card = (id: string, patch: Partial<ShowcaseCard> = {}): ShowcaseCard => ({ id, image: `图片-${id}.png`, name: '', description: '', ...patch });

test('showcase Markdown is the single native-readable source and roundtrips literal text', () => {
  const expected = card('a', { name: '名称 * [] <script> &', description: '## 纯文本\n![[不应嵌入.png]]\n<!-- 标记 -->' });
  const text = note(implementation.showcaseCardBlock(expected));
  assert.deepEqual(implementation.readShowcaseMarkdown(text, 'photos.md', 'photos').cards, [expected]);
  assert.ok(text.includes('![[图片-a.png]]')); assert.ok(text.includes('## 名称')); assert.equal(text.includes('<script>'), false);
  assert.equal(implementation.readShowcaseMarkdown(note(), 'photos.md', 'photos').cards.length, 0);
  assert.throws(() => implementation.showcaseCardBlock(card('a', { description: '字'.repeat(401) })), /400/);
  assert.equal(implementation.readShowcaseMarkdown(note(implementation.showcaseCardBlock(card('a', { description: '😀'.repeat(400) }))), '', 'photos').cards[0].description.length, 800);
});

test('showcase rejects damaged, nested, duplicate and fenced markers without guessing a collection', () => {
  const block = implementation.showcaseCardBlock(card('a'));
  for (const body of [block + block, block.replace(':end -->', ':start -->'), block.replace(':a:end', ':b:end'), block.replace(':end -->', ':broken -->'), '```md\n' + block + '```\n', block.replace('![[图片-a.png]]', '')]) assert.throws(() => implementation.readShowcaseMarkdown(note(body), '', 'photos'));
  assert.throws(() => implementation.readShowcaseMarkdown(note(block), '', 'different'), /标识/);
  assert.throws(() => implementation.readShowcaseMarkdown(note(block).replace('version: 1', 'version: 2'), '', 'photos'), /版本/);
  for (const image of ['../secret.png', '/outside.png', 'file:///secret.png', 'https://example.test/a.png']) assert.throws(() => implementation.showcaseCardBlock(card('a', { image })), /图片/);
});

test('field patches preserve raw image syntax, the other field, outer text and unknown frontmatter exactly', () => {
  const raw = '<!-- magical-cards:card:a:start -->\r\n## 旧名称\r\n\r\n![原始替代文字](<图片-a.png>)\r\n\r\n旧描述 \\* literal  \r\n第二行  \r\n\r\n<!-- magical-cards:card:a:end -->\r\n';
  const text = note(raw).replace(/(?<!\r)\n/g, '\r\n');
  const before = implementation.readShowcaseMarkdown(text, 'photos.md', 'photos').cards[0];
  const changed = implementation.patchShowcaseMarkdown(text, 'photos.md', 'photos', 'a', { name: '新名称' }, before);
  assert.equal(changed.text, text.replace('## 旧名称\r\n', '## 新名称\r\n'));
  const described = implementation.patchShowcaseMarkdown(changed.text, 'photos.md', 'photos', 'a', { description: '新描述' }, before);
  assert.equal(described.text, changed.text.replace('旧描述 \\* literal  \r\n第二行  \r\n', '新描述'));
  assert.throws(() => implementation.patchShowcaseMarkdown(described.text, 'photos.md', 'photos', 'a', { description: '覆盖新稿' }, before), /其他窗口/);
  const noName = implementation.patchShowcaseMarkdown(changed.text, '', 'photos', 'a', { name: '' }, changed.card);
  assert.equal(implementation.readShowcaseMarkdown(noName.text, '', 'photos').cards[0].name, '');
});

test('literal description newlines roundtrip and successive autosaves use the actual persisted baseline', async () => {
  for (const description of ['\n第一行', '第一行\n', '\n第一行\n\n', '\n', '  \n\n']) {
    const expected = card('a', { name: '保留名称', description });
    const text = note(implementation.showcaseCardBlock(expected));
    assert.deepEqual(implementation.readShowcaseMarkdown(text, 'photos.md', 'photos').cards[0], expected);
    const nameOnly = implementation.patchShowcaseMarkdown(text, 'photos.md', 'photos', 'a', { name: '只改名称' }, expected);
    assert.equal(nameOnly.text, text.replace('## 保留名称\n', '## 只改名称\n'));
    assert.equal(implementation.readShowcaseMarkdown(nameOnly.text, 'photos.md', 'photos').cards[0].description, description);
  }
  const { service, app, path } = await fixture(); await service.importImages('photos', [{ id: 'a', file: png() }]);
  let saved = (await service.read('photos')).cards[0];
  saved = await service.patchCard('photos', 'a', { description: '第一行\n' }, saved);
  assert.equal((await service.read('photos')).cards[0].description, saved.description);
  saved = await service.patchCard('photos', 'a', { description: '第一行\n第二行\n\n' }, saved);
  assert.equal(saved.description, '第一行\n第二行\n\n'); assert.equal((await service.read('photos')).cards[0].description, saved.description);
  const beforeName = app.vault.text(path); await service.patchCard('photos', 'a', { name: '新增名称' }, saved);
  assert.equal(app.vault.text(path), beforeName.replace('![[图片-a.png]]', '## 新增名称\n\n![[图片-a.png]]'));
});

test('move and delete touch only managed card spans and reject membership or card changes', () => {
  const a = card('a'), b = card('b', { name: '第二张' });
  const aBlock = implementation.showcaseCardBlock(a), bBlock = implementation.showcaseCardBlock(b), text = note(aBlock + '用户中间注释  \n' + bBlock);
  const moved = implementation.moveShowcaseMarkdown(text, '', 'photos', 'b', 'a', ['a', 'b']);
  assert.equal(moved, note(bBlock + '用户中间注释  \n' + aBlock));
  assert.throws(() => implementation.moveShowcaseMarkdown(moved, '', 'photos', 'b', null, ['a', 'b']), /变化/);
  assert.equal(implementation.deleteShowcaseMarkdown(text, '', 'photos', 'a', a), note('用户中间注释  \n' + bBlock));
  assert.throws(() => implementation.deleteShowcaseMarkdown(text, '', 'photos', 'b', { ...b, name: '过时' }), /重新确认/);
  const eof = implementation.newShowcaseMarkdown('photos', '橱窗') + aBlock + bBlock.trimEnd();
  const movedEof = implementation.moveShowcaseMarkdown(eof, '', 'photos', 'b', 'a', ['a', 'b']);
  assert.deepEqual(implementation.readShowcaseMarkdown(movedEof, '', 'photos').cards.map(item => item.id), ['b', 'a']);
});

async function fixture() {
  const app = new implementation.App();
  Object.assign(app.vault, { readBinary: async (file: Mock.TFile) => Uint8Array.from(Buffer.from(file.contents, 'base64')).buffer });
  let settings: CustomCardModule | undefined, enabled = true, notifications = 0;
  const service = implementation.createShowcaseService({ app: app as unknown as ObsidianApp, rootFolder: '卡片库', getModule: id => settings?.id === id ? settings : undefined, notify: () => { notifications++; }, assertActive: () => { if (!enabled) throw new Error('已停用'); } });
  const path = await service.create('photos', '我的橱窗');
  settings = { id: 'photos', title: '我的橱窗', kind: 'film', mode: 'showcase', showcaseNote: path, appearance: { material: 'paper', style: 'cover' } };
  return { app, service, path, settings, notifications: () => notifications, stop: () => { enabled = false; } };
}
const png = () => new File([Uint8Array.from([1, 2, 3, 4])], '照片.png', { type: 'image/png' });

test('showcase SVG limit counts UTF-8 bytes before writing any image or card', async () => {
  const { app, service, path } = await fixture(), before = app.vault.text(path);
  const svg = new File([`<svg xmlns="http://www.w3.org/2000/svg"><text>${'字'.repeat(700_000)}</text></svg>`], '宽幅.svg', { type: 'image/svg+xml' });
  assert.ok(svg.size > 2_000_000);
  const result = await service.importImages('photos', [{ id: 'too-large-svg', file: svg }]);
  assert.deepEqual(result.imported, []); assert.match(result.failed[0].error, /2 MB/);
  assert.equal(app.vault.text(path), before); assert.equal(app.vault.getAbstractFileByPath(path.replace('橱窗.md', '图片-too-large-svg.svg')), null);
});

test('showcase creation is idempotent and missing or occupied notes are never overwritten or recreated', async () => {
  const { app, service, path } = await fixture(), original = app.vault.text(path);
  assert.equal(await service.create('photos', '不会重写'), path); assert.equal(app.vault.text(path), original);
  app.vault.files.delete(path); await assert.rejects(service.read('photos'), /没有创建空/); await assert.rejects(service.create('photos', '不会重建'), /没有自动重新创建/);
  assert.equal(app.vault.getAbstractFileByPath(path), null);
  await app.vault.create(path, '# 其他笔记'); await assert.rejects(service.read('photos'), /标识/); assert.equal(app.vault.text(path), '# 其他笔记');
});

test('batch imports retain stable IDs and partial retry reuses original bytes without duplicate cards', async () => {
  const { app, service, path } = await fixture(), originalProcess = app.vault.process.bind(app.vault);
  let once = true; app.vault.process = async (file, update) => { if (once) { once = false; throw new Error('模拟笔记写入失败'); } return originalProcess(file, update); };
  const upload = png(), svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"><rect width="2" height="2"/></svg>'], '安全.svg');
  const first = await service.importImages('photos', [{ id: 'a', file: upload }, { id: 'b', file: svg }, { id: '../invalid', file: upload }]);
  assert.deepEqual(first.imported, ['b']); assert.deepEqual(first.failed.map(item => item.id), ['a', '../invalid']);
  const imagePath = path.replace('橱窗.md', '图片-a.png'), imageBefore = app.vault.text(imagePath);
  assert.deepEqual(await service.importImages('photos', [{ id: 'a', file: upload }]), { imported: ['a'], failed: [] });
  assert.equal(app.vault.text(imagePath), imageBefore); assert.equal((await service.read('photos')).cards.length, 2);
  const expected = (await service.read('photos')).cards.find(item => item.id === 'a')!;
  await service.patchCard('photos', 'a', { name: '保留手动编辑' }, expected);
  await service.importImages('photos', [{ id: 'a', file: upload }]); assert.equal((await service.read('photos')).cards.find(item => item.id === 'a')!.name, '保留手动编辑');
  await service.deleteCard('photos', 'a', (await service.read('photos')).cards.find(item => item.id === 'a')!);
  assert.equal(app.vault.text(imagePath), imageBefore); assert.equal(app.vault.getAbstractFileByPath(path)?.path, path);
});

test('native disagreement blocks writes, unrelated fields merge, and stopped imports cannot write delayed files', async () => {
  const { app, service, path, stop } = await fixture(); await service.importImages('photos', [{ id: 'a', file: png() }]);
  const expected = (await service.read('photos')).cards[0], file = app.vault.getAbstractFileByPath(path) as Mock.TFile;
  app.markdownViews = [{ file, getViewData: () => file.contents + '草稿1', save: async () => {} }, { file, getViewData: () => file.contents + '草稿2', save: async () => {} }];
  const before = file.contents; await assert.rejects(service.patchCard('photos', 'a', { description: '不能覆盖' }, expected), /窗口内容不一致/); assert.equal(file.contents, before);
  app.markdownViews = []; await service.patchCard('photos', 'a', { description: '新描述' }, expected); await service.patchCard('photos', 'a', { name: '新名字' }, expected);
  assert.equal((await service.read('photos')).cards[0].description, '新描述');
  const upload = png(), originalRead = upload.arrayBuffer.bind(upload); upload.arrayBuffer = async () => { stop(); return originalRead(); };
  const result = await service.importImages('photos', [{ id: 'late', file: upload }]); assert.equal(result.failed.length, 1); assert.equal(app.vault.getAbstractFileByPath(path.replace('橱窗.md', '图片-late.png')), null);
});

test('unsafe SVG and conflicting retained files fail without changing original notes or image bytes', async () => {
  const { app, service, path } = await fixture();
  await app.vault.createBinary(path.replace('橱窗.md', '图片-a.png'), Uint8Array.from([9]).buffer);
  const imageBefore = app.vault.text(path.replace('橱窗.md', '图片-a.png')), noteBefore = app.vault.text(path);
  const unsafe = new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], '不安全.svg');
  const result = await service.importImages('photos', [{ id: 'a', file: png() }, { id: 'bad', file: unsafe }, { id: 'text', file: new File(['x'], 'x.txt') }]);
  assert.equal(result.failed.length, 3); assert.equal(app.vault.text(path), noteBefore); assert.equal(app.vault.text(path.replace('橱窗.md', '图片-a.png')), imageBefore);
});

test('queued operations capture imports, patches and expected IDs before callers mutate their drafts', async () => {
  const { service } = await fixture();
  const uploads = [{ id: 'a', file: png() }, { id: 'b', file: png() }], imported = service.importImages('photos', uploads);
  uploads[0].id = '../changed'; uploads.splice(1); assert.deepEqual((await imported).imported, ['a', 'b']);
  const expected = (await service.read('photos')).cards[0], patch = { name: '调用时名称' }, saving = service.patchCard('photos', 'a', patch, expected);
  patch.name = '后来改草稿'; expected.name = '后来改基线'; await saving;
  assert.equal((await service.read('photos')).cards[0].name, '调用时名称');
  const ids = ['a', 'b'], moving = service.moveCard('photos', 'b', 'a', ids); ids.reverse(); await moving;
  assert.deepEqual((await service.read('photos')).cards.map(item => item.id), ['b', 'a']);
});

test('creation validates identity and plain names, and a renamed source must be explicitly referenced', async () => {
  assert.throws(() => implementation.newShowcaseMarkdown('../escape', '名称'), /标识/);
  assert.throws(() => implementation.newShowcaseMarkdown('safe', '名称\nmc_showcase_module: other'), /单行/);
  const { app, service, path, settings } = await fixture();
  const file = app.vault.getAbstractFileByPath(path) as Mock.TFile, movedPath = path.replace('橱窗.md', '改名后的橱窗.md');
  app.vault.files.delete(path); file.path = movedPath; app.vault.files.set(movedPath, file);
  await assert.rejects(service.read('photos'), (error: unknown) => {
    assert.ok(error instanceof Error); assert.match(error.message, /没有创建空/); assert.ok(error.message.includes(path)); assert.match(error.message, /_数据\/卡片配置\.md.*showcaseNote/); return true;
  }); settings.showcaseNote = movedPath; assert.equal((await service.read('photos')).path, movedPath);
  settings.showcaseNote = '../outside.md'; await assert.rejects(service.read('photos'), /位置无效/);
  assert.equal(file.contents.includes('mc_showcase_module: photos'), true);
});

test('card setting writes retain unknown raw workbench text keys when changing a known title', async () => {
  const app = new implementation.App(), store = new implementation.CardsStore(app as unknown as ObsidianApp, '卡片库'); await store.initialize();
  const file = app.vault.getAbstractFileByPath('卡片库/_数据/卡片配置.md') as Mock.TFile;
  await app.fileManager.processFrontMatter(file, fields => { fields.bw_card_settings.workbenchText = { 'book.title': '旧标题', 'future.personal': '不可丢失' }; });
  await store.refresh(); await store.saveSettings({ workbenchText: { 'book.title': '新标题' } });
  assert.ok(file.contents.includes('future.personal: 不可丢失')); assert.ok(file.contents.includes('book.title: 新标题')); store.destroy();
});
