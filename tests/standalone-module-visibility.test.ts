import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { App as ObsidianApp } from 'obsidian';
import type * as Mock from './obsidian-mock';
import type { CardsAPI } from '../src/types';
import { createWork } from '../src/domain';
import { createDashboard, saveDashboard } from '../src/dashboards';
import { newCustomModule, readCardsSettings, setStandaloneModuleHidden, validateCardsPatch } from '../src/settings';

const directory = dirname(fileURLToPath(import.meta.url));
const bundled = await build({ stdin: { contents: "export * from '../src/store'; export * from './obsidian-mock';", resolveDir: directory, loader: 'ts' }, alias: { obsidian: resolve(directory, 'obsidian-mock.ts') }, bundle: true, platform: 'node', format: 'cjs', write: false });
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const runtime = module.exports as typeof Mock & typeof import('../src/store');
async function fixture() {
  const app = new runtime.App(), store = new runtime.CardsStore(app as unknown as ObsidianApp, '卡片库');
  await store.initialize();
  const file = app.vault.getAbstractFileByPath('卡片库/_数据/卡片配置.md');
  assert.ok(file instanceof runtime.TFile);
  return { app, store, file };
}
const fields = (text: string) => parse(text.match(/^---\n([\s\S]*?)\n---/)![1]) as { extra?: unknown; bw_card_settings: Record<string, unknown> };
const withoutLocalVisibility = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'standaloneHiddenModuleIds'));

test('standalone hidden IDs are optional, copied, unique safe IDs and never defaulted into old configurations', async t => {
  const absent = readCardsSettings(undefined);
  assert.equal(absent.standaloneHiddenModuleIds, undefined);
  assert.equal(Object.hasOwn(absent, 'standaloneHiddenModuleIds'), false);
  const values = ['book', 'future-module'], read = readCardsSettings({ standaloneHiddenModuleIds: values });
  assert.deepEqual(read.standaloneHiddenModuleIds, values);
  read.standaloneHiddenModuleIds!.reverse(); assert.deepEqual(values, ['book', 'future-module']);
  assert.deepEqual(readCardsSettings({ standaloneHiddenModuleIds: [] }).standaloneHiddenModuleIds, []);
  for (const value of [undefined, null, {}, ['book', 'book'], [''], [' book '], ['../unsafe'], ['book\nfilm'], [1]]) {
    assert.throws(() => readCardsSettings({ standaloneHiddenModuleIds: value }), /独立卡片页.*标识无效/);
    assert.throws(() => validateCardsPatch({ standaloneHiddenModuleIds: value as string[] }), /独立卡片页.*标识无效/);
  }
  const { store, file } = await fixture(); t.after(() => store.destroy());
  assert.equal(store.supportsStandaloneModuleVisibility, true);
  await store.saveSettings({ threeCardView: true });
  assert.equal(Object.hasOwn(fields(file.contents).bw_card_settings, 'standaloneHiddenModuleIds'), false);
});

test('standalone hide and restore only write their field and preserve global visibility, board membership, orders, unknown data and all work files', async t => {
  const { app, store, file } = await fixture(); t.after(() => store.destroy());
  const photos = { ...newCustomModule('图片'), id: 'photos' }, board = createDashboard('已有分类', ['book', 'photos', 'film']);
  await store.saveSettings({ customModules: [photos], dashboards: [board], standaloneOrder: ['photos', 'film', 'book'], hiddenModuleIds: ['book'], workbenchCards: [{ module: 'photos', before: 'actions' }] });
  const cover = await app.vault.create('卡片库/原始图片.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>\n');
  await store.save({ ...createWork('book'), title: '原作品', cover: cover.path });
  await store.save({ ...createWork('film'), title: '自定义作品', moduleId: photos.id, cover: cover.path });
  await app.fileManager.processFrontMatter(file, fm => { fm.extra = '保留'; fm.bw_card_settings.future = { retained: true }; fm.bw_card_settings.dashboards[0].future = '未知分类属性'; });
  file.contents += '\n原有配置说明\n'; await store.refresh();
  const original = fields(file.contents), workFiles = Object.fromEntries(Object.entries(app.vault.dump()).filter(([path]) => path !== file.path));
  const patches: string[][] = [], save = store.saveSettings;
  store.saveSettings = patch => { patches.push(Object.keys(patch)); return save(patch); };
  await setStandaloneModuleHidden(store, 'book', true);
  await setStandaloneModuleHidden(store, 'photos', true);
  assert.deepEqual(store.getSnapshot().settings.standaloneHiddenModuleIds, ['book', 'photos']);
  await setStandaloneModuleHidden(store, 'book', false);
  assert.deepEqual(store.getSnapshot().settings.standaloneHiddenModuleIds, ['photos']);
  await setStandaloneModuleHidden(store, 'photos', false);
  assert.deepEqual(store.getSnapshot().settings.standaloneHiddenModuleIds, []);
  assert.deepEqual(patches, Array.from({ length: 4 }, () => ['standaloneHiddenModuleIds']));
  assert.deepEqual(withoutLocalVisibility(fields(file.contents).bw_card_settings), withoutLocalVisibility(original.bw_card_settings));
  assert.equal(fields(file.contents).extra, original.extra); assert.ok(file.contents.endsWith('原有配置说明\n'));
  assert.deepEqual(Object.fromEntries(Object.entries(app.vault.dump()).filter(([path]) => path !== file.path)), workFiles);
});

