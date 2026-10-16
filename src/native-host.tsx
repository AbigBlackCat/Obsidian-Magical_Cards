import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Notice, normalizePath, type App } from 'obsidian';
import CardsSurface, { cardSurfaceRecoveryDrafts, flushNativeModuleEdits, registeredCardSurfaces } from './CardsSurface';
import type { CardsLease } from './runtime';
import type { CardsSettings } from './types';
import { getShowcaseManager } from './showcase-sessions';
import { getShowcaseRenderOperations } from './showcase-render-state';
import { workImageImportQueues } from './work-image-imports';
import { MAGICAL_CARDS_API_READY, MAGICAL_CARDS_API_UNAVAILABLE, type MagicalCardsHostAPI, type MagicalCardsModule, type MagicalCardsMount, type MagicalCardsMountOptions, type MagicalCardsSnapshot } from './host-api';

/** Dashboard classification controls navigation, never whether a native host may use a module. */
export function nativeModuleCatalog(settings: CardsSettings): MagicalCardsModule[] {
  return [
    { id: 'book', title: settings.workbenchText['book.title']?.trim() || '读过的世界', kind: 'book' as const },
    { id: 'film', title: settings.workbenchText['film.title']?.trim() || '银幕之后', kind: 'film' as const },
    ...settings.customModules.map(module => ({ id: module.id, title: module.title, kind: module.mode === 'showcase' ? 'showcase' as const : module.kind })),
  ].filter(module => !settings.deletedModuleIds?.includes(module.id));
}
interface NativeMount {
  container: HTMLElement;
  options: MagicalCardsMountOptions;
  lease: CardsLease;
  root: Root;
  disposed: boolean;
  paused: number;
  previousInert: boolean;
  previousBusy: string | null;
  dialogs: Map<HTMLDialogElement, boolean>;
  block(this: void, event: Event): void;
  flushing?: Promise<void>;
  disposing?: Promise<void>;
  flush(this: void): Promise<void>;
  destroy(): void;
}
const PAUSED_EVENTS = ['pointerdown', 'click', 'keydown', 'beforeinput', 'change', 'submit', 'drop', 'compositionstart'];
const lockKey = (folder: string, moduleId: string) => `${folder}\0${moduleId}`;

