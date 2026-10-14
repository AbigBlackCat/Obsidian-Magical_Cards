import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { App as ObsidianApp } from 'obsidian';
import type * as Mock from './obsidian-mock';
import type { CardsAPI, CardsDashboard } from '../src/types';
import { createDashboard, saveDashboardTabOrder } from '../src/dashboards';
import { newModuleDraft, readCardsSettings, readModuleDraft, saveModuleDraft, validateCardsPatch } from '../src/settings';

const directory = dirname(fileURLToPath(import.meta.url));
const bundled = await build({ stdin: { contents: "export * from '../src/store'; export * from './obsidian-mock';", resolveDir: directory, loader: 'ts' }, alias: { obsidian: resolve(directory, 'obsidian-mock.ts') }, bundle: true, platform: 'node', format: 'cjs', write: false });
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const runtime = module.exports as typeof Mock & typeof import('../src/store');
const asApp = (app: Mock.App) => app as unknown as ObsidianApp;
async function fixture() {
  const app = new runtime.App(), store = new runtime.CardsStore(asApp(app), '卡片库'); await store.initialize();
  const file = app.vault.getAbstractFileByPath('卡片库/_数据/卡片配置.md'); assert.ok(file instanceof runtime.TFile);
  return { app, store, file };
}
const boards = (api: CardsAPI) => structuredClone(api.getSnapshot().settings.dashboards ?? []);

test('Dashboard navigation versions are explicit and unsupported values preserve the existing config', () => {
  assert.equal(readCardsSettings(undefined).dashboardNavigationVersion, undefined);
  assert.equal(readCardsSettings({ dashboardNavigationVersion: 1 }).dashboardNavigationVersion, 1);
  for (const value of [0, 2, '1', null]) {
    assert.throws(() => readCardsSettings({ dashboardNavigationVersion: value }), /导航版本无效/);
    assert.throws(() => validateCardsPatch({ dashboardNavigationVersion: value as 1 }), /导航版本无效/);
  }
});

test('legacy visibility migration only unlinks historic hidden modules and preserves metadata, original files and board order', async t => {
  const f = await fixture(); f.store.destroy();
  const one = { ...createDashboard('第一类', ['book', 'film', 'hidden', 'missing']), future: { accent: '紫' } }, two = createDashboard('第二类', ['hidden', 'book']);
  const note = await f.app.vault.create('卡片库/书籍/保留.md', '# 作品正文\n'), image = await f.app.vault.create('卡片库/封面.png', '图片字节');
  await f.app.fileManager.processFrontMatter(f.file, fm => {
    fm.future = '配置外属性'; fm.bw_card_settings.future = { untouched: true };
    delete fm.bw_card_settings.dashboardNavigationVersion;
    fm.bw_card_settings.dashboards = [one, two]; fm.bw_card_settings.hiddenModuleIds = ['hidden']; fm.bw_card_settings.standaloneHiddenModuleIds = ['film']; fm.bw_card_settings.standaloneOrder = ['film', 'book'];
  }); f.file.contents += '\n用户的说明\n';
  const store = new runtime.CardsStore(asApp(f.app), '卡片库'); t.after(() => store.destroy()); await store.initialize();
  assert.equal(store.supportsDashboardOnlyNavigation, true);
  assert.deepEqual(boards(store), [{ ...one, moduleIds: ['book', 'missing'] }, { ...two, moduleIds: ['book'] }]);
  assert.deepEqual(store.getSnapshot().settings.hiddenModuleIds, []); assert.deepEqual(store.getSnapshot().settings.standaloneHiddenModuleIds, []);
  assert.equal(store.getSnapshot().settings.dashboardNavigationVersion, 1); assert.deepEqual(store.getSnapshot().settings.standaloneOrder, ['film', 'book']);
  assert.match(f.file.contents, /future: 配置外属性/); assert.match(f.file.contents, /untouched: true/); assert.ok(f.file.contents.endsWith('用户的说明\n'));
  assert.equal(note.contents, '# 作品正文\n'); assert.equal(image.contents, '图片字节');
  const before = f.app.vault.dump(); store.destroy();
  const restart = new runtime.CardsStore(asApp(f.app), '卡片库'); t.after(() => restart.destroy()); await restart.initialize();
  assert.deepEqual(f.app.vault.dump(), before); assert.equal(boards(restart).some(board => board.id === 'all'), false);
});

