import {Notice,Setting} from 'obsidian';
import type {CardsAPI,CustomCardModule,WorkCardAppearance} from './types';
import {CARD_LAYOUTS,CARD_RATIOS,newCustomModule} from './settings';
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
export function addCardsSettings(el:HTMLElement,api:CardsAPI,refresh:()=>void){
  const settings=api.getSnapshot().settings;
  new Setting(el).setName('仅显示三张卡片').addToggle(control=>control.setValue(settings.threeCardView).onChange(async value=>{control.setDisabled(true);try{await api.saveSettings({threeCardView:value});}catch(error){control.setValue(api.getSnapshot().settings.threeCardView);new Notice((error as Error).message);}finally{control.setDisabled(false);}}));
  for(const [key,label] of [['bookCardAppearance','书籍'],['filmCardAppearance','影视']] as const)for(const [field,name,options] of [['material','材质',{paper:'纸感',matte:'磨砂',foil:'全息'}],['style','样式',{minimal:'简约',cover:'整幅封面'}]] as const){
    new Setting(el).setName(`${label}卡片${name}`).addDropdown(control=>control.addOptions(options).setValue(settings[key][field]).onChange(async value=>{control.setDisabled(true);try{await api.saveSettings({[key]:{...api.getSnapshot().settings[key],[field]:value}});}catch(error){control.setValue(api.getSnapshot().settings[key][field]);new Notice((error as Error).message);}finally{control.setDisabled(false);}}));
  }
  let title='';
  new Setting(el).setName('添加卡片模块').addText(control=>control.onChange(value=>{title=value;})).addButton(control=>control.setButtonText('添加').onClick(async()=>{if(!title.trim())return;control.setDisabled(true);try{await api.saveSettings({customModules:[...api.getSnapshot().settings.customModules,newCustomModule(title,api.getSnapshot().settings.filmCardAppearance)]});refresh();}catch(error){new Notice((error as Error).message);control.setDisabled(false);}}));
  for(const module of settings.customModules){
    const update=(patch:Partial<CustomCardModule>)=>api.saveSettings({customModules:api.getSnapshot().settings.customModules.map(item=>item.id===module.id?{...item,...patch}:item)});
    new Setting(el).setName('模块名称').setDesc('移除后作品回到默认集合，笔记仍保留。').addText(control=>{let draft=module.title;control.setValue(draft).onChange(value=>{draft=value;});control.inputEl.addEventListener('blur',()=>{if(!draft.trim()){control.setValue(module.title);return;}if(draft.trim()!==module.title)void update({title:draft.trim()}).catch(error=>{control.setValue(module.title);new Notice((error as Error).message);});});}).addButton(control=>control.setButtonText('移除').onClick(async()=>{control.setDisabled(true);try{await api.saveSettings({customModules:api.getSnapshot().settings.customModules.filter(item=>item.id!==module.id)});refresh();}catch(error){new Notice((error as Error).message);control.setDisabled(false);}}));
    for(const [field,name,options,fallback] of [['ratio','比例',CARD_RATIOS,'2:3'],['imageFit','图片显示方式',{contain:'完整显示',cover:'填满裁切'},'contain']] as const)new Setting(el).setName(`${module.title}${name}`).addDropdown(control=>control.addOptions(options).setValue(module[field]??fallback).onChange(async value=>{control.setDisabled(true);try{await update({[field]:value});}catch(error){control.setValue(module[field]??fallback);new Notice((error as Error).message);}finally{control.setDisabled(false);}}));
    for(const [field,name,options] of [['material','材质',{paper:'纸感',matte:'磨砂',foil:'全息'}],['style','样式',{minimal:'简约',cover:'整幅封面'}]] as const)new Setting(el).setName(`${module.title}卡片${name}`).addDropdown(control=>control.addOptions(options).setValue(module.appearance[field]).onChange(async value=>{control.setDisabled(true);try{const latest=api.getSnapshot().settings.customModules.find(item=>item.id===module.id);if(!latest)throw new Error('模块已移除。');await update({appearance:{...latest.appearance,[field]:value}});}catch(error){control.setValue(module.appearance[field]);new Notice((error as Error).message);}finally{control.setDisabled(false);}}));
  }
  addLayoutSettings(el,api);
}
