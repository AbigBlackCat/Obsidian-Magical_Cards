import { Notice, Setting } from 'obsidian';
import type {CardsAPI,CustomCardModule,WorkCardAppearance} from './types';
import { CARD_LAYOUTS } from './settings';
import { CardsSettingsController } from './settings-controller';
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
export { CardsSettingsController } from './settings-controller';
export function addCardsSettings(el: HTMLElement, api: CardsAPI, _refresh: () => void, manager?: WorkPropertiesManager): () => void {
  const controller = new CardsSettingsController(api, manager, { structureChanged: () => controller.renderFallback(el) });
  controller.renderFallback(el);
  return () => controller.dispose();
}
