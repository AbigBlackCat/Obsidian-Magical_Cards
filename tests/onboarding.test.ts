import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { App as ObsidianApp, TFile as ObsidianFile } from 'obsidian';
import type * as Mock from './obsidian-mock';
import type { CardsPluginData, StarterItem } from '../src/onboarding';

const directory = dirname(fileURLToPath(import.meta.url));
const bundled = await build({ stdin: { contents: "export * from '../src/store'; export * from '../src/onboarding'; export * from '../src/starter-assets'; export * from '../src/domain'; export * from './obsidian-mock';", resolveDir: directory, loader: 'ts' }, alias: { obsidian: resolve(directory, 'obsidian-mock.ts') }, bundle: true, platform: 'node', format: 'cjs', write: false });
const module = { exports: {} }; new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const runtime = module.exports as typeof Mock & typeof import('../src/store') & typeof import('../src/onboarding') & typeof import('../src/starter-assets') & typeof import('../src/domain');
const asApp = (app: Mock.App) => app as unknown as ObsidianApp;
function adapterListing(app: Mock.App) {
  const exists = app.vault.adapter.exists;
  Object.assign(app.vault.adapter, {
    exists: async (path: string) => await exists(path) || [...app.vault.files.keys()].some(file => file.startsWith(`${path}/`)),
    list: async (path: string) => {
      const files: string[] = [], folders = new Set<string>();
      for (const [file, value] of app.vault.files) {
        if (!file.startsWith(`${path}/`)) continue;
        const tail = file.slice(path.length + 1), child = `${path}/${tail.split('/')[0]}`;
        if (tail.includes('/') || value instanceof runtime.TFolder) folders.add(child); else files.push(file);
      }
      return { files, folders: [...folders] };
    }
  });
}
async function fixture(rootFolder = '卡片库', initial?: CardsPluginData, seed?: (app: Mock.App) => Promise<void>) {
  const app = new runtime.App(); await seed?.(app);
  const api = new runtime.CardsStore(asApp(app), rootFolder); await api.initialize();
  let data: CardsPluginData = initial ?? { rootFolder, installationOrigin: 'fresh', keep: { value: 1 } }, active = true;
  const writes: CardsPluginData[] = [];
  const options = { app: asApp(app), api, rootFolder, ready: Promise.resolve(), data: () => data,
    update: async (patch: Partial<CardsPluginData>) => { data = structuredClone({ ...data, ...patch }); writes.push(structuredClone(data)); },
    assertActive: () => { if (!active) throw new Error('停用'); },
    open: async (file: ObsidianFile) => { app.opened.push(file.path); }
  };
  return { app, api, options, board: new runtime.CardsOnboarding(options), data: () => data, writes, stop: () => { active = false; } };
}

function retiredItems(): StarterItem[] {
  return [
    { asset: 'demo-book-crime', title: '罪与罚' },
    { asset: 'demo-book-gone', title: '飘（四十年荣誉珍藏版）' },
  ].map(asset => {
    const id=crypto.randomUUID();
    return { ...asset, id, kind:'book', createdAt:'2026-10-11T00:00:00.000Z', assetDone:false, workDone:false,
      coverPath:`卡片库/附件/示例-${id}.jpg`, notePath:`卡片库/书籍/书籍-${asset.title}-${id.slice(-16)}.md` };
  });
}

test('new installations default to 卡片库; legacy local settings merge once without touching recovery drafts', async () => {
  const app = new runtime.App(); app.vault.configDir = 'custom-config';
  const fresh = await runtime.loadCardsPluginData(asApp(app), null);
  assert.equal(fresh.data.rootFolder, '卡片库'); assert.equal(fresh.data.installationOrigin, 'fresh');
  const legacyPath = 'custom-config/plugins/barry-cards/data.json', recoveryPath = 'custom-config/plugins/barry-cards/card-drafts-recovery-1.json';
  const old = JSON.stringify({ rootFolder: '老卡片', future: { keep: true }, same: 'old' });
  await app.vault.create(legacyPath, old); await app.vault.create(recoveryPath, '{"drafts":["未保存摘要"]}');
  const migrated = await runtime.loadCardsPluginData(asApp(app), { same: 'new', other: 3 });
  assert.equal(migrated.data.rootFolder, '老卡片'); assert.equal(migrated.data.same, 'new'); assert.deepEqual(migrated.data.future, { keep: true }); assert.equal(migrated.data.other, 3); assert.equal(migrated.data.installationOrigin, 'legacy'); assert.equal(migrated.data.legacyCardsMigration, true);
  assert.equal(app.vault.text(legacyPath), old); assert.equal(app.vault.text(recoveryPath), '{"drafts":["未保存摘要"]}');
  (app.vault.getAbstractFileByPath(legacyPath) as Mock.TFile).contents = 'not json';
  const again = await runtime.loadCardsPluginData(asApp(app), migrated.data); assert.equal(again.needsSave, false); assert.deepEqual(again.data, migrated.data);
});

