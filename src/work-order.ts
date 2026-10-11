import type { Book, Film, WorkKind, WorkOrder } from './types';

export function readWorkOrder(value: unknown): WorkOrder {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('作品排序属性格式无效，请检查 bw_work_order。');
  const result = value as Record<string, unknown>;
  for (const kind of ['book', 'film'] as const) {
    const ids = result[kind];
    if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string' && id.length > 0) || new Set(ids).size !== ids.length) throw new Error('作品排序需为两组不重复的 ID 列表。');
  }
  return { book: [...result.book as string[]], film: [...result.film as string[]] };
}

export function orderedWorks<T extends Book | Film>(works: T[], ids?: string[]): T[] {
  if (!ids) return [...works].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const ranks = new Map(ids.map((id, index) => [id, index]));
  return [...works].sort((a, b) => {
    const left = ranks.get(a.id), right = ranks.get(b.id);
    if (left === undefined && right === undefined) return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    return left - right;
  });
}

export function reconcileWorkOrder(order: WorkOrder, entities: Array<{ id: string; type: string; createdAt: string; updatedAt: string; pinned?: boolean }>): WorkOrder {
  const group = (kind: WorkKind) => {
    const works = entities.filter((item): item is Book | Film => item.type === kind);
    const known = new Set(order[kind]);
    // Keep absent IDs so restoring the original note also restores its position.
    return [...orderedWorks(works, order[kind]).filter(item => !known.has(item.id)).map(item => item.id), ...order[kind]];
  };
  return { book: group('book'), film: group('film') };
}

export function moveWorkOrder(order: WorkOrder, kind: WorkKind, id: string, beforeId: string | null): WorkOrder {
  if (!order[kind].includes(id) || (beforeId !== null && !order[kind].includes(beforeId))) throw new Error('排序目标已变化，请刷新后重试。');
  if (id === beforeId) return order;
  const ids = order[kind].filter(value => value !== id);
  ids.splice(beforeId === null ? ids.length : ids.indexOf(beforeId), 0, id);
  return { ...order, [kind]: ids };
}
