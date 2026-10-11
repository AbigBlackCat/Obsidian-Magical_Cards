import { App,TFile,normalizePath,parseYaml,stringifyYaml } from 'obsidian';
import { createCoverSvg,sanitizeSvg } from './covers';
import { validateWork } from './domain';
import { entityFields,entityFromFields,replaceManaged,sourceMarkdown,validFolder,safeFilePart,contentRevision,coverPath,prepareNativeWrite } from './persistence';
import { orderedWorks,readWorkOrder,reconcileWorkOrder,moveWorkOrder } from './work-order';
import { CARD_SETTING_KEYS,readCardsSettings,validateCardsPatch } from './settings';
import { type Book,type Film,type Work,type CardsAPI,type CardsSnapshot,type CardsSettings,type WorkKind,type WorkOrder,type WorkProperties,type WorkPropertyValues,type CardLayoutPatch,type CardLayoutResult,type CoverTemplate } from './types';
const FOLDERS={book:'书籍',film:'观影'};
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export class CardsStore implements CardsAPI {
 private snapshot:CardsSnapshot;
 private listeners=new Set<()=>void>(); private queue:Promise<unknown>=Promise.resolve(); private timer:ReturnType<typeof setTimeout>|undefined;
 private destroyed=false; private refreshRevision=0; private orderPath=''; private initialization?:Promise<void>;
 constructor(private app:App,readonly rootFolder:string,private migrationSettings?:Partial<CardsSettings>){
  if(!validFolder(rootFolder))throw new Error('卡片目录无效，请使用笔记库内的普通目录。');
  this.rootFolder=normalizePath(rootFolder);
  this.snapshot={entities:[],workOrder:null,settings:readCardsSettings(migrationSettings),loading:true,error:''};
 }
 getSnapshot=()=>this.snapshot;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private emit(patch:Partial<CardsSnapshot>={}){if(this.destroyed)return;this.snapshot={...this.snapshot,...patch};for(const listener of [...this.listeners])listener();}
 private active(){if(this.destroyed)throw new Error('插件已停用，操作已取消。');}
 private serial<T>(fn:()=>Promise<T>):Promise<T>{const next=this.queue.catch(()=>{}).then(()=>{this.active();return fn();});this.queue=next;return next;}
 settle=async()=>{await this.queue.catch(()=>{});};
 invalidate=()=>{clearTimeout(this.timer);this.timer=setTimeout(()=>{void this.refresh().catch(error=>this.emit({error:this.message(error)}));},100);};
 destroy(){this.destroyed=true;clearTimeout(this.timer);this.listeners.clear();}
 private message(error:unknown){return error instanceof Error?error.message:'操作没有完成，请重试。';}
 private root(){return this.rootFolder;}
 private metaPath(){return `${this.root()}/_数据/同步状态.md`;}
 private configPath(){return `${this.root()}/_数据/卡片配置.md`;}
 private noteParts(text:string){
  const match=text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);const fields=match?(parseYaml(match[1])??{}):{};
  if(!record(fields))throw new Error('笔记属性格式无效。');
  return {fields,body:match?text.slice(match[0].length):text};
 }
 private frontmatter(text:string){return this.noteParts(text).fields;}
 private async folder(path:string){for(const part of path.split('/').reduce<string[]>((all,p)=>[...all,all.length?`${all.at(-1)}/${p}`:p],[])){this.active();if(!this.app.vault.getAbstractFileByPath(part))await this.app.vault.createFolder(part);}}
 private settingsFrom(text:string){
  const fields=this.frontmatter(text);
  if(fields.bw_view!=='cards-config'||!record(fields.bw_card_settings))throw new Error('卡片配置笔记格式无效，原内容已保留，请先检查。');
  const known=Object.fromEntries(CARD_SETTING_KEYS.filter(key=>Object.hasOwn(fields.bw_card_settings as object,key)).map(key=>[key,(fields.bw_card_settings as Record<string,unknown>)[key]]));
  validateCardsPatch(known);
  return readCardsSettings(fields.bw_card_settings);
 }
 initialize(){
  this.initialization??=this.initializeNow().catch(error=>{this.emit({loading:false,error:this.message(error)});throw error;});
  return this.initialization;
 }
 private async initializeNow(){
  if(this.app.workspace.layoutReady===false)await new Promise<void>(resolve=>this.app.workspace.onLayoutReady(resolve));
  this.active();await this.folder(`${this.root()}/_数据`);this.active();
  const path=this.configPath(),existing=this.app.vault.getAbstractFileByPath(path);
  if(existing){if(!(existing instanceof TFile))throw new Error('卡片配置路径被文件夹占用。');this.settingsFrom(await this.app.vault.read(existing));}
  else{
   let legacy:unknown=this.migrationSettings;
   if(legacy===undefined){try{const adapter=this.app.vault.adapter;const old=normalizePath(`${this.app.vault.configDir}/plugins/barry-workbench/data.json`);if(adapter&&await adapter.exists(old))legacy=JSON.parse(await adapter.read(old));}catch{throw new Error('已有工作台配置未能读取，未建立新配置，请检查后重试。');}}
   const settings=readCardsSettings(legacy);this.active();
   await this.app.vault.create(path,`---\n${stringifyYaml({bw_view:'cards-config',bw_card_settings:settings})}---\n\n# 卡片配置\n\n书籍、影视和收藏模块由两个插件共享。旧插件配置与作品笔记均保留。\n`);
  }
  this.active();await this.refresh();
 }
 async refresh(){
  if(this.destroyed)return;
  const revision=++this.refreshRevision,entities:Work[]=[],errors:string[]=[],seen=new Set<string>(),orderFiles:TFile[]=[];
  let settings=this.snapshot.settings;
  const config=this.app.vault.getAbstractFileByPath(this.configPath());
  if(config instanceof TFile)try{settings=this.settingsFrom(await this.app.vault.cachedRead(config));}catch(error){errors.push(this.message(error));}
  for(const file of this.app.vault.getMarkdownFiles().filter(file=>file.path.startsWith(`${this.root()}/`))){
   try{const text=await this.app.vault.cachedRead(file),fields=this.frontmatter(text);if(fields.bw_view==='work-order')orderFiles.push(file);
    const work=entityFromFields(fields,file.path,text);if(!work)continue;validateWork(work);
    if(seen.has(work.id)){errors.push(`${file.path}：存在重复实体 ID`);continue;}seen.add(work.id);entities.push(work);
   }catch{errors.push(`${file.path}：属性或区块格式需要检查`);}
  }
  let workOrder:WorkOrder|null=null,orderPath='';
  if(orderFiles.length>1)errors.push('存在多篇作品排序笔记，请只保留一篇 bw_view: work-order。');
  else if(orderFiles.length===1){const file=orderFiles[0];orderPath=file.path;
   try{const stored=readWorkOrder(this.frontmatter(await this.app.vault.cachedRead(file)).bw_work_order);workOrder=reconcileWorkOrder(stored,entities);
    if(JSON.stringify(workOrder)!==JSON.stringify(stored))await this.app.vault.process(file,text=>{this.active();const parts=this.noteParts(text);workOrder=reconcileWorkOrder(readWorkOrder(parts.fields.bw_work_order),entities);parts.fields.bw_work_order=workOrder;return `---\n${stringifyYaml(parts.fields)}---\n${parts.body}`;});
   }catch(error){workOrder=this.snapshot.workOrder;errors.push(this.message(error));}
  }
  if(revision===this.refreshRevision){this.orderPath=orderPath;this.emit({entities,workOrder,settings,loading:false,error:errors.join('；')});}
 }
 private async orderFile(){
  await this.refresh();
  if(this.orderPath){const file=this.app.vault.getAbstractFileByPath(this.orderPath);if(file instanceof TFile){readWorkOrder(this.frontmatter(await this.app.vault.cachedRead(file)).bw_work_order);return file;}}
  if(this.snapshot.error.includes('多篇作品排序'))throw new Error('存在多篇作品排序笔记，无法确定保存位置。');
  const path=`${this.root()}/作品排序.md`;
  if(this.app.vault.getAbstractFileByPath(path))throw new Error('作品排序.md 已有其他内容，请先改名；没有覆盖原笔记。');
  const group=(kind:WorkKind)=>orderedWorks(this.snapshot.entities.filter((item):item is Book|Film=>item.type===kind)).map(item=>item.id);
  const fields={bw_view:'work-order',bw_work_order:{book:group('book'),film:group('film')}};
  const file=await this.app.vault.create(path,`---\n${stringifyYaml(fields)}---\n\n# 作品排序\n\n拖动手柄调整顺序，松开自动保存。聚焦手柄后可用 Alt + ↑ / ↓ 移动。\n\n## 书籍\n\n\`\`\`barry-work-order\nbook\n\`\`\`\n\n## 影视\n\n\`\`\`barry-work-order\nfilm\n\`\`\`\n`);
  await this.refresh();return file;
 }
 openWorkOrder=(kind:WorkKind)=>this.serial(async()=>{
  if(kind!=='book'&&kind!=='film')throw new Error('无效的作品分组。');
  const file=await this.orderFile();
  await this.app.workspace.getLeaf('tab').openFile(file,{state:{mode:'preview'},eState:{subpath:kind==='book'?'#书籍':'#影视'}});
 });
 moveWork=(kind:WorkKind,id:string,beforeId:string|null)=>this.serial(async()=>{
  if(kind!=='book'&&kind!=='film')throw new Error('无效的作品分组。');
  const file=await this.orderFile();
  const work=this.snapshot.entities.find(item=>item.id===id);
  const target=beforeId===null?null:this.snapshot.entities.find(item=>item.id===beforeId);
  if(work?.type!==kind||(beforeId!==null&&target?.type!==kind))throw new Error('只能在同一作品分组内排序，请刷新后重试。');
  await this.app.vault.process(file,text=>{
   this.active();const parts=this.noteParts(text);
   if(parts.fields.bw_view!=='work-order')throw new Error('排序笔记已在其他编辑器修改，请重新打开。');
   parts.fields.bw_work_order=moveWorkOrder(reconcileWorkOrder(readWorkOrder(parts.fields.bw_work_order),this.snapshot.entities),kind,id,beforeId);
   return `---\n${stringifyYaml(parts.fields)}---\n${parts.body}`;
  });await this.refresh();
 });
 private fileFor(id:string){const e=this.snapshot.entities.find(e=>e.id===id);if(!e)throw new Error('记录已移除，请刷新后重试。');const f=this.app.vault.getAbstractFileByPath(e.path);if(!(f instanceof TFile))throw new Error('笔记文件不存在。');return {entity:e,file:f};}
 private async saveNow(entity:Work,sourceCover?:string,personalCover=false){
  this.active();validateWork(entity);
  if((entity.type==='book'||entity.type==='film')&&entity.moduleId!==undefined&&(typeof entity.moduleId!=='string'||!entity.moduleId.trim()))throw new Error('卡片所属模块无效。');
  const existing=this.snapshot.entities.find(e=>e.id===entity.id);
  if(existing&&entity.updatedAt!==existing.updatedAt)throw new Error('这条记录已被更新，请收起编辑并重新打开，避免覆盖新内容。');
  if(existing&&entity.revision&&entity.revision!==existing.revision)throw new Error('笔记已在其他编辑器更新，请重新打开编辑后保存。');
  const now=new Date().toISOString();
  if((entity.type==='book'||entity.type==='film')&&entity.linkedNote!==undefined&&entity.linkedNote!==((existing?.type==='book'||existing?.type==='film')?existing.linkedNote:undefined))entity={...entity,linkedNote:this.linkedNotePath(entity.linkedNote)};
  const updated={...entity,createdAt:existing?.createdAt||entity.createdAt||now,updatedAt:now};
  let file=existing?this.app.vault.getAbstractFileByPath(existing.path):null;
  if(!existing){
   const dir=`${this.root()}/${FOLDERS[entity.type]}`;await this.folder(dir);
   const short=safeFilePart(entity.id).slice(-16);const path=`${dir}/${FOLDERS[entity.type]}-${safeFilePart(entity.title)}-${short}.md`;
   if(this.app.vault.getAbstractFileByPath(path))throw new Error('同名笔记已存在，未覆盖原文件。');
   let body=`# ${entity.title}\n`;
   if(entity.body)body=replaceManaged(body,'details',entity.body);
   const source=sourceMarkdown(entity);if(source)body=replaceManaged(body,'source',source);
   const fields=entityFields(updated);if(sourceCover!==undefined){fields.bw_source_cover=sourceCover;fields.bw_cover_custom=personalCover;}
   file=await this.app.vault.create(path,`---\n${stringifyYaml(fields)}---\n\n${body}`);
  }else if(file instanceof TFile){
   const target=file;const revision=entity.revision??existing.revision;
   await this.app.vault.process(target,text=>{
    this.active();
    if(revision&&revision!==contentRevision(text))throw new Error('笔记已在其他编辑器更新，请重新打开编辑后保存。');
    const parts=this.noteParts(text);let body=parts.body;
    if(entity.body!==undefined&&entity.body!==existing.body){
     if(entityFromFields(parts.fields,target.path,body)?.body!==existing.body)throw new Error('正文已在其他编辑器更新，请重新打开任务后再保存。');
     body=replaceManaged(body,'details',entity.body);
    }
    if(entity.type==='book'&&entity.sourceId)body=replaceManaged(body,'source',sourceMarkdown(entity));
    const fields=entityFields(updated);
    if((entity.type==='book'||entity.type==='film')&&Object.hasOwn(parts.fields,'bw_cover')&&coverPath(parts.fields.bw_cover)===entity.cover)fields.bw_cover=parts.fields.bw_cover;
    if(entity.type==='book'&&sourceCover===undefined&&Object.hasOwn(parts.fields,'bw_source_cover')&&entity.cover!==coverPath((parts.fields.bw_data as Record<string,unknown>).cover))fields.bw_cover_custom=entity.cover!==coverPath(parts.fields.bw_source_cover);
    Object.assign(parts.fields,fields);if(sourceCover!==undefined){parts.fields.bw_source_cover=sourceCover;parts.fields.bw_cover_custom=personalCover;}
    return `---\n${stringifyYaml(parts.fields)}---\n${body}`;
   });
  }else throw new Error('笔记文件不存在。');
  await this.refresh();
 }
 save=(entity:Work)=>this.serial(()=>this.saveNow(entity));
 private async workPropertyFile(id:string){
  this.active();
  const indexed=this.snapshot.entities.find(entity=>entity.id===id);
  const file=indexed&&this.app.vault.getAbstractFileByPath(indexed.path);
  if(file instanceof TFile&&this.frontmatter(await this.app.vault.read(file)).bw_id===id)return file;
  const matches:TFile[]=[];
  for(const candidate of this.app.vault.getMarkdownFiles().filter(file=>file.path.startsWith(`${this.root()}/`))){
   try{if(this.frontmatter(await this.app.vault.read(candidate)).bw_id===id)matches.push(candidate);}catch{/* Other malformed notes cannot identify this work. */}
  }
  if(matches.length!==1)throw new Error(matches.length?'作品 ID 重复，请先检查对应笔记。':'作品笔记已移除或标识已改变，请重新打开。');
  return matches[0];
 }
 private workProperties(file:TFile,text:string,id:string):WorkProperties{
  const fields=this.frontmatter(text);
  if(fields.bw_type!=='book'&&fields.bw_type!=='film')throw new Error('只能编辑书籍或影片属性。');
  const entity=entityFromFields(fields,file.path,text);
  if(!entity||entity.id!==id)throw new Error('作品标识已改变，请重新打开。');
  if(entity.type!=='book'&&entity.type!=='film')throw new Error('只能编辑书籍或影片属性。');
  validateWork(entity);
  const coverPresent=Object.hasOwn(fields,'bw_cover');
  const rawCover=coverPresent?fields.bw_cover:(fields.bw_data as Record<string,unknown>).cover;
  if(rawCover!==null&&typeof rawCover!=='string')throw new Error('封面属性应为图片引用文字。');
  const values:WorkPropertyValues={title:entity.title,cover:rawCover??'',summary:entity.summary,rating:entity.rating,pinned:entity.pinned,status:entity.status,cardTitleAlign:entity.cardTitleAlign??'left',cardSummaryAlign:entity.cardSummaryAlign??'left',linkedNote:entity.linkedNote??''};
  if(entity.type==='book')Object.assign(values,{author:entity.author,progress:entity.progress,lastRead:entity.lastRead,deepLink:entity.deepLink});
  else Object.assign(values,{director:entity.director,year:entity.year,date:entity.date,link:entity.link});
  return {id:entity.id,kind:entity.type,moduleId:entity.moduleId,path:file.path,coverPresent,values};
 }
 readWorkProperties=async(id:string)=>{const file=await this.workPropertyFile(id);return this.workProperties(file,await this.app.vault.read(file),id);};
 private async patchWorkPropertiesNow(id:string,patch:Partial<WorkPropertyValues>,expected:WorkProperties,renameTarget?:()=>string){
  if(!expected||expected.id!==id||!expected.values)throw new Error('作品编辑状态无效，请重新打开。');
  const file=await this.workPropertyFile(id);
  const assertEditors=await prepareNativeWrite(this.app,file,()=>this.active());
  const keys=Object.keys(patch) as Array<keyof WorkPropertyValues>;
  let result:WorkProperties|undefined;
  await this.app.vault.process(file,text=>{
   this.active();assertEditors(text);
   const current=this.workProperties(file,text,id);
   if(current.kind!==expected.kind)throw new Error('作品类型已改变，请重新打开。');
   const allowed=['title','cover','summary','rating','pinned','status','cardTitleAlign','cardSummaryAlign',...(current.moduleId?['linkedNote']:[]),...(current.kind==='book'?['author','progress','deepLink']:['director','year','date','link'])];
   for(const key of keys){
    if(!allowed.includes(key))throw new Error(`不能修改此作品字段：${key}`);
    if(!Object.is(current.values[key],expected.values[key])||(key==='cover'&&current.coverPresent!==expected.coverPresent))throw new Error('所编辑的属性已在其他窗口更新，请重新加载后再修改。');
   }
   if(!keys.length){result=current;return text;}
   const parts=this.noteParts(text),data={...parts.fields.bw_data as Record<string,unknown>};
   for(const key of keys){
    const value=key==='linkedNote'?this.linkedNotePath(renameTarget?renameTarget():patch[key]):patch[key];
    if((key==='cardTitleAlign'||key==='cardSummaryAlign')&&(typeof value!=='string'||!['left','center','right'].includes(value)))throw new Error('卡片文字对齐无效。');
    if(key==='title'){
     if(typeof value!=='string'||!value.trim())throw new Error('作品名称不能为空。');
     parts.fields.bw_title=value;
    }else if(key==='cover'){
     if(typeof value!=='string')throw new Error('封面应为图片引用文字。');
     parts.fields.bw_cover=value;
     if(current.kind==='book'){
      if(!Object.hasOwn(parts.fields,'bw_source_cover'))parts.fields.bw_source_cover=coverPath(data.cover);
      parts.fields.bw_cover_custom=true;
     }
     data.cover=coverPath(value);
    }else data[key]=value;
   }
   parts.fields.bw_data=data;parts.fields.bw_updated=new Date().toISOString();
   const updated=`---\n${stringifyYaml(parts.fields)}---\n${parts.body}`;
   result=this.workProperties(file,updated,id);
   return updated;
  });
  return result!;
 }
 patchWorkProperties=(id:string,patch:Partial<WorkPropertyValues>,expected:WorkProperties)=>this.serial(async()=>{
  const result=await this.patchWorkPropertiesNow(id,patch,expected);await this.refresh();return result;
 });
 applyCardLayout=(patch:CardLayoutPatch)=>this.serial(async()=>{
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error('卡片排版设置无效。');
  const keys=Object.keys(patch) as Array<keyof CardLayoutPatch>;
  if(!keys.length)throw new Error('请选择要统一修改的卡片排版。');
  for(const key of keys)if(!['cardTitleAlign','cardSummaryAlign'].includes(key)||!['left','center','right'].includes(patch[key] as string))throw new Error('卡片文字对齐无效。');
  const result:CardLayoutResult={updated:0,skipped:0,failed:[]};
  const works=this.snapshot.entities.filter((entity):entity is Book|Film=>entity.type==='book'||entity.type==='film');
  for(const work of works){
   try{
    const expected=await this.readWorkProperties(work.id),changes:CardLayoutPatch={};
    for(const key of keys)if(!Object.is(expected.values[key],patch[key]))Object.assign(changes,{[key]:patch[key]});
    if(!Object.keys(changes).length){result.skipped++;continue;}
    await this.patchWorkPropertiesNow(work.id,changes,expected);result.updated++;
   }catch(error){result.failed.push({id:work.id,path:work.path,title:work.title,error:this.message(error)});}
  }
  await this.refresh();return result;
 });
 private bookDeletionSources(fields:Record<string,unknown>):string[]{
  const sources=fields.bw_deleted_book_sources;
  if(sources===undefined)return [];
  if(!Array.isArray(sources)||!sources.every(value=>typeof value==='string'))throw new Error('同步状态中的书籍删除记录格式无效，请检查 bw_deleted_book_sources。');
  return sources;
 }
 deleteWork=(id:string)=>this.serial(async()=>{
  const {entity,file}=this.fileFor(id);if(entity.type!=='book'&&entity.type!=='film')throw new Error('这不是书籍或影片。');
  const sourceId=entity.type==='book'?entity.sourceId:'';
  let meta:TFile|undefined;let added=false;
  if(sourceId){
   meta=await this.metaFile();
   await this.app.fileManager.processFrontMatter(meta,fm=>{
    const sources=this.bookDeletionSources(fm);
    if(!sources.includes(sourceId)){fm.bw_deleted_book_sources=[...sources,sourceId];added=true;}
   });
  }
  try{await this.app.fileManager.trashFile(file);}
  catch(error){
   if(meta&&added)try{await this.app.fileManager.processFrontMatter(meta,fm=>{fm.bw_deleted_book_sources=this.bookDeletionSources(fm).filter(source=>source!==sourceId);});}
   catch{throw new Error('笔记未能移入回收站，删除标记回滚也失败；请检查同步状态中的 bw_deleted_book_sources。');}
   throw error;
  }
  await this.refresh();
 });
 private linkedNotePath(value:unknown):string {
  if(typeof value!=='string')throw new Error('关联笔记路径无效，请从已有笔记中选择。');
  const path=normalizePath(value.trim());if(!path)return '';
  if(path.startsWith('/')||path.split('/').some(part=>part==='..'||part==='.')||!path.toLowerCase().endsWith('.md'))throw new Error('请关联笔记库内的 Markdown 笔记。');
  const file=this.app.vault.getAbstractFileByPath(path);
  if(!(file instanceof TFile)||file.extension.toLowerCase()!=='md')throw new Error('关联笔记不存在，请重新选择。');
  return file.path;
 }
 listNoteCandidates=async(query:string)=>{
  const search=query.trim().toLocaleLowerCase();
  return this.app.vault.getMarkdownFiles().filter(file=>!search||file.path.toLocaleLowerCase().includes(search)).sort((a,b)=>a.path.localeCompare(b.path,'zh-CN')).slice(0,50).map(file=>({path:file.path,title:file.basename}));
 };
 followLinkedNoteRename=(newPath:string|(()=>string),oldPath:string)=>this.serial(async()=>{
  const before=normalizePath(oldPath),after=normalizePath(typeof newPath==='function'?newPath():newPath);if(before===after)return;
  await this.refresh();const failures:string[]=[];
  for(const work of this.snapshot.entities.filter((entity):entity is Book|Film=>(entity.type==='book'||entity.type==='film')&&Boolean(entity.moduleId&&entity.linkedNote&&(entity.linkedNote===before||entity.linkedNote.startsWith(`${before}/`))))){
   try{
    const expected=await this.readWorkProperties(work.id),linked=expected.values.linkedNote;
    if(!linked||(linked!==before&&!linked.startsWith(`${before}/`)))continue;
    await this.patchWorkPropertiesNow(work.id,{linkedNote:after+linked.slice(before.length)},expected,()=>normalizePath(typeof newPath==='function'?newPath():newPath)+linked.slice(before.length));
   }catch(error){failures.push(`${work.title}：${this.message(error)}`);}
  }
  await this.refresh();if(failures.length)throw new Error(`关联笔记更新未完成，请编辑卡片资料重新关联。${failures.join('；')}`);
 });
 openNote=async(path:string)=>{
  const file=this.app.vault.getAbstractFileByPath(normalizePath(path));if(!(file instanceof TFile))throw new Error('笔记文件不存在；关联笔记已移除时，请编辑卡片资料重新关联。');
  const entity=this.snapshot.entities.find(e=>e.path===file.path);
  if(entity?.type==='book'||entity?.type==='film'){
   const fields=this.frontmatter(await this.app.vault.cachedRead(file));
   if(!Object.hasOwn(fields,'bw_cover')){
    await this.app.fileManager.processFrontMatter(file,fm=>{
     if(Object.hasOwn(fm,'bw_cover'))return;
     const data=fm.bw_data as Record<string,unknown>|undefined;
     if(fm.bw_type==='book'&&Object.hasOwn(fm,'bw_source_cover')){
      fm.bw_cover=coverPath(fm.bw_source_cover);fm.bw_cover_custom=false;
      fm.bw_data={...data,cover:fm.bw_cover};
     }else fm.bw_cover=coverPath(data?.cover);
     if(fm.bw_type==='book'&&data?.sourceId&&!Object.hasOwn(fm,'bw_source_cover')){
      fm.bw_source_cover=coverPath(data.cover);
      if(fm.bw_cover&&!/^https:\/\//i.test(String(fm.bw_cover)))fm.bw_cover_custom=true;
     }
    });await this.refresh();
   }
  }
  await this.app.workspace.getLeaf('tab').openFile(file,{state:entity?.type==='book'||entity?.type==='film'?{mode:'source',source:false}:{mode:'source'}});
 };
 attachCover=async(file:File)=>{
  if(file.size>10*1024*1024)throw new Error('封面应小于 10 MB。');
  const ext=file.name.split('.').pop()?.toLowerCase();if(!ext||!['png','jpg','jpeg','webp','gif','svg'].includes(ext))throw new Error('请选择 PNG、JPEG、WebP、GIF 或 SVG。');
  const dir=`${this.root()}/附件`;await this.folder(dir);const path=`${dir}/封面-${crypto.randomUUID()}.${ext}`;
  if(ext==='svg')await this.app.vault.create(path,sanitizeSvg(await file.text()));else await this.app.vault.createBinary(path,await file.arrayBuffer());return path;
 };
 makeCover=async(template:CoverTemplate,title:string,color:string)=>{const dir=`${this.root()}/附件`;await this.folder(dir);const path=`${dir}/动态封面-${template}-${crypto.randomUUID()}.svg`;await this.app.vault.create(path,createCoverSvg(template,title,color));return path;};
 coverUrl=(path:string,sourcePath='')=>{
  path=coverPath(path);if(/^https?:\/\//i.test(path))return path;if(!path)return '';
  const file=this.app.metadataCache.getFirstLinkpathDest(path,sourcePath)||this.app.vault.getAbstractFileByPath(normalizePath(path));
  return file instanceof TFile&&/^(png|jpe?g|webp|gif|svg)$/i.test(file.extension)?this.app.vault.getResourcePath(file):'';
 };

 private async metaFile(){
  const path=this.metaPath();await this.folder(`${this.root()}/_数据`);let file=this.app.vault.getAbstractFileByPath(path);
  if(!file)file=await this.app.vault.create(path,'# 阅读统计与同步状态\n\n此笔记保存来源统计，删除会影响目标历史。\n');
  if(!(file instanceof TFile))throw new Error('同步状态路径无效。');
  return file;
 }
 importSourceBook=(incoming:Book)=>this.serial(async():Promise<'created'|'updated'|'skipped'>=>{
  await this.refresh();validateWork(incoming);
  const old=this.snapshot.entities.find((work):work is Book=>work.type==='book'&&(work.id===incoming.id||work.sourceId===incoming.sourceId));
  const meta=this.app.vault.getAbstractFileByPath(this.metaPath());
  const deleted=meta instanceof TFile?this.bookDeletionSources(this.frontmatter(await this.app.vault.read(meta))):[];
  if(incoming.sourceId&&deleted.includes(incoming.sourceId)&&!old)return 'skipped';
  let merged:Book={...incoming,body:undefined},personalCover=false;
  if(old){
   const {file}=this.fileFor(old.id),fm=this.frontmatter(await this.app.vault.read(file)),data=fm.bw_data as Record<string,unknown>;
   const baseline=coverPath(Object.hasOwn(fm,'bw_source_cover')?fm.bw_source_cover:data.cover),native=coverPath(fm.bw_cover),stored=coverPath(data.cover);
   personalCover=Object.hasOwn(fm,'bw_cover')&&(native!==stored?native!==baseline:fm.bw_cover_custom===true||native!==baseline);
   personalCover=personalCover||Boolean(!Object.hasOwn(fm,'bw_source_cover')&&old.cover&&!/^https:\/\//i.test(old.cover));
   merged={...incoming,id:old.id,path:old.path,createdAt:old.createdAt,updatedAt:old.updatedAt,revision:old.revision,body:undefined,summary:old.summary,rating:old.rating,pinned:old.pinned,moduleId:old.moduleId,linkedNote:old.linkedNote,cardTitleAlign:old.cardTitleAlign,cardSummaryAlign:old.cardSummaryAlign,cover:personalCover?old.cover:incoming.cover,notes:[...new Map([...old.notes,...incoming.notes].map(note=>[note.id,note])).values()]};
  }
  await this.saveNow(merged,incoming.cover,personalCover);return old?'updated':'created';
 });
 saveSettings=(patch:Partial<CardsSettings>)=>this.serial(async()=>{
  validateCardsPatch(patch);
  const file=this.app.vault.getAbstractFileByPath(this.configPath());
  if(!(file instanceof TFile))throw new Error('卡片配置笔记已移除，未覆盖其他文件。');
  const expected=this.snapshot.settings,assertEditors=await prepareNativeWrite(this.app,file,()=>this.active());
  let settings=expected;
  await this.app.vault.process(file,text=>{
   this.active();assertEditors(text);const parts=this.noteParts(text),current=this.settingsFrom(text);
   for(const key of Object.keys(patch) as Array<keyof CardsSettings>)if(JSON.stringify(current[key])!==JSON.stringify(expected[key]))throw new Error('所编辑的卡片设置已在其他窗口更新，请重新载入后修改。');
   const stored=parts.fields.bw_card_settings as Record<string,unknown>;
   const values={...stored,...patch,...('workbenchText' in patch?{workbenchText:{...current.workbenchText,...patch.workbenchText}}:{})};
   settings=readCardsSettings(values);parts.fields.bw_card_settings=values;
   return `---\n${stringifyYaml(parts.fields)}---\n${parts.body}`;
  });
  this.emit({settings});
 });

}
