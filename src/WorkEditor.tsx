import React, { useEffect, useId, useRef, useState } from 'react';
import type { Work, CardsAPI, CoverTemplate } from './types';
import { CoverImage } from './CoverImage';
import { Field } from './primitives';
import NotePicker from './NotePicker';

export type Run = (action: () => Promise<unknown>) => Promise<boolean>;

export default function WorkEditor({ entity, genericCard = false, api, run, close }: { entity: Work; genericCard?: boolean; api: CardsAPI; run: Run; close: () => void }) {
  const [draft, setDraft] = useState<Work>({ ...entity });
  const [uploading, setUploading] = useState(false);
  const [coverRetry, setCoverRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const modalEditor = !entity.path;
  const busy = saving || uploading;
  useEffect(() => {
    if (!modalEditor) return;
    const element = dialog.current;
    const trigger = element?.ownerDocument.activeElement as HTMLElement | null;
    element?.showModal(); element?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    return () => { element?.close(); if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, [modalEditor]);
  useEffect(() => {
    if (!modalEditor || !busy) return;
    const owner = dialog.current?.ownerDocument;
    const blockEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') event.preventDefault(); };
    owner?.addEventListener('keydown', blockEscape, true);
    return () => owner?.removeEventListener('keydown', blockEscape, true);
  }, [modalEditor, busy]);
  const [template, setTemplate] = useState<CoverTemplate>('water');
  const [color, setColor] = useState('#b54e39');
  const update = (patch: Record<string, unknown>) => setDraft(current => ({ ...current, ...patch }) as Work);
  const execute = (action: () => Promise<unknown>) => {
    setError('');
    return run(async () => { try { await action(); } catch (err) { setError(err instanceof Error ? err.message : String(err)); throw err; } });
  };
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (busy) return; setSaving(true); const value = { ...draft }; delete value.body; const saved = await execute(() => api.save(value)); setSaving(false); if (saved) close(); };
  const changeCover = async (action: () => Promise<string>) => { if (busy) return; setUploading(true); try { await execute(async () => update({ cover: await action() })); } finally { setUploading(false); } };
  const kind = genericCard ? '卡片' : draft.type === 'book' ? '书籍' : '影片';
  const Container = modalEditor ? 'dialog' : 'section';
  const WorkOptions = entity.path ? 'div' : 'details';
  return <Container ref={modalEditor ? dialog : undefined} className={`bw-editor${modalEditor ? ' bw-editor-dialog' : ''}`} data-bw-editor aria-label={`${kind}编辑`} onKeyDown={modalEditor ? event => { event.stopPropagation(); if (busy && event.key === 'Escape') event.preventDefault(); } : undefined} onCancel={modalEditor ? event => { event.preventDefault(); if (!busy) close(); } : undefined}>
    <header className="bw-section-head"><h2>{entity.path ? '编辑' : '新建'}{kind}</h2><button type="button" disabled={busy} onClick={close}>{modalEditor ? '关闭' : '收起编辑'}</button></header>
    {error && !busy && <p className="bw-sync-note is-error" role="alert">{error}</p>}
    <form onSubmit={submit} onInvalidCapture={event => { const details = (event.target as HTMLElement).closest('details'); if (details) details.open = true; }}><fieldset className="bw-form" disabled={busy}>
      <Field label="名称" wide><input autoFocus={!modalEditor} required maxLength={180} value={draft.title} onChange={e => update({ title: e.target.value })} placeholder={`写下${kind}名称`} /></Field>
      <WorkOptions className="bw-editor-options bw-wide">{!entity.path && <summary>更多信息</summary>}<div className="bw-form">
        {!genericCard && <>{draft.type === 'book' ? <><Field label="作者"><input value={draft.author} onChange={e => update({ author: e.target.value })} /></Field><Field label="阅读进度（%）"><input type="number" min="0" max="100" value={draft.progress} onChange={e => update({ progress: Number(e.target.value) })} /></Field></> : <><Field label="导演"><input value={draft.director} onChange={e => update({ director: e.target.value })} /></Field><Field label="年份"><input maxLength={12} value={draft.year} onChange={e => update({ year: e.target.value })} /></Field><Field label="观看日期"><input type="date" value={draft.date} onChange={e => update({ date: e.target.value })} /></Field><Field label="资料链接"><input type="url" value={draft.link} onChange={e => update({ link: e.target.value })} placeholder="https://" /></Field></>}
        <Field label="状态"><select value={draft.status} onChange={e => update({ status: e.target.value })}><option value="want">{draft.type === 'book' ? '想读' : '想看'}</option><option value={draft.type === 'book' ? 'reading' : 'watching'}>{draft.type === 'book' ? '在读' : '在看'}</option><option value="finished">已完成</option></select></Field></>}
        <Field label="评分"><select value={draft.rating ?? ''} onChange={e => update({ rating: e.target.value ? Number(e.target.value) : null })}><option value="">尚未评分</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} / 5</option>)}</select></Field>
        <Field label={genericCard ? '摘要' : '精选摘要'} wide><textarea rows={3} maxLength={400} value={draft.summary} onChange={e => update({ summary: e.target.value })} placeholder="留下值得再次想起的一句话" /></Field>
        {genericCard && <Field label="相关链接" wide><input type="url" value={draft.type === 'film' ? draft.link : draft.deepLink} onChange={e => update(draft.type === 'film' ? { link: e.target.value } : { deepLink: e.target.value })} placeholder="https://" /></Field>}
        {genericCard && <><Field label="图片链接" wide><input value={draft.cover} onChange={e => update({ cover: e.target.value })} placeholder="URL、Markdown 图片、Wiki 嵌入或库内路径" /></Field><Field label="关联笔记" wide><NotePicker api={api} value={draft.linkedNote ?? ''} onChange={linkedNote => update({ linkedNote })} /></Field></>}
        <Field label="置顶精选"><input type="checkbox" checked={draft.pinned} onChange={e => update({ pinned: e.target.checked })} /></Field>
        <Field label="导入图片 / SVG 封面"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg" onChange={e => { const file = e.target.files?.[0]; if (file) void changeCover(() => api.attachCover(file)); e.target.value = ''; }} /></Field>
        <div className="bw-cover-maker bw-wide"><Field label="本地封面模板"><select value={template} onChange={e => setTemplate(e.target.value as CoverTemplate)}><option value="water">水波</option><option value="pages">纸页</option><option value="orbit">星轨</option></select></Field><Field label="印记颜色"><input type="color" value={color} onChange={e => setColor(e.target.value)} /></Field><button type="button" disabled={!draft.title.trim()} onClick={() => { void changeCover(() => api.makeCover(template, draft.title, color)); }}>生成本地封面</button>{draft.cover && <><CoverImage key={coverRetry} className="bw-cover-preview" src={api.coverUrl(draft.cover, draft.path)} title={draft.title} alt="当前封面" showFailure={genericCard} />{genericCard && <button type="button" onClick={() => setCoverRetry(value => value + 1)}>重试图片</button>}</>}</div>
      </div></WorkOptions>
      <footer className="bw-wide bw-form-footer"><button className="bw-primary" type="submit" disabled={busy}>{saving ? '保存中…' : uploading ? '处理封面中…' : `保存${kind}`}</button><button type="button" disabled={busy} onClick={close}>取消</button></footer>
    </fieldset></form>
  </Container>;
}

