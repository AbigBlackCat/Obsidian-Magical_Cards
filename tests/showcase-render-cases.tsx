import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkCarousel, { carouselCardLabel } from '../src/WorkCarousel';
import ShowcaseCollection from '../src/ShowcaseCollection';
import ShowcaseEditor from '../src/ShowcaseEditor';
import SettingsCardPreview from '../src/SettingsCardPreview';
import CardsSurface, { mergeVisibleModuleOrder } from '../src/CardsSurface';
import { WorkPropertiesManager } from '../src/WorkPropertiesSessions';
import type { ShowcaseSession } from '../src/ShowcaseCardBack';
import { createWork } from '../src/domain';
import { DEFAULT_CARD_SETTINGS, type CardLayout, type CardsAPI, type CardsSnapshot, type CustomCardModule, type ShowcaseCard } from '../src/types';

const layouts: CardLayout[] = ['cylinder', 'coverflow-carousel', 'album-rail', 'scroll-bend', 'skewed-carousel'];
const card: ShowcaseCard = { id: 'image-only', image: 'photo.png', name: '私人名称', description: '仅背面描述' };
function fixture() {
  const module: CustomCardModule = { id: 'photos', title: '橱窗', kind: 'film', mode: 'showcase', showcaseNote: '橱窗/橱窗.md', appearance: { material: 'paper', style: 'cover', layout: 'skewed-carousel', flipEnabled: true, namePosition: 'back', threeCardView: false } };
  const snapshot: CardsSnapshot = { entities: [{ ...createWork('book'), id: 'book', title: '旧书籍' }], workOrder: null, settings: { ...DEFAULT_CARD_SETTINGS, customModules: [module], threeCardView: true, standaloneOrder: ['book', 'photos', 'film'] }, loading: false, error: '' };
  let writes = 0, reads = 0;
  const service = { read: async () => { reads++; return { moduleId: module.id, path: module.showcaseNote!, cards: [card], revision: 'r1' }; }, patchCard: async () => { writes++; return card; }, create: async () => { writes++; return 'new.md'; }, deleteCard: async () => { writes++; }, moveCard: async () => { writes++; }, importImages: async () => { writes++; return { imported: [], failed: [] }; } };
  const api = { getSnapshot: () => snapshot, subscribe: () => () => {}, coverUrl: (image: string) => image, saveSettings: async () => { writes++; }, showcase: service } as unknown as CardsAPI;
  return { module, snapshot, api, service, reads: () => reads, writes: () => writes };
}

test('minimal image cards browse all five layouts with every flip entry and back mount disabled', () => {
  let backs = 0;
  for (const layout of layouts) {
    const html = renderToStaticMarkup(<WorkCarousel works={[{ id: 'minimal' }]} label="图片" appearance={{ layout, material: 'paper', style: 'cover' }} canFlip={false} renderWork={() => <img src="local.png" alt="" />} renderBack={() => { backs++; return <p>禁止挂载</p>; }} empty="空" />);
    assert.match(html, /data-flip-enabled="false"/);
    assert.match(html, /aria-label="图片 1"/);
    assert.doesNotMatch(html, /bw-card-back|bw-card-flip|翻到背面|编辑摘要|打开笔记/);
  }
  assert.equal(backs, 0);
  assert.equal(carouselCardLabel({ id: 'unnamed', title: '  ' }, 4), '图片 5');
});

test('flip settings and explicit front text also gate the scroll-bend current toolbar', () => {
  const html = renderToStaticMarkup(<WorkCarousel works={[{ id: card.id, title: card.name, summary: card.description }]} label="图片" appearance={{ material: 'paper', style: 'cover', layout: 'scroll-bend', flipEnabled: false }} renderWork={() => <img src="local.png" alt="" />} renderBack={() => <p>背面</p>} getFrontText={() => ({ title: '', summary: '' })} empty="空" />);
  assert.doesNotMatch(html, /<strong>|<p>|bw-card-back|编辑摘要|翻到背面/);
  assert.match(html, /bw-scroll-bend-current/);
});

test('scroll-bend keeps the normal summary action and names showcase description editing explicitly', () => {
  const render = (backActionLabel?: string) => renderToStaticMarkup(<WorkCarousel works={[{ id: 'a' }]} label="图片" appearance={{ material: 'paper', style: 'cover', layout: 'scroll-bend' }} backActionLabel={backActionLabel} renderWork={() => <img src="local.png" alt="" />} renderBack={() => <p>背面</p>} empty="空" />);
  assert.match(render(), />编辑摘要<\/button>/);
  assert.match(render('编辑描述'), />编辑描述<\/button>/);
  assert.doesNotMatch(render('编辑描述'), /编辑摘要/);
});

