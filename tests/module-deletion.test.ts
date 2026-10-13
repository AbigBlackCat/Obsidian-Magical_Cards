import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { App as ObsidianApp } from 'obsidian';
import type * as Mock from './obsidian-mock';
import type { CardsAPI, CardsSettings } from '../src/types';
import { createWork } from '../src/domain';
import { createDashboard, saveDashboard } from '../src/dashboards';
import { newCustomModule, newModuleDraft, readCardsSettings, readModuleDraft, removeModule, saveModuleDraft, setModuleHidden, setStandaloneModuleHidden, validateCardsPatch } from '../src/settings';

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
const notesExcept = (app: Mock.App, path: string) => Object.fromEntries(Object.entries(app.vault.dump()).filter(([name]) => name !== path));

test('deleted module markers are optional and reject malformed IDs instead of discarding them', async t => {
  assert.equal(Object.hasOwn(readCardsSettings(undefined), 'deletedModuleIds'), false);
  const ids = ['book', 'photos'], settings = readCardsSettings({ deletedModuleIds: ids });
  assert.deepEqual(settings.deletedModuleIds, ids);
  settings.deletedModuleIds!.reverse(); assert.deepEqual(ids, ['book', 'photos']);
  for (const value of [undefined, null, {}, ['book', 'book'], [''], [' book '], ['../photos'], [1]]) {
    assert.throws(() => readCardsSettings({ deletedModuleIds: value }), /标识无效/);
    assert.throws(() => validateCardsPatch({ deletedModuleIds: value as string[] }), /标识无效/);
  }
  const { store, file } = await fixture(); t.after(() => store.destroy());
  assert.equal(store.supportsModuleDeletion, true);
  await store.saveSettings({ threeCardView: true });
  assert.equal(Object.hasOwn(fields(file.contents).bw_card_settings, 'deletedModuleIds'), false);
});

test('ordinary module deletion atomically removes its definition and references while preserving unknown config and all work files', async t => {
  const { app, store, file } = await fixture(); t.after(() => store.destroy());
  const target = { ...newCustomModule('待移除'), id: 'removed' }, kept = { ...newCustomModule('保留'), id: 'kept' };
  const board = { ...createDashboard('分类一', ['book', target.id, kept.id]), future: '分类未知属性' };
  await store.saveSettings({ customModules: [target, kept], dashboards: [board, createDashboard('分类二', [target.id, 'film'])], standaloneOrder: ['film', target.id, kept.id, 'book'], hiddenModuleIds: [target.id, 'film'], standaloneHiddenModuleIds: ['book', target.id], workbenchCards: [{ module: target.id, before: 'gantt' }, { module: kept.id, before: 'actions' }] });
  const image = await app.vault.create('卡片库/封面.png', '原图片字节');
  await store.save({ ...createWork('film'), title: '模块作品', moduleId: target.id, cover: image.path, summary: '个人摘要' });
  await store.save({ ...createWork('book'), title: '其他作品', cover: image.path });
  await store.openWorkOrder('film');
  await app.fileManager.processFrontMatter(file, fm => { fm.extra = { keep: true }; fm.bw_card_settings.future = { keep: true }; fm.bw_card_settings.customModules[1].future = { keep: true }; fm.bw_card_settings.workbenchText.future = '原文字'; });
  file.contents += '\n原有配置说明  \n'; await store.refresh();
  const before = notesExcept(app, file.path), entities = structuredClone(store.getSnapshot().entities), baseline = readModuleDraft(store.getSnapshot().settings, target.id)!;
  const writes: string[] = [], originalProcess = app.vault.process.bind(app.vault);
  app.vault.process = async (changed, update) => { writes.push(changed.path); return originalProcess(changed, update); };
  await removeModule(store, target.id, baseline);
  assert.deepEqual(writes, [file.path]);
  const settings = store.getSnapshot().settings;
  assert.deepEqual(settings.customModules.map(item => item.id), [kept.id]); assert.equal(readModuleDraft(settings, target.id), null);
  assert.deepEqual(settings.dashboards!.map(item => item.moduleIds), [['book', kept.id], ['film']]);
  assert.deepEqual(settings.standaloneOrder, ['film', kept.id, 'book']); assert.deepEqual(settings.workbenchCards, [{ module: kept.id, before: 'actions' }]);
  assert.deepEqual(settings.hiddenModuleIds, ['film']); assert.deepEqual(settings.standaloneHiddenModuleIds, ['book']); assert.deepEqual(settings.deletedModuleIds, [target.id]);
  const saved = fields(file.contents);
  assert.deepEqual(saved.extra, { keep: true }); assert.deepEqual(saved.bw_card_settings.future, { keep: true });
  assert.deepEqual((saved.bw_card_settings.customModules as Array<Record<string, unknown>>)[0].future, { keep: true });
  assert.equal((saved.bw_card_settings.dashboards as Array<Record<string, unknown>>)[0].future, '分类未知属性');
  assert.equal((saved.bw_card_settings.workbenchText as Record<string, unknown>).future, '原文字'); assert.ok(file.contents.endsWith('原有配置说明  \n'));
  assert.deepEqual(notesExcept(app, file.path), before); assert.deepEqual(store.getSnapshot().entities, entities); assert.equal(app.trashed.size, 0);
});

