import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {freshCardsSettings,newCustomModule,newModuleDraft,readCardsSettings,readModuleDraft,saveModuleDraft,validateCardsPatch} from '../src/settings';
import {createWork} from '../src/domain';
import CardsSurface from '../src/CardsSurface';
import {WorkPropertiesManager} from '../src/WorkPropertiesSessions';
import type {CardsAPI,CardsSettings,CardsSnapshot,WorkProperties} from '../src/types';

function fixture(settings=readCardsSettings(undefined)) {
  let snapshot:CardsSnapshot={settings,entities:[{...createWork('book'),id:'reading',title:'示例书籍'}],workOrder:null,loading:false,error:''};
  const listeners=new Set<()=>void>(),patches:Partial<CardsSettings>[]=[];
  let failure='';
  const api={
    getSnapshot:()=>snapshot,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},coverUrl:(value:string)=>value,
    saveSettings:async(patch:Partial<CardsSettings>)=>{
      patches.push(structuredClone(patch));if(failure){const error=failure;failure='';throw new Error(error);}
      validateCardsPatch(patch);snapshot={...snapshot,settings:readCardsSettings({...snapshot.settings,...patch})};for(const listener of listeners)listener();
    },
    readWorkProperties:async(id:string)=>({id,kind:'book',path:'书籍.md',coverPresent:false,values:{...snapshot.entities[0]}} as WorkProperties),
  } as unknown as CardsAPI;
  return {api,patches,listeners,fail:(message:string)=>{failure=message;},replace:(next:CardsSettings)=>{snapshot={...snapshot,settings:next};for(const listener of listeners)listener();}};
}

test('fresh settings and new modules share neutral defaults without changing legacy rendering defaults',()=>{
  const old=readCardsSettings({bookCardAppearance:{material:'matte',style:'minimal'},customModules:[{id:'old',title:'旧模块',kind:'film',appearance:{material:'foil',style:'cover'}}]});
  assert.deepEqual(old.bookCardAppearance,{material:'matte',style:'minimal'});
  assert.equal(readModuleDraft(old,'book')!.appearance.imageFit,'cover');assert.equal(readModuleDraft(old,'book')!.appearance.ratio,'2:3');
  assert.equal(readModuleDraft(old,'old')!.appearance.imageFit,'contain');
  const first=freshCardsSettings(),second=freshCardsSettings(),custom=newCustomModule('照片');
  assert.deepEqual(first.bookCardAppearance,{material:'paper',style:'cover',layout:'cylinder',ratio:'2:3',imageFit:'cover'});
  assert.equal(first.threeCardView,true);assert.deepEqual(first.workbenchText,{'book.title':'阅读','film.title':'影视'});
  first.bookCardAppearance.material='foil';assert.equal(second.bookCardAppearance.material,'paper');assert.equal(custom.appearance.material,'paper');assert.equal(custom.imageFit,'cover');
  assert.throws(()=>validateCardsPatch({bookCardAppearance:{material:'paper',style:'cover',ratio:'9:9' as '2:3'}}),/比例/);
  assert.throws(()=>validateCardsPatch({filmCardAppearance:{material:'paper',style:'cover',imageFit:'stretch' as 'cover'}}),/显示方式/);
});

test('default collection ratio and image fit reach standalone and embedded rendering',()=>{
  const settings=freshCardsSettings();settings.bookCardAppearance={...settings.bookCardAppearance,ratio:'4:3',imageFit:'contain'};
  const {api}=fixture(settings),manager=new WorkPropertiesManager(api);
  try {
    const html=renderToStaticMarkup(React.createElement(CardsSurface,{api,manager,embed:{id:'local',modules:[{id:'reading',collection:'book',layout:'album-rail'}]}}));
    assert.ok(html.includes('data-ratio="4:3"'));assert.ok(html.includes('data-image-fit="contain"'));assert.ok(html.includes('data-layout="album-rail"'));
    const old=fixture(),oldManager=new WorkPropertiesManager(old.api);
    try{const legacy=renderToStaticMarkup(React.createElement(CardsSurface,{api:old.api,manager:oldManager}));assert.ok(legacy.includes('data-ratio="2:3"'));assert.ok(legacy.includes('data-image-fit="cover"'));assert.equal(legacy.includes('同步'),false);}finally{oldManager.dispose();}
  } finally {manager.dispose();}
});

