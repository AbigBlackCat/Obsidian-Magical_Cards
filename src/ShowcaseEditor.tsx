import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { ShowcaseDescription, type ShowcaseSession } from './ShowcaseCardBack';

export default function ShowcaseEditor({ session, label, close }: { session: ShowcaseSession; label: string; close: () => void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const composing = useRef(false);
  const endComposition = () => { if (composing.current) { composing.current = false; session.endComposition(); } };
  const flush = () => { void session.flush().catch(() => {}); };
  useEffect(() => () => { if (composing.current) { composing.current = false; session.interruptComposition(); } void session.flush().catch(() => {}); }, [session]);
  return <section className="bw-editor bw-showcase-editor" data-card-control aria-label={`编辑${label}`} onKeyDown={event => { event.stopPropagation(); if (!event.nativeEvent.isComposing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void session.retry().catch(() => {}); } }}>
    <header className="bw-section-head"><h3>编辑当前图片</h3><button type="button" disabled={state.saving} onClick={() => { flush(); close(); }}>收起编辑</button></header>
    <label>名称（可选）<input maxLength={180} aria-label="图片名称" value={state.name} disabled={!state.card || state.loading} onChange={event => session.updateName(event.target.value)} onBlur={flush} onCompositionStart={() => { if (!composing.current) { composing.current = true; session.startComposition(); } }} onCompositionEnd={event => { session.updateName(event.currentTarget.value); endComposition(); }} /></label>
    <button type="button" disabled={state.saving || !state.dirty} onClick={() => { void session.retry().catch(() => {}); }}>{state.saving ? '保存中…' : state.error ? '重试保存' : '保存名称与描述'}</button>
    <ShowcaseDescription session={session} label={label} />
  </section>;
}