test('showcase deletion preserves its note, imported images, names and descriptions byte for byte', async t => {
  const { app, store, file } = await fixture(); t.after(() => store.destroy());
  const note = await store.showcase.create('photos', '相片');
  await store.saveSettings({ customModules: [{ ...newCustomModule('相片'), id: 'photos', mode: 'showcase', showcaseNote: note }], dashboards: [createDashboard('照片分类', ['photos'])] });
  await store.showcase.importImages('photos', [{ id: 'image-one', file: new File([Uint8Array.from([1, 2, 3, 4])], '原照片.png', { type: 'image/png' }) }]);
  const card = (await store.showcase.read('photos')).cards[0];
  await store.showcase.patchCard('photos', card.id, { name: '图片名称', description: '个人描述\n第二行' }, card);
  const before = notesExcept(app, file.path), baseline = readModuleDraft(store.getSnapshot().settings, 'photos')!;
  await removeModule(store, 'photos', baseline);
  assert.deepEqual(store.getSnapshot().settings.customModules, []); assert.deepEqual(store.getSnapshot().settings.dashboards![0].moduleIds, []);
  assert.deepEqual(notesExcept(app, file.path), before); assert.ok(app.vault.text(note).includes('个人描述')); assert.equal(app.trashed.size, 0);
  await assert.rejects(store.showcase.read('photos'), /模块|移除|橱窗/);
});

test('built-in modules stay removed after restart without deleting their original works or resurrecting via restore', async t => {
  const { app, store, file } = await fixture(); t.after(() => store.destroy());
  await store.save({ ...createWork('book'), title: '保留书籍', summary: '笔记资料' });
  await store.save({ ...createWork('film'), title: '保留影片' });
  await store.saveSettings({ dashboards: [createDashboard('阅读影视', ['film', 'book'])], standaloneOrder: ['film', 'book'], workbenchText: { 'book.title': '阅读名称', 'film.title': '影视名称' } });
  const before = notesExcept(app, file.path);
  for (const id of ['book', 'film']) await removeModule(store, id, readModuleDraft(store.getSnapshot().settings, id)!);
  assert.deepEqual(store.getSnapshot().settings.deletedModuleIds, ['book', 'film']);
  const stored = fields(file.contents).bw_card_settings;
  assert.equal(Object.hasOwn(stored, 'bookCardAppearance'), false); assert.equal(Object.hasOwn(stored, 'filmCardAppearance'), false);
  assert.equal(Object.hasOwn(stored.workbenchText as object, 'book.title'), false); assert.equal(Object.hasOwn(stored.workbenchText as object, 'film.title'), false);
  await store.saveSettings({ threeCardView: true, workbenchText: { 'book.title': '旧标题回写', 'film.title': '旧标题回写' } });
  const later = fields(file.contents).bw_card_settings;
  assert.equal(Object.hasOwn(later, 'bookCardAppearance'), false); assert.equal(Object.hasOwn(later, 'filmCardAppearance'), false);
  assert.equal(Object.hasOwn(later.workbenchText as object, 'book.title'), false); assert.equal(Object.hasOwn(later.workbenchText as object, 'film.title'), false);
  const reloaded = new runtime.CardsStore(app as unknown as ObsidianApp, '卡片库'); t.after(() => reloaded.destroy()); await reloaded.initialize();
  for (const id of ['book', 'film']) {
    assert.equal(readModuleDraft(reloaded.getSnapshot().settings, id), null);
    await assert.rejects(setModuleHidden(reloaded, id, false), /模块.*改变|已移除/);
    await assert.rejects(setStandaloneModuleHidden(reloaded, id, false), /模块.*改变|已移除/);
  }
  assert.deepEqual(reloaded.getSnapshot().settings.dashboards![0].moduleIds, []); assert.deepEqual(reloaded.getSnapshot().settings.standaloneOrder, []);
  assert.deepEqual(notesExcept(app, file.path), before); assert.equal(reloaded.getSnapshot().entities.length, 2);
});

