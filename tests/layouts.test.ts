import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkCarousel from '../src/WorkCarousel';
import { createWork } from '../src/domain';
import { carouselIndex, carouselLimit, carouselOffset, carouselOpacity, carouselSlots, constrainPosition } from '../src/carousel-motion';
import { bendForSpeed, cardGeometry, cardTransform } from '../src/layouts/geometry';
import { createScrollBend } from '../src/layouts/scroll-bend';
import type { CardLayout, CardRatio } from '../src/types';

const layouts: CardLayout[] = ['cylinder', 'coverflow-carousel', 'album-rail', 'scroll-bend', 'skewed-carousel'];

test('all layouts keep card ratios, fit, material, note activation and summary flip entry', () => {
  const work = { ...createWork('film'), title: '<当前笔记>', summary: '真实摘要', cover: '附件/封面.png' };
  for (const layout of layouts) for (const ratio of ['1:1', '4:3', '3:4', '2:3', '16:9'] as CardRatio[]) for (const imageFit of ['contain', 'cover'] as const) {
    const html = renderToStaticMarkup(createElement(WorkCarousel, { works: [work], label: '卡片', appearance: { layout, material: 'foil', style: 'cover', orientation: 'vertical' }, ratio, imageFit, threeCardView: true, renderWork: item => createElement('h3', {}, item.title), renderBack: () => null, open: () => {}, empty: '空模块' }));
    assert.match(html, new RegExp(`data-layout="${layout}"`));
    assert.match(html, new RegExp(`data-ratio="${ratio}"`));
    assert.match(html, new RegExp(`data-image-fit="${imageFit}"`));
    assert.match(html, /data-material="foil" data-card-style="cover"|data-material="foil"/);
    assert.match(html, /data-three-card-view="true"/);
    assert.match(html, /class="bw-paper-open" tabindex="0" aria-label="打开笔记：&lt;当前笔记&gt;"/);
    assert.match(html, /aria-label="翻到背面：&lt;当前笔记&gt;"/);
    assert.match(html, /class="bw-card-face bw-card-back" inert="" aria-hidden="true"/);
    assert.doesNotMatch(html, /播放|唱片|vinyl|album-rail-play|<script/);
    if (layout === 'scroll-bend') {
      assert.match(html, /data-orientation="vertical"/);
      assert.match(html, /class="bw-scroll-bend-canvas" aria-hidden="true"/);
      assert.match(html, />打开笔记<\/button>/);
      assert.match(html, />编辑摘要<\/button>/);
    }
  }
});

test('empty layouts remain empty and legacy settings keep the cylinder default', () => {
  const props = { label: '卡片', appearance: { material: 'paper', style: 'minimal' } as const, renderWork: () => null, renderBack: () => null, open: () => {}, empty: createElement('p', {}, '添加第一张卡片') };
  for (const layout of layouts) assert.equal(renderToStaticMarkup(createElement(WorkCarousel, { ...props, appearance: { ...props.appearance, layout }, works: [] })), '<p>添加第一张卡片</p>');
  const html = renderToStaticMarkup(createElement(WorkCarousel, { ...props, works: [createWork('film')] }));
  assert.match(html, /data-layout="cylinder"/);
  assert.match(html, /data-ratio="2:3"/);
  assert.doesNotMatch(html, /data-image-fit|<canvas/);
});