test('one module save commits all choices once and preserves other modules and work summary drafts',async()=>{
  const settings=freshCardsSettings();settings.customModules=[newCustomModule('保留模块')];
  const {api,patches}=fixture(settings),manager=new WorkPropertiesManager(api),session=manager.getSession('reading');
  await session.refresh();session.startComposition();session.update({summary:'未保存的摘要'});
  try {
    const baseline=readModuleDraft(settings,'book')!,draft=structuredClone(baseline);
    Object.assign(draft.appearance,{style:'minimal',imageFit:'cover',material:'matte',ratio:'16:9',layout:'scroll-bend',orientation:'vertical'});
    await saveModuleDraft(api,draft,baseline);
    assert.equal(patches.length,1);assert.deepEqual(Object.keys(patches[0]),['bookCardAppearance']);
    assert.equal(api.getSnapshot().settings.bookCardAppearance.ratio,'16:9');assert.deepEqual(api.getSnapshot().settings.customModules,settings.customModules);
    await session.refresh();assert.equal(manager.getSession('reading'),session);assert.equal(session.getSnapshot().values!.summary,'未保存的摘要');assert.equal(session.getSnapshot().dirty,true);
  } finally {manager.dispose();}
});

test('failed saves retain creation identity and choices, retries do not duplicate a committed module',async()=>{
  const {api,patches,fail}=fixture(),draft=newModuleDraft();draft.title='  新模块  ';draft.appearance.ratio='4:3';
  const before=structuredClone(draft);fail('写入失败');await assert.rejects(saveModuleDraft(api,draft,null),/写入失败/);
  assert.deepEqual(draft,before);assert.equal(api.getSnapshot().settings.customModules.length,0);
  await saveModuleDraft(api,draft,null);assert.equal(api.getSnapshot().settings.customModules[0].id,draft.id);assert.equal(api.getSnapshot().settings.customModules[0].ratio,'4:3');
  await saveModuleDraft(api,draft,null);assert.equal(api.getSnapshot().settings.customModules.length,1);assert.equal(patches.length,2);
});

test('external changes to the edited module block overwrites while other module edits merge',async()=>{
  const settings=freshCardsSettings(),one=newCustomModule('一'),two=newCustomModule('二');settings.customModules=[one,two];
  const {api,patches,replace}=fixture(settings),baseline=readModuleDraft(settings,one.id)!,draft=structuredClone(baseline);draft.appearance.material='matte';
  replace({...api.getSnapshot().settings,customModules:[one,{...two,title:'外部修改二'}]});
  await saveModuleDraft(api,draft,baseline);assert.equal(api.getSnapshot().settings.customModules[1].title,'外部修改二');
  const current=readModuleDraft(api.getSnapshot().settings,one.id)!;draft.appearance.material='foil';
  replace({...api.getSnapshot().settings,customModules:api.getSnapshot().settings.customModules.map(module=>module.id===one.id?{...module,ratio:'1:1'}:module)});
  const before=structuredClone(draft),count=patches.length;await assert.rejects(saveModuleDraft(api,draft,current),/其他位置修改/);
  assert.deepEqual(draft,before);assert.equal(patches.length,count);assert.equal(api.getSnapshot().settings.customModules[0].ratio,'1:1');
});

