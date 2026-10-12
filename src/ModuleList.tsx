import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export function movedModule(ids: string[], id: string, before: string | null) {
  if (id === before) return ids;
  const result = ids.filter(item => item !== id), index = before === null ? result.length : result.indexOf(before);
  if (!ids.includes(id) || index < 0) return ids;
  result.splice(index, 0, id); return result;
}

interface Props {
  ids: string[];
  save: (ids: string[]) => Promise<void>;
  children: (id: string, handle: React.ReactNode) => React.ReactNode;
  initialDraft?: string[];
  retainDraft?: (draft: string[] | null) => void;
}

/** Drag only the title handle, leaving carousel gestures and editing fields alone. */
export default function ModuleList({ ids, save, children, initialDraft, retainDraft }: Props) {
  const list = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ id: number; module: string; y: number; moved: boolean; handle: HTMLButtonElement } | null>(null);
  const target = useRef<string | null>(null);
  const latest = useRef(ids); latest.current = ids;
  const [before, setBefore] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [draft, setDraft] = useState<string[] | null>(initialDraft ?? null);
  const draftRef = useRef(draft); draftRef.current = draft;
  const [error, setError] = useState(initialDraft ? '上次排序尚未保存，已恢复原位置，可重试草稿。' : '');
  const [status, setStatus] = useState('');
  const mounted = useRef(true);
  const restoreFocus = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    if (busy || !restoreFocus.current) return;
    const handle = restoreFocus.current; restoreFocus.current = null;
    if (handle.isConnected && handle.ownerDocument.activeElement === handle.ownerDocument.body) handle.focus({ preventScroll: true });
  }, [ids, busy]);
  const release = () => {
    const current = pointer.current; pointer.current = null;
    if (current?.handle.hasPointerCapture(current.id)) current.handle.releasePointerCapture(current.id);
    if (!saving.current && !draftRef.current) list.current?.removeAttribute('data-cards-pending');
    setBefore(undefined);
  };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; const current = pointer.current; pointer.current = null; if (current?.handle.hasPointerCapture(current.id)) current.handle.releasePointerCapture(current.id); }; }, []);
  const persist = async (order: string[], keyboardHandle?: HTMLButtonElement) => {
    if (saving.current || order.join('\0') === latest.current.join('\0')) return;
    restoreFocus.current = keyboardHandle ?? null;
    list.current?.setAttribute('data-cards-pending', 'module-sort');
    saving.current = true; draftRef.current = order; setBusy(true); setError(''); setStatus(''); setDraft(order); retainDraft?.(order);
    try { await save(order); retainDraft?.(null); draftRef.current = null; list.current?.removeAttribute('data-cards-pending'); if (mounted.current) { setDraft(null); setStatus('模块顺序已保存。'); } }
    catch (failure) { if (mounted.current) setError(`排序未保存，已恢复原位置。${failure instanceof Error ? failure.message : String(failure)}`); }
    finally { saving.current = false; if (mounted.current) setBusy(false); }
  };
  const down = (event: React.PointerEvent<HTMLButtonElement>, module: string) => {
    if (event.button !== 0 || !event.isPrimary || busy || saving.current) return;
    list.current?.setAttribute('data-cards-pending', 'module-sort');
    event.stopPropagation(); pointer.current = { id: event.pointerId, module, y: event.clientY, moved: false, handle: event.currentTarget };
    target.current = module;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: React.PointerEvent<HTMLButtonElement>) => {
    const current = pointer.current; if (!current || event.pointerId !== current.id) return;
    if (!current.moved && Math.abs(event.clientY - current.y) < 6) return;
    current.moved = true; event.preventDefault(); event.stopPropagation();
    const rows = Array.from(list.current?.children ?? []).filter((el): el is HTMLElement => el.instanceOf(HTMLElement) && !!el.dataset.cardsModule);
    const next = rows.find(row => event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2)?.dataset.cardsModule ?? null;
    target.current = next; setBefore(next);
    const owner = list.current?.closest<HTMLElement>('.view-content, .workspace-leaf-content, .markdown-preview-view, .cm-scroller');
    if (owner) { const rect = owner.getBoundingClientRect(); if (event.clientY > rect.bottom - 50) owner.scrollBy(0, 16); if (event.clientY < rect.top + 50) owner.scrollBy(0, -16); }
  };
  const up = (event: React.PointerEvent<HTMLButtonElement>) => {
    const current = pointer.current; if (!current || event.pointerId !== current.id) return;
    event.stopPropagation(); const order = movedModule(latest.current, current.module, target.current); const moved = current.moved;
    release(); if (moved) void persist(order);
  };
  const keyboard = (event: React.KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (event.key === 'Escape' && pointer.current) { event.preventDefault(); event.stopPropagation(); release(); return; }
    if (busy || saving.current || !event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const index = latest.current.indexOf(id);
    if (event.key === 'ArrowUp' && index > 0) void persist(movedModule(latest.current, id, latest.current[index - 1]), event.currentTarget);
    if (event.key === 'ArrowDown' && index < latest.current.length - 1) void persist(movedModule(latest.current, id, latest.current[index + 2] ?? null), event.currentTarget);
  };
  return <><div className="bw-module-sort-state" aria-live="polite">{status}{error && <div role="alert"><p>{error}</p>{draft && <button type="button" disabled={busy} onClick={() => { void persist(draft); }}>重试排序草稿</button>}<button type="button" disabled={busy} onClick={() => { draftRef.current = null; list.current?.removeAttribute('data-cards-pending'); setDraft(null); retainDraft?.(null); setError(''); }}>放弃排序草稿</button></div>}</div><div ref={list} className={`bw-cards-modules${before === null ? ' is-drop-end' : ''}`} aria-busy={busy} data-cards-pending={busy || draft || before !== undefined ? 'module-sort' : undefined}>
    {ids.map(id => <div key={id} data-cards-module={id} className={`bw-cards-module-slot${before === id ? ' is-drop-before' : ''}`}>{children(id, <button type="button" className="bw-module-handle bw-icon-button" aria-label="调整卡片模块位置" title="拖拽模块 · Alt / Option + ↑ / ↓" aria-disabled={busy} onPointerDown={event => down(event, id)} onPointerMove={move} onPointerUp={up} onPointerCancel={release} onLostPointerCapture={() => { if (pointer.current) release(); }} onKeyDown={event => keyboard(event, id)}>⠿</button>)}</div>)}
  </div></>;
}
