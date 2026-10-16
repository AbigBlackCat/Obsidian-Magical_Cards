import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Plugin, ItemView, PluginSettingTab, Notice, requireApiVersion } from 'obsidian';
import type { SettingDefinitionItem, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { acquireCards, type CardsLease } from './runtime';
import CardsDashboardView, { flushDashboardEdits } from './CardsDashboardView';
import { newCardsBlock } from './embed-source';
import { chooseCardsModules } from './module-choice';
import { CardsSettingsController } from './settings-tab';
import { validFolder } from './persistence';
import { CardsOnboarding, loadCardsPluginData, prepareFirstRunIntent, type CardsPluginData } from './onboarding';
import { MAGICAL_CARDS_ICON, registerCardsIcon } from './brand';
import { getShowcaseManager } from './showcase-sessions';
const VIEW = 'barry-cards';
class CardsView extends ItemView {
  private root?: Root;
  private lease: CardsLease;
  private dashboardId = '';
  private viewId: string = crypto.randomUUID();
  constructor(leaf: WorkspaceLeaf, plugin: MagicalCardsPlugin, private closed: () => void) { super(leaf); this.lease = plugin.cardsLease; }
  getViewType() { return VIEW; }
  getDisplayText() { return 'Magical Cards'; }
  getIcon() { return MAGICAL_CARDS_ICON; }
  private render() { this.root?.render(<CardsDashboardView api={this.lease.api} manager={this.lease.propertiesManager} dashboardId={this.dashboardId} viewId={this.viewId} onDashboardChange={id => { this.dashboardId = id; this.render(); void this.app.workspace.requestSaveLayout(); }} />); }
  getState() { return { ...super.getState(), dashboardId: this.dashboardId, viewId: this.viewId }; }
  async setState(state: unknown, result: ViewStateResult) {
    const next = state && typeof state === 'object' && 'dashboardId' in state && typeof state.dashboardId === 'string' ? state.dashboardId : '';
    if (state && typeof state === 'object' && 'viewId' in state && typeof state.viewId === 'string' && /^[A-Za-z0-9_-]{1,180}$/.test(state.viewId)) this.viewId = state.viewId;
    if (this.root && next !== this.dashboardId) await flushDashboardEdits(this.lease.api, this.lease.propertiesManager, this.contentEl);
    this.dashboardId = next;
    await super.setState(state, result); this.render();
  }
  async onOpen() { this.contentEl.empty(); this.root = createRoot(this.contentEl); this.render(); }
  async onClose() { if (this.root) { try { await this.lease.propertiesManager.flushAll(); await getShowcaseManager(this.lease.api)?.flushAll(); } catch (error) { new Notice(`卡片草稿已保留：${(error as Error).message}`); } this.dispose(); } this.closed(); }
  dispose() { this.root?.unmount(); this.root = undefined; }
}
export class CardsSettingsTab extends PluginSettingTab {
  private controller?: CardsSettingsController;
  constructor(private plugin: MagicalCardsPlugin) { super(plugin.app, plugin); }
  private getController() {
    this.controller ??= new CardsSettingsController(this.plugin.cardsLease.api, this.plugin.cardsLease.propertiesManager, {
      directory: { get: () => this.plugin.rootFolder, apply: async folder => {
        await this.plugin.changeRoot(folder); this.controller?.dispose(); this.controller = undefined;
        this.refreshSettings();
      } },
      structureChanged: () => { this.refreshSettings(); },
      domStateChanged: () => { if (requireApiVersion('1.13.0')) this.refreshDomState(); },
    });
    return this.controller;
  }
  private refreshSettings() {
    if (requireApiVersion('1.13.0')) this.update();
    else this.getController().renderFallback(this.containerEl);
  }
  getSettingDefinitions(): SettingDefinitionItem[] { return this.getController().getDefinitions(); }
  display() {
    this.getController().renderFallback(this.containerEl);
  }
  hide() { this.controller?.hide(); }
  dispose() { this.controller?.dispose(); this.controller = undefined; }
}
export default class MagicalCardsPlugin extends Plugin {
  cardsLease!: CardsLease;
  rootFolder = '卡片库';
  private unloaded = false;
  private localData: CardsPluginData = { rootFolder: '卡片库' };
  private dataQueue: Promise<unknown> = Promise.resolve();
  private onboarding?: CardsOnboarding;
  private settingsTab?: CardsSettingsTab;
  private cardViews = new Set<CardsView>();
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
    registerCardsIcon();
    const saved: unknown = await this.loadData(); this.assertActive();
    const loaded = await loadCardsPluginData(this.app, saved); this.assertActive();
    this.localData = loaded.data; this.rootFolder = loaded.data.rootFolder;
    if (loaded.needsSave) await this.updateData({});
    const firstRunIntent = await prepareFirstRunIntent(this.app, this.localData, this.assertActive);
    if (firstRunIntent) await this.updateData({ firstRunIntent });
    this.assertActive();
    this.cardsLease = await acquireCards(this.app, this.rootFolder, this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`);
    if (this.unloaded) { await this.cardsLease.release(); return; }
    if (!this.cardsLease.api.showcase) new Notice('橱窗及模块恢复需要新版共享卡片能力。请升级当前启用的兼容插件后再使用这些功能。已有资料已保留。');
    this.onboarding = this.bindOnboarding(this.cardsLease, this.rootFolder);
    this.registerView(VIEW, leaf => { const view = new CardsView(leaf, this, () => { this.cardViews.delete(view); }); this.cardViews.add(view); this.register(() => { view.dispose(); this.cardViews.delete(view); }); return view; });
    this.addRibbonIcon(MAGICAL_CARDS_ICON, '打开 Magical Cards', () => { void this.openCards(); }).addClass('magical-cards-ribbon');
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
    this.settingsTab = new CardsSettingsTab(this); this.addSettingTab(this.settingsTab);
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
  onunload() { this.unloaded = true; this.settingsTab?.dispose(); for (const view of this.cardViews) view.dispose(); this.cardViews.clear(); void this.cardsLease?.release(); }
}