test('registry layouts have distinct symmetric geometry and respect every ratio at narrow widths', () => {
  for (const layout of layouts) for (const width of [20, 320, 1000, 1440]) for (const factor of [1, 3 / 4, 4 / 3, 3 / 2, 9 / 16]) {
    const geometry = cardGeometry(width, factor, layout);
    assert.ok(geometry.cardWidth > 0);
    assert.ok(Math.abs(geometry.cardHeight / geometry.cardWidth - factor) < 1e-12);
    const centered = cardTransform(layout, 0, geometry);
    for (const [key, value] of Object.entries(centered)) assert.ok(Math.abs(value - (key === 'scale' ? 1 : 0)) < 1e-12);
    const left = cardTransform(layout, -1, geometry), right = cardTransform(layout, 1, geometry);
    assert.ok(Math.abs(left.x + right.x) < 1e-12); assert.ok(Math.abs(left.rotateY + right.rotateY) < 1e-12); assert.ok(Math.abs(left.rotateZ + right.rotateZ) < 1e-12);
    assert.equal(left.z, right.z); assert.equal(left.y, right.y); assert.equal(left.scale, right.scale);
    for (const value of Object.values(left)) assert.ok(Number.isFinite(value));
  }
  const geometry = cardGeometry(1000, 1.5, 'coverflow-carousel');
  assert.equal(cardTransform('coverflow-carousel', 1, geometry).rotateY, -44);
  assert.equal(cardTransform('coverflow-carousel', 1, geometry).z, -180);
  assert.equal(cardTransform('album-rail', 1, geometry).rotateZ, 6);
  assert.equal(cardTransform('skewed-carousel', 1, geometry).rotateY, -60);
  const vertical = cardGeometry(600, 1.5, 'scroll-bend', true), horizontal = cardGeometry(600, 1.5, 'scroll-bend');
  assert.equal(cardTransform('scroll-bend', 1, vertical, true).x, 0);
  assert.equal(cardTransform('scroll-bend', 1, vertical, true).y, vertical.cardHeight + 16);
  assert.equal(cardTransform('scroll-bend', 1, horizontal).x, horizontal.cardWidth + 16);
});

test('the DOM and WebGL share a limit that never shows a fourth card across loops', () => {
  for (const count of [1, 2, 3, 4, 7, 120]) for (const sides of [1, 2]) for (let step = -200; step < 200; step++) {
    const position = constrainPosition(count * 1_000 + step / 100, count);
    const visible = carouselSlots(position, count).filter(index => carouselOpacity(carouselOffset(index, position, count), count, sides, true) > 0);
    assert.ok(visible.length <= Math.min(3, count));
    assert.ok(visible.includes(carouselIndex(position, count)));
    assert.ok(carouselLimit(count, sides, true) <= 1.7);
  }
  assert.equal(bendForSpeed(0), 0);
  assert.equal(bendForSpeed(NaN), 0);
  assert.equal(bendForSpeed(-950), -bendForSpeed(950));
  assert.ok(bendForSpeed(950) > bendForSpeed(200));
  assert.ok(bendForSpeed(1e20) <= 0.38);
});

function gpuFixture(failure?: 'shader' | 'allocation' | 'texture' | 'unavailable') {
  const created = { shader: 0, program: 0, buffer: 0, texture: 0 }, deleted = { ...created };
  const values = new Map<string, number>();
  const texts: string[] = [];
  let imageDraws = 0;
  const context = { save() {}, restore() {}, translate() {}, beginPath() {}, rect() {}, clip() {}, fillRect() {}, drawImage() { imageDraws++; }, fillText(value: string) { texts.push(value); }, measureText(value: string) { return { width: value.length }; }, createLinearGradient() { return { addColorStop() {} }; } };
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TEXTURE_2D: 8, TEXTURE_MIN_FILTER: 9, TEXTURE_MAG_FILTER: 10, LINEAR: 11, TEXTURE_WRAP_S: 12, TEXTURE_WRAP_T: 13, CLAMP_TO_EDGE: 14, MAX_TEXTURE_SIZE: 15, RGBA: 16, UNSIGNED_BYTE: 17, TRIANGLES: 18,
    createShader() { created.shader++; return {}; }, createProgram() { created.program++; return {}; }, createBuffer() { created.buffer++; return {}; }, createTexture() { if (failure === 'allocation') return null; created.texture++; return {}; },
    deleteShader() { deleted.shader++; }, deleteProgram() { deleted.program++; }, deleteBuffer() { deleted.buffer++; }, deleteTexture() { deleted.texture++; },
    shaderSource() {}, compileShader() {}, getShaderParameter() { return failure !== 'shader'; }, attachShader() {}, linkProgram() {}, getProgramParameter() { return true; }, useProgram() {}, bindBuffer() {}, bufferData() {}, getAttribLocation() { return 0; }, enableVertexAttribArray() {}, vertexAttribPointer() {}, bindTexture() {}, texParameteri() {},
    getParameter() { return 512; }, texImage2D() { if (failure === 'texture') throw new Error('Blocked texture'); }, viewport() {}, uniform2f() {}, drawArrays() {},
    getUniformLocation(_program: unknown, name: string) { return name; }, uniform1f(name: string, value: number) { values.set(name, value); },
  };
  const surface = new EventTarget() as EventTarget & { getContext(): typeof gl | null; ownerDocument: unknown; clientHeight: number; width: number; height: number };
  Object.assign(surface, { width: 1, height: 1, clientHeight: 520, cloneNode: () => ({ width: 0, height: 0, getContext: () => context }), getContext: () => failure === 'unavailable' ? null : gl, ownerDocument: { defaultView: { devicePixelRatio: 1, getComputedStyle: (node: Element) => getComputedStyle(node) }, createElement: () => ({ width: 0, height: 0, getContext: () => context }) } });
  const modes: string[] = [];
  let wakes = 0;
  const renderer = createScrollBend(surface as unknown as HTMLCanvasElement, mode => modes.push(mode), () => wakes++);
  return { surface, renderer, created, deleted, values, modes, texts, imageDraws: () => imageDraws, wakes: () => wakes };
}