class Element extends EventTarget {
  children:Element[]=[];parentElement:Element|null=null;dataset:Record<string,string>={};attributes=new Map<string,string>();
  textContent='';className='';open=false;hidden=false;disabled=false;readOnly=false;rows=0;value='';checked=false;connected=false;scrolls=0;
  control?:Control;
  constructor(public tagName:string,public ownerDocument:DocumentStub){super();}
  get isConnected():boolean{return this.connected||!!this.parentElement?.isConnected;}
  append(...nodes:Element[]){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
  insertBefore(node:Element,before:Element){node.remove();node.parentElement=this;this.children.splice(this.children.indexOf(before),0,node);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}
  replaceChildren(...nodes:Element[]){for(const child of [...this.children])child.remove();this.append(...nodes);}
  setAttribute(name:string,value:string){this.attributes.set(name,value);}
  get classList(){return {contains:(name:string)=>this.className.split(' ').includes(name),add:(name:string)=>{this.className+=' '+name;this.ownerDocument.mutate(this);}};}
  contains(node:Element){return node===this||this.all().includes(node);}
  closest(tag:string):Element|null{for(let el:Element|null=this;el;el=el.parentElement)if(el.tagName===tag.toUpperCase())return el;return null;}
  createEl(tag:string,attributes?:{cls?:string}){const child=this.ownerDocument.createElement(tag);if(attributes?.cls)child.className=attributes.cls;this.append(child);return child;}
  createDiv(attributes?:{cls?:string}){return this.createEl('div',attributes);}
  scrollIntoView(){this.scrolls++;}
  focus(){this.ownerDocument.activeElement=this;}
  select(){}
  querySelector(selector:string):Element|null{
    const match=selector.match(/^\[data-card-collection="([^"]+)"\]$/);
    return this.all().find(element=>match?element.dataset.cardCollection===match[1]:selector.split(',').some(tag=>element.tagName===tag.toUpperCase()))??null;
  }
  all():Element[]{return this.children.flatMap(child=>[child,...child.all()]);}
}
class DocumentStub extends EventTarget {
  hidden=false;activeElement:Element|null=null;clipboard='';
  observers=new Map<Element,()=>void>();
  defaultView={navigator:{clipboard:{writeText:async(value:string)=>{this.clipboard=value;}}},MutationObserver:class {
    element?:Element;
    constructor(private callback:()=>void){}
    observe(element:Element){this.element=element;element.ownerDocument.observers.set(element,this.callback);}
    disconnect(){if(this.element)this.element.ownerDocument.observers.delete(this.element);}
  }};
  mutate(element:Element){this.observers.get(element)?.();}
  createElement(tag:string){return new Element(tag.toUpperCase(),this);}
}
class Control {
  change?:(value:any)=>unknown;click?:()=>unknown;
  constructor(public inputEl:Element){inputEl.control=this;}
  get selectEl(){return this.inputEl;}
  get toggleEl(){return this.inputEl;}
  setValue(value:any){if(typeof value==='boolean')this.inputEl.checked=value;else this.inputEl.value=value;return this;}
  setDisabled(value:boolean){this.inputEl.disabled=value;return this;}
  addOptions(_options:unknown){return this;}
  setButtonText(text:string){this.inputEl.textContent=text;return this;}
  setTooltip(_text:string){return this;}
  setCta(){return this;}
  onChange(callback:(value:any)=>unknown){this.change=callback;return this;}
  onClick(callback:()=>unknown){this.click=callback;return this;}
  async choose(value:any){this.setValue(value);await this.change?.(value);}
}
class SettingStub {
  settingEl:Element;
  constructor(parent:Element){this.settingEl=parent.ownerDocument.createElement('div');parent.append(this.settingEl);}
  setName(name:string){this.settingEl.dataset.settingName=name;return this;}
  setDesc(text:string){this.settingEl.dataset.description=text;return this;}
  add(kind:string,callback:(control:Control)=>unknown){const element=this.settingEl.ownerDocument.createElement(kind);this.settingEl.append(element);callback(new Control(element));return this;}
  addDropdown(callback:(control:Control)=>unknown){return this.add('select',callback);}
  addText(callback:(control:Control)=>unknown){return this.add('input',callback);}
  addToggle(callback:(control:Control)=>unknown){return this.add('input',callback);}
  addButton(callback:(control:Control)=>unknown){return this.add('button',callback);}
}
class SettingTabStub {
  containerEl!:Element;updates=0;domRefreshes=0;
  constructor(_app:unknown,_plugin:unknown){}
  update(){this.updates++;}
  refreshDomState(){this.domRefreshes++;}
}
const directory=dirname(fileURLToPath(import.meta.url));
const uiBundle=await build({stdin:{contents:"export {addCardsSettings,CardsSettingsController} from '../src/settings-tab';export {CardsSettingsTab,default as MagicalCardsPlugin} from '../src/main';export {renderedRoots} from 'react-dom/client';",resolveDir:directory,loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false,external:['react'],plugins:[{
  name:'settings-platform',setup(builder){
    builder.onResolve({filter:/^obsidian$/},()=>({path:'platform',namespace:'settings-platform'}));
    builder.onLoad({filter:/.*/,namespace:'settings-platform'},()=>({contents:`export * from ${JSON.stringify(resolve(directory,'obsidian-mock.ts'))};export const Setting=globalThis.__settingsSetting;export const PluginSettingTab=globalThis.__settingsTab;export const Platform={isDesktopApp:true};export const requireApiVersion=()=>Boolean(globalThis.__settingsModern);export class ItemView {} export class Modal {}`,resolveDir:directory,loader:'js'}));
    builder.onResolve({filter:/^react-dom\/client$/},()=>({path:'client',namespace:'settings-roots'}));
    builder.onLoad({filter:/.*/,namespace:'settings-roots'},()=>({contents:'export const renderedRoots=[];export function createRoot(){const root={element:null,unmounted:false,render(element){this.element=element;},unmount(){this.unmounted=true;}};renderedRoots.push(root);return root;}',loader:'js'}));
  },
}]});
(globalThis as any).__settingsSetting=SettingStub;
(globalThis as any).__settingsTab=SettingTabStub;
const bundledModule={exports:{}};new Function('require','module','exports',uiBundle.outputFiles[0].text)(createRequire(import.meta.url),bundledModule,bundledModule.exports);
const ui=bundledModule.exports as {addCardsSettings:typeof import('../src/settings-tab').addCardsSettings;CardsSettingsController:typeof import('../src/settings-controller').CardsSettingsController;CardsSettingsTab:typeof import('../src/main').CardsSettingsTab;MagicalCardsPlugin:typeof import('../src/main').default;renderedRoots:Array<{element:{props:{draft:import('../src/settings').CardModuleDraft}};unmounted:boolean}>};
const button=(element:Element,text:string)=>element.all().find(child=>child.tagName==='BUTTON'&&child.textContent===text)!.control!;
const row=(element:Element,name:string)=>element.all().find(child=>child.dataset.settingName===name)!;

test('settings groups preserve requested order and mount previews only while open and visible',async()=>{
  const {api,listeners}=fixture(freshCardsSettings()),doc=new DocumentStub(),el=doc.createElement('div');el.connected=true;
  let managerDisposals=0;const manager={dispose(){managerDisposals++;}} as unknown as WorkPropertiesManager;
  const start=ui.renderedRoots.length,cleanup=ui.addCardsSettings(el as unknown as HTMLElement,api,()=>{},manager);
  const examples=el.all().find(child=>child.dataset.settingsGroup==='examples')!,reading=el.all().find(child=>child.dataset.cardCollection==='book')!;
  const add=el.all().find(child=>child.dataset.settingsGroup==='add-module')!;
  assert.equal(examples.open,false);assert.equal(reading.open,true);assert.equal(ui.renderedRoots.length,start);
  assert.deepEqual(reading.all().filter(child=>child.dataset.settingName?.match(/^\d\./)).map(child=>child.dataset.settingName),['1. 卡片样式','2. 显示方式','3. 卡片材质','4. 比例','5. 动效布局']);
  const previous=el.children[el.children.indexOf(add.parentElement!)-1];assert.equal(previous.all()[0].dataset.settingName,'仅显示三张卡片');assert.ok(previous.all()[0].dataset.description.includes('全部作品'));
  examples.open=true;examples.dispatchEvent(new Event('toggle'));assert.equal(ui.renderedRoots.length,start+2);
  await row(reading,'5. 动效布局').children[0].control!.choose('scroll-bend');assert.equal(row(reading,'画廊方向').hidden,false);
  assert.equal(ui.renderedRoots[start].element.props.draft.appearance.layout,'scroll-bend');assert.equal(api.getSnapshot().settings.bookCardAppearance.layout,'cylinder');
  examples.open=false;examples.dispatchEvent(new Event('toggle'));assert.ok(ui.renderedRoots.slice(start).every(root=>root.unmounted));
  examples.open=true;examples.dispatchEvent(new Event('toggle'));doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.ok(ui.renderedRoots.slice(start).every(root=>root.unmounted));
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.ok(ui.renderedRoots.slice(start).some(root=>!root.unmounted));
  cleanup();cleanup();assert.ok(ui.renderedRoots.slice(start).every(root=>root.unmounted));assert.equal(listeners.size,0);assert.equal(managerDisposals,0);
});

test('creation form retains failed draft, commits once on retry, collapses, and generates existing-module code',async()=>{
  const {api,patches,fail}=fixture(freshCardsSettings()),doc=new DocumentStub(),el=doc.createElement('div');el.connected=true;
  const cleanup=ui.addCardsSettings(el as unknown as HTMLElement,api,()=>{});
  try {
    const add=el.all().find(child=>child.dataset.settingsGroup==='add-module')!;add.open=true;
    await row(add,'模块名称').children[0].control!.choose('我的照片');await row(add,'4. 比例').children[0].control!.choose('4:3');
    fail('磁盘暂不可用');await button(add,'保存并收起').click!();assert.equal(add.open,true);assert.equal(api.getSnapshot().settings.customModules.length,0);assert.equal(row(add,'模块名称').children[0].value,'我的照片');
    assert.ok(add.all().some(child=>child.attributes.get('role')==='alert'&&child.textContent==='磁盘暂不可用'&&!child.hidden));
    await button(add,'保存并收起').click!();assert.equal(add.open,false);assert.equal(patches.length,2);const module=api.getSnapshot().settings.customModules[0];assert.equal(module.ratio,'4:3');
    assert.ok(el.all().some(child=>child.dataset.cardCollection===module.id));
    const code=el.all().find(child=>child.dataset.settingsGroup==='code')!;
    await row(code,'我的照片').children[0].control!.choose(true);await button(code,'生成代码').click!();
    const output=code.all().find(child=>child.tagName==='TEXTAREA')!;assert.ok(output.value.startsWith('```magical-cards'));assert.ok(output.value.includes(module.id));assert.ok(output.value.includes('collection: book'));assert.equal(output.value.includes('layout:'),false);
    await button(code,'复制代码').click!();assert.equal(doc.clipboard,output.value);
  } finally {cleanup();}
});

test('an external module change preserves dirty settings controls and blocks saving until explicit reload',async()=>{
  const {api,patches}=fixture(freshCardsSettings()),doc=new DocumentStub(),el=doc.createElement('div');el.connected=true;
  const cleanup=ui.addCardsSettings(el as unknown as HTMLElement,api,()=>{});
  try{
    const reading=el.all().find(child=>child.dataset.cardCollection==='book')!;reading.open=true;
    await row(reading,'1. 卡片样式').children[0].control!.choose('minimal');
    await api.saveSettings({bookCardAppearance:{...api.getSnapshot().settings.bookCardAppearance,material:'foil'}});
    assert.equal(row(reading,'1. 卡片样式').children[0].value,'minimal');assert.equal(row(reading,'3. 卡片材质').children[0].value,'paper');
    const count=patches.length;await button(reading,'保存并收起').click!();
    assert.equal(reading.open,true);assert.equal(patches.length,count);assert.ok(reading.all().some(child=>child.attributes.get('role')==='alert'&&child.textContent.includes('其他位置修改')&&!child.hidden));
    await button(reading,'重新载入').click!();assert.equal(row(reading,'1. 卡片样式').children[0].value,'cover');assert.equal(row(reading,'3. 卡片材质').children[0].value,'foil');
    await row(reading,'4. 比例').children[0].control!.choose('1:1');await button(reading,'保存并收起').click!();
    assert.equal(reading.open,false);assert.equal(api.getSnapshot().settings.bookCardAppearance.ratio,'1:1');assert.equal(api.getSnapshot().settings.bookCardAppearance.material,'foil');
  }finally{cleanup();}
});

/** Exercise the host's declared rows, then its post-render child ordering, rather than the fallback renderer. */
async function renderDeclared(controller:InstanceType<typeof ui.CardsSettingsController>,el:Element,oldCleanup:Array<()=>void>=[]) {
  for(const cleanup of oldCleanup)cleanup();el.replaceChildren();const cleanup:Array<()=>void>=[];
  for(const definition of controller.getDefinitions()){
    const list=el.createDiv(),rows='type' in definition?definition.items:[definition],nativeRows:Element[]=[];
    for(const definition of rows){
      const setting=new SettingStub(list);nativeRows.push(setting.settingEl);
      const dispose=definition.render(setting as unknown as import('obsidian').Setting,{listEl:list as unknown as HTMLElement});if(dispose)cleanup.push(dispose);
    }
    list.replaceChildren(...nativeRows);
  }
  await Promise.resolve();return cleanup;
}

test('modern definitions index real scoped fields without mounting any preview during search indexing',async()=>{
  const {api,listeners}=fixture(freshCardsSettings()),doc=new DocumentStub(),el=doc.createElement('div');el.connected=true;
  const start=ui.renderedRoots.length,controller=new ui.CardsSettingsController(api,{} as WorkPropertiesManager,{directory:{get:()=> '卡片库',apply:async()=>{}}});
  const defs=controller.getDefinitions(),rows=defs.flatMap(def=>'type' in def?def.items:[def]);
  assert.equal(rows[0].name,'卡片目录');assert.ok(rows.every(def=>typeof def.render==='function'));
  assert.ok(rows.some(def=>def.name==='阅读 · 2. 显示方式'&&def.aliases?.includes('贴满卡片')));
  assert.ok(rows.some(def=>def.name==='影视 · 5. 动效布局'&&def.aliases?.includes('滚动弯曲画廊')));
  const direction=rows.find(def=>def.name==='阅读 · 画廊方向')!;assert.equal(typeof direction.visible==='function'&&direction.visible(),false);
  assert.equal(ui.renderedRoots.length,start);assert.equal(doc.observers.size,0);
  const cleanup=await renderDeclared(controller,el),examples=el.all().find(child=>child.dataset.settingsGroup==='examples')!;
  const reading=el.all().find(child=>child.dataset.cardCollection==='book')!,target=row(reading,'2. 显示方式');
  assert.equal(examples.open,false);assert.equal(ui.renderedRoots.length,start);
  target.classList.add('is-flashing');
  assert.equal(examples.open,true);assert.equal(reading.open,true);assert.equal(target.scrolls,1);assert.equal(doc.activeElement,target.children[0]);assert.equal(ui.renderedRoots.length,start+2);
  for(const dispose of cleanup)dispose();controller.hide();assert.ok(ui.renderedRoots.slice(start).every(root=>root.unmounted));assert.equal(doc.observers.size,0);
  controller.dispose();assert.equal(listeners.size,0);
});

test('modern row updates retain failed draft and reveal state, commit choices once, and release roots',async()=>{
  const {api,patches,fail}=fixture(freshCardsSettings()),doc=new DocumentStub(),el=doc.createElement('div');el.connected=true;
  const controller=new ui.CardsSettingsController(api);let cleanup=await renderDeclared(controller,el);
  try{
    let reading=el.all().find(child=>child.dataset.cardCollection==='book')!;row(reading,'1. 卡片样式').classList.add('is-flashing');
    await row(reading,'1. 卡片样式').children[0].control!.choose('minimal');await row(reading,'4. 比例').children[0].control!.choose('4:3');
    fail('磁盘暂不可写');await button(reading,'保存并收起').click!();assert.equal(reading.open,true);assert.equal(patches.length,1);
    cleanup=await renderDeclared(controller,el,cleanup);reading=el.all().find(child=>child.dataset.cardCollection==='book')!;
    assert.equal(el.all().find(child=>child.dataset.settingsGroup==='examples')!.open,true);assert.equal(reading.open,true);
    assert.equal(row(reading,'1. 卡片样式').children[0].value,'minimal');assert.equal(row(reading,'4. 比例').children[0].value,'4:3');
    assert.ok(reading.all().some(child=>child.attributes.get('role')==='alert'&&child.textContent==='磁盘暂不可写'&&!child.hidden));
    await button(reading,'保存并收起').click!();assert.equal(reading.open,false);assert.equal(patches.length,2);
    assert.equal(api.getSnapshot().settings.bookCardAppearance.style,'minimal');assert.equal(api.getSnapshot().settings.bookCardAppearance.ratio,'4:3');
  }finally{for(const dispose of cleanup)dispose();controller.dispose();}
  assert.equal(doc.observers.size,0);
});

test('1.11.4 tab fallback renders the same rows without runtime SettingGroup and uses only version-supported refresh APIs',async()=>{
  const {api,listeners}=fixture(freshCardsSettings()),doc=new DocumentStub(),el=doc.createElement('div');el.connected=true;
  const plugin={app:{},rootFolder:'卡片库',cardsLease:{api},changeRoot:async(folder:string)=>{plugin.rootFolder=folder;}} as unknown as import('../src/main').default;
  const tab=new ui.CardsSettingsTab(plugin);tab.containerEl=el as unknown as HTMLElement;
  const observed=tab as unknown as SettingTabStub;
  try{
    (globalThis as any).__settingsModern=false;tab.display();
    assert.equal(row(el,'卡片目录').children[0].value,'卡片库');assert.ok(el.all().some(child=>child.dataset.settingsGroup==='examples'));
    await row(el,'卡片目录').children[0].control!.choose('收藏库');await button(el,'应用').click!();
    assert.equal(plugin.rootFolder,'收藏库');assert.equal(row(el,'卡片目录').children[0].value,'收藏库');assert.equal(observed.updates,0);
    (globalThis as any).__settingsModern=true;await row(el,'卡片目录').children[0].control!.choose('影像库');await button(el,'应用').click!();
    assert.equal(observed.updates,1);assert.ok(tab.getSettingDefinitions().length>0);
  }finally{tab.dispose();delete (globalThis as any).__settingsModern;}
  assert.equal(listeners.size,0);assert.equal(doc.observers.size,0);
});

test('plugin unload disposes cards UI and releases its lease without detaching or replacing the open leaf',()=>{
  let detached=0,disposed=0,released=0;
  const state={type:'barry-cards',pinned:true,position:{parent:'right',index:2}},leaf={state,detach(){detached++;}};
  const app={workspace:{getLeavesOfType:()=>[leaf]}};
  const plugin=new ui.MagicalCardsPlugin(app as unknown as import('obsidian').App,{id:'magical-cards'} as import('obsidian').PluginManifest);
  Object.assign(plugin,{cardsLease:{release:()=>{released++;return Promise.resolve();}},cardViews:new Set([{dispose(){disposed++;}}])});
  plugin.onunload();assert.equal(disposed,1);assert.equal(released,1);assert.equal(detached,0);assert.equal(leaf.state,state);assert.deepEqual(leaf.state.position,{parent:'right',index:2});
});