test('invalid legacy settings stop migration instead of silently choosing a new library', async () => {
  const app = new runtime.App(); await app.vault.create('.obsidian/plugins/barry-cards/data.json', '{broken');
  await assert.rejects(runtime.loadCardsPluginData(asApp(app), null), /旧 Barry Cards 配置/);
  assert.equal(app.vault.text('.obsidian/plugins/barry-cards/data.json'), '{broken');
});

test('workbench settings migrate only when their normalized root folder matches', async () => {
  const old = { rootFolder: '工作台', threeCardView: true, bookCardAppearance: { material: 'paper', style: 'cover', imageFit: 'contain' }, workbenchText: { 'book.title': '旧书架' } };
  const unrelated = await fixture('卡片库', undefined, async app => { await app.vault.create('.obsidian/plugins/barry-workbench/data.json', JSON.stringify(old)); });
  assert.equal(unrelated.api.getSnapshot().settings.threeCardView, false); assert.deepEqual(unrelated.api.getSnapshot().settings.workbenchText, {}); assert.equal(unrelated.api.getInitializationInfo().usedLegacySettings, false);
  await unrelated.board.run(); assert.equal(unrelated.api.getSnapshot().entities.length, 6); unrelated.api.destroy();
  const matched = await fixture('工作台', { rootFolder: '工作台', installationOrigin: 'fresh' }, async app => { await app.vault.create('.obsidian/plugins/barry-workbench/data.json', JSON.stringify(old)); });
  const before = matched.app.vault.text('工作台/_数据/卡片配置.md'); await matched.board.run();
  assert.equal(matched.api.getSnapshot().entities.length, 0); assert.equal(matched.api.getSnapshot().settings.workbenchText['book.title'], '旧书架'); assert.equal(matched.api.getSnapshot().settings.bookCardAppearance.imageFit, 'contain'); assert.equal(matched.app.vault.text('工作台/_数据/卡片配置.md'), before); matched.api.destroy();
});