test('WebGL resources are released on context loss, restoration and unmount', () => {
  const fixture = gpuFixture();
  assert.equal(fixture.renderer.mode, 'webgl');
  assert.equal(fixture.deleted.shader, 2);
  const loss = new Event('webglcontextlost', { cancelable: true });
  fixture.surface.dispatchEvent(loss);
  assert.equal(loss.defaultPrevented, true);
  assert.equal(fixture.renderer.mode, 'fallback');
  assert.equal(fixture.deleted.texture, 1); assert.equal(fixture.deleted.program, 1); assert.equal(fixture.deleted.buffer, 1);
  fixture.surface.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(fixture.renderer.mode, 'webgl');
  fixture.renderer.dispose(); fixture.renderer.dispose();
  assert.deepEqual(fixture.deleted, fixture.created);
  const wakes = fixture.wakes();
  fixture.surface.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(fixture.wakes(), wakes);
  assert.deepEqual(fixture.deleted, fixture.created);
});

test('shader/allocation failures clean up partial allocations and leave DOM fallback available', () => {
  for (const failure of ['shader', 'allocation', 'unavailable'] as const) {
    const fixture = gpuFixture(failure);
    assert.equal(fixture.renderer.mode, 'fallback');
    assert.deepEqual(fixture.deleted, fixture.created);
    fixture.renderer.dispose();
  }
});

test('WebGL honors both orientations, three-card clipping and reduced motion, and stops bending at rest', () => {
  const fixture = gpuFixture(), geometry = cardGeometry(800, 1.5, 'scroll-bend');
  const frame = { geometry, position: 0, anchor: 0, vertical: true, limit: carouselLimit(120, 2, true), reduced: false, tiles: Array(7).fill(null) };
  fixture.renderer.draw(frame, 16);
  assert.equal(fixture.values.get('uVertical'), 1); assert.equal(fixture.values.get('uLimit'), 1.5);
  assert.equal(fixture.values.get('uPosition'), 3 * geometry.pitch);
  frame.position = 0.5;
  assert.equal(fixture.renderer.draw(frame, 32), true);
  assert.ok(fixture.values.get('uBend')! > 0);
  let moving = true;
  for (let tick = 3; tick < 240; tick++) moving = fixture.renderer.draw(frame, tick * 16);
  assert.equal(moving, false);
  frame.vertical = false; frame.reduced = true; frame.position = 1;
  fixture.renderer.draw(frame, 4000);
  assert.equal(fixture.values.get('uVertical'), 0); assert.equal(fixture.values.get('uBend'), 0);
  fixture.renderer.dispose();
  assert.deepEqual(fixture.deleted, fixture.created);
});

test('an image texture security failure returns to DOM cards and frees the GPU allocations', () => {
  const fixture = gpuFixture('texture');
  assert.equal(fixture.renderer.draw({ geometry: cardGeometry(800, 1.5, 'scroll-bend'), position: 0, anchor: 0, vertical: false, limit: 1.5, reduced: false, tiles: Array(7).fill(null) }, 16), false);
  assert.equal(fixture.renderer.mode, 'fallback');
  assert.deepEqual(fixture.deleted, fixture.created);
  fixture.renderer.dispose();
});

