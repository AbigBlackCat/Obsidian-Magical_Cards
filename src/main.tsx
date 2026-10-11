import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Plugin, ItemView, WorkspaceLeaf, PluginSettingTab, Setting, Notice, Platform } from 'obsidian';
import { acquireCards, type CardsLease } from './runtime';
import CardsSurface from './CardsSurface';
import { newCardsBlock } from './embed-source';
import { chooseCardsModules } from './module-choice';
import { addCardsSettings } from './settings-tab';
import { validFolder } from './persistence';
import { CardsOnboarding, loadCardsPluginData, prepareFirstRunIntent, type CardsPluginData } from './onboarding';
const VIEW = 'barry-cards';
class CardsView extends ItemView {
  private root?: Root;
  private lease: CardsLease;
  constructor(leaf: WorkspaceLeaf, plugin: MagicalCardsPlugin) { super(leaf); this.lease = plugin.cardsLease; }
  getViewType() { return VIEW; }
  getDisplayText() { return 'Magical Cards'; }
  getIcon() { return 'gallery-horizontal'; }
  async onOpen() { this.contentEl.empty(); this.root = createRoot(this.contentEl); this.root.render(<CardsSurface api={this.lease.api} manager={this.lease.propertiesManager} />); }
  async onClose() { try { await this.lease.propertiesManager.flushAll(); } catch (error) { new Notice(`卡片草稿已保留：${(error as Error).message}`); } this.root?.unmount(); this.root = undefined; }
}
class CardsSettingsTab extends PluginSettingTab {
  private dispose?: () => void;
  constructor(private plugin: MagicalCardsPlugin) { super(plugin.app, plugin); }
  display() {
    this.dispose?.(); this.dispose = undefined;
    const el = this.containerEl; el.empty();
    let draft = this.plugin.rootFolder;
    new Setting(el).setName('卡片目录').setDesc('填写当前笔记库内的相对目录，例如 卡片库。作品保存在其下的书籍／观影目录，配置保存在 _数据/卡片配置.md。切换目录不会搬运原有作品。').addText(control => control.setValue(draft).onChange(value => { draft = value; })).addButton(control => control.setButtonText('应用').onClick(async () => { control.setDisabled(true); try { await this.plugin.changeRoot(draft); this.display(); } catch (error) { new Notice((error as Error).message); control.setDisabled(false); } }));
    this.dispose = addCardsSettings(el, this.plugin.cardsLease.api, () => this.display(), this.plugin.cardsLease.propertiesManager);
  }
  hide() { this.dispose?.(); this.dispose = undefined; }
}
export default class MagicalCardsPlugin extends Plugin {
  cardsLease!: CardsLease;
  rootFolder = '卡片库';
  private unloaded = false;
  private localData: CardsPluginData = { rootFolder: '卡片库' };
  private dataQueue: Promise<unknown> = Promise.resolve();
  private onboarding?: CardsOnboarding;
  private assertActive = () => { if (this.unloaded) throw new Error('插件已停用，操作已取消。'); };
  private updateData = (patch: Partial<CardsPluginData>): Promise<void> => {
    const next = this.dataQueue.catch(() => {}).then(async () => {
      this.assertActive(); const data = { ...this.localData, ...patch };
      await this.saveData(data); this.assertActive(); this.localData = data;
    });
    this.dataQueue = next; return next;
  };
  private bindOnboarding(lease: CardsLease, folder: string) {
    return new CardsOnboarding({ app: this.app, api: lease.api, rootFolder: folder, ready: lease.ready,
      data: () => this.localData, update: this.updateData,
      assertActive: () => { this.assertActive(); if (this.cardsLease !== lease) throw new Error('卡片目录已改变，原目录的初始化已暂停。'); },
      open: async file => { await this.app.workspace.getLeaf('tab').openFile(file, { state: { mode: 'preview' } }); }
    });
  }
  async onload() {
    if (!Platform.isDesktopApp) { new Notice('Magical Cards 仅支持 Obsidian 桌面版。'); return; }
    const saved = await this.loadData(); this.assertActive();
    const loaded = await loadCardsPluginData(this.app, saved); this.assertActive();
    this.localData = loaded.data; this.rootFolder = loaded.data.rootFolder;
    if (loaded.needsSave) await this.updateData({});
    const firstRunIntent = await prepareFirstRunIntent(this.app, this.localData, this.assertActive);
    if (firstRunIntent) await this.updateData({ firstRunIntent });
    this.assertActive();
    this.cardsLease = await acquireCards(this.app, this.rootFolder, this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`);
    if (this.unloaded) { await this.cardsLease.release(); return; }
    this.onboarding = this.bindOnboarding(this.cardsLease, this.rootFolder);
    this.registerView(VIEW, leaf => new CardsView(leaf, this));
    this.addRibbonIcon('gallery-horizontal', '打开 Magical Cards', () => { void this.openCards(); });
    this.addCommand({ id: 'open', name: '打开卡片视图', callback: () => { void this.openCards(); } });
    this.addCommand({ id: 'help', name: '查看示例及用法说明', callback: () => { void this.openHelp().catch(error => new Notice((error as Error).message)); } });
    this.addCommand({ id: 'insert-module', name: '插入卡片模块', editorCallback: async editor => {
      try {
        const lease = this.cardsLease;
        const collections = await chooseCardsModules(this.app, lease.api);
        if (!collections) return;
        this.assertActive();
        if (this.cardsLease !== lease) throw new Error('卡片目录已改变，请重新选择要插入的模块。');
        editor.replaceSelection(newCardsBlock(collections));
      }
      catch (error) { new Notice((error as Error).message); }
    } });
    this.addSettingTab(new CardsSettingsTab(this));
    this.app.workspace.onLayoutReady(() => {
      if (!this.unloaded) void this.onboarding?.run().catch(error => { if (!this.unloaded) new Notice(`首次展示尚未完成，可通过「查看示例及用法说明」重试：${(error as Error).message}`); });
    });
  }
  async openCards() { this.assertActive(); let leaf = this.app.workspace.getLeavesOfType(VIEW)[0]; if (!leaf) { leaf = this.app.workspace.getLeaf('tab'); await leaf.setViewState({ type: VIEW, active: true }); } this.assertActive(); await this.app.workspace.revealLeaf(leaf); }
  async openHelp() { this.assertActive(); await this.onboarding?.openGuide(); }
  async changeRoot(folder: string) {
    this.assertActive(); if (folder === this.rootFolder) return; if (!validFolder(folder)) throw new Error('请使用笔记库内的普通目录。');
    const next = await acquireCards(this.app, folder, this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`);
    try { this.assertActive(); await this.updateData({ rootFolder: next.api.rootFolder, ...(!this.localData.onboarding ? { installationOrigin: 'legacy' as const } : {}) }); this.assertActive(); }
    catch (error) { await next.release(); throw error; }
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) leaf.detach();
    const old = this.cardsLease; this.cardsLease = next; this.rootFolder = next.api.rootFolder;
    this.onboarding = this.bindOnboarding(next, this.rootFolder); await old.release();
  }
  onunload() { this.unloaded = true; for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) leaf.detach(); void this.cardsLease?.release(); }
}
