import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import ActionMenu from './ActionMenu';
import { EMPTY_WORK_IMAGE_IMPORTS, getWorkImageImports } from './work-image-imports';

const subscribePreview = () => () => {};
const previewImports = () => EMPTY_WORK_IMAGE_IMPORTS;

export default function WorkCollection({ kind, module, renameModule, works, order, appearance, threeCardView, manager, api, run, edit, handle, headerAction, previewOnly = false }: { kind: 'book' | 'film'; module?: CustomCardModule; renameModule?: (id: string, title: string) => Promise<boolean>; works: Work[]; order?: string[]; appearance: WorkCardAppearance; threeCardView: boolean; handle?: React.ReactNode; headerAction?: React.ReactNode; manager: WorkPropertiesManager; api: CardsAPI; run: Run; edit: (entity: Work) => void; previewOnly?: boolean }) {
  const section = useRef<HTMLElement>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Work | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [importError, setImportError] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const operations = previewOnly ? undefined : getWorkImageImports(api, module?.id ?? kind);
  const importState = useSyncExternalStore(operations?.subscribe ?? subscribePreview, operations?.getSnapshot ?? previewImports, operations?.getSnapshot ?? previewImports);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const owner = section.current?.ownerDocument.defaultView;
    if (!importStatus || !owner) return;
    const timer = owner.setTimeout(() => setImportStatus(''), 4000);
    return () => owner.clearTimeout(timer);
  }, [importStatus]);
  const importImages = async (files?: File[]) => {
    if (previewOnly || deleting || operations?.getSnapshot().importing) return;
    setImportError(''); setImportStatus('');
    try {
      if (!operations) throw new Error('批量导入需要新版共享卡片能力，请升级已启用的兼容插件后重试。');
      if (files?.length) operations.add(files);
      if (section.current?.querySelector('.bw-work-order[data-cards-pending]')) throw new Error('排序草稿尚未保存，请先重试或放弃草稿后导入。');
      await manager.flushAll();
      if (manager.recoveryDrafts().length) throw new Error('卡片草稿尚未保存，请完成编辑后再导入。');
      if (!mounted.current) return;
      const before = operations.getSnapshot().imports.length;
      await operations.retry();
      if (mounted.current && !operations.getSnapshot().imports.length && before) setImportStatus(`已添加 ${before} 张卡片，可打开笔记修改名称和摘要。`);
    } catch (error) { if (mounted.current) setImportError(error instanceof Error ? error.message : String(error)); }
  };
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
  return <section ref={section} className="bw-work-stack bw-module" data-module-id={module?.id} data-cards-pending={deleting ? 'card-delete' : importState.importing ? 'work-image-import' : importState.imports.length ? 'work-image-import-draft' : undefined}>
    <header className="bw-section-head bw-work-head">{handle}{previewOnly ? <h2>{module?.title || (kind === 'book' ? '阅读' : '影视')}</h2> : module ? <EditableText as="h2" value={module.title} onSave={title => renameModule!(module.id, title)} /> : <EditableText as="h2" textKey={`${kind}.title`} defaultText={kind === 'book' ? '读过的世界' : '银幕之后'} />}{!previewOnly && <div className="bw-work-tools">
      <span className="bw-count">{sorted.length} {module ? '张' : kind === 'book' ? '本' : '部'}</span>
      <ActionMenu label={`${module?.title || (kind === 'book' ? '阅读' : '影视')}操作`} disabled={importState.importing} actions={[
        { id: 'search', label: `搜索${noun}`, icon: 'search', expanded: searchOpen, select: () => { setSearchOpen(value => !value); setQuery(''); } },
        { id: 'add', label: `添加${noun}`, icon: 'plus', select: () => { const entity = createWork(kind); entity.title = ''; if (module) entity.moduleId = module.id; edit(entity); } },
        { id: 'import', label: '批量导入图片／SVG', icon: 'plus', select: () => { if (!operations) setImportError('批量导入需要新版共享卡片能力，请升级已启用的兼容插件后重试。'); else fileInput.current?.click(); } },
        { id: 'sort', label: `排序${noun}`, icon: 'sort', expanded: module ? sortOpen : undefined, select: () => { if (module) { if (sortOpen && section.current?.querySelector('.bw-work-order[data-cards-pending]')) { void run(async () => { throw new Error('排序草稿已保留，请先重试或放弃草稿后收起。'); }); return; } setSortOpen(value => !value); } else void run(() => api.openWorkOrder(kind)); } },
        { id: 'edit', label: module ? '编辑卡片资料' : `编辑当前${noun}`, title: active ? `编辑《${active.title}》的卡片资料` : '编辑卡片资料', icon: 'settings', disabled: !active, select: () => { if (active) void run(async () => { await manager.flushAll(); if (manager.recoveryDrafts().length) throw new Error('卡片草稿尚未保存，请完成编辑后再操作。'); const current = api.getSnapshot().entities.find(item => item.id === active.id); if (!current) throw new Error('当前卡片已改变，请重新载入后重试。'); if (module) await api.openNote(current.path); else edit(current); }); } },
        { id: 'delete', label: active ? `删除当前${noun}《${active.title}》` : `删除当前${noun}`, icon: 'trash', danger: true, disabled: !active || deleting, select: () => { if (active) { setDeleteError(''); setDeleteCandidate(active); } } },
      ]} />
      <input ref={fileInput} hidden type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg" aria-label="批量选择卡片图片／SVG" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; if (files.length) void importImages(files); }} />
      {headerAction}
    </div>}</header>
    {importState.importing && <p role="status">正在导入卡片图片…</p>}
    {importStatus && <p role="status">{importStatus}</p>}
    {importError && <p className="bw-sync-note is-error" role="alert">{importError}</p>}
    {!importState.importing && importState.imports.length > 0 && <div className="bw-sync-note is-error" role="alert"><p>{importState.imports.length} 张图片尚未导入，已保留重试记录。</p>{importState.failures.map(item => <p key={item.id}>{importState.imports.find(image => image.id === item.id)?.file.name}：{item.error}</p>)}<button type="button" onClick={() => { void importImages(); }}>重试未完成图片</button><button type="button" onClick={() => { try { operations?.discard(); setImportError(''); } catch (error) { setImportError(error instanceof Error ? error.message : String(error)); } }}>放弃未完成导入</button><p>放弃只清除重试记录，已写入的笔记和图片会保留。</p></div>}
    {module && sortOpen && <WorkOrderList api={api} kind={kind} moduleId={module.id} />}
    {searchOpen && <label className="bw-work-search"><Icon name="search" /><input autoFocus type="search" aria-label={`搜索${noun}`} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); setSearchOpen(false); } }} /></label>}
    <WorkCarousel works={sorted} appearance={appearance} ratio={module?.ratio ?? appearance.ratio ?? '2:3'} imageFit={module ? module.imageFit ?? appearance.imageFit ?? 'contain' : appearance.imageFit ?? 'cover'} threeCardView={appearance.threeCardView ?? threeCardView} canFlip={!previewOnly} onActiveChange={setActiveId} label={`${module ? module.title : kind === 'book' ? '阅读感想' : '观影感想'}卡片，${appearance.layout === 'scroll-bend' && appearance.orientation === 'vertical' ? '上下' : '左右'}滑动切换`} renderWork={renderWork} renderBack={(work, active, flip, open) => <WorkCardBack work={work} session={manager.getSession(work.id)} active={active} flip={flip} open={open} />} open={previewOnly ? undefined : item => { void run(() => api.openNote(module && item.linkedNote ? item.linkedNote : item.path)); }} empty={<Empty>{query.trim() ? '没有匹配的作品。' : module ? '展开模块操作菜单，添加第一张卡片。' : kind === 'book' ? '添加一本书，收藏第一张阅读感想卡。' : '记录一部影片，收藏你的第一张观影感想卡。'}</Empty>} />
    {deleteCandidate && <DeleteWorkDialog work={deleteCandidate} genericCard={!!module} busy={deleting} error={deleteError} remove={() => { void remove(); }} close={() => setDeleteCandidate(null)} />}
  </section>;
}

