import { DEFAULT_CARD_SETTINGS, type CardLayout, type CardRatio, type CardsAPI, type CardsDashboard, type CardsSettings, type CustomCardModule, type WorkCardAppearance, type WorkbenchCardPlacement } from './types';
import { readDashboards, validDashboards } from './dashboards';

export const CARD_RATIOS: Record<CardRatio, string> = { '1:1': '1:1 方图', '4:3': '4:3 横向照片', '3:4': '3:4 竖向照片', '2:3': '2:3 竖向封面', '16:9': '16:9 横向画面', '32:15': '32:15 宽幅横图' };
export const CARD_LAYOUTS: Record<CardLayout, string> = { cylinder: '圆柱弧面', 'coverflow-carousel': '封面流轮播', 'album-rail': '黑胶专辑架', 'scroll-bend': '滚动弯曲画廊', 'skewed-carousel': '倾斜轮播' };
export const CARD_APPEARANCE_FIELDS = [
  { field: 'style', name: '卡片样式', options: { cover: '整幅封面', minimal: '简约' }, fallback: 'cover' },
  { field: 'imageFit', name: '显示方式', options: { contain: '完整显示', cover: '填满裁切' }, fallback: 'cover' },
  { field: 'material', name: '材质', options: { paper: '纸感', matte: '磨砂', foil: '全息' }, fallback: 'paper' },
  { field: 'ratio', name: '比例', options: CARD_RATIOS, fallback: '2:3' },
  { field: 'layout', name: '动效布局', options: CARD_LAYOUTS, fallback: 'cylinder' },
  { field: 'orientation', name: '画廊方向', options: { horizontal: '横向', vertical: '竖向' }, fallback: 'horizontal' },
] as const;
export const CARD_SETTING_KEYS = ['bookCardAppearance', 'filmCardAppearance', 'customModules', 'threeCardView', 'workbenchText', 'workbenchCards', 'standaloneOrder', 'hiddenModuleIds', 'standaloneHiddenModuleIds', 'deletedModuleIds', 'dashboards', 'dashboardNavigationVersion'] as const;
export const FRESH_CARD_APPEARANCE: Readonly<WorkCardAppearance> = { material: 'paper', style: 'cover', layout: 'cylinder', ratio: '2:3', imageFit: 'cover' };
export const NEW_MODULE_APPEARANCE: Readonly<WorkCardAppearance> = { material: 'paper', style: 'cover', layout: 'skewed-carousel', ratio: '2:3', imageFit: 'cover', threeCardView: false };
export function freshCardsSettings(): CardsSettings {
  return { ...readCardsSettings(undefined), bookCardAppearance: { ...FRESH_CARD_APPEARANCE }, filmCardAppearance: { ...FRESH_CARD_APPEARANCE }, threeCardView: true, workbenchText: { 'book.title': '阅读', 'film.title': '影视' } };
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.every(id => typeof id === 'string' && !!id.trim()) && new Set(value).size === value.length;
const standaloneIds = (value: unknown): value is string[] => ids(value) && value.every(id => /^[\w-]+$/.test(id));
export function validCardAppearance(value: unknown): value is WorkCardAppearance {
  return record(value) && ['paper', 'matte', 'foil'].includes(String(value.material)) && ['minimal', 'cover'].includes(String(value.style))
    && (value.layout === undefined || typeof value.layout === 'string' && Object.hasOwn(CARD_LAYOUTS, value.layout))
    && (value.orientation === undefined || value.orientation === 'horizontal' || value.orientation === 'vertical')
    && (value.ratio === undefined || typeof value.ratio === 'string' && Object.hasOwn(CARD_RATIOS, value.ratio))
    && (value.imageFit === undefined || value.imageFit === 'contain' || value.imageFit === 'cover')
    && (value.threeCardView === undefined || typeof value.threeCardView === 'boolean')
    && (value.flipEnabled === undefined || typeof value.flipEnabled === 'boolean')
    && (value.namePosition === undefined || value.namePosition === 'front' || value.namePosition === 'back' || value.namePosition === 'hidden');
}
export function readCardAppearance(value: unknown, fallback: WorkCardAppearance): WorkCardAppearance {
  return { ...(validCardAppearance(value) ? value : fallback) };
}
const moduleShape = (value: unknown): value is CustomCardModule => record(value) && typeof value.id === 'string' && /^[\w-]+$/.test(value.id) && typeof value.title === 'string' && !!value.title.trim()
  && (value.kind === 'book' || value.kind === 'film') && validCardAppearance(value.appearance)
  && (value.ratio === undefined || typeof value.ratio === 'string' && Object.hasOwn(CARD_RATIOS, value.ratio))
  && (value.imageFit === undefined || value.imageFit === 'contain' || value.imageFit === 'cover')
  && (value.mode === undefined || value.mode === 'showcase')
  && (value.showcaseNote === undefined || typeof value.showcaseNote === 'string' && !!value.showcaseNote.trim());
export function validCustomModules(value: unknown): value is CustomCardModule[] { return Array.isArray(value) && value.every(moduleShape) && new Set(value.map(module => module.id)).size === value.length; }
export function readCustomModules(value: unknown): CustomCardModule[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((module): module is CustomCardModule => {
    if (!moduleShape(module) || seen.has(module.id)) return false;
    seen.add(module.id); return true;
  }).map(module => ({ ...module, title: module.title.trim(), appearance: { ...module.appearance }, ratio: module.ratio ?? '2:3', imageFit: module.imageFit ?? 'contain' }));
}
export function newCustomModule(title: string, appearance: WorkCardAppearance = { ...NEW_MODULE_APPEARANCE }, ratio: CardRatio = '2:3', imageFit: CustomCardModule['imageFit'] = 'cover'): CustomCardModule {
  return { id: crypto.randomUUID(), title: title.trim(), kind: 'film', appearance: { ...appearance }, ratio, imageFit };
}
export interface CardModuleDraft { id: string; title: string; appearance: WorkCardAppearance; mode?: 'showcase'; showcaseNote?: string; }
export interface ModuleDashboardAssignment { dashboardIds: string[]; newDashboards: CardsDashboard[]; baselineDashboards: CardsDashboard[]; }
export function readModuleDraft(settings: CardsSettings, id: string): CardModuleDraft | null {
  if (settings.deletedModuleIds?.includes(id)) return null;
  const custom = settings.customModules.find(module => module.id === id);
  const original = custom?.appearance ?? (id === 'book' ? settings.bookCardAppearance : id === 'film' ? settings.filmCardAppearance : undefined);
  if (!original) return null;
  return { id, title: custom?.title ?? (settings.workbenchText[`${id}.title`]?.trim() || (id === 'book' ? '阅读' : '影视')), ...(custom?.mode ? { mode: custom.mode, showcaseNote: custom.showcaseNote } : {}), appearance: {
    style: original.style, material: original.material, layout: original.layout ?? 'cylinder', orientation: original.orientation ?? 'horizontal',
    ratio: custom?.ratio ?? original.ratio ?? '2:3', imageFit: custom ? custom.imageFit ?? original.imageFit ?? 'contain' : original.imageFit ?? 'cover',
    threeCardView: original.threeCardView ?? settings.threeCardView,
    ...(custom?.mode === 'showcase' ? { flipEnabled: original.flipEnabled ?? true, namePosition: original.namePosition ?? 'back' } : {}),
  } };
}
export function newModuleDraft(mode?: 'showcase'): CardModuleDraft {
  return { id: crypto.randomUUID(), title: '', ...(mode ? { mode } : {}), appearance: { ...NEW_MODULE_APPEARANCE, orientation: 'horizontal', ...(mode === 'showcase' ? { flipEnabled: true, namePosition: 'back' as const } : {}) } };
}
const sameModuleDraft = (left: CardModuleDraft | null, right: CardModuleDraft | null) => {
  const values = (draft: CardModuleDraft | null) => draft && [draft.id, draft.title.trim(), draft.mode, draft.showcaseNote, draft.appearance.style, draft.appearance.imageFit, draft.appearance.material, draft.appearance.ratio, draft.appearance.layout, draft.appearance.orientation, draft.appearance.threeCardView, draft.appearance.flipEnabled, draft.appearance.namePosition];
  return JSON.stringify(values(left)) === JSON.stringify(values(right));
};
function assignmentPatch(api: CardsAPI, settings: CardsSettings, moduleId: string, assignment?: ModuleDashboardAssignment, alreadySaved = false): Partial<CardsSettings> {
  if (!assignment) return {};
  if (!api.supportsDashboardOnlyNavigation) throw new Error('请升级已启用的兼容卡片插件后再分类模块。模块草稿和资料已保留。');
  const { dashboardIds, newDashboards, baselineDashboards } = assignment;
  if (!standaloneIds(dashboardIds)) throw new Error('所选 Dashboard 标识无效，模块草稿已保留。');
  readDashboards(newDashboards); readDashboards(baselineDashboards);
  if (newDashboards.some(board => board.moduleIds.length || !dashboardIds.includes(board.id))) throw new Error('新 Dashboard 必须为空并被主动选中，模块草稿已保留。');
  const boards = settings.dashboards ?? [], baselines = new Map(baselineDashboards.map(board => [board.id, board])), additions = new Map(newDashboards.map(board => [board.id, board]));
  if (newDashboards.some(board => baselines.has(board.id)) || dashboardIds.some(id => !boards.some(board => board.id === id) && !additions.has(id))) throw new Error('所选 Dashboard 已删除或标识冲突，模块草稿已保留，请重新载入后重试。');
  const equivalent = (left: CardsDashboard, right: CardsDashboard) => left.title === right.title && JSON.stringify(left.moduleIds) === JSON.stringify(right.moduleIds);
  // Deleting a board concurrently must not silently discard an intended membership change.
  if (baselineDashboards.some(board => board.moduleIds.includes(moduleId) && !boards.some(current => current.id === board.id))) throw new Error('所属 Dashboard 已在其他位置删除，模块草稿已保留，请重新载入后重试。');
  let changed = false;
  const next = boards.map(board => {
    const selected = dashboardIds.includes(board.id), wasSelected = board.moduleIds.includes(moduleId), baseline = baselines.get(board.id), added = additions.get(board.id);
    if (added) {
      if (!equivalent(board, { ...added, moduleIds: [moduleId] })) throw new Error('新 Dashboard 标识已被其他内容占用，模块草稿已保留。');
      return board; // A successful atomic write whose acknowledgement failed is safe to retry.
    }
    const beforeSelected = baseline?.moduleIds.includes(moduleId) ?? false;
    if (selected !== beforeSelected || wasSelected !== beforeSelected) {
      const committed = baseline && { ...baseline, moduleIds: selected ? beforeSelected ? [...baseline.moduleIds] : [...baseline.moduleIds, moduleId] : baseline.moduleIds.filter(id => id !== moduleId) };
      if (!baseline || !equivalent(board, baseline) && !(alreadySaved && committed && equivalent(board, committed))) throw new Error('Dashboard 名称或成员已在其他位置修改，模块草稿已保留，请重新载入后重试。');
    }
    if (selected === wasSelected) return board;
    changed = true;
    return { ...board, moduleIds: selected ? [...board.moduleIds, moduleId] : board.moduleIds.filter(id => id !== moduleId) };
  });
  for (const board of newDashboards) if (!boards.some(current => current.id === board.id)) { changed = true; next.push({ ...board, title: board.title.trim(), moduleIds: [moduleId] }); }
  return changed ? { dashboards: next } : {};
}

export async function saveModuleDraft(api: CardsAPI, draft: CardModuleDraft, baseline: CardModuleDraft | null, assignment?: ModuleDashboardAssignment): Promise<void> {
  if (!validCardAppearance(draft.appearance)) throw new Error('卡片外观设置无效。');
  if (!draft.title.trim()) throw new Error('请填写模块名称。');
  let settings = api.getSnapshot().settings;
  if (settings.deletedModuleIds?.includes(draft.id)) throw new Error('此模块已删除，当前草稿已保留。请使用“添加卡片模块”或“添加图片橱窗”创建新模块。');
  const current = readModuleDraft(settings, draft.id);
  if (baseline ? !sameModuleDraft(current, baseline) : current !== null) {
    if (!sameModuleDraft(current, draft)) throw new Error('此模块已在其他位置修改，当前选择已保留。请重新载入设置后再编辑。');
  }
  let classified = assignmentPatch(api, settings, draft.id, assignment, sameModuleDraft(current, draft));
  if (sameModuleDraft(current, draft) && !Object.keys(classified).length) return;
  if (draft.id === 'book' || draft.id === 'film') {
    const key = draft.id === 'book' ? 'bookCardAppearance' : 'filmCardAppearance';
    await api.saveSettings({ ...classified, [key]: { ...settings[key], ...draft.appearance }, ...(draft.title.trim() !== current?.title ? { workbenchText: { ...settings.workbenchText, [`${draft.id}.title`]: draft.title.trim() } } : {}) });
    return;
  }
  const { ratio, imageFit, ...appearance } = draft.appearance;
  let module = settings.customModules.find(item => item.id === draft.id);
  if (module && module.mode !== draft.mode) throw new Error('已有模块的卡片类型不能转换，请新建模块。');
  if (draft.mode === 'showcase' && !draft.showcaseNote) {
    if (!api.showcase) throw new Error('请升级已启用的卡片插件后再创建橱窗式模块。');
    draft.showcaseNote = await api.showcase.create(draft.id, draft.title.trim());
    if (!draft.showcaseNote?.trim()) throw new Error('橱窗笔记尚未创建，当前模块草稿已保留。');
    settings = api.getSnapshot().settings;
    if (settings.deletedModuleIds?.includes(draft.id)) throw new Error('此模块已删除，当前草稿和橱窗笔记已保留。请创建新模块。');
    if (!sameModuleDraft(readModuleDraft(settings, draft.id), current)) throw new Error('此模块已在其他位置修改，当前选择已保留。请重新载入设置后再编辑。');
    module = settings.customModules.find(item => item.id === draft.id);
    classified = assignmentPatch(api, settings, draft.id, assignment);
  }
  await api.saveSettings({ ...classified, customModules: module
    ? settings.customModules.map(item => item.id === draft.id ? { ...item, title: draft.title.trim(), appearance: { ...item.appearance, ...appearance }, ratio, imageFit } : item)
    : [...settings.customModules, { ...newCustomModule(draft.title, appearance, ratio, imageFit), id: draft.id, ...(draft.mode ? { mode: draft.mode, showcaseNote: draft.showcaseNote } : {}) }],
  });
}

/** One config transaction replaces historic visibility with ordinary Dashboard membership. */
export function dashboardNavigationPatch(settings: CardsSettings): Partial<CardsSettings> | null {
  if (settings.dashboardNavigationVersion === 1) return null;
  const hidden = new Set([...(settings.hiddenModuleIds ?? []), ...(settings.standaloneHiddenModuleIds ?? [])]);
  return { dashboardNavigationVersion: 1, ...(settings.hiddenModuleIds !== undefined ? { hiddenModuleIds: [] } : {}), ...(settings.standaloneHiddenModuleIds !== undefined ? { standaloneHiddenModuleIds: [] } : {}), ...(settings.dashboards !== undefined ? { dashboards: settings.dashboards.map(board => ({ ...board, moduleIds: board.moduleIds.filter(id => !hidden.has(id)) })) } : {}) };
}
export async function setModuleHidden(api: CardsAPI, id: string, hidden: boolean): Promise<void> {
  if (!api.showcase) throw new Error('请升级已启用的卡片插件后再隐藏或恢复模块。');
  const settings = api.getSnapshot().settings;
  if (!readModuleDraft(settings, id)) throw new Error('模块已改变，请重新载入后重试。');
  const ids = settings.hiddenModuleIds ?? [];
  await api.saveSettings({ hiddenModuleIds: hidden ? [...new Set([...ids, id])] : ids.filter(value => value !== id) });
}
export async function setStandaloneModuleHidden(api: CardsAPI, id: string, hidden: boolean): Promise<void> {
  if (!api.supportsStandaloneModuleVisibility) throw new Error('请升级已启用的兼容卡片插件后再隐藏或恢复独立卡片页模块。已有模块和资料已保留。');
  const settings = api.getSnapshot().settings;
  if (!readModuleDraft(settings, id)) throw new Error('模块已改变，请重新载入后重试。');
  const ids = settings.standaloneHiddenModuleIds ?? [];
  await api.saveSettings({ standaloneHiddenModuleIds: hidden ? [...new Set([...ids, id])] : ids.filter(value => value !== id) });
}
export async function removeModule(api: CardsAPI, id: string, baseline: CardModuleDraft): Promise<void> {
  if (!api.supportsModuleDeletion) throw new Error('请升级已启用的兼容卡片插件后再删除模块。已有模块、笔记和图片已保留。');
  const settings = api.getSnapshot().settings;
  if (baseline.id !== id || !sameModuleDraft(readModuleDraft(settings, id), baseline)) throw new Error('此模块已在其他位置修改或删除，删除已取消。当前草稿已保留，请重新载入后重试。');
  await api.saveSettings({
    deletedModuleIds: [...new Set([...(settings.deletedModuleIds ?? []), id])],
    customModules: settings.customModules.filter(module => module.id !== id),
    standaloneOrder: settings.standaloneOrder.filter(moduleId => moduleId !== id),
    workbenchCards: settings.workbenchCards.filter(placement => placement.module !== id),
    // Built-in appearance and title also participate in saveSettings's conflict check.
    ...(id === 'book' || id === 'film' ? { [id === 'book' ? 'bookCardAppearance' : 'filmCardAppearance']: settings[id === 'book' ? 'bookCardAppearance' : 'filmCardAppearance'], workbenchText: { ...settings.workbenchText } } : {}),
    ...(settings.dashboards !== undefined ? { dashboards: settings.dashboards.map(board => ({ ...board, moduleIds: board.moduleIds.filter(moduleId => moduleId !== id) })) } : {}),
    ...(settings.hiddenModuleIds !== undefined ? { hiddenModuleIds: settings.hiddenModuleIds.filter(moduleId => moduleId !== id) } : {}),
    ...(settings.standaloneHiddenModuleIds !== undefined ? { standaloneHiddenModuleIds: settings.standaloneHiddenModuleIds.filter(moduleId => moduleId !== id) } : {}),
  });
}
export function validWorkbenchCards(value: unknown): value is WorkbenchCardPlacement[] {
  const placement = (item: unknown): item is WorkbenchCardPlacement => record(item) && typeof item.module === 'string' && !!item.module.trim() && ['reflection', 'actions', 'gantt', 'quadrants', 'collections', 'end', 'inside-collections'].includes(String(item.before));
  return Array.isArray(value) && value.every(placement) && new Set(value.map(item => item.module)).size === value.length;
}
export function readCardsSettings(value: unknown): CardsSettings {
  const saved = record(value) ? value : {};
  if (Object.hasOwn(saved, 'dashboardNavigationVersion') && saved.dashboardNavigationVersion !== 1) throw new Error('Dashboard 导航版本无效，原内容已保留，请使用兼容版本。');
  if (Object.hasOwn(saved, 'standaloneHiddenModuleIds') && !standaloneIds(saved.standaloneHiddenModuleIds)) throw new Error('独立卡片页已移除模块标识无效，原内容已保留。');
  if (Object.hasOwn(saved, 'deletedModuleIds') && !standaloneIds(saved.deletedModuleIds)) throw new Error('已删除模块标识无效，原内容已保留。');
  const text = record(saved.workbenchText) ? Object.fromEntries(Object.entries(saved.workbenchText).filter(([key, value]) => ['book.title', 'film.title'].includes(key) && typeof value === 'string')) : {};
  return { bookCardAppearance: readCardAppearance(saved.bookCardAppearance, DEFAULT_CARD_SETTINGS.bookCardAppearance), filmCardAppearance: readCardAppearance(saved.filmCardAppearance, DEFAULT_CARD_SETTINGS.filmCardAppearance), customModules: readCustomModules(saved.customModules), threeCardView: typeof saved.threeCardView === 'boolean' ? saved.threeCardView : false, workbenchText: text as Record<string, string>, workbenchCards: validWorkbenchCards(saved.workbenchCards) ? saved.workbenchCards.map(item => ({ ...item })) : [], standaloneOrder: ids(saved.standaloneOrder) ? [...saved.standaloneOrder] : [], ...(ids(saved.hiddenModuleIds) ? { hiddenModuleIds: [...saved.hiddenModuleIds] } : {}), ...(standaloneIds(saved.standaloneHiddenModuleIds) ? { standaloneHiddenModuleIds: [...saved.standaloneHiddenModuleIds] } : {}), ...(standaloneIds(saved.deletedModuleIds) ? { deletedModuleIds: [...saved.deletedModuleIds] } : {}), ...(Object.hasOwn(saved, 'dashboards') ? { dashboards: readDashboards(saved.dashboards) } : {}), ...(saved.dashboardNavigationVersion === 1 ? { dashboardNavigationVersion: 1 } : {}) };
}
export function validateCardsPatch(patch: Partial<CardsSettings>): void {
  for (const key of Object.keys(patch)) if (!(CARD_SETTING_KEYS as readonly string[]).includes(key)) throw new Error(`不能修改卡片设置：${key}`);
  for (const key of ['bookCardAppearance', 'filmCardAppearance'] as const) if (key in patch && !validCardAppearance(patch[key])) throw new Error('卡片样式、显示方式、材质、比例、布局或方向无效。');
  if ('customModules' in patch && !validCustomModules(patch.customModules)) throw new Error('自定义模块设置无效，请检查名称及卡片外观。');
  if ('threeCardView' in patch && typeof patch.threeCardView !== 'boolean') throw new Error('卡片显示数量设置无效。');
  if ('workbenchCards' in patch && !validWorkbenchCards(patch.workbenchCards)) throw new Error('工作台卡片位置无效。');
  if ('standaloneOrder' in patch && !ids(patch.standaloneOrder)) throw new Error('卡片模块顺序无效。');
  if ('hiddenModuleIds' in patch && !ids(patch.hiddenModuleIds)) throw new Error('已移除模块标识无效。');
  if ('standaloneHiddenModuleIds' in patch && !standaloneIds(patch.standaloneHiddenModuleIds)) throw new Error('独立卡片页已移除模块标识无效，原内容已保留。');
  if ('deletedModuleIds' in patch && !standaloneIds(patch.deletedModuleIds)) throw new Error('已删除模块标识无效，原内容已保留。');
  if ('dashboards' in patch && !validDashboards(patch.dashboards)) throw new Error('看板设置无效，请检查名称、唯一标识和模块顺序。原内容已保留。');
  if ('dashboardNavigationVersion' in patch && patch.dashboardNavigationVersion !== 1) throw new Error('Dashboard 导航版本无效，原内容已保留，请使用兼容版本。');
  if ('workbenchText' in patch && (!record(patch.workbenchText) || Object.entries(patch.workbenchText).some(([key, value]) => !['book.title', 'film.title'].includes(key) || typeof value !== 'string'))) throw new Error('卡片模块文字无效。');
}
