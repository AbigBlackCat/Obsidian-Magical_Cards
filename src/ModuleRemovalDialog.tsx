import React, { useEffect, useId, useRef, useState } from 'react';
import type { CardsAPI } from './types';
import type { WorkPropertiesManager } from './WorkPropertiesSessions';
import { removeModule, type CardModuleDraft } from './settings';
import { assertCardModuleRemovalSettled, flushDashboardEdits } from './CardsSurface';

export default function ModuleRemovalDialog({ api, manager, baseline, close, removed }: { api: CardsAPI; manager?: WorkPropertiesManager; baseline: CardModuleDraft; close: () => void; removed: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), mounted = useRef(true), pending = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const titleId = useId(), descriptionId = useId();
  useEffect(() => {
    mounted.current = true;
    const element = dialog.current, trigger = element?.ownerDocument.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { mounted.current = false; element?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  const submit = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      assertCardModuleRemovalSettled(api);
      await flushDashboardEdits(api, manager);
      if (!mounted.current) return;
      assertCardModuleRemovalSettled(api);
      await removeModule(api, baseline.id, baseline);
      if (mounted.current) { removed(); close(); }
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : '删除未完成，模块和资料已保留，请重试。'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return <dialog ref={dialog} className="bw-delete-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <h2 id={titleId}>删除模块“{baseline.title}”？</h2>
    <p id={descriptionId}>将删除此模块及所有 Dashboard 中的引用，删除后无法恢复模块。作品笔记和图片文件保留；原笔记代码块将提示模块已删除。未保存的模块外观选择会随模块一起删除。</p>
    {error && <p className="bw-sync-note is-error" role="alert">{error}</p>}
    <footer><button type="button" autoFocus disabled={busy} onClick={close}>取消</button><button type="button" className="bw-danger" disabled={busy} onClick={() => { void submit(); }}>{busy ? '正在删除…' : '确认删除模块'}</button></footer>
  </dialog>;
}
