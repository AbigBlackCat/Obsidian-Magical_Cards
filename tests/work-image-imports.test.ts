import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { App as ObsidianApp } from 'obsidian';
import type * as Mock from './obsidian-mock';
import type { Film } from '../src/types';
import { createWork, normalizeDirectorLabel, validateWork } from '../src/domain';
import { newCustomModule, readModuleDraft, removeModule } from '../src/settings';

const directory = dirname(fileURLToPath(import.meta.url));
const bundled = await build({ stdin: { contents: "export * from '../src/store'; export * from './obsidian-mock';", resolveDir: directory, loader: 'ts' }, alias: { obsidian: resolve(directory, 'obsidian-mock.ts') }, bundle: true, platform: 'node', format: 'cjs', write: false });
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const runtime = module.exports as typeof Mock & typeof import('../src/store');
type ImageVault = Mock.MemoryVault & { readBinary(file: Mock.TFile): Promise<ArrayBuffer> };
const fields = (text: string) => parse(text.match(/^---\n([\s\S]*?)\n---/)![1]) as { bw_image_import?: { collectionId: string; resource: string }; bw_data: Record<string, unknown>; [key: string]: unknown };
const png = (name = '游戏封面.PNG', bytes = [1, 2, 3, 4]) => new File([Uint8Array.from(bytes)], name, { type: 'image/png' });
const svg = (name = '说明.svg', text = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 15"><rect width="32" height="15" fill="#a0a"/></svg>') => new File([text], name, { type: 'image/svg+xml' });
async function fixture() {
  const app = new runtime.App();
  (app.vault as ImageVault).readBinary = async file => Uint8Array.from(Buffer.from(file.contents, 'base64')).buffer;
  const store = new runtime.CardsStore(app as unknown as ObsidianApp, '卡片库'); await store.initialize();
  return { app, store };
}

test('ordinary book, film and custom modules import each image into its own named work note', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  const custom = { ...newCustomModule('游戏'), id: 'games' }; await store.saveSettings({ customModules: [custom] });
  assert.equal(store.supportsWorkPropertyLabels, true);
  assert.deepEqual(await store.importWorkImages('book', [{ id: 'book-image', file: png('书名.jpg') }]), { imported: ['book-image'], failed: [] });
  assert.deepEqual(await store.importWorkImages('film', [{ id: 'film-image', file: svg() }]), { imported: ['film-image'], failed: [] });
  assert.deepEqual(await store.importWorkImages('games', [{ id: 'game-image', file: png() }]), { imported: ['game-image'], failed: [] });
  const works = store.getSnapshot().entities;
  assert.equal(works.length, 3);
  assert.deepEqual(works.map(work => [work.id, work.title, work.type, work.moduleId, work.summary]), [['book-image', '书名', 'book', undefined, ''], ['film-image', '说明', 'film', undefined, ''], ['game-image', '游戏封面', 'film', 'games', '']]);
  assert.equal(new Set(works.map(work => work.path)).size, 3);
  for (const work of works) assert.deepEqual(fields(app.vault.text(work.path)).bw_image_import, { collectionId: work.moduleId ?? work.type, resource: work.cover });
  assert.match(app.vault.text(works[1].cover), /^<svg/);
});

test('image imports partially fail and reuse written resources and stable IDs on retry', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  const original = app.vault.create.bind(app.vault); let fail = true;
  app.vault.create = async (path, text) => { if (fail && path.endsWith('-second.md')) throw new Error('模拟作品笔记保存失败'); return original(path, text); };
  const requests = [{ id: 'first', file: png('第一张.png') }, { id: 'second', file: svg('第二张.svg') }];
  const result = await store.importWorkImages('film', requests);
  assert.deepEqual(result.imported, ['first']); assert.equal(result.failed[0].id, 'second'); assert.match(result.failed[0].error, /保存失败/);
  const resource = app.vault.text('卡片库/附件/封面-second.svg'), first = store.getSnapshot().entities[0];
  await store.patchWorkProperties(first.id, { title: '我改过名称', summary: '稍后写的摘要', cover: '自己换过封面.png' }, await store.readWorkProperties(first.id));
  const before = app.vault.text(first.path); fail = false;
  assert.deepEqual(await store.importWorkImages('film', requests), { imported: ['first', 'second'], failed: [] });
  assert.equal(app.vault.text(first.path), before); assert.equal(app.vault.text('卡片库/附件/封面-second.svg'), resource);
  assert.equal(store.getSnapshot().entities.length, 2);
});

