import React from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {Plugin,ItemView,WorkspaceLeaf,PluginSettingTab,Setting,Notice,Platform} from 'obsidian';
import {acquireCards,type CardsLease} from './runtime';
import CardsSurface from './CardsSurface';
import {newCardsBlock} from './embed-source';
import {addCardsSettings} from './settings-tab';
import {validFolder} from './persistence';
const VIEW='barry-cards';
class CardsView extends ItemView {
 private root?:Root;
 constructor(leaf:WorkspaceLeaf,private plugin:BarryCardsPlugin){super(leaf);}
 getViewType(){return VIEW;}getDisplayText(){return 'Barry Cards';}getIcon(){return 'gallery-horizontal';}
 async onOpen(){this.contentEl.empty();this.root=createRoot(this.contentEl);this.root.render(<CardsSurface api={this.plugin.cardsLease.api} manager={this.plugin.cardsLease.propertiesManager}/>);}
 async onClose(){try{await this.plugin.cardsLease.propertiesManager.flushAll();}catch(error){new Notice(`卡片草稿已保留：${(error as Error).message}`);}this.root?.unmount();this.root=undefined;}
}
class CardsSettingsTab extends PluginSettingTab {
 constructor(private plugin:BarryCardsPlugin){super(plugin.app,plugin);}
 display(){
  const el=this.containerEl;el.empty();el.createEl('h2',{text:'Barry Cards'});
  let draft=this.plugin.rootFolder;
  new Setting(el).setName('卡片目录').setDesc('与工作台使用相同目录时，共用作品笔记和卡片配置。').addText(control=>control.setValue(draft).onChange(value=>{draft=value;})).addButton(control=>control.setButtonText('应用').onClick(async()=>{control.setDisabled(true);try{await this.plugin.changeRoot(draft);this.display();}catch(error){new Notice((error as Error).message);control.setDisabled(false);}}));
  addCardsSettings(el,this.plugin.cardsLease.api,()=>this.display());
 }
}
export default class BarryCardsPlugin extends Plugin {
 cardsLease!:CardsLease;
 rootFolder='工作台';
 private unloaded=false;
 async onload(){
  if(!Platform.isDesktopApp){new Notice('Barry Cards 仅支持 Obsidian 桌面版。');return;}
  const saved=await this.loadData();this.rootFolder=typeof saved?.rootFolder==='string'?saved.rootFolder:'工作台';
  this.cardsLease=await acquireCards(this.app,this.rootFolder,this.manifest.dir??`${this.app.vault.configDir}/plugins/${this.manifest.id}`);
  if(this.unloaded){await this.cardsLease.release();return;}
  this.registerView(VIEW,leaf=>new CardsView(leaf,this));
  this.addRibbonIcon('gallery-horizontal','打开 Barry Cards',()=>{void this.openCards();});
  this.addCommand({id:'open',name:'打开卡片视图',callback:()=>{void this.openCards();}});
  this.addCommand({id:'insert-module',name:'插入卡片模块',editorCallback:editor=>{editor.replaceSelection(newCardsBlock());}});
  this.addSettingTab(new CardsSettingsTab(this));
 }
 async openCards(){let leaf=this.app.workspace.getLeavesOfType(VIEW)[0];if(!leaf){leaf=this.app.workspace.getLeaf('tab');await leaf.setViewState({type:VIEW,active:true});}await this.app.workspace.revealLeaf(leaf);}
 async changeRoot(folder:string){
  if(folder===this.rootFolder)return;if(!validFolder(folder))throw new Error('请使用笔记库内的普通目录。');
  const next=await acquireCards(this.app,folder,this.manifest.dir??`${this.app.vault.configDir}/plugins/${this.manifest.id}`);
  try{await this.saveData({rootFolder:folder});}catch(error){await next.release();throw error;}
  for(const leaf of this.app.workspace.getLeavesOfType(VIEW))leaf.detach();
  const old=this.cardsLease;this.cardsLease=next;this.rootFolder=folder;await old.release();
 }
 onunload(){this.unloaded=true;for(const leaf of this.app.workspace.getLeavesOfType(VIEW))leaf.detach();void this.cardsLease?.release();}
}
