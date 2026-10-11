import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { CardsAPI, Work } from './types';
import type { CardsEmbed, EmbeddedModule } from './embed-source';
import { WorkPropertiesManager } from './WorkPropertiesSessions';
import { WorkbenchTextProvider } from './EditableText';
import WorkCollection from './WorkCollection';
import WorkEditor, { type Run } from './WorkEditor';
import ModuleList from './ModuleList';

const standaloneDrafts = new WeakMap<CardsAPI, string[]>();

export default function CardsSurface({ api, manager, embed, saveOrder, initialDraft, retainDraft }: { api: CardsAPI; manager: WorkPropertiesManager; embed?: CardsEmbed; saveOrder?: (order: string[]) => Promise<void>; initialDraft?: string[]; retainDraft?: (draft: string[] | null) => void }) {
  const snapshot = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
  const [editor, setEditor] = useState<Work | null>(null);
  const [error, setError] = useState('');
  const [embedOrder, setEmbedOrder] = useState<string[] | null>(null);
  useEffect(() => setEmbedOrder(null), [embed]);
  const run: Run = async action => { setError(''); try { await action(); return true; } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); return false; } };
  const modules: EmbeddedModule[] = useMemo(() => {
    if (embed) return embedOrder ? [...embed.modules].sort((a,b) => embedOrder.indexOf(a.id) - embedOrder.indexOf(b.id)) : embed.modules;
    const items = [{ id: 'book', collection: 'book' }, { id: 'film', collection: 'film' }, ...snapshot.settings.customModules.map(module => ({ id: module.id, collection: module.id }))];
    const order = snapshot.settings.standaloneOrder;
    return [...items].sort((a, b) => { const ai = order.indexOf(a.id), bi = order.indexOf(b.id); return (ai < 0 ? order.length + items.indexOf(a) : ai) - (bi < 0 ? order.length + items.indexOf(b) : bi); });
  }, [embed, embedOrder, snapshot.settings.customModules, snapshot.settings.standaloneOrder]);
  const renameModule = (id: string, title: string) => run(() => api.saveSettings({ customModules: api.getSnapshot().settings.customModules.map(module => module.id === id ? { ...module, title } : module) }));
  const renderModule = (id: string, handle: React.ReactNode) => {
    const definition = modules.find(module => module.id === id)!;
    const custom = snapshot.settings.customModules.find(module => module.id === definition.collection);
    const kind = custom?.kind ?? definition.collection;
    if (kind !== 'book' && kind !== 'film') return <section className="bw-work-stack bw-module"><header className="bw-section-head">{handle}<h2>集合未找到</h2></header><p role="status">请检查 collection：{definition.collection}</p></section>;
    const works = snapshot.entities.filter(work => work.type === kind && (custom ? work.moduleId === custom.id : !snapshot.settings.customModules.some(module => module.id === work.moduleId && module.kind === work.type)));
    const original = custom?.appearance ?? (kind === 'book' ? snapshot.settings.bookCardAppearance : snapshot.settings.filmCardAppearance);
    const appearance = { ...original, ...(definition.layout ? { layout: definition.layout } : {}), ...(definition.orientation ? { orientation: definition.orientation } : {}) };
    return <WorkCollection kind={kind} module={custom} works={works} order={snapshot.workOrder?.[kind]} appearance={appearance} threeCardView={snapshot.settings.threeCardView} manager={manager} api={api} run={run} edit={setEditor} renameModule={renameModule} handle={handle} />;
  };
  return <WorkbenchTextProvider values={snapshot.settings.workbenchText} save={(key, value) => run(() => api.saveSettings({ workbenchText: { ...api.getSnapshot().settings.workbenchText, [key]: value } }))}><div className="bw-app bw-cards-surface" data-cards-embed={embed?.id}>
    {snapshot.loading && <p role="status">正在读取卡片…</p>}{(error || snapshot.error) && <p className="bw-sync-note is-error" role="alert">{error || snapshot.error}</p>}
    {!modules.length && <p className="bw-empty">当前代码块未指定卡片模块。</p>}
    <ModuleList ids={modules.map(module => module.id)} save={saveOrder ? async order => { await saveOrder(order); setEmbedOrder(order); } : order => api.saveSettings({ standaloneOrder: order })} initialDraft={embed ? initialDraft : standaloneDrafts.get(api)} retainDraft={embed ? retainDraft : draft => { if (draft) standaloneDrafts.set(api, draft); else standaloneDrafts.delete(api); }}>{renderModule}</ModuleList>
    {editor && <WorkEditor entity={editor} genericCard={!!editor.moduleId} api={api} run={run} close={() => setEditor(null)} />}
  </div></WorkbenchTextProvider>;
}