test('duplicate batch IDs and arbitrary existing work IDs do not write or overwrite resources', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  await store.save({ ...createWork('film'), id: 'owned', title: '已有卡片', summary: '已有摘要' });
  const before = app.vault.dump();
  const result = await store.importWorkImages('film', [{ id: 'duplicate', file: png() }, { id: 'duplicate', file: svg() }, { id: 'owned', file: png() }, { id: '../escape', file: png() }]);
  assert.deepEqual(result.imported, []); assert.equal(result.failed.length, 4); assert.deepEqual(app.vault.dump(), before);
});

test('retry verifies original resource bytes and cannot restore a moved or deleted image', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  await store.importWorkImages('film', [{ id: 'one', file: png() }]); const before = app.vault.dump();
  const conflict = await store.importWorkImages('film', [{ id: 'one', file: png('别名.png', [9, 9]) }]);
  assert.match(conflict.failed[0].error, /不同内容/); assert.deepEqual(app.vault.dump(), before);
  app.vault.files.delete('卡片库/附件/封面-one.png'); const missing = app.vault.dump();
  const retry = await store.importWorkImages('film', [{ id: 'one', file: png() }]);
  assert.match(retry.failed[0].error, /移动或删除/); assert.deepEqual(app.vault.dump(), missing);
});

test('orphaned stable resources are reused but different bytes and directory conflicts stay untouched', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  await app.vault.createFolder('卡片库/附件');
  await app.vault.createBinary('卡片库/附件/封面-retry.png', await png().arrayBuffer());
  await app.vault.createBinary('卡片库/附件/封面-conflict.png', await png('不同.png', [9]).arrayBuffer());
  await app.vault.createFolder('卡片库/附件/封面-folder.png');
  const beforeConflict = app.vault.text('卡片库/附件/封面-conflict.png');
  const result = await store.importWorkImages('film', [{ id: 'retry', file: png() }, { id: 'conflict', file: png() }, { id: 'folder', file: png() }]);
  assert.deepEqual(result.imported, ['retry']); assert.equal(result.failed.length, 2); assert.equal(app.vault.text('卡片库/附件/封面-conflict.png'), beforeConflict);
});

test('mixed SVG and raster imports reject executable SVG, unsupported and oversized files', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  const unsafe = svg('坏.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const result = await store.importWorkImages('film', [{ id: 'safe', file: svg() }, { id: 'unsafe', file: unsafe }, { id: 'text', file: new File(['文本'], '记录.txt') }, { id: 'large', file: new File([new Uint8Array(10 * 1024 * 1024 + 1)], '大.png') }, { id: 'unicode-svg', file: svg('大.svg', '<svg xmlns="http://www.w3.org/2000/svg"><text>' + '字'.repeat(700_000) + '</text></svg>') }]);
  assert.deepEqual(result.imported, ['safe']); assert.equal(result.failed.length, 4);
  assert.equal(app.vault.getAbstractFileByPath('卡片库/附件/封面-unsafe.svg'), null);
  assert.match(result.failed.at(-1)!.error, /2 MB/);
  await assert.rejects(store.attachCover(svg('大.svg', '<svg xmlns="http://www.w3.org/2000/svg"><text>' + '字'.repeat(700_000) + '</text></svg>')), /2 MB/);
});