test('failed deletion retains configuration and baseline, then a retry commits once without deleting twice', async t => {
  const { app, store, file } = await fixture(); t.after(() => store.destroy());
  const target = { ...newCustomModule('失败保留'), id: 'target' }; await store.saveSettings({ customModules: [target] });
  const baseline = readModuleDraft(store.getSnapshot().settings, target.id)!, originalBaseline = structuredClone(baseline), before = app.vault.dump();
  const originalProcess = app.vault.process.bind(app.vault);
  app.vault.process = async () => { throw new Error('磁盘暂不可写'); };
  await assert.rejects(removeModule(store, target.id, baseline), /磁盘暂不可写/);
  assert.deepEqual(app.vault.dump(), before); assert.deepEqual(baseline, originalBaseline); assert.ok(readModuleDraft(store.getSnapshot().settings, target.id));
  app.vault.process = originalProcess;
  await removeModule(store, target.id, baseline); const committed = file.contents;
  await assert.rejects(removeModule(store, target.id, baseline), /已移除|模块.*改变|修改或删除|不存在/);
  assert.equal(file.contents, committed); assert.deepEqual(baseline, originalBaseline);
});

test('stale module confirmation and native configuration conflicts cancel deletion without overwriting newer choices', async t => {
  const { app, store, file } = await fixture(); t.after(() => store.destroy());
  const target = { ...newCustomModule('原名称'), id: 'target' }; await store.saveSettings({ customModules: [target] });
  const baseline = readModuleDraft(store.getSnapshot().settings, target.id)!;
  await store.saveSettings({ customModules: [{ ...target, title: '新名称' }] });
  const updated = file.contents;
  await assert.rejects(removeModule(store, target.id, baseline), /其他位置修改|已改变/); assert.equal(file.contents, updated);
  const latest = readModuleDraft(store.getSnapshot().settings, target.id)!;
  await app.fileManager.processFrontMatter(file, fm => { fm.bw_card_settings.customModules[0].title = '原生编辑名称'; });
  const native = file.contents;
  await assert.rejects(removeModule(store, target.id, latest), /其他窗口/); assert.equal(file.contents, native);
  assert.equal(readModuleDraft(store.getSnapshot().settings, target.id)!.title, '新名称');
});

test('divergent unsaved native editors prevent deletion without forcing saves or changing config', async t => {
  const { app, store, file } = await fixture(); t.after(() => store.destroy());
  const target = { ...newCustomModule('保护原生草稿'), id: 'target' }; await store.saveSettings({ customModules: [target] });
  const before = app.vault.dump(), baseline = readModuleDraft(store.getSnapshot().settings, target.id)!;
  let forced = false;
  app.markdownViews = [{ file, getViewData: () => file.contents + '窗口一草稿', save: async () => { forced = true; } }, { file, getViewData: () => file.contents + '窗口二草稿', save: async () => { forced = true; } }];
  await assert.rejects(removeModule(store, target.id, baseline), /编辑窗口内容不一致/);
  assert.deepEqual(app.vault.dump(), before); assert.equal(forced, false); assert.equal(store.getSnapshot().settings.deletedModuleIds, undefined);
});

