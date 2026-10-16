import test from 'node:test';
import assert from 'node:assert/strict';
import { cardBounds, mobileCardGeometry, type CardLayout } from '../src/layouts/geometry';
import { createCarouselRepeat } from '../src/carousel-repeat';
import { constrainPosition } from '../src/carousel-motion';

const layouts: CardLayout[] = ['cylinder', 'coverflow-carousel', 'album-rail', 'skewed-carousel', 'scroll-bend'];
test('mobile geometry fits all three full contours at every ratio, direction and phone size', () => {
  for (const width of [272, 320, 360, 390, 430, 844]) for (const viewportHeight of [320, 568, 844]) for (const ratio of ['1:1', '2:3', '3:4', '4:3', '16:9', '32:15']) for (const layout of layouts) for (const vertical of layout === 'scroll-bend' ? [false, true] : [false]) {
    const [w, h] = ratio.split(':').map(Number);
    const { geometry, height } = mobileCardGeometry(width, h / w, layout, vertical, viewportHeight);
    assert.ok(height <= Math.min(360, viewportHeight * 0.55));
    assert.ok(Math.abs(geometry.cardHeight / geometry.cardWidth - h / w) < 1e-9);
    for (const offset of [-1, 0, 1]) {
      const bounds = cardBounds(layout, offset, geometry, vertical);
      assert.ok(bounds.x <= width / 2 - 12, `${width} ${ratio} ${layout}: horizontal margin`);
      assert.ok(bounds.y <= height / 2 - 12, `${width} ${ratio} ${layout}: vertical margin`);
    }
  }
});

function clock() {
  let now = 0, id = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    setTimeout(run: () => void, delay: number) { timers.set(++id, { at: now + delay, run }); return id; },
    clearTimeout(key?: number) { if (key !== undefined) timers.delete(key); },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at; timers.delete(next[0]); next[1].run();
      }
      now = end;
    },
    get pending() { return timers.size; },
  };
}

test('tap advances once; hold starts at 400ms and repeats at 160ms without a release click', () => {
  const timer = clock(); let position = 0, settled = 0;
  const control = createCarouselRepeat(timer, () => { position++; return true; }, () => settled++);
  control.start(); timer.advance(399); assert.equal(position, 0);
  control.stop(); control.click(); assert.equal(position, 1);
  control.start(); timer.advance(400); assert.equal(position, 2);
  timer.advance(159); assert.equal(position, 2);
  timer.advance(1); assert.equal(position, 3);
  timer.advance(320); assert.equal(position, 5);
  control.stop(); control.click(); timer.advance(5000);
  assert.equal(position, 5); assert.equal(timer.pending, 0); assert.equal(settled, 2);
  control.start(); control.stop(); control.click(); assert.equal(position, 6);
});

test('cancel/leave/hidden/unmount share cleanup, suppress clicks and allow the next tap', () => {
  for (const duration of [50, 400, 1100]) {
    const timer = clock(); let position = 0;
    const control = createCarouselRepeat(timer, () => { position++; return true; }, () => {});
    control.start(); timer.advance(duration); const stopped = position;
    control.cancel(); control.click(); timer.advance(5000);
    assert.equal(position, stopped); assert.equal(timer.pending, 0);
    control.start(); control.stop(); control.click(); assert.equal(position, stopped + 1);
  }
});

test('two-card boundary stops its timer, while three-card navigation keeps cycling', () => {
  for (const count of [1, 2, 3, 6]) {
    const timer = clock(); let position = 0;
    const control = createCarouselRepeat(timer, () => {
      const next = constrainPosition(position + 1, count);
      if (next === position) return false;
      position = next; return true;
    }, () => {});
    control.start(); timer.advance(2000);
    assert.equal(position, count < 3 ? count - 1 : 11);
    assert.equal(timer.pending, count < 3 ? 0 : 1);
    control.cancel(); assert.equal(timer.pending, 0);
  }
});