test('deleted ordinary modules and showcases reject imports while originals remain intact', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  const ordinary = { ...newCustomModule('普通'), id: 'ordinary' }, showcase = { ...newCustomModule('橱窗'), id: 'photos', mode: 'showcase' as const, showcaseNote: '卡片库/橱窗/photos/橱窗.md' };
  await store.saveSettings({ customModules: [ordinary, showcase] });
  await removeModule(store, 'ordinary', readModuleDraft(store.getSnapshot().settings, 'ordinary')!);
  await removeModule(store, 'book', readModuleDraft(store.getSnapshot().settings, 'book')!);
  const before = app.vault.dump();
  for (const id of ['ordinary', 'book', 'photos', 'missing']) {
    const result = await store.importWorkImages(id, [{ id: `card-${id}`, file: png() }]); assert.deepEqual(result.imported, []); assert.equal(result.failed.length, 1);
  }
  assert.deepEqual(app.vault.dump(), before);
});

test('external module deletion during file decoding blocks note and resource creation', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  const ordinary = { ...newCustomModule('普通'), id: 'ordinary' }; await store.saveSettings({ customModules: [ordinary] });
  const file = app.vault.getAbstractFileByPath('卡片库/_数据/卡片配置.md') as Mock.TFile, upload = png();
  upload.arrayBuffer = async () => { await app.fileManager.processFrontMatter(file, fm => { fm.bw_card_settings.customModules = []; fm.bw_card_settings.deletedModuleIds = ['ordinary']; }); return new Uint8Array([1, 2, 3, 4]).buffer; };
  const result = await store.importWorkImages('ordinary', [{ id: 'late', file: upload }]);
  assert.match(result.failed[0].error, /已删除/); assert.equal(store.getSnapshot().entities.length, 0); assert.equal(app.vault.getAbstractFileByPath('卡片库/附件/封面-late.png'), null);
});

test('external type changes after image creation preserve image and reject work note creation', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  const ordinary = { ...newCustomModule('普通'), id: 'ordinary' }; await store.saveSettings({ customModules: [ordinary] });
  const file = app.vault.getAbstractFileByPath('卡片库/_数据/卡片配置.md') as Mock.TFile, create = app.vault.createBinary.bind(app.vault);
  app.vault.createBinary = async (path, content) => { const result = await create(path, content); await app.fileManager.processFrontMatter(file, fm => { fm.bw_card_settings.customModules[0].kind = 'book'; }); return result; };
  const result = await store.importWorkImages('ordinary', [{ id: 'late', file: png() }]);
  assert.match(result.failed[0].error, /类型已变化/); assert.equal(store.getSnapshot().entities.length, 0); assert.ok(app.vault.getAbstractFileByPath('卡片库/附件/封面-late.png'));
});

test('duplicate stored work IDs block retry without overwriting either note', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  await store.importWorkImages('film', [{ id: 'one', file: png() }]); const work = store.getSnapshot().entities[0];
  await app.vault.create('卡片库/另一篇.md', app.vault.text(work.path)); const before = app.vault.dump();
  const result = await store.importWorkImages('film', [{ id: 'one', file: png() }]);
  assert.match(result.failed[0].error, /ID 重复/); assert.deepEqual(app.vault.dump(), before);
});

test('a failed note read blocks duplicate-ID scanning and leaves all data unchanged until retry', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  await store.save({ ...createWork('film'), id: 'occupied', title: '原卡片', summary: '原摘要' });
  const work = store.getSnapshot().entities[0], before = app.vault.dump(), read = app.vault.read.bind(app.vault);
  let fail = true;
  app.vault.read = async file => { if (fail && file.path === work.path) throw new Error('模拟作品笔记读取失败'); return read(file); };
  const request = [{ id: 'occupied', file: png('不同标题.png') }];
  const result = await store.importWorkImages('film', request);
  assert.match(result.failed[0].error, /读取失败/); assert.deepEqual(result.imported, []); assert.deepEqual(app.vault.dump(), before);
  fail = false;
  const retry = await store.importWorkImages('film', request);
  assert.match(retry.failed[0].error, /其他卡片使用/); assert.deepEqual(app.vault.dump(), before); assert.equal(store.getSnapshot().entities.length, 1);
});

