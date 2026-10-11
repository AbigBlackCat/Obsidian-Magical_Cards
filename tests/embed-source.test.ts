import assert from 'node:assert/strict';
import test from 'node:test';
import { cardsSourceBlocks, newCardsBlock, parseCardsEmbed, reorderCardsBlock } from '../src/embed-source';
import { movedModule } from '../src/ModuleList';

const source = 'id: demo\nlabel: 保留这个属性\nmodules:\n  - id: books # 保留注释\n    collection: book\n    layout: coverflow-carousel\n  - id: films\n    collection: film\n    layout: album-rail';
const note = `# 正文前\n\n\`\`\`barry-cards\n${source}\n\`\`\`\n\n正文后面不改。\n`;

test('reorder only the unique cards block; preserve body, scalar options and node comments', () => {
  const result = reorderCardsBlock(note, source, ['films', 'books']);
  assert.ok(result.text.startsWith('# 正文前\n\n```barry-cards\n'));
  assert.ok(result.text.endsWith('```\n\n正文后面不改。\n'));
  assert.ok(result.source.includes('label: 保留这个属性'));
  assert.ok(result.source.includes('# 保留注释'));
  assert.deepEqual(parseCardsEmbed(result.source).modules.map(module => module.id), ['films', 'books']);
});

test('reject changed sources, duplicate block IDs, duplicate module IDs and partial order', () => {
  assert.throws(() => reorderCardsBlock(note.replace('保留这个属性', '修改'), source, ['films', 'books']), /其他窗口修改/);
  assert.throws(() => reorderCardsBlock(note + note, source, ['films', 'books']), /重复/);
  assert.throws(() => reorderCardsBlock(note + note.replace('collection: film', 'collection: []'), source, ['films', 'books']), /重复/);
  assert.throws(() => reorderCardsBlock(note, source, ['books']), /不完整/);
  assert.throws(() => parseCardsEmbed(source.replace('id: films', 'id: books')), /重复/);
  assert.throws(() => parseCardsEmbed(source.replace('album-rail', 'unknown')), /未知卡片布局/);
});

test('ignore nested fences and preserve CRLF', () => {
  assert.equal(cardsSourceBlocks('````md\n' + note + '````\n').length, 0);
  const changed = reorderCardsBlock(note.replace(/\n/g, '\r\n'), source, ['films', 'books']);
  assert.equal(changed.text.replace(/\r\n/g, '').includes('\n'), false);
});

test('insert command uses fresh IDs; keyboard movement preserves IDs', () => {
  const first = parseCardsEmbed(cardsSourceBlocks(newCardsBlock())[0].source), second = parseCardsEmbed(cardsSourceBlocks(newCardsBlock())[0].source);
  assert.notEqual(first.id, second.id); assert.notEqual(first.modules[0].id, second.modules[0].id);
  assert.deepEqual(movedModule(['a', 'b', 'c'], 'a', 'c'), ['b', 'a', 'c']);
  assert.deepEqual(movedModule(['a', 'b', 'c'], 'b', null), ['a', 'c', 'b']);
});
