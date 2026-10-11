import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CoverImage } from './CoverImage';
import type { Book, Film, CardsAPI, CustomCardModule, WorkOrder, WorkKind } from './types';
import { orderedWorks } from './work-order';

export interface WorkOrderAPI extends Pick<CardsAPI, 'subscribe' | 'moveWork' | 'coverUrl' | 'openNote'> { getSnapshot(): { entities: Array<{id: string; type: string; moduleId?: string}>; workOrder: WorkOrder | null; settings: { customModules: CustomCardModule[] }; }; }

type DragSession = { id: string; phase: 'dragging' | 'saving'; initial: string[]; before: string | null };
type Press = { id: number; x: number; y: number; startX: number; startY: number; moved: boolean; handle: HTMLButtonElement };

export function WorkOrderList({ api, kind, moduleId }: { api: WorkOrderAPI; kind: WorkKind; moduleId?: string }) {
  const snapshot = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
  const module = snapshot.settings.customModules.find(item => item.id === moduleId && item.kind === kind);
  const works = snapshot.entities.filter((entity): entity is Book | Film => entity.type === kind && (moduleId !== undefined ? entity.moduleId === moduleId : !snapshot.settings.customModules.some(item => item.id === entity.moduleId && item.kind === entity.type)));
  const [draft, setDraft] = useState<string[] | null>(null);
  const [dropBefore, setDropBefore] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const sorted = orderedWorks(works, draft ?? snapshot.workOrder?.[kind]);
  const idsRef = useRef<string[]>([]);
  idsRef.current = sorted.map(work => work.id);
  const list = useRef<HTMLOListElement>(null);
  const session = useRef<DragSession | null>(null);
  const press = useRef<Press | null>(null);
  const scroll = useRef({ frame: 0, speed: 0 });
  const mounted = useRef(true);
  const label = moduleId !== undefined ? module?.title ?? '卡片' : kind === 'book' ? '书籍' : '影视';

  const stopScroll = () => { cancelAnimationFrame(scroll.current.frame); scroll.current = { frame: 0, speed: 0 }; };
  const release = () => {
    const pointer = press.current;
    press.current = null;
    if (pointer?.handle.hasPointerCapture(pointer.id)) pointer.handle.releasePointerCapture(pointer.id);
  };
  const cancel = () => {
    stopScroll();
    release();
    if (session.current?.phase === 'saving') return;
    session.current = null;
    setDraft(null);
    setDropBefore(undefined);
  };
  useEffect(() => {
    mounted.current = true;
    const hidden = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { mounted.current = false; stopScroll(); release(); document.removeEventListener('visibilitychange', hidden); };
  }, []);

  const chooseDrop = (before: string | null) => {
    const drag = session.current;
    if (drag?.phase !== 'dragging') return;
    drag.before = before === drag.id ? drag.initial[drag.initial.indexOf(drag.id) + 1] ?? null : before;
    setDropBefore(drag.before);
  };
  const chooseAt = (x: number, y: number) => {
    const element = list.current;
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < Math.max(0, rect.top) || y > Math.min(window.innerHeight, rect.bottom)) return false;
    for (const row of element.querySelectorAll<HTMLLIElement>('[data-work-id]')) {
      const rowRect = row.getBoundingClientRect();
      if (y <= rowRect.bottom) {
        const id = row.dataset.workId!;
        chooseDrop(y < rowRect.top + rowRect.height / 2 ? id : idsRef.current[idsRef.current.indexOf(id) + 1] ?? null);
        return true;
      }
    }
    chooseDrop(null);
    return true;
  };
  const updateScroll = (y: number) => {
    const element = list.current;
    if (!element || session.current?.phase !== 'dragging') return;
    const rect = element.getBoundingClientRect();
    scroll.current.speed = y < rect.top + 48 ? -Math.min(16, (rect.top + 48 - y) / 3) : y > rect.bottom - 48 ? Math.min(16, (y - rect.bottom + 48) / 3) : 0;
    if (!scroll.current.speed) { stopScroll(); return; }
    if (scroll.current.frame) return;
    const frame = () => {
      if (!list.current || !press.current || session.current?.phase !== 'dragging') { stopScroll(); return; }
      list.current.scrollTop += scroll.current.speed;
      chooseAt(press.current.x, press.current.y);
      scroll.current.frame = requestAnimationFrame(frame);
    };
    scroll.current.frame = requestAnimationFrame(frame);
  };
  const placeBefore = (moving: string, before: string | null) => {
    const next = idsRef.current.filter(id => id !== moving);
    const target = before ? next.indexOf(before) : next.length;
    next.splice(target < 0 ? next.length : target, 0, moving);
    idsRef.current = next;
    setDraft(next);
  };
  const save = async (moving: string) => {
    stopScroll();
    const index = idsRef.current.indexOf(moving);
    if (index < 0) { cancel(); return; }
    if (session.current) session.current.phase = 'saving';
    else session.current = { id: moving, phase: 'saving', initial: [...idsRef.current], before: idsRef.current[index + 1] ?? null };
    setBusy(true);
    setError('');
    try {
      await api.moveWork(kind, moving, idsRef.current[index + 1] ?? null);
      if (mounted.current) setAnnouncement(`${label}顺序已保存，第 ${index + 1} 位`);
    } catch (failure) {
      if (mounted.current) setError(`顺序未保存：${(failure as Error).message}`);
    } finally {
      session.current = null;
      if (mounted.current) { setDraft(null); setDropBefore(undefined); setBusy(false); }
    }
  };
  const pointerDown = (event: React.PointerEvent<HTMLButtonElement>, work: Book | Film) => {
    if (event.button !== 0 || !event.isPrimary || busy || session.current || idsRef.current.length < 2) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    press.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, handle: event.currentTarget };
    session.current = { id: work.id, phase: 'dragging', initial: [...idsRef.current], before: idsRef.current[idsRef.current.indexOf(work.id) + 1] ?? null };
    setDraft([...idsRef.current]);
    setError('');
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const pointer = press.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    pointer.x = event.clientX; pointer.y = event.clientY;
    pointer.moved ||= Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) >= 6;
    if (!pointer.moved) return;
    if (chooseAt(pointer.x, pointer.y)) updateScroll(pointer.y);
    else { stopScroll(); setDropBefore(undefined); }
  };
  const pointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const pointer = press.current, drag = session.current;
    if (!pointer || pointer.id !== event.pointerId || drag?.phase !== 'dragging') return;
    const moved = pointer.moved || Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) >= 6;
    if (!moved || !chooseAt(event.clientX, event.clientY) || (drag.initial[drag.initial.indexOf(drag.id) + 1] ?? null) === drag.before) { cancel(); return; }
    drag.phase = 'saving';
    release();
    placeBefore(drag.id, drag.before);
    void save(drag.id);
  };
  const keyboard = (event: React.KeyboardEvent<HTMLButtonElement>, work: Book | Film) => {
    if (event.key === 'Escape' && session.current?.phase === 'dragging') { event.preventDefault(); event.stopPropagation(); cancel(); return; }
    if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (busy || session.current) return;
    const index = idsRef.current.indexOf(work.id);
    if (event.key === 'ArrowUp' && index > 0) placeBefore(work.id, idsRef.current[index - 1]);
    else if (event.key === 'ArrowDown' && index >= 0 && index < idsRef.current.length - 1) placeBefore(work.id, idsRef.current[index + 2] ?? null);
    else return;
    void save(work.id);
  };

  return <div className="bw-work-order" data-work-kind={kind} data-work-module={moduleId} aria-busy={busy}>
    <span className="bw-sr-only" role="status">{announcement}</span>
    {error && <p className="bw-order-error" role="alert">{error}</p>}
    {sorted.length ? <ol ref={list} className={`bw-order-list${dropBefore === null ? ' has-drop-end' : ''}`} aria-label={`${label}顺序`}>
      {sorted.map((work, index) => <li key={work.id} data-work-id={work.id} className={`bw-order-row${session.current?.id === work.id ? ' is-moving' : ''}${dropBefore === work.id ? ' is-drop-before' : ''}`}>
        <button type="button" className="bw-order-handle" aria-label={`调整《${work.title}》顺序`} title="拖拽排序 · Alt / Option + ↑ / ↓" aria-disabled={busy} onPointerDown={event => pointerDown(event, work)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancel} onLostPointerCapture={() => { if (press.current) cancel(); }} onKeyDown={event => keyboard(event, work)}>
          <svg width="18" height="20" viewBox="0 0 18 20" fill="currentColor" aria-hidden="true"><circle cx="6" cy="5" r="1.3"/><circle cx="12" cy="5" r="1.3"/><circle cx="6" cy="10" r="1.3"/><circle cx="12" cy="10" r="1.3"/><circle cx="6" cy="15" r="1.3"/><circle cx="12" cy="15" r="1.3"/></svg>
        </button>
        <span className="bw-order-position" aria-hidden="true">{index + 1}</span>
        <CoverImage className="bw-order-cover" src={api.coverUrl(work.cover, work.path)} title={work.title}/>
        <button type="button" className="bw-order-title" onClick={() => { void api.openNote(work.path).catch(failure => setError((failure as Error).message)); }}><span>{work.title}</span><small>{moduleId !== undefined ? work.summary : work.type === 'book' ? work.author : [work.director, work.year].filter(Boolean).join(' · ')}</small></button>
      </li>)}
    </ol> : <p className="bw-order-empty">暂无{label}。</p>}
  </div>;
}