test('showcase previews respect front/back/hidden names and module three-card overrides without sessions or writes', () => {
  for (const namePosition of ['front', 'back', 'hidden'] as const) for (const layout of layouts) {
    const f = fixture();
    const html = renderToStaticMarkup(<ShowcaseCollection module={f.module} api={f.api} appearance={{ ...f.module.appearance, layout, namePosition }} threeCardView previewOnly previewCards={[card]} previewPath="橱窗/橱窗.md" />);
    assert.match(html, /data-three-card-view="false"/);
    assert.match(html, /data-flip-enabled="false"/);
    assert.doesNotMatch(html, /bw-card-back|<textarea|type="file"|编辑当前图片|批量添加图片|编辑模块笔记|编辑摘要/);
    if (namePosition === 'front') assert.match(html, /<h3>私人名称<\/h3>/);
    else assert.doesNotMatch(html, /<h3>|<strong>私人名称<\/strong>/);
    assert.doesNotMatch(html, /仅背面描述/);
    assert.equal(f.reads(), 0); assert.equal(f.writes(), 0); assert.equal(Object.getOwnPropertySymbols(f.service).length, 0);
  }
});

test('saved book/film settings previews cannot mount editing sessions or expose write controls', () => {
  const f = fixture(), manager = new WorkPropertiesManager(f.api);
  manager.getSession = () => { throw new Error('Preview must not request a session'); };
  try {
    const html = renderToStaticMarkup(<SettingsCardPreview api={f.api} manager={manager} draft={{ id: 'book', title: '阅读', appearance: { material: 'paper', style: 'cover', layout: 'scroll-bend' } }} rename={() => { throw new Error('Preview must not rename'); }} />);
    assert.match(html, /翻面、添加图片及编辑资料或描述，请前往 Magical Cards 标签页/);
    assert.doesNotMatch(html, /bw-card-back|翻到背面|编辑摘要|添加书籍|删除当前书籍|<textarea/);
    assert.match(html, /data-flip-enabled="false"/); assert.equal(f.writes(), 0);
  } finally { manager.dispose(); }
});

test('legacy hidden modules disappear standalone but retain embedded identity and restore control', () => {
  const f = fixture(), manager = new WorkPropertiesManager(f.api);
  f.snapshot.settings.hiddenModuleIds = ['book', 'photos'];
  try {
    const standalone = renderToStaticMarkup(<CardsSurface api={f.api} manager={manager} />);
    assert.doesNotMatch(standalone, /data-cards-module="book"|data-cards-module="photos"/);
    const embed = renderToStaticMarkup(<CardsSurface api={f.api} manager={manager} embed={{ id: 'embed', modules: [{ id: 'kept', collection: 'photos', layout: 'album-rail' }] }} />);
    assert.match(embed, /data-cards-module="kept"/); assert.match(embed, /此模块已按旧版规则隐藏/); assert.match(embed, />恢复模块<\/button>/);
    assert.doesNotMatch(embed, /data-module-mode="showcase"|集合未找到/); assert.equal(f.writes(), 0);
  } finally { manager.dispose(); }
  assert.deepEqual(mergeVisibleModuleOrder(['book', 'hidden1', 'film', 'hidden2', 'photos'], ['photos', 'book', 'film']), ['photos', 'hidden1', 'book', 'hidden2', 'film']);
  assert.throws(() => mergeVisibleModuleOrder(['book', 'film'], ['book', 'book']), /顺序已改变/);
});

test('name and description editors use the same retained session and render content as text', () => {
  const session = { getSnapshot: () => ({ card, path: '橱窗.md', name: '<script>名称</script>', description: '<img src=x onerror=alert(1)>', loading: false, saving: false, dirty: true, error: '保留草稿' }), subscribe: () => () => {}, updateName() {}, update() {}, startComposition() {}, endComposition() {}, flush: async () => {}, reload: async () => {} } as unknown as ShowcaseSession;
  const html = renderToStaticMarkup(<ShowcaseEditor session={session} label="图片 1" close={() => {}} />);
  assert.match(html, /maxlength="180"/i); assert.match(html, /maxlength="400"/i);
  assert.match(html, /&lt;script&gt;名称&lt;\/script&gt;/); assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /保留草稿/); assert.doesNotMatch(html, /<script>|<img src=x/);
});