test('concurrent imports serialize and retries never duplicate work notes', async t => {
  const { store } = await fixture(); t.after(() => store.destroy()); const request = [{ id: 'one', file: png() }];
  const results = await Promise.all([store.importWorkImages('film', request), store.importWorkImages('film', request)]);
  assert.deepEqual(results, [{ imported: ['one'], failed: [] }, { imported: ['one'], failed: [] }]); assert.equal(store.getSnapshot().entities.length, 1);
});

test('film label patches remain independent and merge while preserving dates, status, unknown metadata and body', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  const one = { ...createWork('film'), id: 'one', date: '2026-10-01', status: 'finished' as const }, two = { ...createWork('film'), id: 'two' }; await store.save(one); await store.save(two);
  const baseline = await store.readWorkProperties('one'); assert.equal(baseline.values.directorLabel, '导演');
  const file = app.vault.getAbstractFileByPath(baseline.path) as Mock.TFile;
  await app.fileManager.processFrontMatter(file, fm => { fm.extra = '未知顶层'; fm.bw_data.future = '未知字段'; }); file.contents += '\n自由正文保留\n';
  await store.patchWorkProperties('one', { directorLabel: ' 开发商 ' }, baseline);
  await store.patchWorkProperties('one', { director: '团队名称', summary: '作品摘要' }, baseline);
  const read = await store.readWorkProperties('one'); assert.equal(read.values.directorLabel, '开发商'); assert.equal(read.values.director, '团队名称'); assert.equal((await store.readWorkProperties('two')).values.directorLabel, '导演');
  const saved = fields(file.contents); assert.equal(saved.bw_data.date, '2026-10-01'); assert.equal(saved.bw_data.status, 'finished'); assert.equal(saved.bw_data.future, '未知字段'); assert.equal(saved.extra, '未知顶层'); assert.ok(file.contents.endsWith('自由正文保留\n'));
  const before = file.contents; await assert.rejects(store.patchWorkProperties('one', { directorLabel: '旧标签覆盖' }, baseline), /其他窗口/); assert.equal(file.contents, before);
  await store.patchWorkProperties('one', { directorLabel: '   ' }, read); assert.equal((await store.readWorkProperties('one')).values.directorLabel, '导演');
});

test('label validation rejects multiline and oversized values; book properties cannot accept film labels', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  const film = createWork('film'), book = createWork('book'); await store.save(film); await store.save(book); const baseline = await store.readWorkProperties(film.id), before = app.vault.dump();
  for (const label of ['行一\n行二', '行一\r行二', '制\t作', '字'.repeat(41), '行\u2028间']) await assert.rejects(store.patchWorkProperties(film.id, { directorLabel: label }, baseline), /单行|40/);
  await assert.rejects(store.patchWorkProperties(book.id, { directorLabel: '作者' }, await store.readWorkProperties(book.id)), /不能修改/);
  assert.deepEqual(app.vault.dump(), before); assert.equal(normalizeDirectorLabel(''), '导演'); assert.equal(normalizeDirectorLabel('字'.repeat(40)), '字'.repeat(40));
  assert.throws(() => validateWork({ ...film, directorLabel: '\n' }), /单行/);
});

test('native conflicting work buffers block label saves and full saves normalize supplied labels', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  await store.save({ ...createWork('film'), id: 'one', directorLabel: ' 开发商 ' }); const baseline = await store.readWorkProperties('one'); assert.equal(baseline.values.directorLabel, '开发商');
  const file = app.vault.getAbstractFileByPath(baseline.path) as Mock.TFile, before = file.contents;
  app.markdownViews = [{ file, getViewData: () => file.contents + '草稿一', save: async () => {} }, { file, getViewData: () => file.contents + '草稿二', save: async () => {} }];
  await assert.rejects(store.patchWorkProperties('one', { directorLabel: '制作组' }, baseline), /窗口内容不一致/); assert.equal(file.contents, before);
  app.markdownViews = []; const entity = store.getSnapshot().entities[0] as Film; await store.save({ ...entity, directorLabel: '' }); assert.equal((await store.readWorkProperties('one')).values.directorLabel, '导演');
});