export function DeleteWorkDialog({ work, genericCard = false, busy, error, remove, close }: { work: Work; genericCard?: boolean; busy: boolean; error?: string; remove: () => void; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId(), descriptionId = useId();
  useEffect(() => { const element = dialog.current; const trigger = element?.ownerDocument.activeElement as HTMLElement | null; element?.showModal(); return () => { element?.close(); if (trigger?.isConnected) trigger.focus(); }; }, []);
  return <dialog ref={dialog} className="bw-delete-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <h2 id={titleId}>删除《{work.title}》？</h2>
    <p id={descriptionId}>{genericCard ? '卡片资料笔记将移入 Obsidian 设置的回收站，关联笔记会保留。' : '对应笔记及感想将移入 Obsidian 设置的回收站。'}{work.type === 'book' && work.sourceId && '此来源记录不会自动重新添加。'}恢复原笔记后可重新显示。</p>
    {error && <p className="bw-sync-note is-error" role="alert">{error}</p>}
    <footer><button type="button" autoFocus disabled={busy} onClick={close}>取消</button><button className="bw-danger" type="button" disabled={busy} onClick={remove}>{busy ? '正在删除…' : genericCard ? '删除卡片' : work.type === 'book' ? '删除书籍' : '删除影片'}</button></footer>
  </dialog>;
}