/** Owns every external React root; callers receive only DOM lifecycle operations. */
export class NativeCardsHost implements MagicalCardsHostAPI {
  readonly version = 1 as const;
  readonly instanceId = crypto.randomUUID();
  private snapshot!: MagicalCardsSnapshot;
  private listeners = new Set<() => void>();
  private mounts = new Set<NativeMount>();
  private occupied = new WeakMap<HTMLElement, NativeMount>();
  private locks = new Map<string, number>();
  private unsubscribe?: () => void;
  private active = true;
  private stopping?: Promise<void>;
  constructor(private app: App, private lease: CardsLease, private recoveryDirectory: string) { this.bind(lease); }
  private bind(lease: CardsLease) {
    this.unsubscribe?.(); this.lease = lease;
    const update = () => {
      const state = lease.api.getSnapshot();
      this.snapshot = { rootFolder: lease.api.rootFolder, modules: nativeModuleCatalog(state.settings), loading: state.loading, error: state.error };
      for (const listener of [...this.listeners]) listener();
    };
    update(); this.unsubscribe = lease.api.subscribe(update);
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  announce() { if (this.active) this.app.workspace.trigger(MAGICAL_CARDS_API_READY, this); }
  private assertActive() { if (!this.active) throw new Error('Magical Cards 已停用，模块引用会在恢复后重新显示。'); }
  private pause(mount: NativeMount) {
    if (mount.paused++ === 0) {
      mount.previousInert = mount.container.inert; mount.previousBusy = mount.container.getAttribute('aria-busy');
      // A modal dialog escapes ancestor inertness, so pause each open dialog as well.
      for (const dialog of mount.container.querySelectorAll<HTMLDialogElement>('dialog')) { mount.dialogs.set(dialog, dialog.inert); dialog.inert = true; }
      mount.container.inert = true; mount.container.setAttribute('aria-busy', 'true');
    }
  }
  private resume(mount: NativeMount) {
    if (mount.paused > 0 && --mount.paused === 0 && !mount.disposed) this.restorePause(mount);
  }
  private restorePause(mount: NativeMount) {
    mount.container.inert = mount.previousInert;
    if (mount.previousBusy === null) mount.container.removeAttribute('aria-busy'); else mount.container.setAttribute('aria-busy', mount.previousBusy);
    for (const [dialog, inert] of mount.dialogs) dialog.inert = inert;
    mount.dialogs.clear();
  }
  mountModule = (container: HTMLElement, options: MagicalCardsMountOptions): MagicalCardsMount => {
    this.assertActive();
    if (options.rootFolder !== this.snapshot.rootFolder) throw new Error('卡片目录已改变，请重新选择模块。');
    if (!this.snapshot.modules.some(module => module.id === options.moduleId)) throw new Error('卡片模块已删除或不可用。');
    if (this.occupied.has(container)) throw new Error('此容器已经挂载卡片模块。');
    const lease = this.lease;
    const root = createRoot(container);
    const mount: NativeMount = {
      container, options: { ...options }, lease, root, disposed: false, paused: 0, previousInert: container.inert, previousBusy: container.getAttribute('aria-busy'), dialogs: new Map(),
      block: event => { if (mount.paused) { event.preventDefault(); event.stopImmediatePropagation(); } },
      flush: () => {
        if (mount.disposed) return Promise.resolve();
        return mount.flushing ??= flushNativeModuleEdits(lease.api, lease.propertiesManager, container, options.moduleId).finally(() => { mount.flushing = undefined; });
      },
      destroy: () => {
        if (mount.disposed) return;
        mount.disposed = true; root.unmount(); this.mounts.delete(mount); this.occupied.delete(container);
        this.restorePause(mount);
        for (const event of PAUSED_EVENTS) container.removeEventListener(event, mount.block, true);
      },
    };
    for (const event of PAUSED_EVENTS) container.addEventListener(event, mount.block, true);
    this.mounts.add(mount); this.occupied.set(container, mount);
    for (let count = this.locks.get(lockKey(options.rootFolder, options.moduleId)) ?? 0; count > 0; count--) this.pause(mount);
    root.render(<CardsSurface api={lease.api} manager={lease.propertiesManager} nativeModule={{ id: options.moduleId, actions: options.actions }} />);
    return {
      flush: mount.flush,
      dispose: () => {
        if (mount.disposed) return Promise.resolve();
        return mount.disposing ??= (async () => {
          this.pause(mount);
          try { await mount.flush(); mount.destroy(); }
          finally { this.resume(mount); mount.disposing = undefined; }
        })();
      },
    };
  };
  prepareModules = async (rootFolder: string, moduleIds: string[]): Promise<() => void> => {
    this.assertActive();
    const ids = new Set(moduleIds);
    const keys = [...ids].map(id => lockKey(rootFolder, id));
    for (const key of keys) this.locks.set(key, (this.locks.get(key) ?? 0) + 1);
    const affected = [...this.mounts].filter(mount => mount.options.rootFolder === rootFolder && ids.has(mount.options.moduleId));
    affected.forEach(mount => this.pause(mount));
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      for (const key of keys) { const count = (this.locks.get(key) ?? 1) - 1; if (count) this.locks.set(key, count); else this.locks.delete(key); }
      // A host may open the same module while another window is awaiting its save.
      for (const mount of this.mounts) if (mount.options.rootFolder === rootFolder && ids.has(mount.options.moduleId)) {
        this.resume(mount);
      }
    };
    try {
      const results = await Promise.allSettled(affected.map(mount => mount.flush()));
      const failure = results.find(result => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
      this.assertActive(); return release;
    } catch (error) { release(); throw error; }
  };
  moduleIds(): string[] { return [...new Set([...this.snapshot.modules.map(module => module.id), ...[...this.mounts].filter(mount => mount.lease === this.lease).map(mount => mount.options.moduleId)])]; }
  changeLease(next: CardsLease): void {
    this.assertActive();
    // The caller holds prepareModules for the full old library until persistence succeeds.
    for (const mount of [...this.mounts]) if (mount.lease === this.lease) mount.destroy();
    this.bind(next);
  }
  recoveryDrafts(): unknown[] {
    const api = this.lease.api, native = [...this.mounts];
    return [
      ...registeredCardSurfaces(api).filter(surface => !native.some(mount => mount.container.contains(surface))).flatMap(surface => cardSurfaceRecoveryDrafts(api, surface)),
      ...native.flatMap(mount => cardSurfaceRecoveryDrafts(api, mount.container).map(draft => ({ rootFolder: mount.options.rootFolder, moduleId: mount.options.moduleId, ...(draft && typeof draft === 'object' ? draft : { draft }) }))),
      ...this.lease.propertiesManager.recoveryDrafts().map(draft => ({ type: 'work-properties', ...draft })),
      ...(getShowcaseManager(api)?.recoveryDrafts() ?? []).map(draft => ({ type: 'showcase-text', ...draft })),
      ...workImageImportQueues(api).filter(([, operations]) => { const state = operations.getSnapshot(); return state.importing || state.imports.length; }).map(([moduleId, operations]) => ({ type: 'work-image-imports', moduleId, ...operations.getSnapshot() })),
      ...api.getSnapshot().settings.customModules.filter(module => module.mode === 'showcase').flatMap(module => {
        const state = getShowcaseRenderOperations(api, module.id)?.getSnapshot();
        return state && (state.importing || state.imports.length || state.move) ? [{ type: 'showcase-operations', moduleId: module.id, ...state }] : [];
      }),
    ];
  }
  /** Invalidate discovery before notifying hosts; retained drafts are captured before roots go away. */
  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.active = false;
    for (const mount of this.mounts) this.pause(mount);
    const drafts = this.recoveryDrafts();
    this.app.workspace.trigger(MAGICAL_CARDS_API_UNAVAILABLE, { instanceId: this.instanceId });
    this.unsubscribe?.(); this.unsubscribe = undefined;
    this.stopping = (async () => {
      const results = await Promise.allSettled([...this.mounts].map(mount => mount.flush()));
      const failure = results.find(result => result.status === 'rejected');
      if (failure?.status === 'rejected' || drafts.length) {
        const remaining = this.recoveryDrafts();
        if (remaining.length || failure?.status === 'rejected') await writeNativeRecovery(this.app, this.recoveryDirectory, this.snapshot.rootFolder, [...drafts, ...remaining], failure?.status === 'rejected' ? failure.reason : new Error('停用前尚有未完成的操作。'));
      }
      for (const mount of [...this.mounts]) mount.destroy();
      this.listeners.clear(); this.locks.clear();
    })();
    return this.stopping;
  }
}

