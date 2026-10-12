import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CardsAPI, CardsDashboard, Work } from './types';
import type { CardsEmbed, EmbeddedModule } from './embed-source';
import { WorkPropertiesManager } from './WorkPropertiesSessions';
import { WorkbenchTextProvider } from './EditableText';
import WorkCollection from './WorkCollection';
import WorkEditor, { type Run } from './WorkEditor';
import ModuleList from './ModuleList';
import ShowcaseCollection from './ShowcaseCollection';
import { setModuleHidden } from './settings';
import { ALL_DASHBOARD_ID, saveDashboardOrder } from './dashboards';
import { getShowcaseRenderOperations } from './showcase-render-state';

const standaloneDrafts = new WeakMap<CardsAPI, Map<string, { order: string[]; dashboard?: CardsDashboard }>>();
const standaloneSurfaces = new WeakMap<CardsAPI, Set<HTMLElement>>();

/** Do not unmount a module while an operation or its explicit retry draft remains. */
export function assertCardModuleOperationsSettled(api: CardsAPI, surface?: HTMLElement): HTMLElement[] {
  const surfaces = [...new Set([...(standaloneSurfaces.get(api) ?? []), ...(surface ? [surface] : [])])];
  if (surfaces.some(element => element.querySelector('[data-cards-pending]'))) throw new Error('模块仍在编辑或排序，草稿已保留。请先完成操作，或放弃排序草稿后重试。');
  for (const module of api.getSnapshot().settings.customModules) if (module.mode === 'showcase') {
    const state = getShowcaseRenderOperations(api, module.id)?.getSnapshot();
    if (state?.importing || state?.imports.length || state?.move) throw new Error('图片导入或排序尚未完成，重试记录已保留。请先完成操作，或放弃排序草稿后重试。');
  }
  return surfaces;
}

/** Reordering visible modules leaves removed modules in their original slots. */
export function mergeVisibleModuleOrder(original: string[], visible: string[]): string[] {
  if (new Set(original).size !== original.length || new Set(visible).size !== visible.length || visible.some(id => !original.includes(id))) throw new Error('模块顺序已改变，请重新载入后重试。');
  const moved = new Set(visible);
  let index = 0;
  return original.map(id => moved.has(id) ? visible[index++] : id);
}

