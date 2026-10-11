import React from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {Notice,Setting,type DropdownComponent,type TextComponent} from 'obsidian';
import type {CardsAPI,CustomCardModule,WorkCardAppearance} from './types';
import {CARD_LAYOUTS,CARD_RATIOS,newModuleDraft,readModuleDraft,saveModuleDraft,type CardModuleDraft} from './settings';
import {addModuleChoices} from './module-choice';
import {newCardsBlock} from './embed-source';
import SettingsCardPreview from './SettingsCardPreview';
import type {WorkPropertiesManager} from './WorkPropertiesSessions';
export function addLayoutSettings(el:HTMLElement,api:CardsAPI){
  const settings=api.getSnapshot().settings;
  const update=async(module:CustomCardModule|undefined,kind:'book'|'film',field:'layout'|'orientation',value:string)=>{
    const current=api.getSnapshot().settings;
    if(module){await api.saveSettings({customModules:current.customModules.map(item=>item.id===module.id?{...item,appearance:{...item.appearance,[field]:value}}:item)});}
    else {const key=kind==='book'?'bookCardAppearance':'filmCardAppearance';await api.saveSettings({[key]:{...current[key],[field]:value}});}
  };
  const rows:[string,'book'|'film',WorkCardAppearance,CustomCardModule?][]=[['书籍','book',settings.bookCardAppearance],['影视','film',settings.filmCardAppearance],...settings.customModules.map(module=>[module.title,module.kind,module.appearance,module] as [string,'book'|'film',WorkCardAppearance,CustomCardModule])];
  for(const [label,kind,appearance,module] of rows)for(const [field,name,options,fallback] of [['layout','布局',CARD_LAYOUTS,'cylinder'],['orientation','弯曲画廊方向',{horizontal:'横向',vertical:'竖向'},'horizontal']] as const){
    new Setting(el).setName(`${label}卡片${name}`).addDropdown(control=>control.addOptions(options).setValue(appearance[field]??fallback).onChange(async value=>{
      control.setDisabled(true);try{await update(module,kind,field,value);}catch(error){const latest=api.getSnapshot().settings;control.setValue((module?latest.customModules.find(item=>item.id===module.id)?.appearance:kind==='book'?latest.bookCardAppearance:latest.filmCardAppearance)?.[field]??fallback);new Notice((error as Error).message);}finally{control.setDisabled(false);}
    }));
  }
}
export function addCardsSettings(el:HTMLElement,api:CardsAPI,_refresh:()=>void,manager?:WorkPropertiesManager):()=>void {
  const doc=el.ownerDocument,cleanups:Array<()=>void>=[],editors=new Set<{sync():void;refresh():void;dispose():void}>();
  let disposed=false;
  const create=<K extends keyof HTMLElementTagNameMap>(parent:HTMLElement,tag:K,text?:string)=>{
    const child=doc.createElement(tag);if(text)child.textContent=text;parent.append(child);return child;
  };
  const details=(parent:HTMLElement,label:string,open=false)=>{
    const group=create(parent,'details');group.className='bw-cards-settings-group';group.open=open;
    const summary=create(group,'summary',label),body=create(group,'div');body.className='bw-cards-settings-body';
    const toggle=()=>{for(const editor of editors)editor.sync();};group.addEventListener('toggle',toggle);cleanups.push(()=>group.removeEventListener('toggle',toggle));
    return {group,summary,body};
  };
  const visible=(node:HTMLElement)=>{
    if(disposed||doc.hidden||!node.isConnected)return false;
    for(let parent:HTMLElement|null=node;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS'&&!(parent as HTMLDetailsElement).open)return false;
    return true;
  };
  const addEditor=(parent:HTMLElement,initial:CardModuleDraft,label:string,open=false,creating=false,onCreated?:()=>void)=>{
    const {group,summary,body}=details(parent,label,open);if(creating)group.dataset.settingsGroup='add-module';else group.dataset.cardCollection=initial.id;
    const form=create(body,'fieldset');form.className='bw-cards-settings-form';
    let draft=structuredClone(initial),baseline=creating?null:structuredClone(initial),busy=false,root:Root|undefined,name:TextComponent|undefined;
    const inputs:Array<{field:keyof WorkCardAppearance;control:DropdownComponent;fallback:string}>=[];
    const preview=create(body,'div');preview.className='bw-cards-settings-preview-host';
    const error=create(form,'p');error.setAttribute('role','alert');error.className='bw-cards-settings-error';error.hidden=true;
    const fail=(failure:unknown)=>{error.textContent=failure instanceof Error?failure.message:String(failure);error.hidden=false;};
    let direction:Setting;
    const redraw=()=>{direction.settingEl.hidden=draft.appearance.layout!=='scroll-bend';editor.sync();};
    const controls=()=>{name?.setValue(draft.title);for(const input of inputs)input.control.setValue(String(draft.appearance[input.field]??input.fallback));redraw();};
    if(creating||(initial.id!=='book'&&initial.id!=='film'))new Setting(form).setName('模块名称').addText(control=>{name=control;control.inputEl.setAttribute('aria-label','模块名称');control.setValue(draft.title).onChange(value=>{draft={...draft,title:value};redraw();});});
    for(const [field,label,options,fallback] of [
      ['style','1. 卡片样式',{cover:'整幅封面',minimal:'简约'},'cover'],
      ['imageFit','2. 显示方式',{contain:'完整显示',cover:'填满裁切'},'contain'],
      ['material','3. 卡片材质',{paper:'纸感',matte:'磨砂',foil:'全息'},'paper'],
      ['ratio','4. 比例',CARD_RATIOS,'2:3'],
      ['layout','5. 动效布局',CARD_LAYOUTS,'cylinder'],
    ] as const)new Setting(form).setName(label).addDropdown(control=>{
      inputs.push({field,control,fallback});control.selectEl.setAttribute('aria-label',label);control.addOptions(options).setValue(String(draft.appearance[field]??fallback)).onChange(value=>{draft={...draft,appearance:{...draft.appearance,[field]:value}};redraw();});
    });
    direction=new Setting(form).setName('画廊方向').addDropdown(control=>{
      inputs.push({field:'orientation',control,fallback:'horizontal'});control.selectEl.setAttribute('aria-label','画廊方向');control.addOptions({horizontal:'横向',vertical:'竖向'}).setValue(draft.appearance.orientation??'horizontal').onChange(value=>{draft={...draft,appearance:{...draft.appearance,orientation:value as 'horizontal'|'vertical'}};redraw();});
    });
    const actions=new Setting(form).setDesc('选择会实时预览；点击保存后才更新模块。');
    actions.addButton(control=>control.setButtonText('保存并收起').setCta().onClick(async()=>{
      if(busy)return;busy=true;form.disabled=true;error.hidden=true;
      try{
        await saveModuleDraft(api,draft,baseline);
        if(disposed)return;
        if(creating){onCreated?.();draft=newModuleDraft();baseline=null;controls();}
        else{baseline=readModuleDraft(api.getSnapshot().settings,draft.id);if(baseline)draft=structuredClone(baseline);summary.textContent=draft.title;}
        group.open=false;editor.sync();summary.focus();
      }catch(failure){if(!disposed)fail(failure);}
      finally{busy=false;form.disabled=false;}
    }));
    actions.addButton(control=>control.setButtonText('重新载入').setTooltip('替换此处未保存的选择').onClick(()=>{
      const current=creating?newModuleDraft():readModuleDraft(api.getSnapshot().settings,draft.id);
      if(!current){fail(new Error('模块已移除，当前草稿仍保留。'));return;}
      draft=structuredClone(current);baseline=creating?null:structuredClone(current);error.hidden=true;controls();
    }));
    if(!creating&&initial.id!=='book'&&initial.id!=='film')actions.addButton(control=>control.setButtonText('移除').setTooltip('作品回到默认集合，笔记保留').onClick(async()=>{
      if(busy)return;busy=true;form.disabled=true;error.hidden=true;
      try{
        const settings=api.getSnapshot().settings;
        if(JSON.stringify(readModuleDraft(settings,draft.id))!==JSON.stringify(baseline))throw new Error('模块已在其他位置修改，请重新载入后再移除。');
        await api.saveSettings({customModules:settings.customModules.filter(module=>module.id!==draft.id)});
        editor.dispose();editors.delete(editor);group.remove();
      }catch(failure){if(!disposed)fail(failure);}
      finally{busy=false;form.disabled=false;}
    }));
    form.append(error);
    const editor={
      sync(){
        if(!manager||!visible(preview)){root?.unmount();root=undefined;return;}
        root??=createRoot(preview);root.render(React.createElement(SettingsCardPreview,{api,manager,draft,rename:title=>{draft={...draft,title};name?.setValue(title);redraw();}}));
      },
      refresh(){
        if(creating||busy)return;
        const current=readModuleDraft(api.getSnapshot().settings,draft.id);
        if(current&&JSON.stringify(draft)===JSON.stringify(baseline)&&JSON.stringify(current)!==JSON.stringify(baseline)){
          draft=structuredClone(current);baseline=structuredClone(current);summary.textContent=current.title;controls();
        }
      },
      dispose(){root?.unmount();root=undefined;},
    };
    editors.add(editor);redraw();return group;
  };
  const examples=details(el,'示例');examples.group.dataset.settingsGroup='examples';
  create(examples.body,'p','阅读和影视是两个默认集合，可添加、编辑或移除作品。这里的设置会应用于对应集合。');
  for(const id of ['book','film']){const draft=readModuleDraft(api.getSnapshot().settings,id)!;addEditor(examples.body,draft,draft.title,true);}
  let threeCard:{setValue(value:boolean):unknown};
  new Setting(el).setName('仅显示三张卡片').setDesc('同屏最多显示当前卡和两张邻卡；仍可浏览全部作品，作品数量不会改变。').addToggle(control=>{
    threeCard=control;control.toggleEl.setAttribute('aria-label','仅显示三张卡片');control.setValue(api.getSnapshot().settings.threeCardView).onChange(async value=>{control.setDisabled(true);try{await api.saveSettings({threeCardView:value});}catch(failure){control.setValue(api.getSnapshot().settings.threeCardView);new Notice((failure as Error).message);}finally{control.setDisabled(false);}});
  });
  const customList=create(el,'div');customList.className='bw-cards-settings-custom';
  const add=addEditor(el,newModuleDraft(),'添加卡片模块',false,true,()=>{
    const modules=api.getSnapshot().settings.customModules;
    for(const module of modules)if(!customList.querySelector(`[data-card-collection="${module.id}"]`))addEditor(customList,readModuleDraft(api.getSnapshot().settings,module.id)!,module.title);
  });
  el.insertBefore(add,customList);
  for(const module of api.getSnapshot().settings.customModules)addEditor(customList,readModuleDraft(api.getSnapshot().settings,module.id)!,module.title);
  const code=details(el,'笔记代码块生成');code.group.dataset.settingsGroup='code';
  create(code.body,'p','选择一个或多个已有模块。代码引用原有作品，并随模块设置更新。');
  const choices=create(code.body,'div'),selected=new Set<string>(['book']);
  const output=create(code.body,'textarea');output.setAttribute('aria-label','卡片模块代码');output.readOnly=true;output.rows=9;output.hidden=true;
  let generate:{setDisabled(value:boolean):unknown}|undefined,copy:{setDisabled(value:boolean):unknown}|undefined;
  cleanups.push(addModuleChoices(choices,api,selected,()=>{output.value='';output.hidden=true;generate?.setDisabled(selected.size===0);copy?.setDisabled(true);}));
  new Setting(code.body).addButton(control=>{
    generate=control;control.setButtonText('生成代码').setDisabled(!selected.size).onClick(()=>{
      try{output.value=newCardsBlock([...selected]);output.hidden=false;copy?.setDisabled(false);}catch(failure){new Notice((failure as Error).message);}
    });
  }).addButton(control=>{
    copy=control;control.setButtonText('复制代码').setDisabled(true).onClick(async()=>{
      try{await doc.defaultView!.navigator.clipboard.writeText(output.value);new Notice('卡片模块代码已复制。');}
      catch{output.focus();output.select();new Notice('无法自动复制，请复制已选中的代码。');}
    });
  });
  const sync=()=>{for(const editor of editors){editor.refresh();editor.sync();}threeCard?.setValue(api.getSnapshot().settings.threeCardView);};
  cleanups.push(api.subscribe(sync));doc.addEventListener('visibilitychange',sync);cleanups.push(()=>doc.removeEventListener('visibilitychange',sync));
  return()=>{if(disposed)return;disposed=true;for(const editor of editors)editor.dispose();editors.clear();for(const cleanup of cleanups.splice(0))cleanup();};
}