test('fresh onboarding creates six ordinary works with fresh UUIDs, byte-exact offline covers and usable guide', async () => {
  const { board, api, app, data } = await fixture(); await Promise.all([board.run(), board.run()]);
  const snapshot = api.getSnapshot(); assert.equal(snapshot.entities.length, 6); assert.equal(snapshot.entities.filter(work => work.type === 'book').length, 3); assert.equal(snapshot.entities.filter(work => work.type === 'film').length, 3);
  assert.equal(snapshot.settings.dashboardNavigationVersion, 1);
  assert.deepEqual(snapshot.settings.dashboards, [{ id: data().onboarding!.demoDashboardId, title: '示例', moduleIds: ['book', 'film'] }]);
  assert.equal(data().onboarding!.demoDashboardDone, true);
  assert.equal(new Set(snapshot.entities.map(work => work.id)).size, 6);
  for (const work of snapshot.entities) { assert.match(work.id, /^[a-f0-9-]{36}$/); assert.equal(work.moduleId, undefined); assert.equal(work.summary, ''); assert.equal(work.rating, null); if (work.type === 'book') { assert.equal(work.sourceId, ''); assert.deepEqual(work.notes, []); } }
  assert.equal(snapshot.settings.threeCardView, true); assert.equal(snapshot.settings.workbenchText['book.title'], '阅读'); assert.equal(snapshot.settings.workbenchText['film.title'], '影视');
  assert.deepEqual(snapshot.settings.bookCardAppearance, { material: 'paper', style: 'cover', layout: 'cylinder', ratio: '2:3', imageFit: 'cover' });
  for (const item of data().onboarding!.items) {
    const asset = runtime.STARTER_ASSETS.find(asset => asset.id === item.asset)!;
    const bytes = Buffer.from(app.vault.text(item.coverPath), 'base64'); assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.ok(snapshot.entities.some(work => work.id === item.id && work.path === item.notePath));
  }
  const guide = app.vault.text(data().onboarding!.guidePath);
  assert.doesNotMatch(guide,/^# |```/m); assert.match(guide, /卡片库\/_数据\/卡片配置.md/); assert.doesNotMatch(guide, /\{\{|\/Users\//);
  assert.equal(data().onboarding!.status, 'complete'); assert.equal(data().onboarding!.helpOpened, true); assert.equal(app.opened.length, 1); assert.deepEqual(data().keep, { value: 1 });
  const before = app.vault.dump(); await board.run(); assert.deepEqual(app.vault.dump(), before); assert.equal(app.opened.length, 1); api.destroy();
});

test('a deleted starter Dashboard remains deleted across repeated runs and restart without reseeding cards or covers', async () => {
  const f = await fixture(); await f.board.run();
  const demoId = f.data().onboarding!.demoDashboardId!; assert.match(demoId, /^[a-f0-9-]{36}$/);
  await f.api.saveSettings({ dashboards: [] }); const before = f.app.vault.dump(); await f.board.run();
  assert.deepEqual(f.app.vault.dump(), before); assert.deepEqual(f.api.getSnapshot().settings.dashboards, []);
  f.api.destroy(); const restart = new runtime.CardsStore(asApp(f.app), '卡片库'); await restart.initialize();
  const board = new runtime.CardsOnboarding({ ...f.options, api: restart }); await board.run();
  assert.deepEqual(f.app.vault.dump(), before); assert.equal(restart.getSnapshot().entities.length, 6); assert.equal(f.data().onboarding!.demoDashboardId, demoId); restart.destroy();
});

test('starter Dashboard progress retries its persisted ID and preserves user edits after the config write succeeded', async () => {
  const f = await fixture(); const update = f.options.update; let failed = false;
  const options = { ...f.options, update: async (patch: Partial<CardsPluginData>) => {
    if (!failed && patch.onboarding?.demoDashboardDone) { failed = true; throw new Error('示例分类进度保存失败'); }
    await update(patch);
  } };
  await assert.rejects(new runtime.CardsOnboarding(options).run(), /示例分类进度保存失败/);
  const id = f.data().onboarding!.demoDashboardId!; assert.equal(f.data().onboarding!.demoDashboardDone, false); assert.equal(f.api.getSnapshot().settings.dashboards!.length, 1);
  await f.api.saveSettings({ dashboards: [{ id, title: '我改过的分类', moduleIds: ['film'] }] });
  await new runtime.CardsOnboarding(options).run();
  assert.deepEqual(f.api.getSnapshot().settings.dashboards, [{ id, title: '我改过的分类', moduleIds: ['film'] }]);
  assert.equal(f.data().onboarding!.demoDashboardDone, true); assert.equal(f.api.getSnapshot().entities.length, 6); f.api.destroy();
});

test('the generated guide preserves the authored visible bytes, substitutes only root paths and has a unique invisible identity', async () => {
  const template = await readFile(resolve(directory, '../examples/Magical_Cards示例及用法说明.md'), 'utf8');
  const authored = template.replaceAll('{{rootFolder}}', () => '卡片库');
  assert.equal(createHash('sha256').update(authored).digest('hex'), '0f186d75bda4f103e85d22522f65f8a0386d68db0fc2ca15e86cedae6d09fa89');
  assert.match(authored, /批量导入图片／SVG/);
  assert.match(authored, /32:15 宽幅横图/);
  assert.match(authored, /右上角的透明区域/);
  assert.match(authored, /标签页没有固定“全部”页/);
  assert.match(authored, /所属分类右侧的退出箭头只移出该分类/);
  assert.match(authored, /模块加入、移出和删除仅在插件设置里操作/);
  assert.match(authored, /普通“示例” Dashboard 包含阅读和影视/);
  assert.match(authored, /旧隐藏模块移为未分类，取消旧隐藏状态/);
  assert.match(authored, /保留作品笔记、橱窗笔记及图片/);
  assert.match(authored, /原笔记嵌入会提示模块已删除，没有模块恢复入口/);
  // Keep the author's introduction byte-exact while the usage instructions evolve.
  const introduction = template.split('## 打开和编辑卡片', 1)[0];
  assert.equal(createHash('sha256').update(introduction).digest('hex'), 'ade9cca52edac606a23cfde8526188319798d04be86a04d135709fab9b241ff7');
  const ids = [crypto.randomUUID(), crypto.randomUUID()]; assert.notEqual(ids[0], ids[1]);
  const notes = ids.map(id => runtime.guideMarkdown('卡片库', id));
  for (const [index, note] of notes.entries()) {
    const marker = `<!-- magical-cards-guide:${ids[index]} -->\n`;
    assert.ok(note.endsWith(marker)); assert.equal(note.slice(0, -marker.length), authored);
    assert.doesNotMatch(note.slice(0, -marker.length), /^# |```|magical-cards-guide:/m);
  }
  const root = '我的$&卡片/收藏', custom = runtime.guideMarkdown(root, ids[0]);
  assert.equal(custom, authored.replaceAll('卡片库/', () => `${root}/`) + `<!-- magical-cards-guide:${ids[0]} -->\n`);
});

test('a guide written before progress failure resumes by its invisible identity and preserves edits in both saved-path flows', async () => {
  for (const changedRoot of [false, true]) {
    const f = await fixture();
    if (changedRoot) await f.board.run();
    const api = changedRoot ? new runtime.CardsStore(asApp(f.app), '另一个目录') : f.api;
    if (changedRoot) await api.initialize();
    const update = f.options.update; let failed = false;
    const options = { ...f.options, api, rootFolder: changedRoot ? '另一个目录' : '卡片库', update: async (patch: Partial<CardsPluginData>) => {
      if (!failed && (changedRoot ? patch.guideNotes?.['另一个目录']?.created : patch.onboarding?.guideCreated)) { failed = true; throw new Error('说明进度保存失败'); }
      await update(patch);
    } };
    const attempt = () => changedRoot ? new runtime.CardsOnboarding(options).openGuide() : new runtime.CardsOnboarding(options).run();
    await assert.rejects(attempt(), /说明进度保存失败/);
    const saved = changedRoot ? f.data().guideNotes!['另一个目录'] : { id: f.data().onboarding!.guideId, path: f.data().onboarding!.guidePath, created: f.data().onboarding!.guideCreated };
    assert.equal(saved.created, false);
    const note = f.app.vault.getAbstractFileByPath(saved.path) as Mock.TFile;
    assert.match(note.contents, new RegExp(`<!-- magical-cards-guide:${saved.id} -->`));
    note.contents += '\n用户补充的说明\n'; const edited = note.contents, files = f.app.vault.getMarkdownFiles().length;
    await attempt(); assert.equal(note.contents, edited); assert.equal(f.app.vault.getMarkdownFiles().length, files);
    assert.equal(changedRoot ? f.data().guideNotes!['另一个目录'].created : f.data().onboarding!.guideCreated, true);
    if (changedRoot) api.destroy(); f.api.destroy();
  }
});

test('legacy generated guides and already recorded user edits remain byte-exact during upgrade and retry', async () => {
  const f = await fixture(); await f.board.run();
  const journal = f.data().onboarding!, note = f.app.vault.getAbstractFileByPath(journal.guidePath) as Mock.TFile;
  note.contents = `# Magical Cards 示例及用法说明\n\n\`\`\`magical-cards\nid: block-default-${journal.guideId}\nmodules:\n  - id: books-${journal.guideId}\n    collection: book\n\`\`\`\n\n原有说明\n`;
  journal.guideCreated = false; journal.helpOpened = false;
  const legacy = note.contents; await new runtime.CardsOnboarding(f.options).run(); assert.equal(note.contents, legacy);
  note.contents = '\n我自己重写的旧说明，没有标题或生成标识。\n';
  const edited = note.contents; await new runtime.CardsOnboarding(f.options).openGuide(); assert.equal(note.contents, edited); f.api.destroy();
});

test('completed eight-item legacy journals preserve all existing works, edited covers and progress without reseeding',async()=>{
  const f=await fixture();await f.board.run();
  for(const item of retiredItems()){
    await f.app.vault.create(item.coverPath,`original retired cover ${item.asset}`);
    await f.api.saveStarterWork(runtime.starterWork(item),()=>{});
    await f.api.patchWorkProperties(item.id,{summary:'原有用户摘要'},await f.api.readWorkProperties(item.id));
    f.data().onboarding!.items.push({...item,assetDone:true,workDone:true});
  }
  const files=f.app.vault.dump(),data=structuredClone(f.data()),writes=f.writes.length;
  await new runtime.CardsOnboarding(f.options).run();
  assert.equal(f.api.getSnapshot().entities.length,8);assert.deepEqual(f.app.vault.dump(),files);assert.deepEqual(f.data(),data);assert.equal(f.writes.length,writes);assert.equal(f.app.opened.length,1);f.api.destroy();
});

test('pending eight-item legacy journals preserve retired works and covers, skip only unavailable retired images, and resume stable IDs',async()=>{
  for(const mode of ['absent','cover-only','work-only','work-and-cover'] as const){
    const f=await fixture(),save=f.api.saveStarterWork;f.api.saveStarterWork=async()=>{throw new Error('旧导入中断');};
    await assert.rejects(f.board.run(),/旧导入中断/);f.api.saveStarterWork=save;
    const retired=retiredItems(),item=retired[0];f.data().onboarding!.items.push(...retired);
    if(mode==='cover-only'||mode==='work-and-cover')await f.app.vault.create(item.coverPath,'用户保留的退休封面字节');
    if(mode==='work-only'||mode==='work-and-cover'){
      await f.api.saveStarterWork(runtime.starterWork(item),()=>{});
      await f.api.patchWorkProperties(item.id,{title:'用户修改的旧作品',summary:'旧摘要'},await f.api.readWorkProperties(item.id));
    }
    const oldNote=f.app.vault.getAbstractFileByPath(item.notePath) instanceof runtime.TFile?f.app.vault.text(item.notePath):undefined;
    const ids=f.data().onboarding!.items.map(item=>item.id);
    await new runtime.CardsOnboarding(f.options).run();
    const journal=f.data().onboarding!;assert.equal(journal.status,'complete');assert.deepEqual(journal.items.map(item=>item.id),ids);assert.equal(journal.items.length,8);
    assert.equal(f.api.getSnapshot().entities.length,mode==='absent'?6:7);
    const saved=journal.items.find(value=>value.id===item.id)!;
    if(mode==='cover-only'||mode==='work-and-cover'){
      assert.equal(saved.retiredSkipped,undefined);assert.equal(saved.assetDone,true);assert.equal(saved.workDone,true);assert.equal(f.app.vault.text(item.coverPath),'用户保留的退休封面字节');
    }else{
      assert.equal(saved.retiredSkipped,true);assert.equal(saved.assetDone,false);assert.equal(saved.workDone,false);assert.equal(f.app.vault.getAbstractFileByPath(item.coverPath),null);
    }
    if(oldNote!==undefined)assert.equal(f.app.vault.text(item.notePath),oldNote);
    const notWritten=journal.items.find(value=>value.id===retired[1].id)!;
    assert.equal(notWritten.retiredSkipped,true);assert.equal(f.app.vault.getAbstractFileByPath(notWritten.notePath),null);
    const before=f.app.vault.dump();await new runtime.CardsOnboarding(f.options).run();assert.deepEqual(f.app.vault.dump(),before);f.api.destroy();
  }
});

test('retired skips survive a progress-write failure and cannot bypass complete-set, identity or path validation',async()=>{
  const f=await fixture(),save=f.api.saveStarterWork;f.api.saveStarterWork=async()=>{throw new Error('中断');};await assert.rejects(f.board.run(),/中断/);f.api.saveStarterWork=save;
  f.data().onboarding!.items.push(...retiredItems());
  const original=structuredClone(f.data().onboarding!);
  for(const mutation of [
    () => { f.data().onboarding!.items[0].retiredSkipped=true; },
    () => { Reflect.set(f.data().onboarding!.items[6],'retiredSkipped',false); },
    () => { f.data().onboarding!.items[6].coverPath='卡片库/附件/其他.jpg'; },
    () => { f.data().onboarding!.items[6].notePath='卡片库/书籍/../其他.md'; },
    () => { f.data().onboarding!.items[6].title='未知旧作品'; },
    () => { f.data().onboarding!.items[6].asset='other-retired'; },
    () => { f.data().onboarding!.items.pop(); },
  ]){
    f.data().onboarding=structuredClone(original);mutation();const files=f.app.vault.dump();
    await assert.rejects(new runtime.CardsOnboarding(f.options).run(),/进度格式无效/);assert.deepEqual(f.app.vault.dump(),files);
  }
  f.data().onboarding=structuredClone(original);const update=f.options.update;let failed=false;
  f.options.update=async patch=>{if(!failed&&patch.onboarding?.items.some(item=>item.retiredSkipped)){failed=true;throw new Error('退休进度保存失败');}await update(patch);};
  await assert.rejects(new runtime.CardsOnboarding(f.options).run(),/退休进度保存失败/);assert.equal(f.data().onboarding!.status,'pending');assert.equal(f.api.getSnapshot().entities.length,6);
  await new runtime.CardsOnboarding(f.options).run();assert.equal(f.data().onboarding!.status,'complete');assert.equal(f.api.getSnapshot().entities.length,6);assert.equal(f.data().onboarding!.items.filter(item=>item.retiredSkipped).length,2);f.api.destroy();
});

test('each compressed starter asset decodes to its byte-exact recorded original',async()=>{
  for(const asset of runtime.STARTER_ASSETS){
    const bytes=await runtime.decodeStarterAsset(asset),original=await import('node:fs/promises').then(fs=>fs.readFile(resolve(directory,'../examples/vault/示例/附件',asset.cover)));
    assert.deepEqual(Buffer.from(bytes),original,asset.title);
    assert.equal(bytes.byteLength,asset.byteLength);
  }
  const asset=runtime.STARTER_ASSETS[0];
  await assert.rejects(runtime.decodeStarterAsset({...asset,data:'broken'}),/解压失败/);
  await assert.rejects(runtime.decodeStarterAsset({...asset,byteLength:1}),/解压失败/);
  await assert.rejects(runtime.decodeStarterAsset({...asset,sha256:'0'.repeat(64)}),/校验失败/);
});

test('corrupt compressed covers pause before writing files and the same journal resumes after repair',async()=>{
  const f=await fixture(),assets=runtime.STARTER_ASSETS as unknown as Array<import('../src/starter-assets').StarterAsset>,original=assets[0];
  try{
    assets[0]={...original,sha256:'0'.repeat(64)};
    await assert.rejects(f.board.run(),/校验失败/);
    const journal=f.data().onboarding!;
    assert.equal(journal.status,'pending');assert.equal(journal.items[0].assetDone,false);assert.equal(journal.items[0].workDone,false);
    assert.equal(f.app.vault.getAbstractFileByPath(journal.items[0].coverPath),null);assert.equal(f.api.getSnapshot().entities.length,0);
    const ids=journal.items.map(item=>item.id);assets[0]=original;
    await new runtime.CardsOnboarding(f.options).run();
    assert.deepEqual(f.data().onboarding!.items.map(item=>item.id),ids);assert.equal(f.api.getSnapshot().entities.length,6);assert.equal(f.data().onboarding!.status,'complete');
  }finally{assets[0]=original;f.api.destroy();}
});

test('an empty-root intent survives the first journal write failure and resumes after restart without replacing edited settings', async () => {
  const app = new runtime.App(); adapterListing(app);
  let data: CardsPluginData = { rootFolder: '卡片库', installationOrigin: 'fresh' };
  const intent = await runtime.prepareFirstRunIntent(asApp(app), data, () => {}); assert.ok(intent);
  assert.equal(app.vault.getAbstractFileByPath('卡片库/_数据/卡片配置.md'), null);
  data = { ...data, firstRunIntent: intent };
  let api = new runtime.CardsStore(asApp(app), data.rootFolder); await api.initialize();
  const options = () => ({ app: asApp(app), api, rootFolder: data.rootFolder, ready: Promise.resolve(), data: () => data, assertActive: () => {}, open: async () => {}, update: async (patch: Partial<CardsPluginData>) => { data = structuredClone({ ...data, ...patch }); } });
  await assert.rejects(new runtime.CardsOnboarding({ ...options(), update: async () => { throw new Error('首次进度写入失败'); } }).run(), /首次进度写入失败/);
  assert.equal(data.onboarding, undefined); assert.equal(api.getSnapshot().entities.length, 0);
  await api.saveSettings({ bookCardAppearance: { material: 'foil', style: 'cover', imageFit: 'contain' } }); api.destroy();
  data = (await runtime.loadCardsPluginData(asApp(app), JSON.parse(JSON.stringify(data)))).data;
  api = new runtime.CardsStore(asApp(app), data.rootFolder); await api.initialize();
  assert.equal(api.getInitializationInfo().hadConfig, true);
  await new runtime.CardsOnboarding(options()).run();
  assert.equal(data.onboarding?.status, 'complete'); assert.equal(api.getSnapshot().entities.length, 6);
  assert.deepEqual(api.getSnapshot().settings.bookCardAppearance, { material: 'foil', style: 'cover', imageFit: 'contain' }); api.destroy();
});

test('first-run intents require adapter-confirmed empty roots and never seed changed roots or newly added files', async () => {
  const app = new runtime.App(); adapterListing(app); app.workspace.layoutReady = false;
  await app.vault.create('卡片库/附件/自己的封面.png', 'existing bytes');
  app.vault.getMarkdownFiles = () => [];
  assert.equal(await runtime.prepareFirstRunIntent(asApp(app), { rootFolder: '卡片库', installationOrigin: 'fresh' }, () => {}), undefined);
  assert.equal(await runtime.prepareFirstRunIntent(asApp(app), { rootFolder: '空库', installationOrigin: 'legacy' }, () => {}), undefined);
  const intent = await runtime.prepareFirstRunIntent(asApp(app), { rootFolder: '空库', installationOrigin: 'fresh' }, () => {}); assert.ok(intent);
  app.workspace.layoutReady = true;
  for (const rootFolder of ['空库', '更换目录']) {
    if (rootFolder === '空库') await app.vault.create('空库/用户新增.md', '# 新增内容');
    const api = new runtime.CardsStore(asApp(app), rootFolder); await api.initialize();
    let data: CardsPluginData = { rootFolder, installationOrigin: 'fresh', firstRunIntent: intent };
    await new runtime.CardsOnboarding({ app: asApp(app), api, rootFolder, ready: Promise.resolve(), data: () => data, update: async patch => { data = { ...data, ...patch }; }, assertActive: () => {}, open: async () => {} }).run();
    assert.equal(api.getSnapshot().entities.length, 0); assert.notEqual(data.onboarding?.status, 'pending'); api.destroy();
  }
});

test('existing target files or a legacy installation keep settings and never receive starter cards', async () => {
  for (const legacy of [false, true]) {
    const f = await fixture('卡片库', { rootFolder: '卡片库', installationOrigin: legacy ? 'legacy' : 'fresh' }, legacy ? undefined : async app => { await app.vault.create('卡片库/我的笔记.md', '# 自有内容\n'); });
    const config = f.app.vault.text('卡片库/_数据/卡片配置.md'); await f.board.run();
    assert.equal(f.api.getSnapshot().entities.length, 0); assert.equal(f.app.vault.text('卡片库/_数据/卡片配置.md'), config); assert.equal(f.data().onboarding!.status, 'skipped'); assert.deepEqual(f.data().onboarding!.items, []); f.api.destroy();
  }
});

test('partial import resumes stable IDs and preserves edited works, covers and settings', async () => {
  const f = await fixture(); const save = f.api.saveStarterWork; let count = 0;
  f.api.saveStarterWork = async (work, active) => { if (++count === 3) throw new Error('模拟中断'); await save(work, active); };
  await assert.rejects(f.board.run(), /模拟中断/); assert.equal(f.api.getSnapshot().entities.length, 2); assert.equal(f.data().onboarding!.status, 'pending');
  const plannedIds = f.data().onboarding!.items.map(item => item.id), first = f.api.getSnapshot().entities[0];
  await f.api.patchWorkProperties(first.id, { title: '自己改过的作品', summary: '自己写的摘要' }, await f.api.readWorkProperties(first.id));
  (f.app.vault.getAbstractFileByPath(first.cover) as Mock.TFile).contents = 'user cover bytes';
  await f.api.saveSettings({ threeCardView: false });
  f.api.saveStarterWork = save; await new runtime.CardsOnboarding(f.options).run();
  assert.equal(f.api.getSnapshot().entities.length, 6); assert.deepEqual(f.data().onboarding!.items.map(item => item.id), plannedIds);
  assert.equal(f.api.getSnapshot().entities.find(work => work.id === first.id)!.summary, '自己写的摘要'); assert.equal(f.api.getSnapshot().entities.find(work => work.id === first.id)!.title, '自己改过的作品'); assert.equal(f.app.vault.text(first.cover), 'user cover bytes'); assert.equal(f.api.getSnapshot().settings.threeCardView, false); f.api.destroy();
});

test('failure saving progress after a note write does not duplicate or overwrite that note on retry', async () => {
  const f = await fixture(); const update = f.options.update; let failed = false;
  f.options.update = async patch => { if (!failed && patch.onboarding?.items.some(item => item.workDone)) { failed = true; throw new Error('本地进度保存失败'); } await update(patch); };
  await assert.rejects(new runtime.CardsOnboarding(f.options).run(), /本地进度保存失败/);
  assert.equal(f.api.getSnapshot().entities.length, 1); const work = f.api.getSnapshot().entities[0];
  await f.api.patchWorkProperties(work.id, { summary: '中断后编辑' }, await f.api.readWorkProperties(work.id));
  await new runtime.CardsOnboarding(f.options).run(); assert.equal(f.api.getSnapshot().entities.length, 6); assert.equal(f.api.getSnapshot().entities.find(item => item.id === work.id)!.summary, '中断后编辑'); f.api.destroy();
});

test('first-open success is recorded only after opening; edited guide survives retry and deletion never reseeds', async () => {
  const f = await fixture(); let fail = true;
  f.options.open = async file => { if (fail) throw new Error('打开失败'); f.app.opened.push(file.path); };
  await assert.rejects(new runtime.CardsOnboarding(f.options).run(), /打开失败/); assert.equal(f.data().onboarding!.helpOpened, false);
  const guidePath = f.data().onboarding!.guidePath, guide = f.app.vault.getAbstractFileByPath(guidePath) as Mock.TFile; guide.contents += '\n用户说明\n';
  fail = false; await new runtime.CardsOnboarding(f.options).run(); assert.equal(f.data().onboarding!.helpOpened, true); assert.ok(guide.contents.endsWith('用户说明\n'));
  f.app.vault.files.delete(guidePath); const work = f.api.getSnapshot().entities[0]; await f.api.deleteWork(work.id);
  const before = f.app.vault.dump(); await new runtime.CardsOnboarding(f.options).run(); assert.deepEqual(f.app.vault.dump(), before); assert.equal(f.api.getSnapshot().entities.length, 5); assert.equal(f.app.opened.length, 1); f.api.destroy();
});

test('an unrelated guide filename is preserved and the welcome page gets its own path', async () => {
  const f = await fixture('卡片库', undefined, async app => { await app.vault.create('卡片库/Magical_Cards示例及用法说明.md', '# 我的同名笔记\n'); });
  await f.board.run(); assert.equal(f.app.opened.length,0);await f.board.openGuide(); assert.equal(f.app.vault.text('卡片库/Magical_Cards示例及用法说明.md'), '# 我的同名笔记\n'); assert.notEqual(f.data().onboarding!.guidePath, '卡片库/Magical_Cards示例及用法说明.md'); f.api.destroy();
});

test('deactivation stops subsequent seed writes and keeps the pending journal resumable', async () => {
  const f = await fixture(), create = f.app.vault.createBinary.bind(f.app.vault); let writes = 0;
  f.app.vault.createBinary = async (path, bytes) => { writes++; const file = await create(path, bytes); f.stop(); return file; };
  await assert.rejects(f.board.run(), /停用/); assert.equal(writes, 1); assert.equal(f.api.getSnapshot().entities.length, 0); assert.equal(f.data().onboarding!.status, 'pending'); assert.equal(f.app.opened.length, 0); f.api.destroy();
});

test('older shared stores without starter capabilities are preserved and do not receive automatic help or cards', async () => {
  const f = await fixture(); Reflect.deleteProperty(f.api, 'getInitializationInfo'); Reflect.deleteProperty(f.api, 'saveStarterWork');
  const before = f.app.vault.dump(); await f.board.run();
  assert.equal(f.data().onboarding!.status, 'skipped'); assert.deepEqual(f.app.vault.dump(), before); assert.equal(f.app.opened.length, 0);
  await f.board.openGuide(); assert.equal(f.app.opened.length, 1); assert.match(f.app.vault.text(f.data().onboarding!.guidePath), /插件的开发思路/); f.api.destroy();
});

test('an incomplete journal pauses safely when an older workbench supplied the shared store', async () => {
  const f = await fixture(), save = f.api.saveStarterWork; f.api.saveStarterWork = async () => { throw new Error('中断'); };
  await assert.rejects(f.board.run(), /中断/); Reflect.deleteProperty(f.api, 'getInitializationInfo'); Reflect.deleteProperty(f.api, 'saveStarterWork');
  const before = f.app.vault.dump(); await assert.rejects(new runtime.CardsOnboarding(f.options).run(), /更新提供此卡片库的插件/); assert.deepEqual(f.app.vault.dump(), before); assert.equal(f.data().onboarding!.status, 'pending'); f.api.saveStarterWork = save; f.api.destroy();
});

test('corrupted journal paths and asset identities cannot write outside the intended starter paths', async () => {
  for (const mutation of [
    (data: CardsPluginData) => { data.onboarding!.guidePath = '卡片库/../其他笔记.md'; },
    (data: CardsPluginData) => { data.onboarding!.items[0].coverPath = '卡片库/附件/../其他封面.png'; },
    (data: CardsPluginData) => { data.onboarding!.items[0].kind = 'book'; },
    (data: CardsPluginData) => { data.onboarding!.items[1].id = data.onboarding!.items[0].id; },
    (data: CardsPluginData) => { Reflect.deleteProperty(data.onboarding!, 'guideCreated'); }
  ]) {
    const f = await fixture(); f.api.saveStarterWork = async () => { throw new Error('中断'); }; await assert.rejects(f.board.run(), /中断/);
    mutation(f.data()); const before = f.app.vault.dump(); await assert.rejects(new runtime.CardsOnboarding(f.options).run(), /进度格式无效/); assert.deepEqual(f.app.vault.dump(), before); f.api.destroy();
  }
});

test('a guide-path collision after planning is never overwritten or treated as a created guide', async () => {
  const f = await fixture(); const update = f.options.update; let collision = false;
  f.options.update = async patch => { await update(patch); if (!collision && patch.onboarding) { collision = true; await f.app.vault.create(patch.onboarding.guidePath, `# 其他笔记\n${patch.onboarding.guideId}\n`); } };
  await assert.rejects(new runtime.CardsOnboarding(f.options).run(), /已有其他内容/);
  assert.equal(f.app.vault.text(f.data().onboarding!.guidePath), `# 其他笔记\n${f.data().onboarding!.guideId}\n`); assert.equal(f.data().onboarding!.guideCreated, false); assert.equal(f.app.opened.length, 0); f.api.destroy();
});

test('queued collection edits conflict instead of silently replacing the first edit with a stale array', async () => {
  const f = await fixture(); const appearance = f.api.getSnapshot().settings.filmCardAppearance;
  const modules = [{ id: 'left', title: '左集合', kind: 'film' as const, appearance }, { id: 'right', title: '右集合', kind: 'film' as const, appearance }];
  await f.api.saveSettings({ customModules: modules });
  const results = await Promise.allSettled([
    f.api.saveSettings({ customModules: modules.map(module => module.id === 'left' ? { ...module, title: '修改左集合' } : module) }),
    f.api.saveSettings({ customModules: modules.map(module => module.id === 'right' ? { ...module, title: '修改右集合' } : module) })
  ]);
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected']);
  assert.deepEqual(f.api.getSnapshot().settings.customModules.map(module => module.title), ['修改左集合', '右集合']); f.api.destroy();
});

test('explicit guide opens after changing roots reuse their saved path without starting a second import', async () => {
  const f = await fixture(); await f.board.run();
  const api = new runtime.CardsStore(asApp(f.app), '另一个目录'); await api.initialize();
  const options = { ...f.options, api, rootFolder: '另一个目录' }, board = new runtime.CardsOnboarding(options);
  await board.openGuide(); const first = f.app.opened.at(-1), count = f.app.vault.getMarkdownFiles().length;
  await new runtime.CardsOnboarding(options).openGuide(); assert.equal(f.app.opened.at(-1), first); assert.equal(f.app.vault.getMarkdownFiles().length, count); assert.equal(api.getSnapshot().entities.length, 0); api.destroy(); f.api.destroy();
});

test('an installed old plugin without saved preferences retains its original implicit 工作台 root', async () => {
  const app = new runtime.App(); await app.vault.create('.obsidian/plugins/barry-cards/manifest.json', '{"id":"barry-cards"}');
  const loaded = await runtime.loadCardsPluginData(asApp(app), null); assert.equal(loaded.data.rootFolder, '工作台'); assert.equal(loaded.data.installationOrigin, 'legacy');
  await app.vault.create('.obsidian/plugins/barry-cards/data.json', '{"unknown":"keep"}');
  const missingRoot = await runtime.loadCardsPluginData(asApp(app), null); assert.equal(missingRoot.data.rootFolder, '工作台'); assert.equal(missingRoot.data.unknown, 'keep');
});
