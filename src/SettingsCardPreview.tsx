import React, { useSyncExternalStore } from 'react';
import type { CardsAPI, CustomCardModule, ShowcaseCard } from './types';
import type { CardModuleDraft } from './settings';
import { createWork } from './domain';
import WorkCollection from './WorkCollection';
import ShowcaseCollection from './ShowcaseCollection';
import type { WorkPropertiesManager } from './WorkPropertiesSessions';

const previewImage = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><rect width="600" height="900" fill="#dfd7e9"/><circle cx="300" cy="300" r="135" fill="#a68bc2"/><path d="M0 680 220 400 420 720 600 500V900H0Z" fill="#715387"/></svg>');
const showcasePreviewCards: ShowcaseCard[] = [{ id: 'showcase-preview', image: previewImage, name: '', description: '' }];

export default function SettingsCardPreview({ api, manager, draft }: { api: CardsAPI; manager: WorkPropertiesManager; draft: CardModuleDraft; rename: (title: string) => void }) {
  const snapshot = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
  const savedModule = snapshot.settings.customModules.find(module => module.id === draft.id);
  const fresh = draft.id !== 'book' && draft.id !== 'film' && !savedModule;
  const kind = savedModule?.kind ?? (draft.id === 'book' ? 'book' : 'film');
  const module: CustomCardModule | undefined = draft.id === 'book' || draft.id === 'film' ? undefined : {
    ...(savedModule ?? { id: draft.id, kind }), title: draft.title.trim() || '新模块预览', appearance: draft.appearance, ratio: draft.appearance.ratio, imageFit: draft.appearance.imageFit, ...(draft.mode ? { mode: draft.mode, showcaseNote: draft.showcaseNote } : {}),
  };
  let works = snapshot.entities.filter(work => work.type === kind && (fresh ? true : module ? work.moduleId === module.id : !snapshot.settings.customModules.some(item => item.id === work.moduleId && item.kind === work.type)));
  if (fresh && !works.length) works = [{ ...createWork(kind), id: 'new-module-preview', title: '卡片预览', summary: '保存模块后，可以添加作品和封面。' }];
  return <div className="bw-app bw-cards-settings-preview">
    <p className="bw-settings-preview-notice">此处仅预览和浏览。翻面、添加图片及编辑资料或描述，请前往 Magical Cards 标签页。</p>
    {module?.mode === 'showcase'
      ? <ShowcaseCollection module={module} appearance={draft.appearance} threeCardView={snapshot.settings.threeCardView} api={api} previewOnly previewCards={fresh ? showcasePreviewCards : undefined} />
      : <WorkCollection kind={kind} module={module} works={works} order={snapshot.workOrder?.[kind]} appearance={draft.appearance} threeCardView={snapshot.settings.threeCardView} manager={manager} api={api} run={async () => false} edit={() => {}} previewOnly />}
  </div>;
}