test('the atlas uses the resolved DOM image and text and removes image listeners on unmount', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
  Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: () => ({ objectFit: 'contain', fontSize: '22px', lineHeight: '29px', textAlign: 'center', paddingLeft: '23px', paddingTop: '19px', webkitLineClamp: '2', getPropertyValue: (key: string) => key === '--bw-card-surface' ? '#192329' : '#f5f3ec' }) });
  const image = Object.assign(new EventTarget(), { complete: false, naturalWidth: 0, naturalHeight: 0, src: 'app://local/附件/本地.png', currentSrc: 'app://local/附件/本地.png' });
  const heading = { textContent: '真实 DOM 标题', getAttribute: () => 'text-align: center;' }, paragraph = { textContent: '真实 DOM 摘要', getAttribute: () => 'text-align: right;' };
  const copy = { querySelector: (selector: string) => selector === 'h3' ? heading : selector === 'p' ? paragraph : { textContent: '作者与年份' } };
  const node = { textContent: '真实 DOM 标题真实 DOM 摘要作者与年份', querySelector: (selector: string) => selector === '.bw-card-front img' ? image : selector === '.bw-paper-image' ? { offsetHeight: 261 } : selector === '.bw-paper-copy' ? copy : selector.endsWith('h3') ? heading : paragraph, closest: (selector: string) => ({ getAttribute: () => selector === '[data-material]' ? 'foil' : 'minimal' }) };
  const fixture = gpuFixture();
  const frame = { geometry: cardGeometry(800, 1.5, 'scroll-bend'), position: 0, anchor: 0, vertical: false, limit: 1.5, reduced: false, tiles: [null, null, null, { id: 'note', title: '原实体标题', summary: '原实体摘要', node: node as unknown as HTMLElement }, null, null, null] };
  try {
    fixture.renderer.draw(frame, 16);
    assert.equal(fixture.renderer.mode, 'webgl');
    assert.ok(fixture.texts.includes('真实 DOM 标题')); assert.ok(fixture.texts.includes('真实 DOM 摘要')); assert.ok(fixture.texts.includes('作者与年份'));
    const wakes = fixture.wakes();
    image.complete = true; image.naturalWidth = 320; image.naturalHeight = 480; image.dispatchEvent(new Event('load'));
    assert.equal(fixture.wakes(), wakes + 1);
    fixture.renderer.draw(frame, 32);
    assert.equal(fixture.imageDraws(), 1);
    fixture.renderer.dispose();
    const disposedWakes = fixture.wakes();
    image.dispatchEvent(new Event('load'));
    assert.equal(fixture.wakes(), disposedWakes);
    assert.deepEqual(fixture.deleted, fixture.created);
  } finally {
    fixture.renderer.dispose();
    if (descriptor) Object.defineProperty(globalThis, 'getComputedStyle', descriptor); else Reflect.deleteProperty(globalThis, 'getComputedStyle');
  }
});

test('removing front text rebuilds the WebGL atlas without hidden name or description fallbacks', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
  Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: () => ({ objectFit: 'cover', getPropertyValue: () => '#eee' }) });
  const image = Object.assign(new EventTarget(), { complete: true, naturalWidth: 300, naturalHeight: 450, src: 'app://photo.png', currentSrc: 'app://photo.png' });
  const node = { textContent: '', querySelector: (selector: string) => selector === '.bw-card-front img' ? image : selector === '.bw-paper-image' ? { offsetHeight: 450 } : null, closest: () => ({ getAttribute: () => 'cover' }) };
  const fixture = gpuFixture();
  const tile = { id: 'image', title: '正面名称', summary: '正面描述', node: node as unknown as HTMLElement };
  const frame = { geometry: cardGeometry(800, 1.5, 'scroll-bend'), position: 0, anchor: 0, vertical: false, limit: 1.5, reduced: false, tiles: [tile] };
  try {
    fixture.renderer.draw(frame, 16);
    assert.ok(fixture.texts.includes('正面名称')); assert.ok(fixture.texts.includes('正面描述'));
    fixture.texts.length = 0;
    tile.title = ''; tile.summary = '';
    fixture.renderer.draw(frame, 32);
    assert.deepEqual(fixture.texts, []);
    assert.equal(fixture.imageDraws(), 2); assert.equal(fixture.renderer.mode, 'webgl');
  } finally {
    fixture.renderer.dispose();
    if (descriptor) Object.defineProperty(globalThis, 'getComputedStyle', descriptor); else Reflect.deleteProperty(globalThis, 'getComputedStyle');
  }
});
