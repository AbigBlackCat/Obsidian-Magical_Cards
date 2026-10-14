import React, { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CardsAPI, CardsDashboard } from './types';
import type { WorkPropertiesManager } from './WorkPropertiesSessions';
import CardsSurface, { assertCardModuleRemovalSettled, claimDashboardTabDraft, flushDashboardEdits, readDashboardTabDraft, registerDashboardTabDraftView, retainDashboardTabDraft, type DashboardTabDraft } from './CardsSurface';
export { flushDashboardEdits } from './CardsSurface';
import { deleteDashboard, saveDashboard, saveDashboardTabOrder } from './dashboards';
import { movedModule } from './ModuleList';
import { Field } from './primitives';
import ActionMenu from './ActionMenu';
import WorkImageImportRecovery from './WorkImageImportRecovery';

interface Props {
  api: CardsAPI;
  manager: WorkPropertiesManager;
  dashboardId: string;
  viewId?: string;
  onDashboardChange: (id: string) => void;
}
interface DashboardEditorState { draft: CardsDashboard; baseline: CardsDashboard | null; remove?: boolean; }
interface TabPointer { id: number; dashboard: string; x: number; moved: boolean; handle: HTMLButtonElement; baseline: CardsDashboard[]; }

export default function CardsDashboardView({ api, manager, dashboardId, viewId, onDashboardChange }: Props) {
  const snapshot = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
  const boards = snapshot.settings.dashboards ?? [];
  const supported = Boolean(api.supportsDashboardOnlyNavigation);
  const existing = boards.find(board => board.id === dashboardId);
  const retained = useRef<CardsDashboard | undefined>(undefined);
  if (existing) retained.current = existing;
  const dashboard = existing ?? (retained.current?.id === dashboardId ? retained.current : undefined) ?? boards[0];
  const selected = dashboard?.id ?? '';
  const replacement = existing?.id ?? boards[0]?.id ?? '';
  const panelId = useId(), draftOwner = viewId ?? panelId;
  const [editing, setEditing] = useState<DashboardEditorState | null>(null);
  const [tabDraft, setTabDraft] = useState<DashboardTabDraft | null>(() => readDashboardTabDraft(api, draftOwner) ?? null);
  const [before, setBefore] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false), mounted = useRef(true), composing = useRef(new Set<EventTarget>());
  const pointer = useRef<TabPointer | null>(null), dropTarget = useRef<string | null>(null), suppressClick = useRef(false);
  const clickReset = useRef<{ owner: Window; timer: number } | null>(null);
  const restoreTabFocus = useRef<HTMLButtonElement | null>(null);
  const surface = useRef<HTMLElement>(null), wrapper = useRef<HTMLDivElement>(null), tabList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mounted.current = true;
    const release = registerDashboardTabDraftView(api, draftOwner);
    setTabDraft(claimDashboardTabDraft(api, draftOwner));
    return () => {
      mounted.current = false; release();
      if (clickReset.current) clickReset.current.owner.clearTimeout(clickReset.current.timer);
      clickReset.current = null;
      const current = pointer.current; pointer.current = null;
      if (current?.handle.hasPointerCapture(current.id)) current.handle.releasePointerCapture(current.id);
    };
  }, [api, draftOwner]);
  useEffect(() => {
    const owner = wrapper.current?.ownerDocument.defaultView;
    if (!status || !owner) return;
    const timer = owner.setTimeout(() => setStatus(''), 4000);
    return () => owner.clearTimeout(timer);
  }, [status, selected]);
  useLayoutEffect(() => {
    if (busy || !restoreTabFocus.current) return;
    const handle = restoreTabFocus.current; restoreTabFocus.current = null;
    if (handle.isConnected && handle.ownerDocument.activeElement === handle.ownerDocument.body) handle.focus({ preventScroll: true });
  }, [busy, boards]);
  const execute = async (action: () => void | Promise<void>, retryTabs = false) => {
    if (pending.current) return;
    if (tabDraft && !retryTabs) { setError('Dashboard 排序草稿尚未保存，请先重试或放弃草稿。'); return; }
    if (composing.current.size) { setError('请先结束输入法输入，当前草稿已保留。'); return; }
    pending.current = true; setBusy(true); setError(''); setStatus('');
    try { await flushDashboardEdits(api, manager, surface.current ?? undefined); if (composing.current.size) throw new Error('请先结束输入法输入，当前草稿已保留。'); if (mounted.current) await action(); }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : '操作未完成，草稿已保留，请重试。'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const select = (id: string) => { if (id !== dashboardId) void execute(() => onDashboardChange(id)); };
  useEffect(() => { if (!snapshot.loading && dashboardId !== replacement) select(replacement); }, [dashboardId, replacement, snapshot.loading]);
  const openEditor = (board?: CardsDashboard, remove = false) => {
    if (!supported) { setError('请升级已启用的兼容卡片插件并重启笔记库，再管理 Dashboard。已有模块和资料已保留。'); return; }
    void execute(() => setEditing({ draft: board ? structuredClone(board) : { id: crypto.randomUUID(), title: '', moduleIds: [] }, baseline: board ? structuredClone(board) : null, remove }));
  };
  const persistTabs = (draft: DashboardTabDraft, keyboardHandle?: HTMLButtonElement) => {
    if (!supported || pending.current) return;
    restoreTabFocus.current = keyboardHandle ?? null;
    retainDashboardTabDraft(api, draftOwner, draft); setTabDraft(draft);
    void execute(async () => {
      await saveDashboardTabOrder(api, draft.baseline, draft.order);
      retainDashboardTabDraft(api, draftOwner, null);
      if (mounted.current) { setTabDraft(claimDashboardTabDraft(api, draftOwner)); setStatus('Dashboard 顺序已保存。'); }
    }, true);
  };
  const keyboard = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.nativeEvent.isComposing || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      if (!supported || busy || tabDraft) return;
      const target = index + (event.key === 'ArrowRight' ? 1 : -1);
      if (target < 0 || target >= boards.length) return;
      const order = boards.map(board => board.id), id = order[index];
      [order[index], order[target]] = [order[target], id];
      persistTabs({ baseline: structuredClone(boards), order }, event.currentTarget); return;
    }
    const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next]?.focus({ preventScroll: true });
  };
  const blockComposition = (event: React.PointerEvent) => { if (composing.current.size) { event.preventDefault(); setError('请先结束输入法输入，当前草稿已保留。'); } };
  const releasePointer = () => {
    const current = pointer.current; pointer.current = null;
    if (current?.handle.hasPointerCapture(current.id)) current.handle.releasePointerCapture(current.id);
    setBefore(undefined);
  };
  const startDrag = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
    suppressClick.current = false;
    if (!supported || busy || pending.current || tabDraft || composing.current.size || event.button !== 0 || !event.isPrimary || !boards.some(board => board.id === id)) return;
    pointer.current = { id: event.pointerId, dashboard: id, x: event.clientX, moved: false, handle: event.currentTarget, baseline: structuredClone(boards) };
    dropTarget.current = id; event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId || (!current.moved && Math.abs(event.clientX - current.x) < 6)) return;
    current.moved = true; event.preventDefault();
    const targets = Array.from(tabList.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
    const next = targets.find(tab => { const rect = tab.getBoundingClientRect(); return event.clientX < rect.left + rect.width / 2; })?.dataset.dashboardId ?? null;
    dropTarget.current = next; setBefore(next);
    const container = tabList.current;
    if (container) { const rect = container.getBoundingClientRect(); if (event.clientX > rect.right - 32) container.scrollBy(16, 0); else if (event.clientX < rect.left + 32) container.scrollBy(-16, 0); }
  };
  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const current = pointer.current; if (!current || current.id !== event.pointerId) return;
    releasePointer();
    if (!current.moved) return;
    suppressClick.current = true;
    const owner = current.handle.ownerDocument?.defaultView;
    if (clickReset.current) clickReset.current.owner.clearTimeout(clickReset.current.timer);
    if (owner) clickReset.current = { owner, timer: owner.setTimeout(() => { suppressClick.current = false; clickReset.current = null; }, 0) };
    const order = movedModule(current.baseline.map(board => board.id), current.dashboard, dropTarget.current);
    if (order.some((id, index) => id !== current.baseline[index].id)) persistTabs({ baseline: current.baseline, order });
  };
  const tabs = [...boards];
  if (dashboard && !boards.some(board => board.id === dashboard.id)) tabs.push({ ...dashboard, title: `${dashboard.title}（已删除）` });
  return <div ref={wrapper} className="bw-app bw-dashboard-view" onCompositionStartCapture={event => composing.current.add(event.target)} onCompositionEndCapture={event => composing.current.delete(event.target)}>
    <header className="bw-dashboard-toolbar" onPointerDownCapture={blockComposition}>
      <div ref={tabList} className="bw-dashboard-tabs" role="tablist" aria-label="Dashboard">
        {tabs.map((board, index) => <button type="button" key={board.id} role="tab" id={`${panelId}-${board.id}`} data-dashboard-id={board.id} data-drop-before={before === board.id ? 'true' : undefined} data-drop-after={before === null && index === tabs.length - 1 ? 'true' : undefined} aria-selected={selected === board.id} aria-controls={panelId} tabIndex={selected === board.id ? 0 : -1} title={`${board.title} · 拖动或 Alt / Option + ← / → 调整顺序`} disabled={busy} onKeyDown={event => { if (event.key === 'Escape' && pointer.current) { event.preventDefault(); releasePointer(); } else keyboard(event, index); }} onPointerDown={event => startDrag(event, board.id)} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={releasePointer} onLostPointerCapture={() => { if (pointer.current) releasePointer(); }} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } select(board.id); }}>{board.title}</button>)}
      </div>
      <ActionMenu label="Dashboard 操作" disabled={busy || snapshot.loading || !supported || Boolean(tabDraft)} actions={[
        { id: 'create', label: '新建 Dashboard', icon: 'plus', select: () => openEditor() },
        { id: 'rename', label: '重命名 Dashboard', icon: 'settings', disabled: !existing, select: () => openEditor(existing) },
        { id: 'delete', label: '删除 Dashboard', icon: 'trash', danger: true, disabled: !existing, select: () => openEditor(existing, true) },
      ]} />
    </header>
    {!supported && <p className="bw-dashboard-read-only" role="status">当前共享运行时仅支持只读分类。请升级已启用的兼容卡片插件后再管理 Dashboard；已有模块、资料和草稿已保留。</p>}
    {error && <p className="bw-dashboard-error" role="alert">{error}</p>}
    {status && <p className="bw-dashboard-status" role="status">{status}</p>}
    {tabDraft && <div className="bw-dashboard-tab-retry"><p>Dashboard 顺序尚未保存，已恢复原位置。草稿可重试或放弃。</p><button type="button" disabled={busy} onClick={() => persistTabs(tabDraft)}>重试 Dashboard 排序</button><button type="button" disabled={busy} onClick={() => { retainDashboardTabDraft(api, draftOwner, null); setTabDraft(claimDashboardTabDraft(api, draftOwner)); setError(''); }}>放弃 Dashboard 排序</button></div>}
    {dashboard && !existing && dashboard.id !== replacement && <button type="button" disabled={busy} onClick={() => select(replacement)}>切换到可用 Dashboard</button>}
    <WorkImageImportRecovery api={api} manager={manager} visibleCollectionIds={dashboard?.moduleIds} />
    {dashboard ? <section ref={surface} id={panelId} role="tabpanel" aria-labelledby={`${panelId}-${selected}`} aria-busy={busy} inert={busy}>
      <CardsSurface key={selected} api={api} manager={manager} dashboard={dashboard} />
    </section> : <section ref={surface} id={panelId} className="bw-dashboard-empty" role="region" aria-label="Dashboard 起步" aria-busy={busy}><p>{snapshot.loading ? '正在读取 Dashboard…' : '还没有 Dashboard。新建分类后，可在插件设置中将已有卡片模块加入分类。'}</p>{supported && !snapshot.loading && <button type="button" disabled={busy || Boolean(tabDraft)} onPointerDownCapture={blockComposition} onClick={() => openEditor()}>新建 Dashboard</button>}</section>}
    {editing && <DashboardEditor api={api} manager={manager} state={editing} close={id => { setEditing(null); if (id) { onDashboardChange(id); setStatus('Dashboard 已保存。请在插件设置中选择模块加入此分类。'); } else if (id === '') { const first = api.getSnapshot().settings.dashboards?.[0]?.id ?? ''; onDashboardChange(first); setStatus('Dashboard 已删除，模块、笔记和图片已保留。'); } }} />}
  </div>;
}

