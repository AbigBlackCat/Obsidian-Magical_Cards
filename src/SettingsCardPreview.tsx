import React, { useState, useSyncExternalStore } from 'react';
import type { CardsAPI, CustomCardModule, Work } from './types';
import type { CardModuleDraft } from './settings';
import { createWork } from './domain';
import { WorkbenchTextProvider } from './EditableText';
import WorkCollection from './WorkCollection';
import WorkEditor, { type Run } from './WorkEditor';
import type { WorkPropertiesManager } from './WorkPropertiesSessions';

export default function SettingsCardPreview({ api, manager, draft, rename }: { api: CardsAPI; manager: WorkPropertiesManager; draft: CardModuleDraft; rename: (title: string) => void }) {
  const snapshot = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
  const [editor, setEditor] = useState<Work | null>(null);
  const [error, setError] = useState('');
  const savedModule = snapshot.settings.customModules.find(module => module.id === draft.id);
  const fresh = draft.id !== 'book' && draft.id !== 'film' && !savedModule;
  const kind = savedModule?.kind ?? (draft.id === 'book' ? 'book' : 'film');
  const module: CustomCardModule | undefined = draft.id === 'book' || draft.id === 'film' ? undefined : {
    ...(savedModule ?? { id: draft.id, kind }), title: draft.title.trim() || '新模块预览', appearance: draft.appearance, ratio: draft.appearance.ratio, imageFit: draft.appearance.imageFit,
  };
  let works = snapshot.entities.filter(work => work.type === kind && (fresh ? true : module ? work.moduleId === module.id : !snapshot.settings.customModules.some(item => item.id === work.moduleId && item.kind === work.type)));
  if (fresh && !works.length) works = [{ ...createWork(kind), id: 'new-module-preview', title: '卡片预览', summary: '保存模块后，可以添加作品和封面。' }];
  const run: Run = async action => { setError(''); try { await action(); return true; } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); return false; } };
  return <WorkbenchTextProvider values={snapshot.settings.workbenchText} save={(key, value) => run(() => api.saveSettings({ workbenchText: { ...api.getSnapshot().settings.workbenchText, [key]: value } }))}>
    <div className="bw-app bw-cards-settings-preview">
      {error && <p role="alert">{error}</p>}
      <WorkCollection kind={kind} module={module} works={works} order={snapshot.workOrder?.[kind]} appearance={draft.appearance} threeCardView={snapshot.settings.threeCardView} manager={manager} api={api} run={run} edit={setEditor} previewOnly={fresh} renameModule={async(_id,title)=>{rename(title);return true;}} />
      {editor && <WorkEditor entity={editor} genericCard={!!module} api={api} run={run} close={() => setEditor(null)} />}
    </div>
  </WorkbenchTextProvider>;
}
