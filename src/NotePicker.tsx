import React, { useEffect, useId, useState } from 'react';
import type { CardsAPI } from './types';

export default function NotePicker({ api, value, onChange, onCompositionStart, onCompositionEnd }: { api: Pick<CardsAPI, 'listNoteCandidates'>; value: string; onChange: (path: string) => void; onCompositionStart?: React.CompositionEventHandler<HTMLInputElement>; onCompositionEnd?: React.CompositionEventHandler<HTMLInputElement> }) {
  const listId = useId();
  const [notes, setNotes] = useState<Array<{ path: string; title: string }>>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      api.listNoteCandidates(value).then(items => { if (current) { setNotes(items); setError(''); } }).catch(reason => {
        if (current) { setNotes([]); setError(reason instanceof Error ? reason.message : String(reason)); }
      });
    }, 150);
    return () => { current = false; clearTimeout(timer); };
  }, [api, value]);
  return <div className="bw-note-picker">
    <input list={listId} value={value} onChange={event => onChange(event.target.value)} onCompositionStart={onCompositionStart} onCompositionEnd={onCompositionEnd} placeholder="搜索已有笔记，留空打开卡片资料" autoComplete="off" />
    <datalist id={listId}>{notes.map(note => <option key={note.path} value={note.path}>{note.title}</option>)}</datalist>
    {error && <p className="bw-sync-note is-error" role="alert">笔记候选读取失败：{error}</p>}
  </div>;
}
