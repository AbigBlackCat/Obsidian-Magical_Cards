import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceCarousel, carouselIndex, carouselOffset, carouselOpacity, carouselSlots, constrainPosition, type CarouselMotion } from '../src/carousel-motion';

test('large collections wrap indices and keep continuous positions across many rotations', () => {
  const position = 124 * 1_000_000_000 + 123.75;
  assert.equal(constrainPosition(position, 124), position);
  assert.equal(carouselIndex(position, 124), 0);
  assert.equal(carouselOffset(0, position, 124), 0.25);
  assert.equal(carouselOffset(123, position, 124), -0.75);
  assert.equal(carouselIndex(-124 * 1_000_000_000 - 0.75, 124), 123);
  assert.equal(carouselOffset(123, -0.75, 124), -0.25);
  assert.equal(carouselOffset(0, 123.75, 124), 0.25);
});

test('empty and single collections stay centered; two works do not wrap', () => {
  for (const count of [0, 1]) {
    for (const position of [-10, 0, 0.5, 10]) {
      assert.equal(carouselIndex(position, count), 0);
      assert.equal(constrainPosition(position, count), 0);
    }
    assert.deepEqual(carouselSlots(100, count), count === 0 ? [] : [0]);
  }
  assert.equal(constrainPosition(-10, 2), 0);
  assert.equal(constrainPosition(10, 2), 1);
  assert.equal(constrainPosition(0.4, 2), 0.4);
  assert.equal(carouselIndex(0.49, 2), 0);
  assert.equal(carouselIndex(0.5, 2), 1);
  assert.equal(carouselIndex(10, 2), 1);
  assert.equal(carouselOffset(0, 0.75, 2), -0.75);
  assert.equal(carouselOffset(1, 0.75, 2), 0.25);
  assert.deepEqual(carouselSlots(0.75, 2), [0, 1]);
});

test('render slots form a bounded unique neighborhood even at a wrap boundary', () => {
  for (const count of [3, 4, 5, 6, 7, 8, 124]) {
    for (const position of [-124.2, -0.6, 0, 0.51, 123.9, 10_000]) {
      const slots = carouselSlots(position, count);
      assert.equal(slots.length, Math.min(7, count));
      assert.equal(new Set(slots).size, slots.length);
      assert.ok(slots.includes(carouselIndex(position, count)));
      assert.ok(slots.every(index => index >= 0 && index < count));
      assert.ok(slots.every(index => Math.abs(carouselOffset(index, position, count)) <= 3.5));
    }
  }
});

test('three-card view never reveals a fourth card during dragging, wrapping or settling', () => {
  for (const count of [0, 1, 2, 3, 4, 7, 120]) {
    for (const sides of [1, 2]) {
      for (const direction of [-1, 1]) {
        for (let tick = -200; tick <= 200; tick++) {
          const position = constrainPosition(direction * count * 1_000 + tick / 100, count);
          const shown = carouselSlots(position, count).filter(index => carouselOpacity(carouselOffset(index, position, count), count, sides, true) > 0);
          assert.ok(shown.length <= Math.min(3, count), `count ${count}, sides ${sides}, position ${position}: ${shown.length} cards`);
          assert.equal(new Set(shown).size, shown.length);
          if (count > 0) assert.ok(shown.includes(carouselIndex(position, count)));
        }
      }
    }
    const centered = carouselSlots(0, count).filter(index => carouselOpacity(carouselOffset(index, 0, count), count, 2, true) > 0);
    assert.equal(centered.length, Math.min(3, count));
  }
});

test('three-card view fades the replacement side smoothly and preserves automatic geometry', () => {
  assert.equal(carouselOpacity(1, 120, 2, true), 1);
  assert.equal(carouselOpacity(1.3, 120, 2, true), (1.5 - 1.3) / 0.4);
  assert.equal(carouselOpacity(1.5, 120, 2, true), 0);
  assert.equal(carouselOpacity(-1.5, 120, 2, true), 0);
  assert.equal(carouselOpacity(2, 120, 2, true), 0);
  assert.equal(carouselOpacity(2, 120, 2), 1);
  assert.equal(carouselOpacity(2, 120, 1), 0);
  assert.ok(carouselOpacity(1.49, 120, 2, true) < 0.026);
  assert.ok(carouselOpacity(-1.49, 120, 2, true) < 0.026);
});

test('spring targets can be interrupted repeatedly without resetting position or velocity', () => {
  const state: CarouselMotion = { position: 0, velocity: 4, target: 3 };
  for (let frame = 0; frame < 6; frame++) assert.equal(advanceCarousel(state, 1 / 60), true);
  const forwardPosition = state.position;
  const forwardVelocity = state.velocity;
  state.target = 5;
  assert.equal(state.position, forwardPosition);
  assert.equal(state.velocity, forwardVelocity);
  assert.equal(advanceCarousel(state, 1 / 60), true);
  assert.ok(state.position > forwardPosition);
  const reversePosition = state.position;
  state.target = -2;
  assert.equal(state.position, reversePosition);
  for (let frame = 0; frame < 15; frame++) advanceCarousel(state, 1 / 60);
  assert.ok(state.position < reversePosition);
  for (let frame = 0; frame < 120 && state.target !== null; frame++) advanceCarousel(state, 1 / 60);
  assert.deepEqual(state, { position: -2, velocity: 0, target: null });
});

test('spring settles exactly at different frame rates and performs no idle motion', () => {
  for (const fps of [30, 60, 120]) {
    for (const velocity of [-8, 0, 8]) {
      const state: CarouselMotion = { position: 123.6, velocity, target: 124 };
      let frames = 0;
      while (advanceCarousel(state, 1 / fps) && frames < fps * 2) frames++;
      assert.ok(frames < fps * 2);
      assert.deepEqual(state, { position: 124, velocity: 0, target: null });
      for (let idle = 0; idle < 120; idle++) assert.equal(advanceCarousel(state, 1 / fps), false);
      assert.deepEqual(state, { position: 124, velocity: 0, target: null });
    }
  }
});

test('a delayed animation frame is capped and zero elapsed time does not advance it', () => {
  const delayed: CarouselMotion = { position: 0, velocity: 2, target: 4 };
  const normal = { ...delayed };
  assert.equal(advanceCarousel(delayed, 10), true);
  assert.equal(advanceCarousel(normal, 0.05), true);
  assert.deepEqual(delayed, normal);
  const paused = { ...normal };
  assert.equal(advanceCarousel(paused, 0), true);
  assert.deepEqual(paused, normal);
});
