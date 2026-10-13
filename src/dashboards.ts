import type { CardsAPI, CardsDashboard } from './types';

/** The built-in complete library uses standaloneOrder and is never saved as a dashboard. */
export const ALL_DASHBOARD_ID = 'all';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,180}$/.test(value);
const title = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim()) && !Array.from(value).some(character => character.charCodeAt(0) < 32);
const moduleIds = (value: unknown): value is string[] => Array.isArray(value) && value.every(identifier) && new Set(value).size === value.length;
const dashboard = (value: unknown): value is CardsDashboard => record(value) && identifier(value.id) && value.id !== ALL_DASHBOARD_ID && title(value.title) && moduleIds(value.moduleIds);

export function validDashboards(value: unknown): value is CardsDashboard[] {
  return Array.isArray(value) && value.every(dashboard) && new Set(value.map(board => board.id)).size === value.length;
}

/** Preserve future properties and missing collection references; malformed data requires repair. */
export function readDashboards(value: unknown): CardsDashboard[] {
  if (!validDashboards(value)) throw new Error('看板设置无效，请检查名称、唯一标识和模块顺序。原内容已保留。');
  return value.map(board => ({ ...board, moduleIds: [...board.moduleIds] }));
}

function assertSupported(api: CardsAPI): void {
  if (!api.supportsDashboards) throw new Error('请升级已启用的兼容卡片插件后再编辑看板。已有模块和资料已保留。');
}

const same = (left: CardsDashboard | undefined, right: CardsDashboard) => !!left && left.id === right.id && left.title === right.title && JSON.stringify(left.moduleIds) === JSON.stringify(right.moduleIds);

export function createDashboard(title: string, ids: string[] = []): CardsDashboard {
  const result = { id: crypto.randomUUID(), title: title.trim(), moduleIds: [...ids] };
  readDashboards([result]);
  return result;
}

/** Merge other boards from the latest snapshot; native/queued races still use saveSettings's CAS. */
export async function saveDashboard(api: CardsAPI, draft: CardsDashboard, baseline: CardsDashboard | null): Promise<void> {
  assertSupported(api);
  readDashboards([draft]);
  if (baseline && baseline.id !== draft.id) throw new Error('看板标识已改变，草稿已保留，请重新载入。');
  const settings = api.getSnapshot().settings;
  if (draft.moduleIds.some(id => settings.deletedModuleIds?.includes(id))) throw new Error('所选模块已删除，看板草稿已保留，请取消该模块后重试。');
  const boards = settings.dashboards ?? [], current = boards.find(board => board.id === draft.id);
  const next = { ...(current ?? draft), id: draft.id, title: draft.title.trim(), moduleIds: [...draft.moduleIds] };
  if (baseline ? !same(current, baseline) : !!current) {
    if (same(current, next)) return;
    throw new Error('此看板已在其他位置修改，草稿已保留。请重新载入后重试。');
  }
  await api.saveSettings({ dashboards: current ? boards.map(board => board.id === draft.id ? next : board) : [...boards, next] });
}

export async function deleteDashboard(api: CardsAPI, baseline: CardsDashboard): Promise<void> {
  assertSupported(api);
  readDashboards([baseline]);
  const boards = api.getSnapshot().settings.dashboards ?? [], current = boards.find(board => board.id === baseline.id);
  if (!current) return;
  if (!same(current, baseline)) throw new Error('此看板已在其他位置修改，删除已取消。请重新载入后重试。');
  await api.saveSettings({ dashboards: boards.filter(board => board.id !== baseline.id) });
}

export async function saveDashboardOrder(api: CardsAPI, baseline: CardsDashboard, order: string[]): Promise<void> {
  if (!moduleIds(order) || order.length !== baseline.moduleIds.length || order.some(id => !baseline.moduleIds.includes(id))) throw new Error('看板成员已改变，排序草稿已保留，请重新载入后重试。');
  await saveDashboard(api, { ...baseline, moduleIds: [...order] }, baseline);
}