export function DashboardEditor({ api, manager, state, close }: { api: CardsAPI; manager: WorkPropertiesManager; state: DashboardEditorState; close: (id?: string) => void }) {
  const [draft, setDraft] = useState(state.draft);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef(false), composing = useRef(false), mounted = useRef(true), dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    mounted.current = true;
    const element = dialog.current, trigger = element?.ownerDocument.activeElement as HTMLElement | null;
    element?.showModal(); element?.querySelector<HTMLElement>(state.remove ? 'button' : 'input')?.focus({ preventScroll: true });
    return () => { mounted.current = false; element?.close(); if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, []);
  const submit = async () => {
    if (pending.current) return;
    if (composing.current) { setError('请先结束输入法输入，名称草稿已保留。'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      if (!api.supportsDashboardOnlyNavigation) throw new Error('请升级兼容卡片插件后再管理 Dashboard。草稿已保留。');
      if (state.remove) assertCardModuleRemovalSettled(api);
      await flushDashboardEdits(api, manager);
      if (!mounted.current) return;
      if (composing.current) throw new Error('请先结束输入法输入，名称草稿已保留。');
      if (state.remove) assertCardModuleRemovalSettled(api);
      if (state.remove && state.baseline) { await deleteDashboard(api, state.baseline); if (mounted.current) close(''); }
      else { await saveDashboard(api, draft, state.baseline); if (mounted.current) close(draft.id); }
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : '保存未完成，草稿已保留，请重试。'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return <dialog ref={dialog} className="bw-editor bw-editor-dialog bw-dashboard-editor" aria-labelledby={titleId} onCompositionStartCapture={() => { composing.current = true; }} onCompositionEndCapture={() => { composing.current = false; }} onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <header className="bw-section-head"><h2 id={titleId}>{state.remove ? '删除' : state.baseline ? '重命名' : '新建'} Dashboard</h2><button type="button" disabled={busy} onClick={() => close()}>关闭</button></header>
    <form onSubmit={event => { event.preventDefault(); void submit(); }}><fieldset disabled={busy}>
      {state.remove ? <p>确认删除“{draft.title}”？仅删除此分类，模块、笔记和图片都会保留。</p> : <><Field label="Dashboard 名称"><input required maxLength={180} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} /></Field><p className="bw-dashboard-help">模块分类在插件设置中调整。新建 Dashboard 不会自动加入模块。</p></>}
      {error && <p className="bw-dashboard-error" role="alert">{error}</p>}
      <footer className="bw-dashboard-editor-actions"><button type="button" onClick={() => close()}>取消</button><button type="submit" className={state.remove ? 'bw-danger' : 'bw-primary'}>{busy ? '保存中…' : state.remove ? '确认删除 Dashboard' : '保存 Dashboard'}</button></footer>
    </fieldset></form>
  </dialog>;
}
