import assert from 'node:assert/strict';
import test from 'node:test';
import { cardsSourceBlocks, newCardsBlock, parseCardsEmbed, reorderCardsBlock } from '../src/embed-source';
import { movedModule } from '../src/ModuleList';

const source = 'id: demo\nlabel: 保留这个属性\nmodules:\n  - id: books # 保留注释\n    collection: book\n    layout: coverflow-carousel\n  - id: films\n    collection: film\n    layout: album-rail';
const note = `# 正文前\n\n\`\`\`barry-cards\n${source}\n\`\`\`\n\n正文后面不改。\n`;

test('both card languages reorder only their unique block; preserve body, scalar options and node comments', () => {
  for (const language of ['magical-cards', 'barry-cards']) {
    const result = reorderCardsBlock(note.replace('```barry-cards', `\`\`\`${language}`), source, ['films', 'books']);
    assert.ok(result.text.startsWith(`# 正文前\n\n\`\`\`${language}\n`));
    assert.ok(result.text.endsWith('```\n\n正文后面不改。\n'));
    assert.ok(result.source.includes('label: 保留这个属性'));
    assert.ok(result.source.includes('# 保留注释'));
    assert.deepEqual(parseCardsEmbed(result.source).modules.map(module => module.id), ['films', 'books']);
  }
});

test('reject changed sources, duplicate block IDs, duplicate module IDs and partial order', () => {
  assert.throws(() => reorderCardsBlock(note.replace('保留这个属性', '修改'), source, ['films', 'books']), /其他窗口修改/);
  assert.throws(() => reorderCardsBlock(note + note, source, ['films', 'books']), /重复/);
  assert.throws(() => reorderCardsBlock(note + note.replace('collection: film', 'collection: []'), source, ['films', 'books']), /重复/);
  assert.throws(() => reorderCardsBlock(note + note.replace('barry-cards', 'magical-cards'), source, ['films', 'books']), /重复/);
  assert.throws(() => reorderCardsBlock(note + note.replace('barry-cards', 'magical-cards').replace('collection: film', 'collection: []'), source, ['films', 'books']), /重复/);
  assert.throws(() => reorderCardsBlock(note, source, ['books']), /不完整/);
  assert.throws(() => parseCardsEmbed(source.replace('id: films', 'id: books')), /重复/);
  assert.throws(() => parseCardsEmbed(source.replace('album-rail', 'unknown')), /未知卡片布局/);
});

test('ignore nested fences and preserve CRLF', () => {
  assert.equal(cardsSourceBlocks('````md\n' + note + '````\n').length, 0);
  assert.equal(cardsSourceBlocks('````md\n' + note.replace('barry-cards', 'magical-cards') + '````\n').length, 0);
  const changed = reorderCardsBlock(note.replace('barry-cards', 'magical-cards').replace(/\n/g, '\r\n'), source, ['films', 'books']);
  assert.equal(changed.text.replace(/\r\n/g, '').includes('\n'), false);
});

test('insert command uses fresh IDs; keyboard movement preserves IDs', () => {
  const first = parseCardsEmbed(cardsSourceBlocks(newCardsBlock())[0].source), second = parseCardsEmbed(cardsSourceBlocks(newCardsBlock())[0].source);
  assert.notEqual(first.id, second.id); assert.notEqual(first.modules[0].id, second.modules[0].id);
  assert.ok(newCardsBlock().startsWith('```magical-cards\n'));
  assert.deepEqual(first.modules.map(module => module.collection), ['book', 'film']);
  assert.ok(first.modules.every(module => module.layout === undefined && module.orientation === undefined));
  assert.deepEqual(movedModule(['a', 'b', 'c'], 'a', 'c'), ['b', 'a', 'c']);
  assert.deepEqual(movedModule(['a', 'b', 'c'], 'b', null), ['a', 'c', 'b']);
});

test('generated blocks use selected collection IDs verbatim without YAML injection or reused instance IDs', () => {
  const collections = ['photos-123', 'yes', 'collection: two'];
  const blocks = [newCardsBlock(collections), newCardsBlock(collections)].map(text => parseCardsEmbed(cardsSourceBlocks(text)[0].source));
  for (const block of blocks) assert.deepEqual(block.modules.map(module => module.collection), collections);
  const ids = blocks.flatMap(block => [block.id, ...block.modules.map(module => module.id)]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(parseCardsEmbed(cardsSourceBlocks(newCardsBlock(['photos-123']))[0].source).modules.length, 1);
  assert.throws(() => newCardsBlock(['book', 'book']), /不同的有效/);
  assert.throws(() => newCardsBlock(['bad\ncollection']), /不同的有效/);
});

test('a mixed-language note retains the other block exactly while reordering the selected one', () => {
  const other = note.replace('id: demo', 'id: another');
  const magical = note.replace('barry-cards', 'magical-cards');
  const result = reorderCardsBlock(other + magical, source, ['films', 'books']);
  assert.ok(result.text.startsWith(other));
  assert.equal(cardsSourceBlocks(result.text).length, 2);
  assert.deepEqual(parseCardsEmbed(cardsSourceBlocks(result.text)[1].source).modules.map(module => module.id), ['films', 'books']);
});
