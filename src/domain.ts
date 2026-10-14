import type { Work, WorkKind } from './types';
function civilDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(0);
  result.setUTCFullYear(year, month - 1, day);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const date = civilDate(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function createWork<T extends WorkKind>(type: T): Extract<Work, { type: T }>;
export function createWork(type: WorkKind): Work {
  const now = new Date().toISOString();
  const base = { id: crypto.randomUUID(), path: '', createdAt: now, updatedAt: now, body: '' };
  switch (type) {
    case 'book': return { ...base, type, title: '新书籍', sourceId: '', author: '', cover: '', progress: 0, lastRead: '', status: 'want', notes: [], deepLink: '', summary: '', rating: null, pinned: false, cardTitleAlign: 'left', cardSummaryAlign: 'left' };
    case 'film': return { ...base, type, title: '新影片', director: '', year: '', cover: '', date: '', status: 'want', summary: '', rating: null, pinned: false, link: '', cardTitleAlign: 'left', cardSummaryAlign: 'left' };
  }
}

function requireValue(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function strings(entity: object, fields: string[]): void {
  const values = entity as Record<string, unknown>;
  for (const field of fields) requireValue(typeof values[field] === 'string', `${field} 必须是文字`);
}

function nonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function optionalDate(value: unknown): boolean {
  return value === '' || validDate(value);
}

export function normalizeDirectorLabel(value: unknown): string {
  requireValue(typeof value === 'string', '信息标签必须是文字。');
  requireValue(!Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) && !/[\u2028\u2029]/.test(value), '信息标签应为单行纯文本。');
  const label = value.trim();
  requireValue(Array.from(label).length <= 40, '信息标签应为不超过 40 字的单行纯文本。');
  return label || '导演';
}

export function validateWork(entity: Work): void {
  requireValue(!!entity && typeof entity === 'object', '记录无效');
  strings(entity, ['id', 'type', 'title', 'path', 'createdAt', 'updatedAt']);
  requireValue(entity.id.trim().length > 0 && entity.title.trim().length > 0, '记录 ID 和标题不能为空');
  requireValue(Number.isFinite(Date.parse(entity.createdAt)) && Number.isFinite(Date.parse(entity.updatedAt)), '记录时间无效');
  requireValue(entity.body === undefined || typeof entity.body === 'string', '正文必须是文字');
  if (entity.type === 'book' || entity.type === 'film') {
    for (const value of [entity.cardTitleAlign, entity.cardSummaryAlign]) requireValue(value === undefined || ['left', 'center', 'right'].includes(value), '卡片文字对齐无效');
  }
  if (entity.type === 'book' || entity.type === 'film') requireValue(entity.linkedNote === undefined || typeof entity.linkedNote === 'string' && (!entity.linkedNote || !entity.linkedNote.startsWith('/') && !entity.linkedNote.split('/').includes('..') && /\.md$/i.test(entity.linkedNote)), '关联笔记路径无效');
  requireValue(entity.moduleId === undefined || typeof entity.moduleId === 'string' && !!entity.moduleId.trim(), '卡片所属模块无效。');
  switch (entity.type) {
    case 'book':
      strings(entity, ['sourceId', 'author', 'cover', 'lastRead', 'deepLink', 'summary']);
      requireValue(['want', 'reading', 'finished'].includes(entity.status), '阅读状态无效');
      requireValue(nonnegative(entity.progress) && entity.progress <= 100 && optionalDate(entity.lastRead), '阅读进度或日期无效');
      requireValue(entity.rating === null || nonnegative(entity.rating) && entity.rating <= 10, '评分无效');
      requireValue(typeof entity.pinned === 'boolean', '置顶状态无效');
      requireValue(Array.isArray(entity.notes) && entity.notes.every(note => !!note && typeof note.id === 'string' && !!note.id.trim() && ['highlight', 'thought'].includes(note.kind) && typeof note.text === 'string' && (note.quote === undefined || typeof note.quote === 'string') && (note.chapter === undefined || typeof note.chapter === 'string') && (note.date === undefined || optionalDate(note.date))), '书籍笔记无效');
      return;
    case 'film':
      strings(entity, ['director', 'year', 'cover', 'date', 'summary', 'link']);
      if (entity.directorLabel !== undefined) normalizeDirectorLabel(entity.directorLabel);
      requireValue(['want', 'watching', 'finished'].includes(entity.status) && optionalDate(entity.date), '观影状态或日期无效');
      requireValue(entity.rating === null || nonnegative(entity.rating) && entity.rating <= 10, '评分无效');
      requireValue(typeof entity.pinned === 'boolean', '置顶状态无效');
      return;
    default: throw new Error('记录类型无效');
  }
}
