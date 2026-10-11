import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Book, Film } from './types';
import type { WorkPropertiesSession } from './WorkPropertiesSessions';

export function WorkCardBack({ work, session, active, flip, open }: { work: Book | Film; session: WorkPropertiesSession; active: boolean; flip: () => void; open: () => void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const composing = useRef(false);
  const ready = !!state.properties && !!state.values;
  const endComposition = () => {
    if (composing.current) { composing.current = false; session.endComposition(); }
  };
  const flush = () => { endComposition(); void session.flush().catch(() => {}); };
  useEffect(() => { if (!active) flush(); }, [active, session]);
  useEffect(() => () => { endComposition(); void session.flush().catch(() => {}); }, [session]);
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return <section className="bw-card-back-content" aria-label={`${work.title}的背面`} onClick={stop} onDoubleClick={stop} onKeyDown={event => {
    event.stopPropagation();
    if (!event.nativeEvent.isComposing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); flush(); }
  }} onBlur={event => {
    if ((event.relatedTarget as Element | null)?.closest?.('[data-bw-discard]')) return;
    flush();
  }}>
    <header className="bw-card-back-header"><h3 style={{textAlign:state.values?.cardTitleAlign??work.cardTitleAlign??'left'}}>{state.values?.title ?? work.title}</h3><button type="button" data-card-control className="bw-card-flip" aria-label="返回正面" title="返回正面" onClick={() => { flush(); flip(); }}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 7H5V4M5 7a8 8 0 1 1-1 8"/><path d="M9 12h6"/></svg><span className="bw-sr-only">返回正面</span></button></header>
    <label className="bw-card-summary-editor"><span>摘要</span><textarea maxLength={400} style={{textAlign:state.values?.cardSummaryAlign??work.cardSummaryAlign??'left'}} aria-label={`${work.title}的背面文字`} value={state.values?.summary ?? work.summary} disabled={!ready} onChange={event => { event.stopPropagation(); session.update({ summary: event.target.value }); }} onCompositionStart={event => {
      event.stopPropagation();
      if (!composing.current) { composing.current = true; session.startComposition(); }
    }} onCompositionEnd={event => { event.stopPropagation(); session.update({ summary: event.currentTarget.value }); endComposition(); }}/></label>
    <footer className="bw-card-back-footer"><span role="status">{state.loading ? '正在读取…' : state.saving ? '保存中…' : state.error ? '尚未保存' : state.dirty ? '待保存' : '已保存'}</span><button type="button" data-card-control onClick={() => { flush(); open(); }}>打开笔记</button></footer>
    {state.error && <div className="bw-card-back-error" role="alert"><p>{state.error}</p><div><button type="button" data-card-control disabled={state.saving} onClick={() => { void (ready ? session.flush() : session.reload()).catch(() => {}); }}>重试</button><button type="button" data-card-control data-bw-discard="" disabled={state.saving} onClick={() => { endComposition(); void session.reload(); }}>放弃草稿并重新载入</button></div></div>}
  </section>;
}

export default WorkCardBack;
