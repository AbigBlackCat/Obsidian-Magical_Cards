import { parseYaml } from 'obsidian';
import { contentRevision, coverPath, validFolder } from './persistence';
import type { ShowcaseCard, ShowcaseDocument } from './types';

const prefix = '<!-- magical-cards:card:';
const identifier = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const punctuation = new Set('\\`*_{}[]()#+.!|~-');
export function assertShowcaseId(id: string): void {
  if (!identifier.test(id)) throw new Error('橱窗标识无效。');
}
function assertText(text: string, limit: number, label: string): void {
  if (typeof text !== 'string' || Array.from(text).length > limit || text.includes('\0')) throw new Error(`${label}应为不超过 ${limit} 字的纯文本。`);
}
function escapeText(text: string): string {
  return Array.from(text, character => character === '&' ? '&amp;' : character === '<' ? '&lt;' : character === '>' ? '&gt;' : punctuation.has(character) ? `\\${character}` : character).join('');
}
function decodeText(text: string): string {
  let output = '';
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '\\' && punctuation.has(text[index + 1])) index++;
    output += text[index];
  }
  return output.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
export function assertShowcaseImage(image: string): void {
  if (!image || !validFolder(image) || /^[a-z][a-z\d+.-]*:/i.test(image) || !/\.(?:png|jpe?g|webp|gif|svg)$/i.test(image)) throw new Error('橱窗图片必须引用笔记库内的图片文件。');
}
export function showcaseCardBlock(card: ShowcaseCard, newline = '\n'): string {
  assertShowcaseId(card.id); assertShowcaseImage(card.image);
  assertText(card.name, 180, '卡片名称'); assertText(card.description, 400, '翻面描述');
  if (/[\r\n]/.test(card.name)) throw new Error('卡片名称应为单行文字。');
  const body = `${card.name ? `## ${escapeText(card.name)}\n\n` : ''}![[${card.image}]]${card.description ? `\n\n${escapeText(card.description.replace(/\r\n?/g, '\n'))}` : ''}`;
  return `${prefix}${card.id}:start -->\n${body}\n<!-- magical-cards:card:${card.id}:end -->\n`.replace(/\n/g, newline);
}
interface TextSpan { start: number; end: number; }
interface CardSpan { card: ShowcaseCard; start: number; end: number; raw: string; nameSpan?: TextSpan; nameInsert: number; descriptionSpan?: TextSpan; descriptionInsert: number; }
interface ParsedShowcase { document: ShowcaseDocument; spans: CardSpan[]; newline: string; }
function cardFromBody(id: string, body: string, bodyOffset: number): Pick<CardSpan, 'card' | 'nameSpan' | 'nameInsert' | 'descriptionSpan' | 'descriptionInsert'> {
  const lines: Array<{ text: string; start: number; end: number; after: number }> = [];
  let offset = bodyOffset;
  for (const raw of body.match(/[^\n]*(?:\n|$)/g) ?? []) {
    if (!raw) continue;
    const text = raw.replace(/\r?\n$/, ''); lines.push({ text, start: offset, end: offset + text.length, after: offset + raw.length }); offset += raw.length;
  }
  while (lines.length && !lines[0].text.trim()) lines.shift();
  let name = '';
  let nameSpan: TextSpan | undefined;
  if (lines[0]?.text.startsWith('## ')) { const line = lines.shift()!; name = decodeText(line.text.slice(3)); nameSpan = { start: line.start, end: line.after }; while (lines.length && !lines[0].text.trim()) lines.shift(); }
  const imageLine = lines.shift();
  if (!imageLine || !/^!\[\[[^\r\n]+\]\]$/.test(imageLine.text) && !/^!\[[^\r\n]*\]\([^\r\n]+\)$/.test(imageLine.text)) throw new Error('橱窗卡片需要一行图片嵌入。');
  const image = coverPath(imageLine.text); assertShowcaseImage(image);
  // Generated blocks have one separator after the image; additional blank lines are description text.
  if (lines[0]?.text === '') lines.shift();
  const description = decodeText(lines.map(line => line.text).join('\n'));
  const descriptionSpan = lines.length ? { start: lines[0].start, end: lines.at(-1)!.end } : undefined;
  assertText(name, 180, '卡片名称'); assertText(description, 400, '翻面描述');
  return { card: { id, image, name, description }, nameSpan, nameInsert: imageLine.start, descriptionSpan, descriptionInsert: imageLine.after };
}
function parse(text: string, path: string, expectedModule: string): ParsedShowcase {
  assertShowcaseId(expectedModule);
  const header = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const fields: unknown = header ? parseYaml(header[1]) : null;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields) || !('mc_showcase_module' in fields) || fields.mc_showcase_module !== expectedModule || !('mc_showcase_version' in fields) || fields.mc_showcase_version !== 1) throw new Error('橱窗笔记标识或版本不匹配，原内容已保留。');
  const spans: CardSpan[] = [], seen = new Set<string>();
  let open: { id: string; start: number; body: number } | undefined;
  let fence: { character: string; length: number } | undefined;
  let offset = header?.[0].length ?? 0;
  for (const line of text.slice(offset).match(/[^\n]*(?:\n|$)/g) ?? []) {
    if (!line) continue;
    const plain = line.replace(/\r?\n$/, ''), fenced = plain.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    const hasMarker = plain.includes('<!-- magical-cards:card');
    if (hasMarker && (fence || fenced)) throw new Error('卡片管理标记不能放在代码块中，原内容已保留。');
    if (fenced) {
      if (open) throw new Error('卡片描述应为纯文本，不能包含代码围栏。');
      if (!fence) fence = { character: fenced[1][0], length: fenced[1].length };
      else if (fenced[1][0] === fence.character && fenced[1].length >= fence.length && !fenced[2].trim()) fence = undefined;
    }
    if (hasMarker) {
      const match = plain.match(/^<!-- magical-cards:card:([A-Za-z0-9][A-Za-z0-9_-]{0,127}):(start|end) -->$/);
      if (!match) throw new Error('卡片管理标记损坏，原内容已保留。');
      const [, id, edge] = match;
      if (edge === 'start') {
        if (open || seen.has(id)) throw new Error('卡片标识重复或管理区块嵌套，原内容已保留。');
        seen.add(id); open = { id, start: offset, body: offset + line.length };
      } else {
        if (!open || open.id !== id) throw new Error('卡片管理区块边界不完整，原内容已保留。');
        const end = offset + line.length;
        spans.push({ ...cardFromBody(id, text.slice(open.body, offset), open.body), start: open.start, end, raw: text.slice(open.start, end) });
        open = undefined;
      }
    }
    offset += line.length;
  }
  if (open) throw new Error('卡片管理区块缺少结束标记，原内容已保留。');
  return { document: { moduleId: expectedModule, path, cards: spans.map(span => span.card), revision: contentRevision(text) }, spans, newline: text.includes('\r\n') ? '\r\n' : '\n' };
}
export function readShowcaseMarkdown(text: string, path: string, moduleId: string): ShowcaseDocument { return parse(text, path, moduleId).document; }
export function newShowcaseMarkdown(moduleId: string, title: string): string {
  assertShowcaseId(moduleId); assertText(title, 180, '模块名称');
  if (!title.trim() || /[\r\n]/.test(title)) throw new Error('模块名称应为非空单行文字。');
  return `---\nmc_showcase_module: ${moduleId}\nmc_showcase_version: 1\n---\n\n# ${escapeText(title)}\n\n`;
}
function spanFor(parsed: ParsedShowcase, id: string): CardSpan {
  assertShowcaseId(id); const span = parsed.spans.find(item => item.card.id === id);
  if (!span) throw new Error('这张卡片已删除或标识改变，草稿已保留。');
  return span;
}
export function patchShowcaseMarkdown(text: string, path: string, moduleId: string, id: string, patch: Partial<Pick<ShowcaseCard, 'name' | 'description'>>, expected: ShowcaseCard): { text: string; card: ShowcaseCard } {
  const parsed = parse(text, path, moduleId), span = spanFor(parsed, id);
  if (expected.id !== id) throw new Error('卡片编辑状态无效。');
  for (const key of Object.keys(patch)) {
    if (key !== 'name' && key !== 'description') throw new Error('不能修改此卡片字段。');
    if (span.card[key] !== expected[key]) throw new Error('所编辑的卡片字段已在其他窗口更新，草稿已保留。');
  }
  const card = { ...span.card, ...patch };
  showcaseCardBlock(card); // Validate changed values without normalizing untouched source fields.
  const edits: Array<TextSpan & { value: string }> = [];
  if (Object.hasOwn(patch, 'name')) {
    if (span.nameSpan) edits.push({ ...span.nameSpan, value: card.name ? `## ${escapeText(card.name)}${parsed.newline}` : '' });
    else if (card.name) edits.push({ start: span.nameInsert, end: span.nameInsert, value: `## ${escapeText(card.name)}${parsed.newline}${parsed.newline}` });
  }
  if (Object.hasOwn(patch, 'description')) {
    const value = escapeText(card.description.replace(/\r\n?/g, '\n')).replace(/\n/g, parsed.newline);
    if (span.descriptionSpan) edits.push({ ...span.descriptionSpan, value });
    else if (value) edits.push({ start: span.descriptionInsert, end: span.descriptionInsert, value: `${parsed.newline}${value}${parsed.newline}` });
  }
  let updated = text;
  for (const edit of edits.sort((a, b) => b.start - a.start)) updated = updated.slice(0, edit.start) + edit.value + updated.slice(edit.end);
  return { text: updated, card };
}
export function appendShowcaseMarkdown(text: string, path: string, moduleId: string, card: ShowcaseCard): string {
  const parsed = parse(text, path, moduleId);
  if (parsed.spans.some(span => span.card.id === card.id)) throw new Error('卡片标识已存在。');
  return text + (text.endsWith('\n') ? '' : parsed.newline) + parsed.newline + showcaseCardBlock(card, parsed.newline);
}
export function deleteShowcaseMarkdown(text: string, path: string, moduleId: string, id: string, expected: ShowcaseCard): string {
  const parsed = parse(text, path, moduleId), span = spanFor(parsed, id);
  if (['id', 'image', 'name', 'description'].some(key => span.card[key as keyof ShowcaseCard] !== expected[key as keyof ShowcaseCard])) throw new Error('卡片已在其他窗口更新，请重新确认删除。');
  return text.slice(0, span.start) + text.slice(span.end);
}
export function moveShowcaseMarkdown(text: string, path: string, moduleId: string, id: string, beforeId: string | null, expectedIds: string[]): string {
  const parsed = parse(text, path, moduleId), ids = parsed.spans.map(span => span.card.id);
  if (ids.length !== expectedIds.length || ids.some((value, index) => value !== expectedIds[index])) throw new Error('卡片顺序或成员已变化，排序草稿已保留。');
  if (!ids.includes(id) || beforeId !== null && !ids.includes(beforeId)) throw new Error('排序目标已删除。');
  if (id === beforeId) return text;
  const order = ids.filter(value => value !== id); order.splice(beforeId === null ? order.length : order.indexOf(beforeId), 0, id);
  const blocks = new Map(parsed.spans.map(span => [span.card.id, span.raw]));
  let result = '', offset = 0;
  parsed.spans.forEach((span, index) => {
    const raw = blocks.get(order[index])!, ending = span.raw.match(/\r?\n$/)?.[0] ?? '';
    result += text.slice(offset, span.start) + raw.replace(/\r?\n$/, '') + ending; offset = span.end;
  });
  return result + text.slice(offset);
}
