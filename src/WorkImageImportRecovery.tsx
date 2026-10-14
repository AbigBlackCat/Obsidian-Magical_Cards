import React, { useState, useSyncExternalStore } from 'react';
import type { CardsAPI } from './types';
import type { WorkPropertiesManager } from './WorkPropertiesSessions';
import { workImageImportQueues, type WorkImageImportOperations } from './work-image-imports';

/** External classification/deletion must not leave an invisible retry queue blocking navigation. */
export default function WorkImageImportRecovery({ api, manager, visibleCollectionIds = [] }: { api: CardsAPI; manager?: WorkPropertiesManager; visibleCollectionIds?: string[] }) {
  const { settings } = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
  return <>{workImageImportQueues(api).map(([id, operations]) => {
    const module = settings.customModules.find(item => item.id === id);
    const available = !settings.deletedModuleIds?.includes(id) && (id === 'book' || id === 'film' || Boolean(module && module.mode !== 'showcase'));
    if (available && visibleCollectionIds.includes(id)) return null;
    return <Retry key={id} operations={operations} manager={manager} available={available} label={module?.title ?? (id === 'book' ? '阅读' : id === 'film' ? '影视' : id)} />;
  })}</>;
}

function Retry({ operations, manager, available, label }: { operations: WorkImageImportOperations; manager?: WorkPropertiesManager; available: boolean; label: string }) {
  const state = useSyncExternalStore(operations.subscribe, operations.getSnapshot, operations.getSnapshot);
  const [error, setError] = useState('');
  if (!state.imports.length && !state.importing) return null;
  const retry = async () => {
    setError('');
    try {
      await manager?.flushAll();
      if (manager?.recoveryDrafts().length) throw new Error('卡片编辑草稿尚未保存，请完成编辑后再导入。');
      await operations.retry();
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
  };
  return <div className="bw-sync-note is-error" role="alert" data-work-import-recovery={label}>
    <p>“{label}”的 {state.imports.length} 张图片尚未完成导入，文件与重试标识已保留。</p>
    {!available && <p>模块已删除或改变类型，不能继续导入。</p>}
    {error && <p>{error}</p>}{state.failures.map(item => <p key={item.id}>{item.error}</p>)}
    {available && <button type="button" disabled={state.importing} onClick={() => { void retry(); }}>重试未完成图片</button>}
    <button type="button" disabled={state.importing} onClick={() => { try { operations.discard(); } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); } }}>放弃未完成导入</button>
    <p>放弃只清除重试记录，已写入的笔记和图片会保留。</p>
  </div>;
}
