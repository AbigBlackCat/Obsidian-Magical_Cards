import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CardsAPI, CustomCardModule, ShowcaseCard, ShowcaseDocument, WorkCardAppearance } from './types';
import { CoverImage } from './CoverImage';
import { Empty, Icon } from './primitives';
import ActionMenu from './ActionMenu';
import WorkCarousel from './WorkCarousel';
import ShowcaseCardBack from './ShowcaseCardBack';
import ShowcaseEditor from './ShowcaseEditor';
import { getShowcaseManager } from './showcase-sessions';
import { EMPTY_SHOWCASE_OPERATIONS, getShowcaseRenderOperations, type ShowcasePendingMove } from './showcase-render-state';

export interface ShowcaseCollectionProps {
  module: CustomCardModule; api: CardsAPI; appearance?: WorkCardAppearance; threeCardView?: boolean; handle?: React.ReactNode; headerAction?: React.ReactNode;
  previewOnly?: boolean; previewCards?: ShowcaseCard[]; previewPath?: string;
}
type DisplayCard = ShowcaseCard & { title: string; summary: string };
const subscribePreview = () => () => {};
const previewOperations = () => EMPTY_SHOWCASE_OPERATIONS;

export default function ShowcaseCollection({ module, api, appearance = module.appearance, threeCardView = false, handle, headerAction, previewOnly = false, previewCards, previewPath }: ShowcaseCollectionProps) {
  const section = useRef<HTMLElement>(null);
  const [document, setDocument] = useState<ShowcaseDocument>({ moduleId: module.id, path: previewPath ?? module.showcaseNote ?? '', cards: [], revision: '' });
  const [loading, setLoading] = useState(!previewCards);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ShowcaseCard | null>(null);
  const operations = previewOnly ? undefined : getShowcaseRenderOperations(api, module.id);
  const operationState = useSyncExternalStore(operations?.subscribe ?? subscribePreview, operations?.getSnapshot ?? previewOperations, operations?.getSnapshot ?? previewOperations);
  const failedImports = operationState.failures;
  const pendingMove = operationState.move;
  const fileInput = useRef<HTMLInputElement>(null);
  const reload = useRef<() => Promise<void>>(async () => {});
  const service = api.showcase;
  const manager = previewOnly ? undefined : getShowcaseManager(api);
  const namePosition = appearance.namePosition ?? 'back';
  useEffect(() => {
    let alive = true, generation = 0;
    if (previewCards) { setLoading(false); return; }
    const read = async () => {
      if (!service) { if (alive) { setError('请升级已启用的卡片插件后再使用橱窗式模块。'); setLoading(false); } return; }
      const ticket = ++generation;
      try { const value = await service.read(module.id); if (alive && ticket === generation) { setDocument(value); setLoading(false); } }
      catch (failure) { if (alive && ticket === generation) { setError(failure instanceof Error ? failure.message : String(failure)); setLoading(false); } }
    };
    reload.current = read;
    setLoading(true); void read();
    const unsubscribe = api.subscribe(() => { void read(); });
    return () => { alive = false; unsubscribe(); reload.current = async () => {}; };
  }, [api, service, module.id, module.showcaseNote, previewCards]);
  const cards = previewCards ?? document.cards;
  const path = previewPath ?? document.path;
  const displayed: DisplayCard[] = cards.filter(card => !query.trim() || `${card.name}\n${card.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(card => ({ ...card, title: card.name, summary: card.description }));
  const active = cards.find(card => card.id === activeId);
  const editing = cards.find(card => card.id === editingId);
  const labelFor = (card: ShowcaseCard) => card.name.trim() || `图片 ${cards.findIndex(item => item.id === card.id) + 1}`;
  const execute = async (action: () => Promise<unknown>) => {
    if (busy) return false;
    section.current?.setAttribute('data-cards-pending', 'showcase-operation');
    setBusy(true); setError('');
    try { await action(); await reload.current(); return true; }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); return false; }
    finally { section.current?.removeAttribute('data-cards-pending'); setBusy(false); }
  };
  const importPending = async () => {
    if (!service || !operations || !operations.getSnapshot().imports.length || operations.getSnapshot().importing || busy) return;
    operations.update({ importing: true }); setBusy(true); setError('');
    const batch = operations.getSnapshot().imports;
    try {
      const result = await service.importImages(module.id, batch);
      const failures = new Set(result.failed.map(item => item.id));
      operations.update({ imports: batch.filter(item => failures.has(item.id)), failures: result.failed });
      await reload.current();
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      operations.update({ failures: batch.map(item => ({ id: item.id, error: message })) });
    } finally { operations.update({ importing: false }); setBusy(false); }
  };
  const importFiles = (files: File[]) => {
    if (previewOnly || !service || !operations || busy || operations.getSnapshot().importing) return;
    operations.update({ imports: [...operations.getSnapshot().imports, ...files.map(file => ({ id: crypto.randomUUID(), file }))] });
    void importPending();
  };
  const openNote = () => { if (path && !previewOnly) void execute(() => api.openNote(path)); };
  const moveCard = async (move: ShowcasePendingMove) => {
    if (!service || !operations || busy) return;
    operations.update({ move, moveError: '' });
    if (await execute(async () => { try { await service.moveCard(module.id, move.id, move.beforeId, move.expectedIds); } catch (failure) { operations.update({ moveError: failure instanceof Error ? failure.message : String(failure) }); throw failure; } }) && operations.getSnapshot().move === move) operations.update({ move: null, moveError: '' });
  };
  const renderCard = (card: DisplayCard) => <>
    <div className="bw-paper-image"><CoverImage src={api.coverUrl(card.image, path)} source={card.image} sourcePath={path} readSvg={api.readCoverSvg} title={namePosition === 'front' ? labelFor(card) : `图片 ${cards.findIndex(item => item.id === card.id) + 1}`} loading="eager" showFailure /></div>
    {namePosition === 'front' && card.name.trim() && <div className="bw-paper-copy"><h3>{card.name}</h3></div>}
  </>;
  return <section ref={section} className="bw-work-stack bw-module bw-showcase-module" data-module-id={module.id} data-module-mode="showcase" data-name-position={namePosition} data-cards-pending={busy ? 'showcase-operation' : !previewOnly && (operationState.importing || operationState.imports.length || pendingMove) ? 'showcase-draft' : undefined} onDragOver={event => { if (!previewOnly && event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }} onDrop={event => { if (!previewOnly && event.dataTransfer.files.length) { event.preventDefault(); event.stopPropagation(); importFiles(Array.from(event.dataTransfer.files)); } }}>
    <header className="bw-section-head bw-work-head">{handle}<h2>{module.title}</h2>{!previewOnly && <div className="bw-work-tools">
      <span className="bw-count">{displayed.length} 张</span>
      <ActionMenu label={`${module.title}操作`} disabled={busy} actions={[
        { id: 'search', label: '搜索图片', icon: 'search', expanded: searchOpen, select: () => { setSearchOpen(value => !value); setQuery(''); } },
        { id: 'import', label: '批量添加图片', title: '选择多张图片，或拖放到此模块', icon: 'plus', disabled: !service, select: () => fileInput.current?.click() },
        { id: 'sort', label: '排序图片', icon: 'sort', expanded: sortOpen, select: () => { if (sortOpen && pendingMove) { setError('排序草稿已保留，请先重试或放弃草稿后收起。'); return; } setSortOpen(value => !value); } },
        { id: 'edit', label: '编辑当前图片', icon: 'settings', disabled: !active || !manager, select: () => { if (active) setEditingId(active.id); } },
        { id: 'delete', label: active ? `删除当前图片《${labelFor(active)}》` : '删除当前图片', icon: 'trash', danger: true, disabled: !active || !service, select: () => { if (active) setDeleting(active); } },
        { id: 'note', label: '编辑模块笔记', icon: 'open', disabled: !path, select: openNote },
      ]} />
      <input ref={fileInput} hidden type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg" aria-label="批量选择图片" onChange={event => { importFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      {headerAction}
    </div>}</header>
    {loading && <p role="status">正在读取图片…</p>}{error && <p className="bw-sync-note is-error" role="alert">{error}</p>}
    {failedImports.length > 0 && <div className="bw-sync-note is-error" role="alert"><p>{failedImports.length} 张图片尚未导入，已保留重试记录。</p>{failedImports.map(item => <p key={item.id}>{item.error}</p>)}<button type="button" disabled={busy} onClick={() => { void importPending(); }}>重试未完成图片</button></div>}
    {!previewOnly && pendingMove && !busy && <div className="bw-sync-note is-error" role="alert"><p>排序草稿已保留。重试会检查原图片顺序；若正文已改变，请确认后放弃草稿再重新排序。</p>{operationState.moveError && <p>{operationState.moveError}</p>}<button type="button" onClick={() => { void moveCard(pendingMove); }}>重试排序草稿</button><button type="button" onClick={() => { operations?.update({ move: null, moveError: '' }); setError(''); }}>放弃排序草稿</button></div>}
    {searchOpen && <label className="bw-work-search"><Icon name="search" /><input autoFocus type="search" aria-label="搜索图片" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { setQuery(''); setSearchOpen(false); } }} /></label>}
    {!previewOnly && sortOpen && <ol className="bw-showcase-order" aria-label="图片顺序">{cards.map((card, index) => <li key={card.id} data-showcase-card={card.id}><span>{labelFor(card)}</span><button type="button" disabled={busy || Boolean(pendingMove) || index === 0} aria-label={`上移${labelFor(card)}`} onClick={() => { void moveCard({ id: card.id, beforeId: cards[index - 1].id, expectedIds: cards.map(item => item.id) }); }}>↑</button><button type="button" disabled={busy || Boolean(pendingMove) || index === cards.length - 1} aria-label={`下移${labelFor(card)}`} onClick={() => { void moveCard({ id: card.id, beforeId: cards[index + 2]?.id ?? null, expectedIds: cards.map(item => item.id) }); }}>↓</button></li>)}</ol>}
    <WorkCarousel works={displayed} label={`${module.title}图片，${appearance.layout === 'scroll-bend' && appearance.orientation === 'vertical' ? '上下' : '左右'}滑动切换`} appearance={appearance} ratio={module.ratio ?? appearance.ratio ?? '2:3'} imageFit={module.imageFit ?? appearance.imageFit ?? 'cover'} threeCardView={appearance.threeCardView ?? threeCardView} canFlip={!previewOnly && Boolean(manager)} backActionLabel="编辑描述" onActiveChange={setActiveId} renderWork={renderCard} getFrontText={card => ({ title: namePosition === 'front' ? card.name : '', summary: '' })} renderBack={manager ? (card, isActive, flip, open) => <ShowcaseCardBack session={manager.getSession(module.id, card.id)} label={labelFor(card)} showName={namePosition === 'back'} active={isActive} flip={flip} open={open} /> : undefined} open={previewOnly ? undefined : openNote} empty={<Empty>{query.trim() ? '没有匹配的图片。' : previewOnly ? '保存模块后，在 Magical Cards 标签页添加图片。' : '展开模块操作菜单批量选择图片，或将图片拖放到此模块。'}</Empty>} />
    {!previewOnly && editing && service && manager && <ShowcaseEditor key={editing.id} session={manager.getSession(module.id, editing.id)} label={labelFor(editing)} close={() => setEditingId(null)} />}
    {deleting && service && <ShowcaseDeleteDialog card={deleting} label={labelFor(deleting)} busy={busy} error={error} close={() => setDeleting(null)} remove={() => { void execute(async () => { await service.deleteCard(module.id, deleting.id, deleting); setDeleting(null); if (editingId === deleting.id) setEditingId(null); }); }} />}
  </section>;
}

function ShowcaseDeleteDialog({ card, label, busy, error, close, remove }: { card: ShowcaseCard; label: string; busy: boolean; error: string; close: () => void; remove: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; const trigger = element?.ownerDocument.activeElement as HTMLElement | null; element?.showModal(); return () => { element?.close(); if (trigger?.isConnected) trigger.focus(); }; }, []);
  return <dialog ref={dialog} className="bw-delete-dialog" aria-label={`删除当前图片《${label}》`} data-showcase-card={card.id} onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); if (!busy) close(); }}><h2>删除当前图片《{label}》？</h2><p>仅删除模块笔记中的这张图片卡片。原图片文件和模块笔记会保留。</p>{error && <p role="alert">{error}</p>}<footer><button type="button" autoFocus disabled={busy} onClick={close}>取消</button><button type="button" className="bw-danger" disabled={busy} onClick={remove}>{busy ? '正在删除…' : `确认删除《${label}》`}</button></footer></dialog>;
}