test('old APIs without the visibility capability and missing modules cannot mutate any configuration', async t => {
  const { app, store, file } = await fixture(); t.after(() => store.destroy());
  const before = app.vault.dump(), old = Object.create(store) as CardsAPI;
  Object.defineProperty(old, 'supportsStandaloneModuleVisibility', { value: undefined });
  await assert.rejects(setStandaloneModuleHidden(old, 'book', true), /升级已启用.*兼容卡片插件/);
  await assert.rejects(setStandaloneModuleHidden(store, 'missing-module', true), /模块已改变/);
  assert.deepEqual(app.vault.dump(), before); assert.equal(store.supportsStandaloneModuleVisibility, true);
  assert.equal(Object.hasOwn(fields(file.contents).bw_card_settings, 'standaloneHiddenModuleIds'), false);
});

test('queued standalone visibility writes reject stale arrays, retain the first commit, and retry without losing it', async t => {
  const { store } = await fixture(); t.after(() => store.destroy());
  const results = await Promise.allSettled([setStandaloneModuleHidden(store, 'book', true), setStandaloneModuleHidden(store, 'film', true)]);
  assert.equal(results[0].status, 'fulfilled'); assert.equal(results[1].status, 'rejected');
  if (results[1].status === 'rejected') assert.match(String(results[1].reason), /其他窗口/);
  assert.deepEqual(store.getSnapshot().settings.standaloneHiddenModuleIds, ['book']);
  await setStandaloneModuleHidden(store, 'film', true);
  assert.deepEqual(store.getSnapshot().settings.standaloneHiddenModuleIds, ['book', 'film']);
  const board = createDashboard('并行分类', ['book']);
  const independent = await Promise.allSettled([setStandaloneModuleHidden(store, 'book', false), saveDashboard(store, board, null)]);
  assert.deepEqual(independent.map(result => result.status), ['fulfilled', 'fulfilled']);
  assert.deepEqual(store.getSnapshot().settings.standaloneHiddenModuleIds, ['film']);
  assert.deepEqual(store.getSnapshot().settings.dashboards, [board]);
});

test('external standalone visibility changes and malformed persisted values are not overwritten or silently discarded', async t => {
  const { app, store, file } = await fixture(); t.after(() => store.destroy());
  await store.saveSettings({ standaloneHiddenModuleIds: ['book'] });
  await app.fileManager.processFrontMatter(file, fm => { fm.bw_card_settings.standaloneHiddenModuleIds = ['film']; });
  const native = file.contents;
  await assert.rejects(setStandaloneModuleHidden(store, 'book', false), /其他窗口/);
  assert.equal(file.contents, native);
  await app.fileManager.processFrontMatter(file, fm => { fm.bw_card_settings.standaloneHiddenModuleIds = ['film', 'film']; });
  const malformed = file.contents;
  await assert.rejects(store.saveSettings({ threeCardView: true }), /独立卡片页.*标识无效/);
  assert.equal(file.contents, malformed);
  const reloaded = new runtime.CardsStore(app as unknown as ObsidianApp, '卡片库'); t.after(() => reloaded.destroy());
  await assert.rejects(reloaded.initialize(), /独立卡片页.*标识无效/);
  assert.equal(file.contents, malformed);
});