test('built-in deletion conflicts with native appearance and title changes instead of removing an unseen edit', async t => {
  const { app, store, file } = await fixture(); t.after(() => store.destroy());
  const baseline = readModuleDraft(store.getSnapshot().settings, 'book')!;
  await app.fileManager.processFrontMatter(file, fm => { fm.bw_card_settings.bookCardAppearance.ratio = '16:9'; });
  const appearanceEdit = file.contents;
  await assert.rejects(removeModule(store, 'book', baseline), /其他窗口/); assert.equal(file.contents, appearanceEdit);
  await store.refresh(); const updated = readModuleDraft(store.getSnapshot().settings, 'book')!;
  await app.fileManager.processFrontMatter(file, fm => { fm.bw_card_settings.workbenchText['book.title'] = '原生新名称'; });
  const titleEdit = file.contents;
  await assert.rejects(removeModule(store, 'book', updated), /其他窗口/); assert.equal(file.contents, titleEdit);
  assert.equal(store.getSnapshot().settings.deletedModuleIds, undefined);
});

test('queued deletions conflict atomically and retry retains the first deletion and independent board changes', async t => {
  const { store } = await fixture(); t.after(() => store.destroy());
  const a = { ...newCustomModule('一'), id: 'first' }, b = { ...newCustomModule('二'), id: 'second' };
  const board = createDashboard('共同分类', [a.id, 'book', b.id]);
  await store.saveSettings({ customModules: [a, b], dashboards: [board], standaloneOrder: [a.id, b.id, 'book'] });
  const aBaseline = readModuleDraft(store.getSnapshot().settings, a.id)!, bBaseline = readModuleDraft(store.getSnapshot().settings, b.id)!;
  const results = await Promise.allSettled([removeModule(store, a.id, aBaseline), removeModule(store, b.id, bBaseline)]);
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected']);
  if (results[1].status === 'rejected') assert.match(String(results[1].reason), /其他窗口/);
  assert.deepEqual(store.getSnapshot().settings.customModules.map(item => item.id), [b.id]); assert.deepEqual(store.getSnapshot().settings.dashboards![0].moduleIds, ['book', b.id]);
  await removeModule(store, b.id, bBaseline);
  assert.deepEqual(store.getSnapshot().settings.deletedModuleIds, [a.id, b.id]); assert.deepEqual(store.getSnapshot().settings.dashboards![0].moduleIds, ['book']); assert.deepEqual(store.getSnapshot().settings.standaloneOrder, ['book']);
});

test('queued first dashboard, creator and initially empty order references cannot revive a removed module', async t => {
  const { store } = await fixture(); t.after(() => store.destroy());
  const target = { ...newCustomModule('待移除'), id: 'target' }; await store.saveSettings({ customModules: [target] });
  const baseline = readModuleDraft(store.getSnapshot().settings, target.id)!, creator = newModuleDraft(); creator.title = '新模块';
  const retainedCreator = structuredClone(creator);
  const results = await Promise.allSettled([
    removeModule(store, target.id, baseline),
    saveDashboard(store, createDashboard('首次分类', [target.id]), null),
    saveModuleDraft(store, creator, null),
    store.saveSettings({ standaloneOrder: [target.id] }),
    store.saveSettings({ workbenchCards: [{ module: target.id, before: 'gantt' }] }),
    store.saveSettings({ hiddenModuleIds: [target.id] }),
    store.saveSettings({ standaloneHiddenModuleIds: [target.id] }),
  ]);
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected', 'rejected', 'rejected', 'rejected', 'rejected', 'rejected']);
  for (const result of results.slice(1)) if (result.status === 'rejected') assert.match(String(result.reason), /已删除|其他窗口/);
  assert.deepEqual(store.getSnapshot().settings.customModules, []); assert.deepEqual(store.getSnapshot().settings.deletedModuleIds, [target.id]);
  assert.equal(store.getSnapshot().settings.dashboards, undefined); assert.deepEqual(store.getSnapshot().settings.standaloneOrder, []); assert.deepEqual(store.getSnapshot().settings.workbenchCards, []);
  assert.deepEqual(creator, retainedCreator); await saveModuleDraft(store, creator, null);
  assert.deepEqual(store.getSnapshot().settings.customModules.map(item => item.id), [creator.id]); assert.deepEqual(store.getSnapshot().settings.deletedModuleIds, [target.id]);
});

