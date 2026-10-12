import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { App as ObsidianApp } from 'obsidian';
import type * as Mock from './obsidian-mock';
import type { CardsAPI, CardsDashboard } from '../src/types';
import { createDashboard, deleteDashboard, readDashboards, saveDashboard, saveDashboardOrder, validDashboards } from '../src/dashboards';
import { newModuleDraft, readCardsSettings, validateCardsPatch } from '../src/settings';

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
const fields = (text: string) => parse(text.match(/^---\n([\s\S]*?)\n---/)![1]) as { extra?: unknown; bw_card_settings: Record<string, any> };
const current = (api: CardsAPI, id: string) => structuredClone(api.getSnapshot().settings.dashboards!.find(board => board.id === id)!);

test('dashboard data is optional, validates identifiers and duplicates, and retains future fields and missing references', () => {
  assert.equal(readCardsSettings(undefined).dashboards, undefined);
  const valid = { id: 'photos-board', title: '图片与阅读', moduleIds: ['book', 'missing-module'], future: { color: 'violet' } };
  const read = readDashboards([valid]);
  assert.deepEqual(read, [valid]);
  read[0].moduleIds.reverse();
  assert.deepEqual(valid.moduleIds, ['book', 'missing-module']);
  for (const value of [null, [{ ...valid, id: 'all' }], [{ ...valid, id: '../unsafe' }], [{ ...valid, moduleIds: ['book', 'book'] }], [{ ...valid, moduleIds: ['book\nfilm'] }], [{ ...valid, title: '  ' }], [valid, valid]]) {
    assert.equal(validDashboards(value), false);
    assert.throws(() => readCardsSettings({ dashboards: value }), /看板设置无效/);
    assert.throws(() => validateCardsPatch({ dashboards: value as CardsDashboard[] }), /看板设置无效/);
  }
});

test('ordinary and showcase creation drafts have independent identities and fixed default types', () => {
  const ordinary = newModuleDraft(), showcase = newModuleDraft('showcase'), another = newModuleDraft('showcase');
  assert.equal(ordinary.mode, undefined); assert.equal(ordinary.appearance.flipEnabled, undefined);
  assert.equal(showcase.mode, 'showcase'); assert.equal(showcase.appearance.flipEnabled, true); assert.equal(showcase.appearance.namePosition, 'back');
  assert.equal(showcase.appearance.imageFit, 'cover'); assert.equal(showcase.appearance.layout, 'skewed-carousel');
  assert.notEqual(showcase.id, ordinary.id); assert.notEqual(showcase.id, another.id);
  showcase.appearance.ratio = '1:1'; assert.equal(another.appearance.ratio, '2:3');
});

test('dashboard CRUD only changes configuration and preserves unknown properties, body, global ordering and hidden membership', async t => {
  const { app, store, file } = await fixture(); t.after(() => store.destroy());
  assert.equal(store.supportsDashboards, true);
  await store.saveSettings({ standaloneOrder: ['film', 'book'], hiddenModuleIds: ['film'] });
  const unrelated = await app.vault.create('卡片库/我的笔记.md', '# 独立正文\n');
  const one = createDashboard('收藏', ['film', 'book', 'missing-module']), two = createDashboard('阅读', ['book']);
  await saveDashboard(store, one, null); await saveDashboard(store, two, null);
  await app.fileManager.processFrontMatter(file, fm => { fm.extra = '保留'; fm.bw_card_settings.future = { value: 3 }; fm.bw_card_settings.dashboards[0].future = { retained: true }; });
  file.contents += '\n我的配置说明\n'; await store.refresh();
  const baseline = current(store, one.id);
  // A caller that only knows the public fields must not erase future properties.
  await store.saveSettings({ dashboards: [{ id: one.id, title: '改名', moduleIds: baseline.moduleIds }, current(store, two.id)] });
  assert.deepEqual(fields(file.contents).bw_card_settings.dashboards[0].future, { retained: true });
  await deleteDashboard(store, current(store, two.id));
  assert.deepEqual(store.getSnapshot().settings.dashboards?.[0].moduleIds, ['film', 'book', 'missing-module']);
  assert.deepEqual(store.getSnapshot().settings.standaloneOrder, ['film', 'book']); assert.deepEqual(store.getSnapshot().settings.hiddenModuleIds, ['film']);
  assert.equal(fields(file.contents).extra, '保留'); assert.deepEqual(fields(file.contents).bw_card_settings.future, { value: 3 });
  assert.ok(file.contents.endsWith('我的配置说明\n')); assert.equal(unrelated.contents, '# 独立正文\n');
  assert.deepEqual(Object.keys(app.vault.dump()).sort(), ['卡片库/_数据/卡片配置.md', '卡片库/我的笔记.md']);
});

test('editing one dashboard merges other dashboard changes and latest unknown fields but rejects competing target edits', async t => {
  const { app, store, file } = await fixture(); t.after(() => store.destroy());
  const one = createDashboard('一', ['book']), two = createDashboard('二', ['film']);
  const storedOne = { ...one, future: 'old' };
  await store.saveSettings({ dashboards: [storedOne, two] });
  const baseline = current(store, one.id), draft = { ...baseline, title: '新的看板一' };
  await app.fileManager.processFrontMatter(file, fm => { fm.bw_card_settings.dashboards[0].future = 'latest'; fm.bw_card_settings.dashboards[1].title = '外部修改二'; });
  await store.refresh(); await saveDashboard(store, draft, baseline);
  assert.equal(store.getSnapshot().settings.dashboards?.[1].title, '外部修改二');
  assert.equal(fields(file.contents).bw_card_settings.dashboards[0].future, 'latest');
  const expected = current(store, one.id), pending = { ...expected, title: '待保存草稿' }, retained = structuredClone(pending);
  await store.saveSettings({ dashboards: store.getSnapshot().settings.dashboards!.map(board => board.id === one.id ? { ...board, moduleIds: ['book', 'film'] } : board) });
  const before = file.contents;
  await assert.rejects(saveDashboard(store, pending, expected), /其他位置修改.*草稿已保留/);
  await assert.rejects(deleteDashboard(store, expected), /其他位置修改.*删除已取消/);
  assert.equal(file.contents, before); assert.deepEqual(pending, retained);
});

