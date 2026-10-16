import React, { useEffect, useMemo, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CardsAPI, CardsDashboard, Work } from './types';
import type { CardsEmbed, EmbeddedModule } from './embed-source';
import { WorkPropertiesManager } from './WorkPropertiesSessions';
import { WorkbenchTextProvider } from './EditableText';
import WorkCollection from './WorkCollection';
import WorkEditor, { type Run } from './WorkEditor';
import ModuleList from './ModuleList';
import ShowcaseCollection from './ShowcaseCollection';
import { saveDashboardOrder } from './dashboards';
import { getShowcaseRenderOperations } from './showcase-render-state';
import { getShowcaseManager } from './showcase-sessions';
import { hasPendingWorkImageImports } from './work-image-imports';
import WorkImageImportRecovery from './WorkImageImportRecovery';
import { flushSurfaceDrafts, surfaceRecoveryDrafts } from './draft-lifecycle';
import { workImageImportQueues } from './work-image-imports';

const operationsKey = Symbol.for('magical-cards.module-operations.v1');
export interface DashboardTabDraft { baseline: CardsDashboard[]; order: string[]; }
interface ModuleOperations { drafts: Map<string, { order: string[]; dashboard?: CardsDashboard }>; surfaces: Set<HTMLElement>; tabDrafts?: Map<string, DashboardTabDraft>; activeTabViews?: Map<string, number>; }
type APIWithOperations = CardsAPI & { [operationsKey]?: ModuleOperations };
function moduleOperations(api: CardsAPI): ModuleOperations {
  return (api as APIWithOperations)[operationsKey] ??= { drafts: new Map(), surfaces: new Set() };
}

export function registerCardModuleSurface(api: CardsAPI, element: HTMLElement): () => void {
  const { surfaces } = moduleOperations(api);
  surfaces.add(element);
  return () => { surfaces.delete(element); };
}

export function registeredCardSurfaces(api: CardsAPI): HTMLElement[] { return [...moduleOperations(api).surfaces]; }

export function readDashboardTabDraft(api: CardsAPI, viewId: string): DashboardTabDraft | undefined {
  return moduleOperations(api).tabDrafts?.get(viewId);
}
export function retainDashboardTabDraft(api: CardsAPI, viewId: string, draft: DashboardTabDraft | null): void {
  const state = moduleOperations(api);
  if (draft) (state.tabDrafts ??= new Map()).set(viewId, draft);
  else state.tabDrafts?.delete(viewId);
}
export function registerDashboardTabDraftView(api: CardsAPI, viewId: string): () => void {
  const owners = moduleOperations(api).activeTabViews ??= new Map();
  owners.set(viewId, (owners.get(viewId) ?? 0) + 1);
  return () => { const remaining = (owners.get(viewId) ?? 1) - 1; if (remaining > 0) owners.set(viewId, remaining); else owners.delete(viewId); };
}
/** Actual leaf closure retains the draft; a new leaf can explicitly resolve it. */
export function claimDashboardTabDraft(api: CardsAPI, viewId: string): DashboardTabDraft | null {
  const state = moduleOperations(api), own = state.tabDrafts?.get(viewId);
  if (own) return own;
  for (const [owner, draft] of state.tabDrafts ?? []) if (!state.activeTabViews?.has(owner)) {
    state.tabDrafts?.delete(owner); state.tabDrafts?.set(viewId, draft); return draft;
  }
  return null;
}