test('deleted module IDs cannot be reused by stale create or dashboard drafts', async t => {
  const { app, store, file } = await fixture(); t.after(() => store.destroy());
  const target = { ...newCustomModule('原模块'), id: 'target' }, board = createDashboard('原分类', [target.id, 'book']);
  await store.saveSettings({ customModules: [target], dashboards: [board] });
  const draft = readModuleDraft(store.getSnapshot().settings, target.id)!;
  await removeModule(store, target.id, draft); const before = app.vault.dump();
  await assert.rejects(saveModuleDraft(store, draft, null), /已移除|已删除/);
  await assert.rejects(saveModuleDraft(store, draft, draft), /已移除|已删除|其他位置修改/);
  await assert.rejects(saveDashboard(store, createDashboard('过时新分类', [target.id]), null), /已移除|已删除/);
  const current = store.getSnapshot().settings.dashboards![0];
  await assert.rejects(saveDashboard(store, { ...current, moduleIds: [target.id, 'book'] }, current), /已移除|已删除/);
  const stalePatches: Partial<CardsSettings>[] = [{ customModules: [target] }, { standaloneOrder: [target.id] }, { workbenchCards: [{ module: target.id, before: 'gantt' }] }, { hiddenModuleIds: [target.id] }, { standaloneHiddenModuleIds: [target.id] }];
  for (const patch of stalePatches) await assert.rejects(store.saveSettings(patch), /已删除/);
  assert.deepEqual(app.vault.dump(), before); assert.deepEqual(fields(file.contents).bw_card_settings.deletedModuleIds, [target.id]);
});

test('an async showcase creator cannot resurrect a deleted module ID after its note was created', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  const draft = { id: 'async-photos', title: '异步橱窗', mode: 'showcase' as const, appearance: { material: 'paper' as const, style: 'cover' as const } };
  const create = store.showcase.create;
  store.showcase.create = async (id, title) => { const path = await create(id, title); await store.saveSettings({ deletedModuleIds: [id] }); return path; };
  await assert.rejects(saveModuleDraft(store, draft, null), /已删除/);
  assert.equal(store.getSnapshot().settings.customModules.length, 0); assert.deepEqual(store.getSnapshot().settings.deletedModuleIds, [draft.id]);
  assert.ok('showcaseNote' in draft && typeof draft.showcaseNote === 'string');
  assert.ok(app.vault.getAbstractFileByPath(draft.showcaseNote as string)); assert.equal(app.trashed.size, 0);
});

test('old runtimes cannot delete modules and hide remains a reversible visibility-only operation', async t => {
  const { app, store } = await fixture(); t.after(() => store.destroy());
  const target = { ...newCustomModule('保留'), id: 'target' }; await store.saveSettings({ customModules: [target], dashboards: [createDashboard('分类', [target.id])] });
  const baseline = readModuleDraft(store.getSnapshot().settings, target.id)!, before = app.vault.dump(), old = Object.create(store) as CardsAPI;
  Object.defineProperty(old, 'supportsModuleDeletion', { value: undefined });
  await assert.rejects(removeModule(old, target.id, baseline), /升级.*兼容卡片插件/); assert.deepEqual(app.vault.dump(), before);
  const original = structuredClone(store.getSnapshot().settings);
  await setStandaloneModuleHidden(store, target.id, true);
  assert.ok(readModuleDraft(store.getSnapshot().settings, target.id)); assert.equal(store.getSnapshot().settings.deletedModuleIds, undefined);
  assert.deepEqual(store.getSnapshot().settings.customModules, original.customModules); assert.deepEqual(store.getSnapshot().settings.dashboards, original.dashboards);
  await setStandaloneModuleHidden(store, target.id, false); assert.deepEqual(store.getSnapshot().settings.standaloneHiddenModuleIds, []);
});
