import React from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MarkdownView,Notice,type App,type Component} from 'obsidian';
import {WorkPropertiesManager,WorkPropertiesPanel} from './WorkProperties';
import type {CardsAPI} from './types';

interface MountedPanel { id:string; el:HTMLElement; root:Root; raw:boolean; ready:boolean; }

/** The editor and reading headers are local compatibility boundaries; leave native properties visible if either is unavailable. */
export class WorkPropertiesHost {
 private manager:WorkPropertiesManager;
 private panels=new Map<MarkdownView,MountedPanel>();
 private observers=new Map<MarkdownView,MutationObserver>();
 private failed=new Map<MarkdownView,string>();
 private unsubscribe:()=>void;
 private frame=0;
 private stopped=false;
 constructor(private app:App,private api:CardsAPI,plugin:Component,private sharedManager?:WorkPropertiesManager){
  this.manager=sharedManager??new WorkPropertiesManager(api);
  this.unsubscribe=api.subscribe(this.schedule);
  for(const event of ['file-open','layout-change','active-leaf-change'] as const)plugin.registerEvent(app.workspace.on(event as 'layout-change',this.schedule));
  this.schedule();
 }
 private schedule=()=>{
  if(this.stopped||this.frame)return;
  this.frame=window.requestAnimationFrame(()=>{this.frame=0;this.update();});
 };
 private header(view:MarkdownView){
  return view.getMode()==='preview'
   ?view.contentEl.querySelector<HTMLElement>('.markdown-preview-sizer > .mod-header')
   :view.contentEl.querySelector<HTMLElement>('.markdown-source-view.is-live-preview .cm-sizer');
 }
 private update(){
  if(this.stopped)return;
  const views=new Set(this.app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).filter((view):view is MarkdownView=>view instanceof MarkdownView));
  for(const view of this.observers.keys())if(!views.has(view)){this.remove(view);this.observers.get(view)?.disconnect();this.observers.delete(view);this.failed.delete(view);}
  for(const view of views){
   const work=this.api.getSnapshot().entities.find(entity=>entity.path===view.file?.path&&(entity.type==='book'||entity.type==='film'));
   if(!work){this.remove(view);this.observers.get(view)?.disconnect();this.observers.delete(view);this.failed.delete(view);continue;}
   if(this.failed.get(view)===work.id)continue;
   this.failed.delete(view);
   if(!this.observers.has(view)){
    const observer=new MutationObserver(this.schedule);observer.observe(view.contentEl,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});this.observers.set(view,observer);
   }
   const header=this.header(view),existing=this.panels.get(view);
   if(!header){this.remove(view);continue;}
   if(existing?.id===work.id&&existing.el.parentElement===header)continue;
   this.remove(view);
   if(header.querySelector('.bw-work-properties-host'))continue;
   const el=document.createElement('div');el.className='bw-work-properties-host';header.prepend(el);
   const root=createRoot(el,{onUncaughtError:()=>{this.failed.set(view,work.id);this.remove(view);new Notice('作品编辑区未能打开，已保留原始属性。');}});
   const panel:MountedPanel={id:work.id,el,root,raw:false,ready:false};this.panels.set(view,panel);
   const apply=()=>{
    if(this.stopped||this.panels.get(view)!==panel)return;
    view.contentEl.classList.toggle('bw-work-note',panel.ready);
    view.contentEl.classList.toggle('bw-work-raw-visible',panel.ready&&panel.raw);
   };
   root.render(<WorkPropertiesPanel api={this.api} session={this.manager.getSession(work.id)} onReady={ready=>{panel.ready=ready;apply();}} onRawChange={raw=>{panel.raw=raw;apply();}}/>);
  }
 }
 private remove(view:MarkdownView){
  const panel=this.panels.get(view);
  if(panel){this.panels.delete(view);void this.manager.flush(panel.id).catch(error=>new Notice(`作品属性未能保存：${(error as Error).message}`));panel.root.unmount();panel.el.remove();}
  if(panel)view.contentEl.classList.remove('bw-work-note','bw-work-raw-visible');
 }
 stop():Promise<void>{
  if(this.stopped)return Promise.resolve();
  this.stopped=true;window.cancelAnimationFrame(this.frame);this.unsubscribe();
  for(const observer of this.observers.values())observer.disconnect();this.observers.clear();
  const saving=this.manager.flushAll();
  for(const view of [...this.panels.keys()])this.remove(view);
  return saving.finally(()=>{if(!this.sharedManager)this.manager.dispose();});
 }
}