/** Do not unmount a module while an operation or its explicit retry draft remains. */
export function assertCardModuleOperationsSettled(api: CardsAPI, surface?: HTMLElement): HTMLElement[] {
  const surfaces = [...new Set([...moduleOperations(api).surfaces, ...(surface ? [surface] : [])])];
  if (hasPendingWorkImageImports(api)) throw new Error('图片导入尚未完成，重试记录已保留。请先重试或放弃未完成导入后再操作。');
  if (surfaces.some(element => element.querySelector('[data-cards-pending]'))) throw new Error('模块仍在编辑或排序，草稿已保留。请先完成操作，或放弃排序草稿后重试。');
  for (const module of api.getSnapshot().settings.customModules) if (module.mode === 'showcase') {
    const state = getShowcaseRenderOperations(api, module.id)?.getSnapshot();
    if (state?.importing || state?.imports.length || state?.move) throw new Error('图片导入或排序尚未完成，重试记录已保留。请先完成操作，或放弃排序草稿后重试。');
  }
  return surfaces;
}

export function assertCardModuleRemovalSettled(api: CardsAPI): void {
  if (moduleOperations(api).drafts.size || moduleOperations(api).tabDrafts?.size) throw new Error('模块或 Dashboard 排序草稿尚未保存，请在卡片标签页重试或放弃草稿后再操作。');
  assertCardModuleOperationsSettled(api);
}

export async function flushDashboardEdits(api: CardsAPI, manager?: WorkPropertiesManager, surface?: HTMLElement): Promise<void> {
  const checkTitles = () => {
    for (const element of assertCardModuleOperationsSettled(api, surface)) {
      if (element.querySelector('[data-editable-composing="true"]')) throw new Error('请先结束输入法输入，模块名称草稿已保留。');
      const focused = element.ownerDocument.activeElement;
      if (focused?.instanceOf(HTMLElement) && element.contains(focused) && focused.classList.contains('bw-editable-text')) focused.blur();
      if (element.querySelector('.bw-editable-text[data-editable-saving="true"], .bw-editable-text[data-editable-error="true"]')) throw new Error('模块名称尚未保存，请等待保存完成，或回到标题重试后再操作。');
    }
  };
  checkTitles();
  await manager?.flushAll();
  if (manager?.recoveryDrafts().length) throw new Error('卡片草稿尚未保存，请完成编辑后再操作。');
  await getShowcaseManager(api)?.flushAll();
  checkTitles();
}

/** Native mounts can submit their own forms before checking shared card sessions. */
export async function flushNativeModuleEdits(api: CardsAPI, manager: WorkPropertiesManager, surface: HTMLElement, moduleId: string): Promise<void> {
  await flushSurfaceDrafts(surface);
  if (typeof manager.flushModules === 'function') await manager.flushModules([moduleId]); else await manager.flushAll();
  const showcaseManager = getShowcaseManager(api);
  if (showcaseManager?.flushModules) await showcaseManager.flushModules([moduleId]); else await showcaseManager?.flushAll();
  const imports = workImageImportQueues(api).find(([id]) => id === moduleId)?.[1].getSnapshot();
  const showcase = getShowcaseRenderOperations(api, moduleId)?.getSnapshot();
  if (imports?.importing || imports?.imports.length || showcase?.importing || showcase?.imports.length || showcase?.move || surface.querySelector('[data-cards-pending]')) throw new Error('模块仍有未保存的操作或导入，草稿与重试记录已保留。请完成后重试。');
}
export function cardSurfaceRecoveryDrafts(api: CardsAPI, surface: HTMLElement): unknown[] {
  const state = moduleOperations(api);
  return [
    ...surfaceRecoveryDrafts(surface),
    ...[...state.drafts].map(([id, draft]) => ({ type: 'module-sort', id, ...draft })),
    ...[...(state.tabDrafts ?? [])].map(([id, draft]) => ({ type: 'dashboard-sort', id, ...draft })),
  ];
}
function DOMActions({ element }: { element?: HTMLElement }) {
  const slot = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => { const target = slot.current; if (!element || !target) return; target.append(element); return () => { if (element.parentNode === target) element.remove(); }; }, [element]);
  return <span ref={slot} className="bw-native-module-actions" />;
}

