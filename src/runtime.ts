import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Component, MarkdownRenderChild, Notice, Plugin, normalizePath, type App, type PluginManifest } from 'obsidian';
import { CardsStore } from './store';
import { WorkPropertiesManager } from './WorkPropertiesSessions';
import { WorkPropertiesHost } from './WorkPropertiesHost';
import { WorkOrderList } from './WorkOrder';
import { registerCardsEmbeds, type EmbeddedRuntime } from './embeds';
import type { CardsSettings, WorkKind } from './types';

export interface CardsLease { api: CardsStore; propertiesManager: WorkPropertiesManager; ready: Promise<void>; release(): Promise<void>; }
interface Library { api: CardsStore; component: Component; manager?: WorkPropertiesManager; host?: WorkPropertiesHost; references: number; ready: Promise<void>; closing?: Promise<void>; children: Set<MarkdownRenderChild>; }
interface AppRuntime { app: App; registrar: Plugin; libraries: Map<string, Library>; ready: Promise<void>; registered: boolean; processorError?: unknown; }
const key = Symbol.for('barry-cards.runtime.v1');
const globals = globalThis as typeof globalThis & { [key: symbol]: unknown };
const registry = (globals[key] ??= new WeakMap<App, AppRuntime>()) as WeakMap<App, AppRuntime>;
const runtimeManifest: PluginManifest = { id: 'barry-cards-runtime', name: 'Barry Cards runtime', version: '1.0.0', minAppVersion: '1.11.4', author: 'AbigBlackCat', description: 'Shared card rendering lifecycle', isDesktopOnly: true };
class CardsRegistrar extends Plugin {}

class WorkOrderChild extends MarkdownRenderChild {
  private root?: Root;
  constructor(container: HTMLElement, private library: Library, private kind: WorkKind) { super(container); }
  onload() { this.containerEl.empty(); this.root = createRoot(this.containerEl); this.root.render(React.createElement(WorkOrderList, { api: this.library.api, kind: this.kind })); }
  onunload() { this.root?.unmount(); this.root = undefined; this.library.children.delete(this); }
}
function chooseLibrary(runtime: AppRuntime, sourcePath: string): Library | undefined {
  const libraries = [...runtime.libraries.entries()].filter(([, library]) => library.manager && !library.closing);
  const matching = libraries.filter(([folder]) => sourcePath.startsWith(`${folder}/`)).sort(([a], [b]) => b.length - a.length);
  return matching[0]?.[1] ?? (libraries.length === 1 ? libraries[0][1] : undefined);
}
function registerProcessors(runtime: AppRuntime) {
  if (runtime.processorError) throw runtime.processorError;
  if (runtime.registered) return;
  try {
  registerCardsEmbeds(runtime.registrar, sourcePath => {
    const library = chooseLibrary(runtime, sourcePath);
    return library?.manager ? { api: library.api, manager: library.manager, trackChild: child => { library.children.add(child); return () => library.children.delete(child); } } satisfies EmbeddedRuntime : undefined;
  });
  runtime.registrar.registerMarkdownCodeBlockProcessor('barry-work-order', (source, element, context) => {
    const kind = source.trim(), library = chooseLibrary(runtime, context.sourcePath);
    if (context.frontmatter?.bw_view !== 'work-order' || (kind !== 'book' && kind !== 'film') || !library) { element.createEl('p', { text: '请在作品排序笔记中使用 book 或 film 分组。' }); return; }
    const child = new WorkOrderChild(element, library, kind); library.children.add(child); context.addChild(child);
  });
  runtime.registered = true;
  } catch (error) { runtime.processorError = error; throw error; }
}
async function backupDrafts(app: App, manager: WorkPropertiesManager, directory: string, error: unknown) {
  const drafts = manager.recoveryDrafts(), message = error instanceof Error ? error.message : String(error);
  if (!drafts.length) { new Notice(`作品属性未能保存：${message}`); return; }
  const path = normalizePath(`${directory}/card-drafts-recovery-${Date.now()}.json`);
  try { await app.vault.adapter.write(path, JSON.stringify({ savedAt: new Date().toISOString(), drafts }, null, 2)); new Notice(`作品属性未能保存：${message}\n未保存文字已备份至 ${path}`); }
  catch (failure) { new Notice(`作品属性未能保存：${message}\n恢复文件 ${path} 写入失败：${failure instanceof Error ? failure.message : String(failure)}`); }
}

export async function acquireCards(app: App, rootFolder: string, recoveryDir: string, migrationSettings?: Partial<CardsSettings>): Promise<CardsLease> {
  const folder = normalizePath(rootFolder);
  let runtime = registry.get(app);
  if (!runtime) {
    const registrar = new CardsRegistrar(app, runtimeManifest);
    runtime = { app, registrar, libraries: new Map(), ready: Promise.resolve().then(() => registrar.load()), registered: false };
    registry.set(app, runtime);
  }
  let library = runtime.libraries.get(folder);
  if (library?.closing) { await library.closing; return acquireCards(app, folder, recoveryDir, migrationSettings); }
  if (!library) {
    const api = new CardsStore(app, folder, migrationSettings), component = new Component(); component.load();
    library = { api, component, references: 0, ready: Promise.resolve(), children: new Set() };
    const created = library;
    runtime.libraries.set(folder, created);
    created.manager = new WorkPropertiesManager(api);
    created.host = new WorkPropertiesHost(app, api, component, created.manager);
    created.ready = api.initialize().then(() => {
      for (const event of ['create', 'modify', 'delete'] as const) component.registerEvent(app.vault.on(event as 'modify', api.invalidate));
      component.registerEvent(app.vault.on('rename', (file, oldPath) => {
        api.invalidate(); void api.followLinkedNoteRename(() => file.path, oldPath).catch(error => new Notice(`关联笔记路径未能更新：${error instanceof Error ? error.message : String(error)}`));
      }));
    });
    if(app.workspace.layoutReady===false)void created.ready.catch(error=>{if(created.references&&!created.closing)new Notice(`卡片库启动未完成：${error instanceof Error?error.message:String(error)}`);});
  }
  const current = library, owner = runtime;
  current.references++;
  try { await owner.ready; if(app.workspace.layoutReady!==false)await current.ready; registerProcessors(owner); }
  catch (error) {
    current.references--;
    if (!current.references) { await current.host?.stop().catch(() => {}); current.component.unload(); current.manager?.dispose(); current.api.destroy(); owner.libraries.delete(folder); }
    if (!owner.libraries.size) { owner.registrar.unload(); registry.delete(app); }
    throw error;
  }
  let released = false;
  return { api: current.api, propertiesManager: current.manager!, ready: current.ready, release: async () => {
    if (released) return;
    released = true;
    if (--current.references) return;
    current.closing = (async () => {
      try { await current.host?.stop(); await current.manager!.flushAll(); }
      catch (error) { await backupDrafts(app, current.manager!, recoveryDir, error); }
      await current.api.settle();
      for (const child of [...current.children]) child.unload(); current.children.clear();
      current.component.unload(); current.manager!.dispose(); current.api.destroy(); owner.libraries.delete(folder);
      if (!owner.libraries.size) { owner.registrar.unload(); registry.delete(app); }
      else app.workspace.trigger('post-processor-change');
    })();
    await current.closing;
  } };
}
