import React, { useMemo, useState } from 'react';
import type { Work, CardsAPI, CustomCardModule, WorkCardAppearance } from './types';
import { createWork } from './domain';
import { CoverImage } from './CoverImage';
import { Icon, Empty } from './primitives';
import { orderedWorks } from './work-order';
import WorkCarousel from './WorkCarousel';
import WorkCardBack from './WorkCardBack';
import { WorkPropertiesManager } from './WorkPropertiesSessions';
import EditableText from './EditableText';
import { WorkOrderList } from './WorkOrder';
import { DeleteWorkDialog, type Run } from './WorkEditor';

export default function WorkCollection({ kind, module, renameModule, works, order, appearance, threeCardView, manager, api, run, edit, handle, previewOnly = false }: { kind: 'book' | 'film'; module?: CustomCardModule; renameModule?: (id: string, title: string) => Promise<boolean>; works: Work[]; order?: string[]; appearance: WorkCardAppearance; threeCardView: boolean; handle?: React.ReactNode; manager: WorkPropertiesManager; api: CardsAPI; run: Run; edit: (entity: Work) => void; previewOnly?: boolean }) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Work | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const sorted = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return orderedWorks(works, order).filter(item => !needle || [item.title, item.type === 'book' ? item.author : item.director, item.type === 'film' ? item.year : ''].some(value => value.toLocaleLowerCase().includes(needle)));
  }, [works, order, query]);
  const active = sorted.find(item => item.id === activeId);
  const remove = async () => {
    if (!deleteCandidate || deleting) return;
    setDeleting(true);
    setDeleteError('');
    const removed = await run(async () => { try { await api.deleteWork(deleteCandidate.id); } catch (error) { setDeleteError(error instanceof Error ? error.message : String(error)); throw error; } });
    setDeleting(false);
    if (removed) setDeleteCandidate(null);
  };
  const renderWork = (item: Work) => <>
    <div className="bw-paper-image">{item.cover ? <CoverImage src={api.coverUrl(item.cover, item.path)} source={item.cover} sourcePath={item.path} readSvg={api.readCoverSvg} title={item.title} loading="eager" showFailure={!!module} /> : <div className="bw-paper-placeholder"><span style={{textAlign:item.cardTitleAlign??'left'}}>{item.title}</span><i>等待一张封面</i></div>}</div>
    <div className="bw-paper-copy"><h3 style={{textAlign:item.cardTitleAlign??'left'}}>{item.title}</h3>{item.summary?.trim() && <p style={{textAlign:item.cardSummaryAlign??'left'}}>{item.summary}</p>}{!module && <footer><span>{item.type === 'book' ? item.author : [item.director, item.year].filter(Boolean).join(' · ')}</span></footer>}</div>
  </>;
  const noun = module ? '卡片' : kind === 'book' ? '书籍' : '影片';
  return <section className="bw-work-stack bw-module" data-module-id={module?.id}>
    <header className="bw-section-head bw-work-head">{handle}{previewOnly ? <h2>{module?.title || '卡片预览'}</h2> : module ? <EditableText as="h2" value={module.title} onSave={title => renameModule!(module.id, title)} /> : <EditableText as="h2" textKey={`${kind}.title`} defaultText={kind === 'book' ? '读过的世界' : '银幕之后'} />}{!previewOnly && <div className="bw-work-tools">
      <span className="bw-count">{sorted.length} {module ? '张' : kind === 'book' ? '本' : '部'}</span>
      <button className="bw-icon-button" aria-label={`搜索${noun}`} aria-expanded={searchOpen} title={`搜索${noun}`} onClick={() => { setSearchOpen(value => !value); setQuery(''); }}><Icon name="search" /></button>
      <button className="bw-icon-button" aria-label={`添加${noun}`} title={`添加${noun}`} onClick={() => { const entity = createWork(kind); entity.title = ''; if (module) entity.moduleId = module.id; edit(entity); }}><Icon name="plus" /></button>
      <button className="bw-icon-button" aria-label={`排序${noun}`} title={`排序${noun}`} aria-expanded={module ? sortOpen : undefined} onClick={() => { if (module) setSortOpen(value => !value); else void run(() => api.openWorkOrder(kind)); }}><Icon name="sort" /></button>
      {module && <button className="bw-icon-button" aria-label="编辑卡片资料" title={active ? `编辑《${active.title}》的卡片资料` : '编辑卡片资料'} disabled={!active} onClick={() => { if (active) void run(() => api.openNote(active.path)); }}><Icon name="settings" /></button>}
      <button className="bw-icon-button" aria-label={`删除当前${noun}`} title={active ? `删除《${active.title}》` : `删除当前${noun}`} disabled={!active || deleting} onClick={() => { if (active) { setDeleteError(''); setDeleteCandidate(active); } }}><Icon name="trash" /></button>
    </div>}</header>
    {module && sortOpen && <WorkOrderList api={api} kind={kind} moduleId={module.id} />}
    {searchOpen && <label className="bw-work-search"><Icon name="search" /><input autoFocus type="search" aria-label={`搜索${noun}`} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); setSearchOpen(false); } }} /></label>}
    <WorkCarousel works={sorted} appearance={appearance} ratio={module?.ratio ?? appearance.ratio ?? '2:3'} imageFit={module ? module.imageFit ?? appearance.imageFit ?? 'contain' : appearance.imageFit ?? 'cover'} threeCardView={appearance.threeCardView ?? threeCardView} canFlip={!previewOnly} onActiveChange={setActiveId} label={`${module ? module.title : kind === 'book' ? '阅读感想' : '观影感想'}卡片，${appearance.layout === 'scroll-bend' && appearance.orientation === 'vertical' ? '上下' : '左右'}滑动切换`} renderWork={renderWork} renderBack={(work, active, flip, open) => <WorkCardBack work={work} session={manager.getSession(work.id)} active={active} flip={flip} open={open} />} open={previewOnly ? undefined : item => { void run(() => api.openNote(module && item.linkedNote ? item.linkedNote : item.path)); }} empty={<Empty>{query.trim() ? '没有匹配的作品。' : module ? '点击 ＋，添加第一张卡片。' : kind === 'book' ? '添加一本书，收藏第一张阅读感想卡。' : '记录一部影片，收藏你的第一张观影感想卡。'}</Empty>} />
    {deleteCandidate && <DeleteWorkDialog work={deleteCandidate} genericCard={!!module} busy={deleting} error={deleteError} remove={() => { void remove(); }} close={() => setDeleteCandidate(null)} />}
  </section>;
}