/** Reordering visible modules leaves removed modules in their original slots. */
export function mergeVisibleModuleOrder(original: string[], visible: string[]): string[] {
  if (new Set(original).size !== original.length || new Set(visible).size !== visible.length || visible.some(id => !original.includes(id))) throw new Error('模块顺序已改变，请重新载入后重试。');
  const moved = new Set(visible);
  let index = 0;
  return original.map(id => moved.has(id) ? visible[index++] : id);
}

export default function CardsSurface({ api, manager, embed, dashboard, saveOrder, initialDraft, retainDraft, headerAction, nativeModule }: { api: CardsAPI; manager: WorkPropertiesManager; embed?: CardsEmbed; dashboard?: CardsDashboard; saveOrder?: (order: string[]) => Promise<void>; initialDraft?: string[]; retainDraft?: (draft: string[] | null) => void; headerAction?: (id: string) => React.ReactNode; nativeModule?: { id: string; actions?: HTMLElement } }) {
  const snapshot = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
  const [editor, setEditor] = useState<Work | null>(null);
  const [error, setError] = useState('');
  const [embedOrder, setEmbedOrder] = useState<string[] | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => setEmbedOrder(null), [embed]);
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    return registerCardModuleSurface(api, element);
  }, [api, embed]);
  const run: Run = async action => { setError(''); try { await action(); return true; } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); return false; } };
  const modules: EmbeddedModule[] = useMemo(() => {
    if (nativeModule) return [{ id: nativeModule.id, collection: nativeModule.id }];
    if (embed) return embedOrder ? [...embed.modules].sort((a,b) => embedOrder.indexOf(a.id) - embedOrder.indexOf(b.id)) : embed.modules;
    if (dashboard) return dashboard.moduleIds.map(id => ({ id, collection: id }));
    return [];
  }, [embed, embedOrder, dashboard, nativeModule?.id]);
  const legacyVisibility = !api.supportsDashboardOnlyNavigation;
  const visibleModules = embed || nativeModule ? modules : modules.filter(module => !snapshot.settings.deletedModuleIds?.includes(module.collection) && (!legacyVisibility || (!snapshot.settings.hiddenModuleIds?.includes(module.collection) && !snapshot.settings.standaloneHiddenModuleIds?.includes(module.collection))));
  const visibleIds = visibleModules.map(module => module.id);
  const draftKey = dashboard?.id ?? 'no-dashboard';
  const mergedOrder = (order: string[]) => {
    if (order.length !== visibleIds.length || visibleIds.some(id => !order.includes(id))) throw new Error('可见模块已改变，排序草稿已保留。');
    return mergeVisibleModuleOrder(modules.map(module => module.id), order);
  };
  const renameModule = (id: string, title: string) => run(() => api.saveSettings({ customModules: api.getSnapshot().settings.customModules.map(module => module.id === id ? { ...module, title } : module) }));
  const renderModule = (id: string, handle: React.ReactNode) => {
    const definition = modules.find(module => module.id === id)!;
    const action = nativeModule ? <DOMActions element={nativeModule.actions} /> : embed ? undefined : headerAction?.(definition.collection);
    const custom = snapshot.settings.customModules.find(module => module.id === definition.collection);
    if (snapshot.settings.deletedModuleIds?.includes(definition.collection)) return <section className="bw-work-stack bw-module"><header className="bw-section-head">{handle}<h2>模块已删除</h2></header><p role="status">此模块已删除，作品笔记与图片仍保留。请重新选择已有模块生成代码。</p></section>;
    if (legacyVisibility && snapshot.settings.hiddenModuleIds?.includes(definition.collection)) return <section className="bw-work-stack bw-module bw-removed-module"><header className="bw-section-head">{handle}<h2>{custom?.title ?? (definition.collection === 'book' ? '阅读' : definition.collection === 'film' ? '影视' : '卡片模块')}</h2></header><p role="status">此模块已按旧版规则隐藏，卡片资料仍保留。升级兼容插件后可在设置中分类。</p></section>;
    if (custom?.mode === 'showcase') {
      const appearance = { ...custom.appearance, ...(definition.layout ? { layout: definition.layout } : {}), ...(definition.orientation ? { orientation: definition.orientation } : {}) };
      return <ShowcaseCollection module={custom} appearance={appearance} threeCardView={snapshot.settings.threeCardView} api={api} handle={handle} headerAction={action} previewOnly={!embed && !nativeModule && legacyVisibility} />;
    }
    const kind = custom?.kind ?? definition.collection;
    if (kind !== 'book' && kind !== 'film') return <section className="bw-work-stack bw-module"><header className="bw-section-head">{handle}<h2>集合未找到</h2>{action}</header><p role="status">请检查 collection：{definition.collection}</p></section>;
    const works = snapshot.entities.filter(work => work.type === kind && !snapshot.settings.deletedModuleIds?.includes(work.moduleId ?? '') && (custom ? work.moduleId === custom.id : !snapshot.settings.customModules.some(module => module.id === work.moduleId && module.kind === work.type)));
    const original = custom?.appearance ?? (kind === 'book' ? snapshot.settings.bookCardAppearance : snapshot.settings.filmCardAppearance);
    const appearance = { ...original, ...(definition.layout ? { layout: definition.layout } : {}), ...(definition.orientation ? { orientation: definition.orientation } : {}) };
    return <WorkCollection kind={kind} module={custom} works={works} order={snapshot.workOrder?.[kind]} appearance={appearance} threeCardView={snapshot.settings.threeCardView} manager={manager} api={api} run={run} edit={setEditor} renameModule={renameModule} handle={handle} headerAction={action} previewOnly={!embed && !nativeModule && legacyVisibility} />;
  };
  return <WorkbenchTextProvider values={snapshot.settings.workbenchText} save={(key, value) => run(() => api.saveSettings({ workbenchText: { ...api.getSnapshot().settings.workbenchText, [key]: value } }))}><div ref={surface} className={`bw-app bw-cards-surface${nativeModule ? ' bw-native-card-surface' : ''}`} data-cards-embed={embed?.id}>
    {snapshot.loading && <p role="status">正在读取卡片…</p>}{(error || snapshot.error) && <p className="bw-sync-note is-error" role="alert">{error || snapshot.error}</p>}
    {embed && <WorkImageImportRecovery api={api} manager={manager} visibleCollectionIds={visibleModules.map(module => module.collection)} />}
    {!visibleIds.length && <p className="bw-empty">{embed ? '当前代码块未指定卡片模块。' : '此 Dashboard 暂无模块。请在插件设置中选择已有模块加入此分类。'}</p>}
    {nativeModule ? renderModule(nativeModule.id, undefined) : <ModuleList key={embed?.id ?? draftKey} ids={visibleIds} disabled={!embed && !api.supportsDashboardOnlyNavigation} save={async order => { const merged = mergedOrder(order); if (saveOrder) { await saveOrder(merged); setEmbedOrder(merged); } else if (dashboard) await saveDashboardOrder(api, moduleOperations(api).drafts.get(draftKey)?.dashboard ?? dashboard, merged); }} initialDraft={(embed ? initialDraft : moduleOperations(api).drafts.get(draftKey)?.order)?.filter(id => visibleIds.includes(id))} retainDraft={draft => { let merged = draft; if (draft) { try { merged = mergedOrder(draft); } catch { /* Keep the original draft while save reports the changed module set. */ } } if (embed) retainDraft?.(merged); else if (merged) { const { drafts } = moduleOperations(api); drafts.set(draftKey, { order: merged, dashboard: drafts.get(draftKey)?.dashboard ?? (dashboard ? structuredClone(dashboard) : undefined) }); } else moduleOperations(api).drafts.delete(draftKey); }}>{renderModule}</ModuleList>}
    {editor && <WorkEditor entity={editor} genericCard={!!editor.moduleId} api={api} run={run} close={() => setEditor(null)} />}
  </div></WorkbenchTextProvider>;
}