test('migration write failures and divergent native editors retain the entire original and permit a new initialization retry', async t => {
  for (const native of [false, true]) {
    const f = await fixture(); f.store.destroy();
    await f.app.fileManager.processFrontMatter(f.file, fm => { delete fm.bw_card_settings.dashboardNavigationVersion; fm.bw_card_settings.hiddenModuleIds = ['book']; fm.bw_card_settings.dashboards = [createDashboard('原分类', ['book', 'film'])]; });
    const before = f.file.contents, process = f.app.vault.process.bind(f.app.vault);
    if (native) f.app.markdownViews = [{ file: f.file, getViewData: () => before + '第一份草稿', save: async () => { throw new Error('不能强制保存'); } }, { file: f.file, getViewData: () => before + '第二份草稿', save: async () => { throw new Error('不能强制保存'); } }];
    else f.app.vault.process = async () => { throw new Error('模拟配置写入失败'); };
    const failed = new runtime.CardsStore(asApp(f.app), '卡片库'); t.after(() => failed.destroy());
    await assert.rejects(failed.initialize(), native ? /窗口内容不一致/ : /模拟配置写入失败/); assert.equal(f.file.contents, before); failed.destroy();
    f.app.markdownViews = []; f.app.vault.process = process;
    const retry = new runtime.CardsStore(asApp(f.app), '卡片库'); t.after(() => retry.destroy()); await retry.initialize();
    assert.deepEqual(boards(retry)[0].moduleIds, ['film']); assert.equal(retry.getSnapshot().settings.dashboardNavigationVersion, 1);
  }
});

test('tab order merges newest board names, members and unknown properties but rejects concurrent tab changes', async t => {
  const { store, app, file } = await fixture(); t.after(() => store.destroy());
  const first = createDashboard('甲', ['book']), second = createDashboard('乙', ['film']); await store.saveSettings({ dashboards: [first, second] });
  const baseline = boards(store);
  await app.fileManager.processFrontMatter(file, fm => { fm.bw_card_settings.dashboards[0].title = '最新甲'; fm.bw_card_settings.dashboards[0].moduleIds.push('film'); fm.bw_card_settings.dashboards[0].future = '保留'; }); await store.refresh();
  await saveDashboardTabOrder(store, baseline, [second.id, first.id]);
  assert.deepEqual(boards(store), [second, { ...first, title: '最新甲', moduleIds: ['book', 'film'], future: '保留' }]);
  const before = file.contents; await assert.rejects(saveDashboardTabOrder(store, baseline, [first.id, second.id]), /标签顺序.*其他位置修改/); assert.equal(file.contents, before);
  await assert.rejects(saveDashboardTabOrder(store, boards(store), [first.id]), /分类已改变/);
  await saveDashboardTabOrder(store, baseline, [second.id, first.id]); assert.equal(file.contents, before); // lost acknowledgement retry
});

test('a module and selected existing/new classifications commit once, retaining unrelated boards and note bytes', async t => {
  const { store, app, file } = await fixture(); t.after(() => store.destroy());
  const first = createDashboard('书籍', ['book']), other = createDashboard('其他', ['film']), baseline = [first, other]; await store.saveSettings({ dashboards: baseline });
  const note = await app.vault.create('卡片库/已有笔记.md', '不改正文');
  const draft = newModuleDraft(); draft.title = '番剧'; const added = createDashboard('休闲');
  const save = store.saveSettings; let writes = 0; store.saveSettings = async patch => { writes++; await save(patch); };
  await saveModuleDraft(store, draft, null, { dashboardIds: [first.id, added.id], newDashboards: [added], baselineDashboards: baseline });
  assert.equal(writes, 1); assert.equal(readModuleDraft(store.getSnapshot().settings, draft.id)?.title, '番剧');
  assert.deepEqual(boards(store), [{ ...first, moduleIds: ['book', draft.id] }, other, { ...added, moduleIds: [draft.id] }]);
  assert.equal(note.contents, '不改正文'); assert.equal(file.path, '卡片库/_数据/卡片配置.md');
  const moduleBaseline = readModuleDraft(store.getSnapshot().settings, draft.id)!;
  await saveModuleDraft(store, { ...moduleBaseline, title: '新的番剧名' }, moduleBaseline, { dashboardIds: [], newDashboards: [], baselineDashboards: boards(store) });
  assert.deepEqual(boards(store), [first, other, added]); assert.equal(readModuleDraft(store.getSnapshot().settings, draft.id)?.title, '新的番剧名');
});