/** JSON recovery includes image bytes; File objects alone serialize to an empty object. */
export async function recoveryJSON(value: unknown): Promise<unknown> {
  if (value && typeof value === 'object' && 'arrayBuffer' in value && typeof value.arrayBuffer === 'function' && 'name' in value) {
    const file = value as File, bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    return { name: file.name, type: file.type, lastModified: file.lastModified, encoding: 'base64', data: btoa(binary) };
  }
  if (Array.isArray(value)) return Promise.all(value.map(recoveryJSON));
  if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await recoveryJSON(item)])));
  return value;
}
async function writeNativeRecovery(app: App, directory: string, rootFolder: string, drafts: unknown[], error: unknown): Promise<void> {
  const path = normalizePath(`${directory}/native-card-drafts-recovery-${Date.now()}-${crypto.randomUUID()}.json`);
  const message = error instanceof Error ? error.message : String(error);
  try {
    await app.vault.adapter.write(path, JSON.stringify(await recoveryJSON({ savedAt: new Date().toISOString(), rootFolder, error: message, drafts }), null, 2));
    new Notice(`Magical Cards 未完成的草稿与导入记录已备份至 ${path}`);
  } catch (failure) { new Notice(`Magical Cards 草稿恢复文件写入失败：${failure instanceof Error ? failure.message : String(failure)}。原错误：${message}`); }
}
