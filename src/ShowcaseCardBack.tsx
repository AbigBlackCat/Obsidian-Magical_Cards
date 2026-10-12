import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import type { ShowcaseSessionsManager } from './showcase-sessions';

export type ShowcaseSession = ReturnType<ShowcaseSessionsManager['getSession']>;

/** The same retained description draft is used by the back and the flip-independent editor. */
export function ShowcaseDescription({ session, label }: { session: ShowcaseSession; label: string }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const composing = useRef(false);
  const endComposition = () => { if (composing.current) { composing.current = false; session.endComposition(); } };
  const interruptComposition = () => { if (composing.current) { composing.current = false; session.interruptComposition(); } };
  const flush = () => { void session.flush().catch(() => {}); };
  useEffect(() => () => { interruptComposition(); void session.flush().catch(() => {}); }, [session]);
  return <div className="bw-showcase-description" onKeyDown={event => {
    event.stopPropagation();
    if (!event.nativeEvent.isComposing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void session.retry().catch(() => {}); }
  }}>
    <label className="bw-card-summary-editor"><span>描述</span><textarea rows={5} maxLength={400} aria-label={`${label}的描述`} value={state.description} disabled={!state.card || state.loading} onChange={event => session.update(event.target.value)} onBlur={event => { if (!event.relatedTarget?.closest('[data-bw-discard]')) flush(); }} onCompositionStart={() => { if (!composing.current) { composing.current = true; session.startComposition(); } }} onCompositionEnd={event => { session.update(event.currentTarget.value); endComposition(); }} /></label>
    <p role="status">{state.loading ? '正在读取…' : state.saving ? '保存中…' : state.error ? '尚未保存' : state.dirty ? '待保存' : '已保存'}</p>
    {state.error && <div className="bw-card-back-error" role="alert"><p>{state.error}</p><button type="button" data-card-control disabled={state.saving} onClick={() => { void session.retry().catch(() => {}); }}>重试保存</button><button type="button" data-card-control data-bw-discard="" disabled={state.saving} onClick={() => { interruptComposition(); void session.reload().catch(() => {}); }}>放弃草稿并重新载入</button></div>}
  </div>;
}

export default function ShowcaseCardBack({ session, label, showName, active, flip, open }: { session: ShowcaseSession; label: string; showName: boolean; active: boolean; flip: () => void; open: () => void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useEffect(() => { if (!active) void session.flush().catch(() => {}); }, [active, session]);
  return <section className="bw-card-back-content" aria-label={`${label}的背面`} onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <header className="bw-card-back-header">{showName && state.name.trim() && <h3>{state.name}</h3>}<button type="button" data-card-control className="bw-card-flip" aria-label="返回正面" onClick={() => { void session.flush().catch(() => {}); flip(); }}>返回正面</button></header>
    <ShowcaseDescription session={session} label={label} />
    <footer className="bw-card-back-footer"><button type="button" data-card-control onClick={() => { void session.flush().catch(() => {}); open(); }}>编辑模块笔记</button></footer>
  </section>;
}
