import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { App as ObsidianApp } from 'obsidian';
import { createWork } from '../src/domain';
import { entityFields, entityFromFields, safeFilePart, validFolder } from '../src/persistence';
import { decodeSvgDataUrl, staticCoverSvg } from '../src/covers';
import type * as Mock from './obsidian-mock';

const directory = dirname(fileURLToPath(import.meta.url));
const bundle = await build({ stdin: { contents: "export * from '../src/cover-reader';export * from './obsidian-mock';", resolveDir: directory, loader: 'ts' }, alias: { obsidian: resolve(directory, 'obsidian-mock.ts') }, bundle: true, platform: 'node', format: 'cjs', write: false });
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const runtime = module.exports as typeof Mock & typeof import('../src/cover-reader');
const asApp = (app: Mock.App) => app as unknown as ObsidianApp;
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><title>离线封面</title><circle r="3"><animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite"/></circle></svg>';

test('SVG data URLs decode UTF-8 original text without network requests', async () => {
  const app = new runtime.App(); let requests = 0;
  runtime.setRequestHandler(async () => { requests++; throw new Error('Unexpected network request'); });
  for (const url of [`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`]) {
    assert.equal(decodeSvgDataUrl(url), svg);
    assert.equal(await runtime.readCoverSvg(asApp(app), url), svg);
  }
  assert.equal(requests, 0);
  assert.throws(() => decodeSvgDataUrl('data:image/png;base64,AAAA'), /数据地址无效/);
  assert.throws(() => decodeSvgDataUrl('data:image/svg+xml,%ZZ'), URIError);
});

test('local SVG references resolve through Vault using the source note path', async () => {
  const app = new runtime.App(); let requests = 0;
  runtime.setRequestHandler(async () => { requests++; throw new Error('Unexpected network request'); });
  await app.vault.create('阅读/封面.svg', svg);
  await app.vault.create('影视/封面.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await app.vault.create('阅读/照片.png', 'image bytes');
  assert.equal(await runtime.readCoverSvg(asApp(app), '![[封面.svg|封面]]', '阅读/书籍.md'), svg);
  assert.equal(await runtime.readCoverSvg(asApp(app), '![封面](阅读/封面.svg)'), svg);
  await assert.rejects(runtime.readCoverSvg(asApp(app), '阅读/照片.png'), /SVG 封面文件不存在/);
  await assert.rejects(runtime.readCoverSvg(asApp(app), '阅读/不存在.svg'), /SVG 封面文件不存在/);
  assert.equal(requests, 0);
});

test('only HTTP and HTTPS use the Obsidian network API and unsuccessful responses reject', async () => {
  const app = new runtime.App(), requests: Mock.RequestOptions[] = [];
  runtime.setRequestHandler(async options => { requests.push(options); return { status: options.url.endsWith('missing.svg') ? 404 : 200, json: null, text: svg }; });
  assert.equal(await runtime.readCoverSvg(asApp(app), 'https://example.test/cover.svg'), svg);
  assert.equal(await runtime.readCoverSvg(asApp(app), 'http://example.test/cover.svg'), svg);
  await assert.rejects(runtime.readCoverSvg(asApp(app), 'https://example.test/missing.svg'), /封面读取失败/);
  assert.deepEqual(requests, ['https://example.test/cover.svg', 'http://example.test/cover.svg', 'https://example.test/missing.svg'].map(url => ({ url, method: 'GET', throw: false })));
});

test('resource URLs and blob URLs are never sent to requestUrl or converted back into Vault paths', async () => {
  const app = new runtime.App(); let requests = 0;
  runtime.setRequestHandler(async () => { requests++; throw new Error('Unexpected network request'); });
  for (const source of ['app://resource/cover.svg', 'blob:cover.svg', 'file:///cover.svg', 'data:image/png;base64,AAAA']) await assert.rejects(runtime.readCoverSvg(asApp(app), source), /不能作为库内 SVG/);
  assert.equal(requests, 0);
});

test('reduced motion strips declarative animation and continues rejecting executable SVG', () => {
  assert.doesNotMatch(staticCoverSvg(svg), /<animate/);
  assert.match(staticCoverSvg(svg), /离线封面/);
  assert.throws(() => staticCoverSvg('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'), /不支持的元素/);
});

test('typed YAML text and control-character handling preserve existing coercion and path rules', () => {
  const work = createWork('book');
  for (const value of ['旧标题', 42, true, ['第一', null, ['第二', 3]], { old: 'value' }, new Date('2026-10-11T00:00:00Z')]) {
    const fields = { ...entityFields(work), bw_title: value, bw_created: value, bw_updated: value };
    const loaded = entityFromFields(fields, '书籍.md', '')!;
    assert.equal(loaded.title, String(value)); assert.equal(loaded.createdAt, String(value)); assert.equal(loaded.updatedAt, String(value));
  }
  assert.equal(validFolder('卡片库/正常目录'), true);
  for (let code = 0; code < 32; code++) {
    const character = String.fromCharCode(code);
    assert.equal(validFolder(`卡片${character}库`), false);
    assert.equal(safeFilePart(`卡片${character}库`), '卡片-库');
  }
  assert.equal(safeFilePart('封面[]:#.png'), '封面----.png');
});

test('cyclic YAML aliases and uncoercible metadata retain native String behavior', () => {
  const fields = entityFields(createWork('book')), cyclic: unknown[] = ['历史文字']; cyclic.push(cyclic);
  assert.equal(entityFromFields({ ...fields, bw_title: cyclic }, '书籍.md', '')!.title, String(cyclic));
  const invalid = { toString: null };
  assert.throws(() => String(invalid), TypeError);
  assert.throws(() => entityFromFields({ ...fields, bw_title: invalid }, '书籍.md', ''), TypeError);
});
