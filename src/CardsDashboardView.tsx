import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { CardsAPI, CardsDashboard } from './types';
import type { WorkPropertiesManager } from './WorkPropertiesSessions';
import CardsSurface from './CardsSurface';
import { ALL_DASHBOARD_ID, deleteDashboard, saveDashboard } from './dashboards';
import { cardModuleChoices } from './module-choice';
import { getShowcaseManager } from './showcase-sessions';
import { Field, Icon } from './primitives';

export async function flushDashboardEdits(api: CardsAPI, manager: WorkPropertiesManager, surface?: HTMLElement): Promise<void> {
  const checkTitles = () => {
    if (surface?.querySelector('[data-editable-composing="true"]')) throw new Error('请先结束输入法输入，模块名称草稿已保留。');
    const focused = surface?.ownerDocument.activeElement;
    if (focused?.instanceOf(HTMLElement) && surface?.contains(focused) && focused.classList.contains('bw-editable-text')) focused.blur();
    if (surface?.querySelector('.bw-editable-text[data-editable-saving="true"], .bw-editable-text[data-editable-error="true"]')) throw new Error('模块名称尚未保存，请等待保存完成，或回到标题重试后再切换 Dashboard。');
  };
  checkTitles();
  await manager.flushAll();
  if (manager.recoveryDrafts().length) throw new Error('卡片草稿尚未保存，请完成编辑后再切换 Dashboard。');
  await getShowcaseManager(api)?.flushAll();
  checkTitles();
}

interface Props {
  api: CardsAPI;
  manager: WorkPropertiesManager;
  dashboardId: string;
  onDashboardChange: (id: string) => void;
}
interface DashboardEditorState { draft: CardsDashboard; baseline: CardsDashboard | null; }

export default function CardsDashboardView({ api, manager, dashboardId, onDashboardChange }: Props) {
  const snapshot = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
  const boards = snapshot.settings.dashboards ?? [];
  const existing = api.supportsDashboards ? boards.find(board => board.id === dashboardId) : undefined;
  const retained = useRef<CardsDashboard | undefined>(undefined);
  if (existing) retained.current = existing;
  const dashboard = dashboardId === ALL_DASHBOARD_ID ? undefined : existing ?? (retained.current?.id === dashboardId ? retained.current : undefined);
  const [editing, setEditing] = useState<DashboardEditorState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const composing = useRef(new Set<EventTarget>());
  const panelId = useId();
  const surface = useRef<HTMLElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const execute = async (action: () => void) => {
    if (pending.current) return;
    if (composing.current.size) { setError('请先结束输入法输入，当前草稿已保留。'); return; }
    pending.current = true; setBusy(true); setError('');
    try { await flushDashboardEdits(api, manager, surface.current ?? undefined); if (composing.current.size) throw new Error('请先结束输入法输入，当前草稿已保留。'); if (mounted.current) action(); }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : '操作未完成，草稿已保留，请重试。'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const select = (id: string) => { if (id !== dashboardId) void execute(() => onDashboardChange(id)); };
  useEffect(() => {
    if (!snapshot.loading && dashboardId !== ALL_DASHBOARD_ID && !existing) select(ALL_DASHBOARD_ID);
  }, [dashboardId, Boolean(existing), snapshot.loading]);
  const openEditor = (board?: CardsDashboard) => {
    if (!api.supportsDashboards) { setError('请升级已启用的兼容卡片插件并重启笔记库，再使用 Dashboard。已有模块和资料已保留。'); return; }
    void execute(() => setEditing({ draft: board ? structuredClone(board) : { id: crypto.randomUUID(), title: '', moduleIds: [] }, baseline: board ? structuredClone(board) : null }));
  };
  const keyboard = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.nativeEvent.isComposing || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next]?.focus();
  };
  const selected = dashboard?.id ?? ALL_DASHBOARD_ID;
  const tabs = [{ id: ALL_DASHBOARD_ID, title: '全部' }, ...(api.supportsDashboards ? boards : [])];
  if (dashboard && !existing) tabs.push({ id: dashboard.id, title: `${dashboard.title}（已删除）` });
  return <div className="bw-app bw-dashboard-view" onCompositionStartCapture={event => composing.current.add(event.target)} onCompositionEndCapture={event => composing.current.delete(event.target)}>
    <header className="bw-dashboard-toolbar" onPointerDownCapture={event => { if (composing.current.size) { event.preventDefault(); setError('请先结束输入法输入，当前草稿已保留。'); } }}>
      <div className="bw-dashboard-tabs" role="tablist" aria-label="Dashboard">
        {tabs.map((board, index) => <button type="button" key={board.id} role="tab" id={`${panelId}-${board.id}`} aria-selected={selected === board.id} aria-controls={panelId} tabIndex={selected === board.id ? 0 : -1} disabled={busy} onKeyDown={event => keyboard(event, index)} onClick={() => select(board.id)}>{board.title}</button>)}
      </div>
      <button type="button" className="bw-icon-button" aria-label="新建 Dashboard" title="新建 Dashboard" disabled={busy || snapshot.loading} onClick={() => openEditor()}><Icon name="plus" /></button>
      {existing && <button type="button" disabled={busy} onClick={() => openEditor(existing)}>编辑 Dashboard</button>}
    </header>
    {error && <p className="bw-dashboard-error" role="alert">{error}</p>}
    <section ref={surface} id={panelId} role="tabpanel" aria-labelledby={`${panelId}-${selected}`} aria-busy={busy}>
      <CardsSurface key={selected} api={api} manager={manager} dashboard={dashboard} />
    </section>
    {editing && <DashboardEditor api={api} manager={manager} state={editing} close={() => setEditing(null)} />}
  </div>;
}