export default function CardsSurface({ api, manager, embed, dashboard, saveOrder, initialDraft, retainDraft, headerAction }: { api: CardsAPI; manager: WorkPropertiesManager; embed?: CardsEmbed; dashboard?: CardsDashboard; saveOrder?: (order: string[]) => Promise<void>; initialDraft?: string[]; retainDraft?: (draft: string[] | null) => void; headerAction?: (id: string) => React.ReactNode }) {
  const snapshot = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
  const [editor, setEditor] = useState<Work | null>(null);
  const [error, setError] = useState('');
  const [embedOrder, setEmbedOrder] = useState<string[] | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => setEmbedOrder(null), [embed]);
  useEffect(() => {
    const element = surface.current;
    if (embed || !element) return;
    let surfaces = standaloneSurfaces.get(api);
    if (!surfaces) { surfaces = new Set(); standaloneSurfaces.set(api, surfaces); }
    surfaces.add(element);
    return () => { surfaces.delete(element); if (!surfaces.size) standaloneSurfaces.delete(api); };
  }, [api, embed]);
  const run: Run = async action => { setError(''); try { await action(); return true; } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); return false; } };
  const modules: EmbeddedModule[] = useMemo(() => {
    if (embed) return embedOrder ? [...embed.modules].sort((a,b) => embedOrder.indexOf(a.id) - embedOrder.indexOf(b.id)) : embed.modules;
    if (dashboard) return dashboard.moduleIds.map(id => ({ id, collection: id }));
    const items = [{ id: 'book', collection: 'book' }, { id: 'film', collection: 'film' }, ...snapshot.settings.customModules.map(module => ({ id: module.id, collection: module.id }))];
    const order = snapshot.settings.standaloneOrder;
    return [...items].sort((a, b) => { const ai = order.indexOf(a.id), bi = order.indexOf(b.id); return (ai < 0 ? order.length + items.indexOf(a) : ai) - (bi < 0 ? order.length + items.indexOf(b) : bi); });
  }, [embed, embedOrder, dashboard, snapshot.settings.customModules, snapshot.settings.standaloneOrder]);
  const visibleModules = embed ? modules : modules.filter(module => !snapshot.settings.hiddenModuleIds?.includes(module.collection) && !snapshot.settings.standaloneHiddenModuleIds?.includes(module.collection));
  const visibleIds = visibleModules.map(module => module.id);
  const draftKey = dashboard?.id ?? ALL_DASHBOARD_ID;
  const mergedOrder = (order: string[]) => {
    if (order.length !== visibleIds.length || visibleIds.some(id => !order.includes(id))) throw new Error('可见模块已改变，排序草稿已保留。');
    return mergeVisibleModuleOrder(modules.map(module => module.id), order);
  };
  const renameModule = (id: string, title: string) => run(() => api.saveSettings({ customModules: api.getSnapshot().settings.customModules.map(module => module.id === id ? { ...module, title } : module) }));
  const renderModule = (id: string, handle: React.ReactNode) => {
    const definition = modules.find(module => module.id === id)!;
    const action = embed ? undefined : headerAction?.(definition.collection);
    const custom = snapshot.settings.customModules.find(module => module.id === definition.collection);
    if (snapshot.settings.hiddenModuleIds?.includes(definition.collection)) return <section className="bw-work-stack bw-module bw-removed-module"><header className="bw-section-head">{handle}<h2>{custom?.title ?? (definition.collection === 'book' ? '阅读' : definition.collection === 'film' ? '影视' : '卡片模块')}</h2></header><p role="status">此模块已从显示中移除，卡片资料仍保留。</p><button type="button" onClick={() => { void run(() => setModuleHidden(api, definition.collection, false)); }}>恢复模块</button></section>;
    if (custom?.mode === 'showcase') {
      const appearance = { ...custom.appearance, ...(definition.layout ? { layout: definition.layout } : {}), ...(definition.orientation ? { orientation: definition.orientation } : {}) };
      return <ShowcaseCollection module={custom} appearance={appearance} threeCardView={snapshot.settings.threeCardView} api={api} handle={handle} headerAction={action} />;
    }
    const kind = custom?.kind ?? definition.collection;
    if (kind !== 'book' && kind !== 'film') return <section className="bw-work-stack bw-module"><header className="bw-section-head">{handle}<h2>集合未找到</h2>{action}</header><p role="status">请检查 collection：{definition.collection}</p></section>;
    const works = snapshot.entities.filter(work => work.type === kind && (custom ? work.moduleId === custom.id : !snapshot.settings.customModules.some(module => module.id === work.moduleId && module.kind === work.type)));
    const original = custom?.appearance ?? (kind === 'book' ? snapshot.settings.bookCardAppearance : snapshot.settings.filmCardAppearance);
    const appearance = { ...original, ...(definition.layout ? { layout: definition.layout } : {}), ...(definition.orientation ? { orientation: definition.orientation } : {}) };
    return <WorkCollection kind={kind} module={custom} works={works} order={snapshot.workOrder?.[kind]} appearance={appearance} threeCardView={snapshot.settings.threeCardView} manager={manager} api={api} run={run} edit={setEditor} renameModule={renameModule} handle={handle} headerAction={action} />;
  };
  return <WorkbenchTextProvider values={snapshot.settings.workbenchText} save={(key, value) => run(() => api.saveSettings({ workbenchText: { ...api.getSnapshot().settings.workbenchText, [key]: value } }))}><div ref={surface} className="bw-app bw-cards-surface" data-cards-embed={embed?.id}>
    {snapshot.loading && <p role="status">正在读取卡片…</p>}{(error || snapshot.error) && <p className="bw-sync-note is-error" role="alert">{error || snapshot.error}</p>}
    {!visibleIds.length && <p className="bw-empty">{embed ? '当前代码块未指定卡片模块。' : dashboard ? '此 Dashboard 暂无显示的模块。点击“编辑 Dashboard”选择模块；隐藏的模块可在“全部”的“已隐藏模块”中恢复。' : '所有模块均已隐藏，可展开“已隐藏模块”恢复。'}</p>}
    <ModuleList key={embed?.id ?? draftKey} ids={visibleIds} save={async order => { const merged = mergedOrder(order); if (saveOrder) { await saveOrder(merged); setEmbedOrder(merged); } else if (dashboard) await saveDashboardOrder(api, standaloneDrafts.get(api)?.get(draftKey)?.dashboard ?? dashboard, merged); else await api.saveSettings({ standaloneOrder: merged }); }} initialDraft={(embed ? initialDraft : standaloneDrafts.get(api)?.get(draftKey)?.order)?.filter(id => visibleIds.includes(id))} retainDraft={draft => { let merged = draft; if (draft) { try { merged = mergedOrder(draft); } catch { /* Keep the original draft while save reports the changed module set. */ } } if (embed) retainDraft?.(merged); else if (merged) { let drafts = standaloneDrafts.get(api); if (!drafts) { drafts = new Map(); standaloneDrafts.set(api, drafts); } drafts.set(draftKey, { order: merged, dashboard: drafts.get(draftKey)?.dashboard ?? (dashboard ? structuredClone(dashboard) : undefined) }); } else standaloneDrafts.get(api)?.delete(draftKey); }}>{renderModule}</ModuleList>
    {editor && <WorkEditor entity={editor} genericCard={!!editor.moduleId} api={api} run={run} close={() => setEditor(null)} />}
  </div></WorkbenchTextProvider>;
}