test('dashboard ordering keeps complete membership including hidden or missing modules and never changes the complete library order', async t => {
  const { store, file } = await fixture(); t.after(() => store.destroy());
  const board = createDashboard('顺序', ['book', 'hidden', 'film', 'missing']);
  await store.saveSettings({ dashboards: [board], standaloneOrder: ['book', 'film'], hiddenModuleIds: ['hidden'] });
  await saveDashboardOrder(store, board, ['film', 'hidden', 'book', 'missing']);
  assert.deepEqual(store.getSnapshot().settings.dashboards?.[0].moduleIds, ['film', 'hidden', 'book', 'missing']);
  assert.deepEqual(store.getSnapshot().settings.standaloneOrder, ['book', 'film']);
  const before = file.contents, expected = current(store, board.id);
  await assert.rejects(saveDashboardOrder(store, expected, ['film', 'book']), /成员已改变/);
  await assert.rejects(saveDashboardOrder(store, expected, ['film', 'hidden', 'book', 'book']), /成员已改变/);
  assert.equal(file.contents, before);
});

test('queued dashboard edits reject stale arrays without losing an earlier commit and can retry against the unchanged target baseline', async t => {
  const { store } = await fixture(); t.after(() => store.destroy());
  const one = createDashboard('一', ['book']), two = createDashboard('二', ['film']); await store.saveSettings({ dashboards: [one, two] });
  const results = await Promise.allSettled([saveDashboard(store, { ...one, title: '改一' }, one), saveDashboard(store, { ...two, title: '改二' }, two)]);
  assert.equal(results[0].status, 'fulfilled'); assert.equal(results[1].status, 'rejected');
  if (results[1].status === 'rejected') assert.match(String(results[1].reason), /其他窗口/);
  assert.deepEqual(store.getSnapshot().settings.dashboards?.map(board => board.title), ['改一', '二']);
  await saveDashboard(store, { ...two, title: '改二' }, two);
  assert.deepEqual(store.getSnapshot().settings.dashboards?.map(board => board.title), ['改一', '改二']);
});

test('native competing buffers, persisted malformed dashboards and external configuration changes are never overwritten', async t => {
  const { app, store, file } = await fixture(); t.after(() => store.destroy());
  const board = createDashboard('原有', ['book']); await saveDashboard(store, board, null);
  let forced = false;
  app.markdownViews = [{ file, getViewData: () => file.contents + '窗口一', save: async () => { forced = true; } }, { file, getViewData: () => file.contents + '窗口二', save: async () => { forced = true; } }];
  const original = file.contents;
  await assert.rejects(saveDashboard(store, { ...board, title: '草稿' }, board), /窗口内容不一致/);
  assert.equal(file.contents, original); assert.equal(forced, false); app.markdownViews = [];
  await app.fileManager.processFrontMatter(file, fm => { fm.bw_card_settings.dashboards[0].title = '原生修改'; });
  const changed = file.contents; await assert.rejects(saveDashboard(store, { ...board, title: '草稿' }, board), /其他窗口/); assert.equal(file.contents, changed);
  await app.fileManager.processFrontMatter(file, fm => { fm.bw_card_settings.dashboards.push({ ...fm.bw_card_settings.dashboards[0] }); });
  const damaged = file.contents; await assert.rejects(store.saveSettings({ threeCardView: true }), /看板设置无效/); assert.equal(file.contents, damaged);
  const reloaded = new runtime.CardsStore(app as unknown as ObsidianApp, '卡片库'); t.after(() => reloaded.destroy());
  await assert.rejects(reloaded.initialize(), /看板设置无效/); assert.equal(file.contents, damaged);
});

test('create and delete retries are idempotent after an acknowledged write is lost, and old APIs are left intact', async t => {
  const { store, file } = await fixture(); t.after(() => store.destroy());
  const save = store.saveSettings; let writes = 0, failAfter = true;
  store.saveSettings = async patch => { writes++; await save(patch); if (failAfter) { failAfter = false; throw new Error('确认失败'); } };
  const draft = createDashboard('重试', ['book']), preserved = structuredClone(draft);
  await assert.rejects(saveDashboard(store, draft, null), /确认失败/); assert.deepEqual(draft, preserved);
  await saveDashboard(store, draft, null); assert.equal(writes, 1); assert.equal(store.getSnapshot().settings.dashboards?.length, 1);
  await deleteDashboard(store, draft); await deleteDashboard(store, draft); assert.equal(writes, 2);
  const before = file.contents, old = Object.create(store) as CardsAPI; Object.defineProperty(old, 'supportsDashboards', { value: undefined });
  await assert.rejects(saveDashboard(old, draft, null), /升级已启用/); assert.equal(file.contents, before); assert.equal(store.supportsDashboards, true);
});