function DashboardEditor({ api, manager, state, close }: { api: CardsAPI; manager: WorkPropertiesManager; state: DashboardEditorState; close: () => void }) {
  const snapshot = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
  const [draft, setDraft] = useState(state.draft);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pending = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(true);
  const titleId = useId();
  useEffect(() => {
    mounted.current = true;
    const element = dialog.current, trigger = element?.ownerDocument.activeElement as HTMLElement | null;
    element?.showModal(); element?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    return () => { mounted.current = false; element?.close(); if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, []);
  const settings = snapshot.settings, choices = cardModuleChoices(settings, true);
  for (const id of draft.moduleIds) if (!choices.some(choice => choice.id === id)) choices.push({ id, label: `未找到模块：${id}` });
  const submit = async (remove = false) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      await flushDashboardEdits(api, manager);
      if (remove && state.baseline) await deleteDashboard(api, state.baseline);
      else await saveDashboard(api, draft, state.baseline);
      if (mounted.current) close();
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : '保存未完成，草稿已保留，请重试。'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return <dialog ref={dialog} className="bw-editor bw-editor-dialog bw-dashboard-editor" aria-labelledby={titleId} onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <header className="bw-section-head"><h2 id={titleId}>{state.baseline ? '编辑' : '新建'} Dashboard</h2><button type="button" disabled={busy} onClick={close}>关闭</button></header>
    <form onSubmit={event => { event.preventDefault(); void submit(); }}><fieldset disabled={busy}>
      <Field label="Dashboard 名称"><input required maxLength={180} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} /></Field>
      <p className="bw-dashboard-help">选择要展示的已有模块。只有主动勾选，才会同时出现在多个 Dashboard；笔记和图片共用一份。</p>
      <div className="bw-dashboard-choices">{choices.map(choice => {
        const other = (settings.dashboards ?? []).filter(board => board.id !== draft.id && board.moduleIds.includes(choice.id)).map(board => board.title);
        const hidden = settings.hiddenModuleIds?.includes(choice.id);
        return <label key={choice.id} className="bw-dashboard-choice"><input type="checkbox" checked={draft.moduleIds.includes(choice.id)} onChange={event => { const checked = event.target.checked; setDraft(current => ({ ...current, moduleIds: checked ? [...current.moduleIds, choice.id] : current.moduleIds.filter(id => id !== choice.id) })); }} /><span><span>{choice.label}</span>{(other.length > 0 || hidden) && <small>{[other.length > 0 ? `已加入：${other.join('、')}` : '', hidden ? '已移除，恢复后显示' : ''].filter(Boolean).join('；')}</small>}</span></label>;
      })}</div>
      {error && <p className="bw-dashboard-error" role="alert">{error}</p>}
      <footer className="bw-dashboard-editor-actions"><button type="button" onClick={close}>取消</button><button type="submit" className="bw-primary">{busy ? '保存中…' : '保存 Dashboard'}</button></footer>
      {state.baseline && <div className="bw-dashboard-delete">{confirmDelete ? <><p>仅删除此分类，模块、笔记和图片都会保留。</p><button type="button" onClick={() => setConfirmDelete(false)}>取消删除</button><button type="button" className="bw-danger" onClick={() => { void submit(true); }}>确认删除 Dashboard</button></> : <button type="button" onClick={() => setConfirmDelete(true)}><Icon name="trash" />删除 Dashboard</button>}</div>}
    </fieldset></form>
  </dialog>;
}
