import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CoverImage } from './CoverImage';
import type { CardsAPI, CustomCardModule, WorkPropertyValues } from './types';
import type { WorkPropertiesSession } from './WorkPropertiesSessions';
import NotePicker from './NotePicker';

export interface WorkPropertiesPanelAPI extends Pick<CardsAPI, 'subscribe' | 'coverUrl' | 'listNoteCandidates'> { getSnapshot(): { entities: Array<{id: string; type: string; moduleId?: string}>; settings: {customModules: CustomCardModule[]}; }; }

export { WorkPropertiesManager } from './WorkPropertiesSessions';
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={`bw-property-field${wide ? ' is-wide' : ''}`}><span>{label}</span>{children}</label>; }

export function WorkPropertiesPanel({ api, session, onRawChange, onReady }: { api: WorkPropertiesPanelAPI; session: WorkPropertiesSession; onRawChange: (expanded: boolean) => void; onReady: (ready: boolean) => void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const snapshot = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
  const currentWork = snapshot.entities.find(work => work.id === session.id);
  const moduleId = state.properties ? state.properties.moduleId : ((currentWork?.type === 'book' || currentWork?.type === 'film') ? currentWork.moduleId : undefined);
  const custom = !!moduleId && snapshot.settings.customModules.some(module => module.id === moduleId);
  const informationTitle = custom ? '卡片信息' : '作品信息';
  const [raw, setRaw] = useState(false);
  const [coverRetry, setCoverRetry] = useState(0);
  const composing = useRef(false);
  const ready = !!state.properties && !!state.values;
  useEffect(() => { onReady(ready); return () => onReady(false); }, [ready, onReady]);
  useEffect(() => () => { if (composing.current) session.endComposition(); }, [session]);
  const flush = () => { if (!composing.current) void session.flush().catch(() => {}); };
  const update = (patch: Partial<WorkPropertyValues>) => session.update(patch);
  const composition = {
    onCompositionStart: () => { if (!composing.current) { composing.current = true; session.startComposition(); } },
    onCompositionEnd: () => { if (composing.current) { composing.current = false; session.endComposition(); } },
  };
  const error = state.error && <div className="bw-properties-error" role="alert"><p>{state.error}</p><div><button type="button" disabled={state.saving} onClick={() => { void (ready ? session.flush() : session.reload()).catch(() => {}); }}>重试</button><button type="button" data-bw-discard="" disabled={state.saving} onClick={() => { void session.reload(); }}>放弃草稿并重新载入</button></div></div>;
  if (!ready) return <section className="bw-work-properties" aria-label={informationTitle}>{state.loading && <p className="bw-properties-state" role="status">正在读取{informationTitle}…</p>}{error}</section>;
  const work = state.properties!, values = state.values!, book = work.kind === 'book';
  return <section className="bw-work-properties" aria-label={informationTitle} onBlur={event => {
    if ((event.relatedTarget as Element | null)?.closest?.('[data-bw-discard]')) return;
    flush();
  }} onKeyDown={event => {
    if (event.metaKey || event.ctrlKey) {
      if (event.key.toLowerCase() !== 's') return;
      event.preventDefault(); flush();
    }
    event.stopPropagation();
  }}>
    <header><h2>{informationTitle}</h2><span className="bw-properties-state" role="status">{state.saving ? '保存中…' : state.error ? '尚未保存' : state.dirty ? '待保存' : '已保存'}</span><button type="button" className="bw-properties-raw" aria-expanded={raw} onClick={() => { const next = !raw; setRaw(next); onRawChange(next); }}>原始属性</button></header>
    <div className="bw-properties-fields">
      <Field label="名称" wide><input {...composition} value={values.title} onChange={event => update({ title: event.target.value })}/></Field>
      {!custom && <>
        {book ? <Field label="作者" wide><input {...composition} value={values.author ?? ''} onChange={event => update({ author: event.target.value })}/></Field> : <Field label="导演"><input {...composition} value={values.director ?? ''} onChange={event => update({ director: event.target.value })}/></Field>}
        <Field label={book ? '阅读状态' : '观看状态'}><select value={values.status} onChange={event => update({ status: event.target.value as WorkPropertyValues['status'] })}><option value="want">{book ? '想读' : '想看'}</option><option value={book ? 'reading' : 'watching'}>{book ? '在读' : '在看'}</option><option value="finished">{book ? '已读' : '已看'}</option></select></Field>
        {book ? <Field label="阅读进度（%）"><input type="number" min="0" max="100" step="1" value={values.progress ?? 0} onChange={event => update({ progress: Number(event.target.value) })}/></Field> : <><Field label="年份"><input {...composition} value={values.year ?? ''} onChange={event => update({ year: event.target.value })}/></Field><Field label="观看日期"><input type="date" value={values.date ?? ''} onChange={event => update({ date: event.target.value })}/></Field></>}
      </>}
      <Field label={custom ? '图片链接' : '封面'} wide><div className="bw-properties-cover"><input {...composition} value={values.cover} aria-label={custom ? '图片链接' : '封面图片或 SVG 的 Markdown 链接'} placeholder={custom ? 'URL、Markdown 图片、Wiki 嵌入或库内路径' : undefined} onChange={event => update({ cover: event.target.value })}/>{values.cover && <><CoverImage key={coverRetry} className="bw-properties-cover-preview" src={api.coverUrl(values.cover, work.path)} title={values.title} alt="封面预览" showFailure={custom}/>{custom && <button type="button" onClick={() => setCoverRetry(value => value + 1)}>重试图片</button>}</>}</div></Field>
      <Field label="摘要" wide><textarea {...composition} rows={3} maxLength={400} value={values.summary} onChange={event => update({ summary: event.target.value })}/></Field>
      {custom && <Field label="关联笔记" wide><NotePicker {...composition} api={api} value={values.linkedNote ?? ''} onChange={linkedNote => update({ linkedNote })}/></Field>}
    </div>
    <section className="bw-properties-layout" aria-label="卡片排版"><h3>卡片排版</h3><div className="bw-properties-fields">
      <Field label="卡片标题对齐"><select value={values.cardTitleAlign ?? 'left'} onChange={event => update({ cardTitleAlign: event.target.value as WorkPropertyValues['cardTitleAlign'] })}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></Field>
      <Field label="卡片摘要对齐"><select value={values.cardSummaryAlign ?? 'left'} onChange={event => update({ cardSummaryAlign: event.target.value as WorkPropertyValues['cardSummaryAlign'] })}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></Field>
    </div></section>
    <details className="bw-properties-more"><summary>更多信息</summary><div className="bw-properties-fields">
      <Field label="评分（0–10）"><input type="number" min="0" max="10" step="0.1" value={values.rating ?? ''} onChange={event => update({ rating: event.target.value === '' ? null : Number(event.target.value) })}/></Field>
      <Field label="精选"><input type="checkbox" checked={values.pinned} onChange={event => update({ pinned: event.target.checked })}/></Field>
      <Field label="相关链接" wide><input {...composition} value={(book ? values.deepLink : values.link) ?? ''} onChange={event => update(book ? { deepLink: event.target.value } : { link: event.target.value })}/></Field>
      {book && !custom && <div className="bw-property-field is-wide"><span>最近阅读</span><span className="bw-properties-readonly">{values.lastRead || '暂无记录'}</span></div>}
    </div></details>
    {error}
  </section>;
}