test('module classification conflicts reject the whole create and keep its reusable draft', async t => {
  const { store, file } = await fixture(); t.after(() => store.destroy());
  const first = createDashboard('初始', ['book']), baseline = [first]; await store.saveSettings({ dashboards: baseline });
  const draft = newModuleDraft(); draft.title = '待保存'; const preserved = structuredClone(draft);
  await store.saveSettings({ dashboards: [{ ...first, title: '外部改名' }] }); const before = file.contents;
  await assert.rejects(saveModuleDraft(store, draft, null, { dashboardIds: [first.id], newDashboards: [], baselineDashboards: baseline }), /名称或成员.*草稿已保留/);
  assert.equal(file.contents, before); assert.deepEqual(draft, preserved); assert.equal(readModuleDraft(store.getSnapshot().settings, draft.id), null);
  await saveModuleDraft(store, draft, null, { dashboardIds: [first.id], newDashboards: [], baselineDashboards: boards(store) });
  assert.equal(boards(store)[0].title, '外部改名'); assert.deepEqual(boards(store)[0].moduleIds, ['book', draft.id]);
});

test('atomic module/classification creation is idempotent after a lost acknowledgement and rejects newly conflicting members', async t => {
  const { store, file } = await fixture(); t.after(() => store.destroy());
  const board = createDashboard('已有', ['book']); await store.saveSettings({ dashboards: [board] });
  const added = createDashboard('新分类'), draft = newModuleDraft(); draft.title = '收藏';
  const assignment = { dashboardIds: [board.id, added.id], newDashboards: [added], baselineDashboards: [board] };
  const save = store.saveSettings; let writes = 0;
  store.saveSettings = async patch => { writes++; await save(patch); throw new Error('回执丢失'); };
  await assert.rejects(saveModuleDraft(store, draft, null, assignment), /回执丢失/); const committed = file.contents;
  await saveModuleDraft(store, draft, null, assignment); assert.equal(writes, 1); assert.equal(file.contents, committed);
  store.saveSettings = save;
  await store.saveSettings({ dashboards: boards(store).map(value => value.id === board.id ? { ...value, moduleIds: [...value.moduleIds, 'film'] } : value) });
  const changed = file.contents; await assert.rejects(saveModuleDraft(store, draft, null, assignment), /名称或成员.*草稿已保留/); assert.equal(file.contents, changed);
});

test('failed showcase configuration keeps its stable note and classification draft for a single-resource retry', async t => {
  const { store, app } = await fixture(); t.after(() => store.destroy());
  const draft = newModuleDraft('showcase'); draft.title = '相册'; const board = createDashboard('图片');
  const assignment = { dashboardIds: [board.id], newDashboards: [board], baselineDashboards: [] as CardsDashboard[] };
  const save = store.saveSettings, create = store.showcase.create; let created = 0;
  store.showcase.create = async (id, title) => { created++; return create(id, title); }; store.saveSettings = async () => { throw new Error('暂时不能保存配置'); };
  await assert.rejects(saveModuleDraft(store, draft, null, assignment), /不能保存配置/); assert.ok(draft.showcaseNote); assert.equal(boards(store).length, 0);
  const bytes = app.vault.text(draft.showcaseNote), stableId = draft.id; store.saveSettings = save;
  await saveModuleDraft(store, draft, null, assignment); assert.equal(created, 1); assert.equal(draft.id, stableId); assert.equal(app.vault.text(draft.showcaseNote), bytes); assert.deepEqual(boards(store)[0].moduleIds, [stableId]);
});

test('old shared stores cannot claim Dashboard-only capabilities or receive classification writes', async t => {
  const { store, file } = await fixture(); t.after(() => store.destroy());
  const old = Object.create(store) as CardsAPI; Object.defineProperty(old, 'supportsDashboardOnlyNavigation', { value: undefined });
  const before = file.contents, draft = newModuleDraft(); draft.title = '不会偷偷分类';
  await assert.rejects(saveModuleDraft(old, draft, null, { dashboardIds: [], newDashboards: [], baselineDashboards: [] }), /升级已启用/);
  await assert.rejects(saveDashboardTabOrder(old, [], []), /升级已启用/); assert.equal(file.contents, before); assert.equal(old.supportsDashboardOnlyNavigation, undefined);
});
