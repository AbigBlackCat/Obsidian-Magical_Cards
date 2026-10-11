import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { createWork } from '../src/domain';
import type { App as ObsidianApp } from 'obsidian';
import type { Book, CardsSettings } from '../src/types';
import type * as Mock from './obsidian-mock';

const directory = dirname(fileURLToPath(import.meta.url));
const bundled = await build({ stdin: { contents: "export * from '../src/store'; export * from '../src/runtime'; export * from './obsidian-mock'; export { renderedRoots } from 'react-dom/client';", resolveDir: directory, loader: 'ts' }, alias: { obsidian: resolve(directory, 'obsidian-mock.ts') }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'], plugins:[{name:'render-lifecycle',setup(build){build.onResolve({filter:/^react-dom\/client$/},()=>({path:'client',namespace:'render-lifecycle'}));build.onLoad({filter:/.*/,namespace:'render-lifecycle'},()=>({contents:'export const renderedRoots=[];export function createRoot(){const root={element:null,unmounted:false,render(element){this.element=element;},unmount(){this.unmounted=true;}};renderedRoots.push(root);return root;}',loader:'js'}));}}] });
const module = { exports: {} }; new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const runtime = module.exports as typeof Mock & typeof import('../src/store') & typeof import('../src/runtime') & {renderedRoots:Array<{element:{props:{saveOrder(order:string[]):Promise<void>}};unmounted:boolean}>};
const fields = (text: string) => parse(text.match(/^---\n([\s\S]*?)\n---/)![1]) as Record<string, any>;
const asApp = (app: Mock.App) => app as unknown as ObsidianApp;
async function fixture(settings?: Partial<CardsSettings>) { const app = new runtime.App(), store = new runtime.CardsStore(asApp(app), '工作台', settings); await store.initialize(); return { app, store }; }

test('migration copies only card configuration and never edits legacy data or unrelated notes', async () => {
  const app = new runtime.App(), legacy = JSON.stringify({ bookCardAppearance: { material: 'paper', style: 'cover' }, customModules: [{ id: 'photos', title: '照片', kind: 'film', appearance: { material: 'matte', style: 'minimal' } }], threeCardView: true, workbenchText: { 'book.title': '书架', 'header.title': '私人标题' }, wereadSecret: 'local-secret-id', categories: ['私人分类'] });
  await app.vault.create('.obsidian/plugins/barry-workbench/data.json', legacy);
  const unrelated = await app.vault.create('工作台/任务/任务.md', '# 原有任务\n未触碰的正文\n');
  const store = new runtime.CardsStore(asApp(app), '工作台'); await store.initialize();
  assert.equal(app.vault.text('.obsidian/plugins/barry-workbench/data.json'), legacy); assert.equal(unrelated.contents, '# 原有任务\n未触碰的正文\n');
  assert.deepEqual(store.getSnapshot().settings.bookCardAppearance, { material: 'paper', style: 'cover' }); assert.equal(store.getSnapshot().settings.customModules[0].id, 'photos');
  const config = app.vault.text('工作台/_数据/卡片配置.md'); assert.ok(config.includes('书架')); assert.equal(config.includes('私人'), false); assert.equal(config.includes('local-secret-id'), false);
  store.destroy();
});

test('shared configuration merges a patch, preserves unknown fields and body, and rejects competing field edits', async () => {
  const { app, store } = await fixture(), file = app.vault.getAbstractFileByPath('工作台/_数据/卡片配置.md') as Mock.TFile;
  await app.fileManager.processFrontMatter(file, fm => { fm.extra = '保留'; fm.bw_card_settings.future = { value: 3 }; }); file.contents += '\n我的配置说明\n';
  await store.saveSettings({ filmCardAppearance: { material: 'matte', style: 'cover', layout: 'scroll-bend', orientation: 'vertical' } });
  assert.equal(fields(file.contents).extra, '保留'); assert.equal(fields(file.contents).bw_card_settings.future.value, 3); assert.ok(file.contents.endsWith('我的配置说明\n'));
  await app.fileManager.processFrontMatter(file, fm => { fm.bw_card_settings.threeCardView = true; });
  const before = file.contents; await assert.rejects(store.saveSettings({ threeCardView: false }), /其他窗口/); assert.equal(file.contents, before);
  await store.refresh(); assert.equal(store.getSnapshot().settings.threeCardView, true); store.destroy();
});

test('malformed or unrelated configuration is not overwritten', async () => {
  const app = new runtime.App(); await app.vault.create('工作台/_数据/卡片配置.md', '# 我的原有笔记\n');
  const store = new runtime.CardsStore(asApp(app), '工作台'); await assert.rejects(store.initialize(), /配置笔记格式/); assert.equal(app.vault.text('工作台/_数据/卡片配置.md'), '# 我的原有笔记\n'); store.destroy();
});

test('property patches merge different fields, reject same-field conflicts and preserve arbitrary body', async () => {
  const { app, store } = await fixture(); const film = createWork('film'); await store.save(film); const first = await store.readWorkProperties(film.id);
  const file = app.vault.getAbstractFileByPath(first.path) as Mock.TFile; file.contents += '\n自由正文\n';
  await store.patchWorkProperties(film.id, { summary: '我的摘要' }, first);
  await store.patchWorkProperties(film.id, { title: '新的名称' }, first);
  const before = file.contents; await assert.rejects(store.patchWorkProperties(film.id, { summary: '旧稿覆盖' }, first), /其他窗口/); assert.equal(file.contents, before); assert.ok(file.contents.includes('自由正文'));
  store.destroy();
});

test('native editor disagreement blocks property writes without forcing buffers to disk', async () => {
  const { app, store } = await fixture(); const work = createWork('film'); await store.save(work); const expected = await store.readWorkProperties(work.id), file = app.vault.getAbstractFileByPath(expected.path) as Mock.TFile;
  let saved = false; app.markdownViews = [{ file, getViewData: () => file.contents + '第一个草稿', save: async () => { saved = true; } }, { file, getViewData: () => file.contents + '第二个草稿', save: async () => { saved = true; } }];
  const before = file.contents; await assert.rejects(store.patchWorkProperties(work.id, { summary: '卡片摘要' }, expected), /窗口内容不一致/); assert.equal(file.contents, before); assert.equal(saved, false); store.destroy();
});

test('source book imports preserve personal cover, summary, layout and notes; deleted sources stay absent', async () => {
  const { app, store } = await fixture(); const source: Book = { ...createWork('book'), sourceId: 'source-1', cover: 'https://example.test/source.png', notes: [{ id: 'a', kind: 'highlight', text: '来源笔记' }] };
  assert.equal(await store.importSourceBook(source), 'created');
  const expected = await store.readWorkProperties(source.id); await store.patchWorkProperties(source.id, { summary: '个人摘要', cover: '本地封面.png', cardTitleAlign: 'center' }, expected);
  await store.importSourceBook({ ...source, progress: 80, cover: 'https://example.test/new.png', notes: [{ id: 'b', kind: 'thought', text: '新来源笔记' }] });
  const saved = store.getSnapshot().entities[0] as Book; assert.equal(saved.summary, '个人摘要'); assert.equal(saved.cover, '本地封面.png'); assert.equal(saved.cardTitleAlign, 'center'); assert.equal(saved.notes.length, 2); assert.equal(saved.progress, 80);
  await store.deleteWork(saved.id); assert.equal(await store.importSourceBook(source), 'skipped'); assert.equal(store.getSnapshot().entities.length, 0); assert.deepEqual(fields(app.vault.text('工作台/_数据/同步状态.md')).bw_deleted_book_sources, ['source-1']); store.destroy();
});

test('failed trash rolls back source deletion marker', async () => {
  const { app, store } = await fixture(); const source = { ...createWork('book'), sourceId: 'source-2' }; await store.importSourceBook(source);
  app.fileManager.trashFile = async () => { throw new Error('trash failure'); }; await assert.rejects(store.deleteWork(source.id), /trash failure/);
  assert.equal(store.getSnapshot().entities.length, 1); assert.deepEqual(fields(app.vault.text('工作台/_数据/同步状态.md')).bw_deleted_book_sources, []); store.destroy();
});

test('two plugin leases share migration, queue and sessions, and either can release first', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window'); Object.defineProperty(globalThis, 'window', { configurable: true, value: { requestAnimationFrame: () => 1, cancelAnimationFrame() {} } });
  try {
    for (const reverse of [false, true]) {
      const app = new runtime.App(), constructions = runtime.Plugin.constructions;
      const leases = await Promise.all([runtime.acquireCards(asApp(app), '工作台', '.obsidian/plugins/workbench', { threeCardView: true }), runtime.acquireCards(asApp(app), '工作台/', '.obsidian/plugins/cards')]);
      assert.equal(leases[0].api, leases[1].api); assert.equal(leases[0].propertiesManager, leases[1].propertiesManager); assert.equal(runtime.Plugin.constructions, constructions + 1); assert.equal(runtime.Plugin.languages.size, 2);
      const [first, second] = reverse ? leases.reverse() : leases; await first.release(); await first.release(); assert.equal(runtime.Plugin.languages.size, 2);
      const film = createWork('film'); await second.api.save(film); assert.equal(second.api.getSnapshot().entities.length, 1);
      await second.release(); assert.equal(runtime.Plugin.languages.size, 0); await assert.rejects(second.api.save(createWork('film')), /停用/);
    }
  } finally { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window'); }
});


test('last release of one root unmounts its reading and live-preview embeds while another root remains usable', async () => {
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{configurable:true,value:{requestAnimationFrame:()=>1,cancelAnimationFrame(){}}});
  const app=new runtime.App();let first:import('../src/runtime').CardsLease|undefined,second:import('../src/runtime').CardsLease|undefined;
  try{
    first=await runtime.acquireCards(asApp(app),'一号库','.obsidian/plugins/first');second=await runtime.acquireCards(asApp(app),'二号库','.obsidian/plugins/second');
    const source='id: note-demo\nmodules:\n  - id: books\n    collection: book\n  - id: films\n    collection: film';
    const processor=runtime.Plugin.languages.get('barry-cards') as (source:string,element:HTMLElement,context:{sourcePath:string;addChild(child:Mock.MarkdownRenderChild):void})=>void;
    const children:Mock.MarkdownRenderChild[]=[],start=runtime.renderedRoots.length;
    for(const path of ['一号库/阅读.md','一号库/实时预览.md','二号库/阅读.md'])processor(source,{} as HTMLElement,{sourcePath:path,addChild(child){children.push(child);child.load();}});
    const mounted=runtime.renderedRoots.slice(start);assert.equal(mounted.length,3);assert.equal(mounted.some(root=>root.unmounted),false);
    await first.release();assert.deepEqual(mounted.map(root=>root.unmounted),[true,true,false]);assert.equal(runtime.Plugin.languages.size,2);
    await assert.rejects(mounted[0].element.props.saveOrder(['films','books']),/笔记已关闭/);
    await second.api.save(createWork('film'));assert.equal(second.api.getSnapshot().entities.length,1);
    await second.release();assert.deepEqual(mounted.map(root=>root.unmounted),[true,true,true]);assert.equal(runtime.Plugin.languages.size,0);
    for(const child of children)child.unload();
  }finally{await first?.release();await second?.release();if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});


test('concurrent acquisitions all reject a preexisting native language conflict without retaining partial processors', async () => {
  let scheduled=0,cancelled=0;const previous=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{configurable:true,value:{requestAnimationFrame:()=>++scheduled,cancelAnimationFrame(){cancelled++;}}});
  const original=()=>{};runtime.Plugin.languages.set('barry-work-order',original);
  try{
    const app=new runtime.App();const result=await Promise.allSettled([runtime.acquireCards(asApp(app),'工作台','.obsidian/plugins/first'),runtime.acquireCards(asApp(app),'工作台','.obsidian/plugins/second')]);
    assert.deepEqual(result.map(item=>item.status),['rejected','rejected']);assert.equal(runtime.Plugin.languages.size,1);assert.equal(runtime.Plugin.languages.get('barry-work-order'),original);assert.equal(cancelled,scheduled,'失败加载必须取消共享属性宿主的待执行帧');
    runtime.Plugin.languages.delete('barry-work-order');const retry=await runtime.acquireCards(asApp(app),'工作台','.obsidian/plugins/retry');assert.equal(runtime.Plugin.languages.size,2);await retry.release();assert.equal(runtime.Plugin.languages.size,0);
  }finally{runtime.Plugin.languages.delete('barry-work-order');if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});


test('startup returns shared loading leases before the vault index is ready, then initializes once without overwriting existing files',async()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{configurable:true,value:{requestAnimationFrame:()=>1,cancelAnimationFrame(){}}});
  const app=new runtime.App();let first:import('../src/runtime').CardsLease|undefined,second:import('../src/runtime').CardsLease|undefined;
  try{
    const seed=new runtime.CardsStore(asApp(app),'工作台',{threeCardView:true,workbenchText:{'book.title':'原有书架'}});await seed.initialize();const book=createWork('book');book.title='启动前已有作品';await seed.save(book);seed.destroy();const before=app.vault.dump();
    app.workspace.layoutReady=false;const lookup=app.vault.getAbstractFileByPath.bind(app.vault),list=app.vault.getMarkdownFiles.bind(app.vault);let writes=0;
    app.vault.getAbstractFileByPath=path=>app.workspace.layoutReady?lookup(path):null;app.vault.getMarkdownFiles=()=>app.workspace.layoutReady?list():[];
    const folder=app.vault.createFolder.bind(app.vault),create=app.vault.create.bind(app.vault);app.vault.createFolder=async path=>{writes++;return folder(path);};app.vault.create=async(path,text)=>{writes++;return create(path,text);};
    [first,second]=await Promise.race([Promise.all([runtime.acquireCards(asApp(app),'工作台','.obsidian/plugins/first'),runtime.acquireCards(asApp(app),'工作台','.obsidian/plugins/second')]),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('plugin onload must not wait for layout boot')),100))]);
    assert.equal(first.api,second.api);assert.equal(first.api.getSnapshot().loading,true);assert.equal(writes,0);assert.equal(runtime.Plugin.languages.size,2);
    const pending=first.api.initialize();assert.equal(pending,second.api.initialize());
    app.workspace.layoutReady=true;for(const callback of app.layoutReadyCallbacks.splice(0))callback();await Promise.all([first.ready,second.ready,pending]);
    assert.equal(first.api.getSnapshot().loading,false);assert.equal(first.api.getSnapshot().entities[0].title,'启动前已有作品');assert.equal(first.api.getSnapshot().settings.threeCardView,true);assert.equal(writes,0);assert.deepEqual(app.vault.dump(),before);
  }finally{await first?.release();await second?.release();if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});

test('unloading both startup leases before layout becomes ready performs no deferred file writes',async()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{configurable:true,value:{requestAnimationFrame:()=>1,cancelAnimationFrame(){}}});
  const app=new runtime.App();app.workspace.layoutReady=false;
  try{
    const first=await runtime.acquireCards(asApp(app),'尚未创建的卡片库','.obsidian/plugins/first'),second=await runtime.acquireCards(asApp(app),'尚未创建的卡片库','.obsidian/plugins/second');
    await first.release();await second.release();assert.equal(runtime.Plugin.languages.size,0);
    app.workspace.layoutReady=true;for(const callback of app.layoutReadyCallbacks.splice(0))callback();await assert.rejects(first.ready,/停用/);assert.deepEqual(app.vault.dump(),{});
  }finally{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});
