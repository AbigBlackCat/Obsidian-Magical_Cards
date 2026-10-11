import { isSeq, parseDocument } from 'yaml';
import type { CardDirection, CardLayout } from './types';

export interface EmbeddedModule { id: string; collection: string; layout?: CardLayout; orientation?: CardDirection; }
export interface CardsEmbed { id: string; modules: EmbeddedModule[]; }
export const CARD_LANGUAGES = ['magical-cards', 'barry-cards'] as const;
const layouts = ['cylinder', 'coverflow-carousel', 'album-rail', 'scroll-bend', 'skewed-carousel'];
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length <= 180 && Boolean(value.trim()) && !Array.from(value).some(char => char.charCodeAt(0) < 32);
const cardLayout = (value: unknown): value is CardLayout => typeof value === 'string' && layouts.includes(value);
const canonical = (source: string) => source.replace(/\r\n/g, '\n').replace(/\n$/, '');

export function parseCardsEmbed(source: string): CardsEmbed {
  const document = parseDocument(source);
  if (document.errors.length) throw new Error(`卡片模块配置无效：${document.errors[0].message}`);
  const value: unknown = document.toJS({ maxAliasCount: 20 });
  if (!record(value) || !identifier(value.id) || !Array.isArray(value.modules)) throw new Error('卡片代码块需要稳定的 id 和 modules 数组。');
  const modules: EmbeddedModule[] = value.modules.map((module: unknown) => {
    if (!record(module) || !identifier(module.id) || !identifier(module.collection)) throw new Error('每个模块需要稳定的 id 和 collection。');
    if (module.layout !== undefined && !cardLayout(module.layout)) throw new Error(`未知卡片布局：${typeof module.layout === 'string' ? module.layout : '无效值'}`);
    if (module.orientation !== undefined && module.orientation !== 'horizontal' && module.orientation !== 'vertical') throw new Error('弯曲画廊方向应为 horizontal 或 vertical。');
    return { id: module.id, collection: module.collection, ...(module.layout ? { layout: module.layout } : {}), ...(module.orientation ? { orientation: module.orientation } : {}) };
  });
  if (new Set(modules.map(module => module.id)).size !== modules.length) throw new Error('同一代码块中模块 id 重复，无法安全排序。');
  return { id: value.id, modules };
}

interface SourceBlock { source: string; from: number; to: number; }
/** Ignore card-like text nested inside other fences; offsets refer to the original note. */
export function cardsSourceBlocks(text: string): SourceBlock[] {
  const blocks: SourceBlock[] = [];
  const lines = [...text.matchAll(/[^\r\n]*(?:\r?\n|$)/g)].filter(match => match[0]);
  let fence: { character: string; length: number; card: boolean; from: number } | null = null;
  for (const line of lines) {
    const value = line[0].replace(/\r?\n$/, '');
    if (fence) {
      const closing = value.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (closing && closing[1][0] === fence.character && closing[1].length >= fence.length) {
        if (fence.card) blocks.push({ source: text.slice(fence.from, line.index), from: fence.from, to: line.index });
        fence = null;
      }
      continue;
    }
    const opening = value.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!opening || opening[1][0] === '`' && opening[2].includes('`')) continue;
    fence = { character: opening[1][0], length: opening[1].length, card: CARD_LANGUAGES.some(language => language === opening[2].trim()), from: line.index + line[0].length };
  }
  return blocks;
}

export function reorderCardsBlock(text: string, expectedSource: string, order: string[]): { text: string; source: string } {
  const expected = parseCardsEmbed(expectedSource);
  if (order.length !== expected.modules.length || new Set(order).size !== order.length || order.some(id => !expected.modules.some(module => module.id === id))) throw new Error('模块排序标识不完整，草稿已保留。');
  const matches = cardsSourceBlocks(text).filter(block => {
    try { return parseCardsEmbed(block.source).id === expected.id; } catch { return false; }
  });
  // Invalid duplicate blocks must also prevent writing a valid sibling.
  const rawMatches = cardsSourceBlocks(text).filter(block => {
    try { return parseDocument(block.source).get('id') === expected.id; } catch { return false; }
  });
  if (matches.length !== 1 || rawMatches.length !== 1) throw new Error('代码块 id 缺失或重复，草稿已保留，请修复源码后重试。');
  const block = matches[0];
  if (canonical(block.source) !== canonical(expectedSource)) throw new Error('卡片代码块已在其他窗口修改，草稿已保留，请重新载入后重试。');
  const document = parseDocument(block.source), sequence = document.get('modules', true);
  if (!isSeq(sequence)) throw new Error('模块源码已改变，草稿已保留。');
  const original = [...sequence.items];
  sequence.items = order.map(id => original[expected.modules.findIndex(module => module.id === id)]);
  let source = document.toString({ lineWidth: 0 });
  if (text.includes('\r\n')) source = source.replace(/\n/g, '\r\n');
  return { text: text.slice(0, block.from) + source + text.slice(block.to), source: canonical(source) };
}

export function newCardsBlock(collections: readonly string[] = ['book', 'film']): string {
  if (collections.some(collection => !identifier(collection)) || new Set(collections).size !== collections.length) throw new Error('请选择不同的有效卡片集合。');
  const id = crypto.randomUUID();
  const document = parseDocument('');
  document.set('id', `cards-${id}`);
  document.set('modules', collections.map(collection => ({ id: `module-${crypto.randomUUID()}`, collection })));
  return `\`\`\`magical-cards\n${document.toString({ lineWidth: 0 })}\`\`\`\n`;
}
