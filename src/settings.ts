import { DEFAULT_CARD_SETTINGS, type CardLayout, type CardRatio, type CardsAPI, type CardsSettings, type CustomCardModule, type WorkCardAppearance, type WorkbenchCardPlacement } from './types';

export const CARD_RATIOS: Record<CardRatio, string> = { '1:1': '1:1 方图', '4:3': '4:3 横向照片', '3:4': '3:4 竖向照片', '2:3': '2:3 番剧／海报', '16:9': '16:9 横向画面' };
export const CARD_LAYOUTS: Record<CardLayout, string> = { cylinder: '圆柱弧面', 'coverflow-carousel': '封面流轮播', 'album-rail': '黑胶专辑架', 'scroll-bend': '滚动弯曲画廊', 'skewed-carousel': '倾斜轮播' };
export const CARD_APPEARANCE_FIELDS = [
  { field: 'style', name: '1. 卡片样式', options: { cover: '整幅封面', minimal: '简约' }, fallback: 'cover' },
  { field: 'imageFit', name: '2. 显示方式', options: { contain: '完整显示', cover: '填满裁切' }, fallback: 'cover' },
  { field: 'material', name: '3. 卡片材质', options: { paper: '纸感', matte: '磨砂', foil: '全息' }, fallback: 'paper' },
  { field: 'ratio', name: '4. 比例', options: CARD_RATIOS, fallback: '2:3' },
  { field: 'layout', name: '5. 动效布局', options: CARD_LAYOUTS, fallback: 'cylinder' },
  { field: 'orientation', name: '画廊方向', options: { horizontal: '横向', vertical: '竖向' }, fallback: 'horizontal' },
] as const;
export const CARD_SETTING_KEYS = ['bookCardAppearance', 'filmCardAppearance', 'customModules', 'threeCardView', 'workbenchText', 'workbenchCards', 'standaloneOrder'] as const;
export const FRESH_CARD_APPEARANCE: Readonly<WorkCardAppearance> = { material: 'paper', style: 'cover', layout: 'cylinder', ratio: '2:3', imageFit: 'cover' };
export function freshCardsSettings(): CardsSettings {
  return { ...readCardsSettings(undefined), bookCardAppearance: { ...FRESH_CARD_APPEARANCE }, filmCardAppearance: { ...FRESH_CARD_APPEARANCE }, threeCardView: true, workbenchText: { 'book.title': '阅读', 'film.title': '影视' } };
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.every(id => typeof id === 'string' && !!id.trim()) && new Set(value).size === value.length;
export function validCardAppearance(value: unknown): value is WorkCardAppearance {
  return record(value) && ['paper', 'matte', 'foil'].includes(String(value.material)) && ['minimal', 'cover'].includes(String(value.style))
    && (value.layout === undefined || typeof value.layout === 'string' && Object.hasOwn(CARD_LAYOUTS, value.layout))
    && (value.orientation === undefined || value.orientation === 'horizontal' || value.orientation === 'vertical')
    && (value.ratio === undefined || typeof value.ratio === 'string' && Object.hasOwn(CARD_RATIOS, value.ratio))
    && (value.imageFit === undefined || value.imageFit === 'contain' || value.imageFit === 'cover');
}
export function readCardAppearance(value: unknown, fallback: WorkCardAppearance): WorkCardAppearance {
  return { ...(validCardAppearance(value) ? value : fallback) };
}
const moduleShape = (value: unknown): value is CustomCardModule => record(value) && typeof value.id === 'string' && /^[\w-]+$/.test(value.id) && typeof value.title === 'string' && !!value.title.trim()
  && (value.kind === 'book' || value.kind === 'film') && validCardAppearance(value.appearance)
  && (value.ratio === undefined || typeof value.ratio === 'string' && Object.hasOwn(CARD_RATIOS, value.ratio))
  && (value.imageFit === undefined || value.imageFit === 'contain' || value.imageFit === 'cover');
export function validCustomModules(value: unknown): value is CustomCardModule[] { return Array.isArray(value) && value.every(moduleShape) && new Set(value.map(module => module.id)).size === value.length; }
export function readCustomModules(value: unknown): CustomCardModule[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((module): module is CustomCardModule => {
    if (!moduleShape(module) || seen.has(module.id)) return false;
    seen.add(module.id); return true;
  }).map(module => ({ ...module, title: module.title.trim(), appearance: { ...module.appearance }, ratio: module.ratio ?? '2:3', imageFit: module.imageFit ?? 'contain' }));
}
export function newCustomModule(title: string, appearance: WorkCardAppearance = { ...FRESH_CARD_APPEARANCE }, ratio: CardRatio = '2:3', imageFit: CustomCardModule['imageFit'] = 'cover'): CustomCardModule {
  return { id: crypto.randomUUID(), title: title.trim(), kind: 'film', appearance: { ...appearance }, ratio, imageFit };
}
export interface CardModuleDraft { id: string; title: string; appearance: WorkCardAppearance; }
export function readModuleDraft(settings: CardsSettings, id: string): CardModuleDraft | null {
  const custom = settings.customModules.find(module => module.id === id);
  const original = custom?.appearance ?? (id === 'book' ? settings.bookCardAppearance : id === 'film' ? settings.filmCardAppearance : undefined);
  if (!original) return null;
  return { id, title: custom?.title ?? (id === 'book' ? '阅读' : '影视'), appearance: {
    style: original.style, material: original.material, layout: original.layout ?? 'cylinder', orientation: original.orientation ?? 'horizontal',
    ratio: custom?.ratio ?? original.ratio ?? '2:3', imageFit: custom ? custom.imageFit ?? original.imageFit ?? 'contain' : original.imageFit ?? 'cover',
  } };
}
export function newModuleDraft(): CardModuleDraft {
  return { id: crypto.randomUUID(), title: '', appearance: { ...FRESH_CARD_APPEARANCE, orientation: 'horizontal' } };
}
const sameModuleDraft = (left: CardModuleDraft | null, right: CardModuleDraft | null) => {
  const values = (draft: CardModuleDraft | null) => draft && [draft.id, draft.title.trim(), draft.appearance.style, draft.appearance.imageFit, draft.appearance.material, draft.appearance.ratio, draft.appearance.layout, draft.appearance.orientation];
  return JSON.stringify(values(left)) === JSON.stringify(values(right));
};
export async function saveModuleDraft(api: CardsAPI, draft: CardModuleDraft, baseline: CardModuleDraft | null): Promise<void> {
  if (!validCardAppearance(draft.appearance)) throw new Error('卡片外观设置无效。');
  const settings = api.getSnapshot().settings, current = readModuleDraft(settings, draft.id);
  if (baseline ? !sameModuleDraft(current, baseline) : current !== null) {
    if (!baseline && sameModuleDraft(current, draft)) return;
    throw new Error('此模块已在其他位置修改，当前选择已保留。请重新载入设置后再编辑。');
  }
  if (draft.id === 'book' || draft.id === 'film') {
    const key = draft.id === 'book' ? 'bookCardAppearance' : 'filmCardAppearance';
    await api.saveSettings({ [key]: { ...settings[key], ...draft.appearance } });
    return;
  }
  if (!draft.title.trim()) throw new Error('请填写模块名称。');
  const { ratio, imageFit, ...appearance } = draft.appearance;
  const module = settings.customModules.find(item => item.id === draft.id);
  await api.saveSettings({ customModules: module
    ? settings.customModules.map(item => item.id === draft.id ? { ...item, title: draft.title.trim(), appearance: { ...item.appearance, ...appearance }, ratio, imageFit } : item)
    : [...settings.customModules, { ...newCustomModule(draft.title, appearance, ratio, imageFit), id: draft.id }],
  });
}
export function validWorkbenchCards(value: unknown): value is WorkbenchCardPlacement[] {
  const placement = (item: unknown): item is WorkbenchCardPlacement => record(item) && typeof item.module === 'string' && !!item.module.trim() && ['reflection', 'actions', 'gantt', 'quadrants', 'collections', 'end', 'inside-collections'].includes(String(item.before));
  return Array.isArray(value) && value.every(placement) && new Set(value.map(item => item.module)).size === value.length;
}
export function readCardsSettings(value: unknown): CardsSettings {
  const saved = record(value) ? value : {};
  const text = record(saved.workbenchText) ? Object.fromEntries(Object.entries(saved.workbenchText).filter(([key, value]) => ['book.title', 'film.title'].includes(key) && typeof value === 'string')) : {};
  return { bookCardAppearance: readCardAppearance(saved.bookCardAppearance, DEFAULT_CARD_SETTINGS.bookCardAppearance), filmCardAppearance: readCardAppearance(saved.filmCardAppearance, DEFAULT_CARD_SETTINGS.filmCardAppearance), customModules: readCustomModules(saved.customModules), threeCardView: typeof saved.threeCardView === 'boolean' ? saved.threeCardView : false, workbenchText: text as Record<string, string>, workbenchCards: validWorkbenchCards(saved.workbenchCards) ? saved.workbenchCards.map(item => ({ ...item })) : [], standaloneOrder: ids(saved.standaloneOrder) ? [...saved.standaloneOrder] : [] };
}
export function validateCardsPatch(patch: Partial<CardsSettings>): void {
  for (const key of Object.keys(patch)) if (!(CARD_SETTING_KEYS as readonly string[]).includes(key)) throw new Error(`不能修改卡片设置：${key}`);
  for (const key of ['bookCardAppearance', 'filmCardAppearance'] as const) if (key in patch && !validCardAppearance(patch[key])) throw new Error('卡片样式、显示方式、材质、比例、布局或方向无效。');
  if ('customModules' in patch && !validCustomModules(patch.customModules)) throw new Error('自定义模块设置无效，请检查名称及卡片外观。');
  if ('threeCardView' in patch && typeof patch.threeCardView !== 'boolean') throw new Error('卡片显示数量设置无效。');
  if ('workbenchCards' in patch && !validWorkbenchCards(patch.workbenchCards)) throw new Error('工作台卡片位置无效。');
  if ('standaloneOrder' in patch && !ids(patch.standaloneOrder)) throw new Error('卡片模块顺序无效。');
  if ('workbenchText' in patch && (!record(patch.workbenchText) || Object.entries(patch.workbenchText).some(([key, value]) => !['book.title', 'film.title'].includes(key) || typeof value !== 'string'))) throw new Error('卡片模块文字无效。');
}
