import { Modal, Notice, Setting, type App } from 'obsidian';
import type { CardsAPI, CardsSettings } from './types';

export function cardModuleChoices(settings: CardsSettings, includeHidden = false): Array<{ id: string; label: string }> {
  return [{ id: 'book', label: settings.workbenchText['book.title']?.trim() || '阅读' }, { id: 'film', label: settings.workbenchText['film.title']?.trim() || '影视' }, ...settings.customModules.map(module => ({ id: module.id, label: module.title }))]
    .filter(module => !settings.deletedModuleIds?.includes(module.id) && (includeHidden || !settings.hiddenModuleIds?.includes(module.id)));
}

export function addModuleChoices(el: HTMLElement, api: CardsAPI, selected: Set<string>, change: () => void): () => void {
  let sequence = '';
  const render = () => {
    const choices = cardModuleChoices(api.getSnapshot().settings), next = JSON.stringify(choices);
    if (next === sequence) return;
    sequence = next;
    for (const id of selected) if (!choices.some(choice => choice.id === id)) selected.delete(id);
    el.replaceChildren();
    for (const choice of choices) new Setting(el).setName(choice.label).addToggle(control => {
      control.toggleEl.setAttribute('aria-label',choice.label);
      control.setValue(selected.has(choice.id)).onChange(value => {
        if (value) selected.add(choice.id); else selected.delete(choice.id);
        change();
      });
    });
    change();
  };
  render();
  return api.subscribe(render);
}

export function chooseCardsModules(app: App, api: CardsAPI): Promise<string[] | null> {
  return new Promise(resolve => {
    class ModuleChoiceModal extends Modal {
      private selected = new Set<string>(['book']);
      private cleanup?: () => void;
      private result: string[] | null = null;
      onOpen() {
        this.titleEl.setText('插入卡片模块');
        this.contentEl.createEl('p', { text: '选择一个或多个已有模块，代码引用原有作品。' });
        const choices = this.contentEl.createDiv();
        let confirm: { setDisabled(value: boolean): unknown } | undefined;
        this.cleanup = addModuleChoices(choices, api, this.selected, () => confirm?.setDisabled(this.selected.size === 0));
        new Setting(this.contentEl).addButton(control => control.setButtonText('取消').onClick(() => this.close())).addButton(control => {
          confirm = control;
          control.setButtonText('插入').setCta().setDisabled(this.selected.size === 0).onClick(() => {
            const available = cardModuleChoices(api.getSnapshot().settings).map(choice => choice.id);
            if (!this.selected.size || [...this.selected].some(id => !available.includes(id))) { new Notice('所选模块已改变，请重新选择。'); return; }
            this.result = available.filter(id => this.selected.has(id));
            this.close();
          });
        });
      }
      onClose() { this.cleanup?.(); this.cleanup = undefined; resolve(this.result); }
    }
    new ModuleChoiceModal(app).open();
  });
}
