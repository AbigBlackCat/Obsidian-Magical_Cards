import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type WorkCarousel from '../src/WorkCarousel';
import type { WorkCarouselProps } from '../src/WorkCarousel';
import type { CardLayout } from '../src/types';

// Exercise real controls and retained component state without a DOM renderer dependency.
class Hooks {
  private cursor = 0;
  private slots: unknown[] = [];
  useState = (initial: unknown) => {
    const index = this.cursor++;
    if (!(index in this.slots)) this.slots[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
    return [this.slots[index], (value: unknown) => { this.slots[index] = typeof value === 'function' ? (value as (previous: unknown) => unknown)(this.slots[index]) : value; }];
  };
  useRef = (initial: unknown) => { const index = this.cursor++; return this.slots[index] ??= { current: initial }; };
  useLayoutEffect = () => { this.cursor++; };
  render(props: WorkCarouselProps<{ id: string; title: string }>) {
    activeHooks = this; this.cursor = 0;
    try { return Carousel(props); } finally { activeHooks = undefined; }
  }
}
let activeHooks: Hooks | undefined;
const proxy = { ...React, ...Object.fromEntries(['useState', 'useRef', 'useLayoutEffect'].map(name => [name, (...args: unknown[]) => {
  assert.ok(activeHooks);
  return Reflect.apply(Reflect.get(activeHooks, name), activeHooks, args);
}])) };
const require = createRequire(import.meta.url);
const bundled = await build({ entryPoints: [resolve(dirname(fileURLToPath(import.meta.url)), '../src/WorkCarousel.tsx')], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'] });
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)((name: string) => name === 'react' ? proxy : require(name), module, module.exports);
const Carousel = (module.exports as { default: typeof WorkCarousel }).default;
const nodes = (value: React.ReactNode): React.ReactElement<any>[] => {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement<{ children?: React.ReactNode }>(value)) return [];
  return [value, ...nodes(value.props.children)];
};
const layouts: CardLayout[] = ['cylinder', 'coverflow-carousel', 'album-rail', 'scroll-bend', 'skewed-carousel'];
const key = (name: string, composing = false) => {
  let prevented = false;
  return { key: name, nativeEvent: { isComposing: composing }, target: { closest: () => null }, currentTarget: { focus() {} }, preventDefault() { prevented = true; }, get prevented() { return prevented; } };
};

test('touch never tilts a cover and swiping the back does not capture the editor gesture', () => {
  const hooks = new Hooks();
  const props: WorkCarouselProps<{ id: string; title: string }> = {
    works: [{ id: 'first', title: '一' }, { id: 'second', title: '二' }], label: '卡片', appearance: { material: 'paper', style: 'cover', layout: 'cylinder' },
    renderWork: () => null, renderBack: () => null, empty: null,
  };
  const tree = nodes(hooks.render(props));
  tree.find(node => node.type === 'article')!.props.onPointerMove({ pointerType: 'touch', currentTarget: { getBoundingClientRect() { assert.fail('touch must not calculate hover tilt'); } } });
  const stage = tree.find(node => node.props.className === 'bw-paper-stage')!;
  stage.props.onPointerDown({ pointerType: 'touch', target: { closest: (selector: string) => selector.includes('.bw-card-back') ? {} : null }, button: 0, isPrimary: true, pointerId: 1, clientX: 0, clientY: 0 });
  stage.props.onPointerMove({ pointerId: 1, clientX: 0, clientY: 90, currentTarget: { setPointerCapture() { assert.fail('editing must not become a carousel swipe'); } } });
});

test('a transparent hotspot flips without opening the note, and its keyboard action preserves composition', () => {
  for (const layout of layouts) {
    const hooks = new Hooks(), opened: string[] = [];
    const props: WorkCarouselProps<{ id: string; title: string }> = {
      works: [{ id: 'first', title: '原名称' }], label: '卡片', appearance: { material: 'paper', style: 'cover', layout }, ratio: '32:15',
      renderWork: () => React.createElement('img', { src: 'image.svg', alt: '' }),
      renderBack: (_work, active, flip) => React.createElement('button', { 'data-back-active': active, onClick: flip }, '返回正面'),
      open: work => opened.push(work.id), empty: null,
    };
    const render = () => nodes(hooks.render(props));
    const hotspot = () => render().find(node => node.props.className === 'bw-card-flip bw-card-flip-hotspot')!;
    assert.equal(hotspot().props.children, undefined);
    const composing = key('f', true);
    hotspot().props.onKeyDown(composing);
    assert.equal(composing.prevented, false);
    assert.equal(render().find(node => node.type === 'article')!.props['data-flipped'], false);
    const flipKey = key('F');
    hotspot().props.onKeyDown(flipKey);
    assert.equal(flipKey.prevented, true);
    assert.equal(render().find(node => node.type === 'article')!.props['data-flipped'], true);
    assert.deepEqual(opened, []);
    render().find(node => node.props['data-back-active'])!.props.onClick();
    assert.equal(render().find(node => node.type === 'article')!.props['data-flipped'], false);
    hotspot().props.onClick();
    assert.equal(render().find(node => node.type === 'article')!.props['data-flipped'], true);
    render().find(node => node.props['data-back-active'])!.props.onClick();
    render().find(node => node.props.className === 'bw-paper-open')!.props.onClick();
    assert.deepEqual(opened, ['first']);
  }
});

test('stage shortcuts preserve note opening and gated previews never mount a back editor', () => {
  for (const layout of layouts) for (const canFlip of [true, false]) {
    const hooks = new Hooks(), opened: string[] = [];
    let backMounts = 0;
    const props: WorkCarouselProps<{ id: string; title: string }> = { works: [{ id: 'card', title: '' }], label: '卡片', appearance: { material: 'paper', style: 'cover', layout }, canFlip, renderWork: () => null, renderBack: () => { backMounts++; return null; }, open: work => opened.push(work.id), empty: null };
    const render = () => nodes(hooks.render(props));
    const stage = () => render().find(node => node.props.className === 'bw-paper-stage')!;
    stage().props.onKeyDown(key('f', true));
    assert.equal(backMounts, 0);
    stage().props.onKeyDown(key('f'));
    assert.equal(render().find(node => node.type === 'article')!.props['data-flipped'], canFlip);
    if (canFlip) stage().props.onKeyDown(key('Escape'));
    assert.equal(render().find(node => node.type === 'article')!.props['data-flipped'], false);
    stage().props.onKeyDown(key('Enter'));
    assert.deepEqual(opened, ['card']);
    if (!canFlip) {
      assert.equal(backMounts, 0);
      assert.equal(render().some(node => String(node.props.className).includes('bw-card-flip')), false);
    }
  }
});
