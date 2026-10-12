import assert from 'node:assert/strict';
import test from 'node:test';
import { getShowcaseRenderOperations } from '../src/showcase-render-state';
import type { CardsAPI } from '../src/types';

function library(service: object = {}) { return { showcase: service } as CardsAPI; }

test('failed import Files, stable IDs and expected order survive a new view and a different plugin API wrapper', () => {
  const api = library(), state = getShowcaseRenderOperations(api, 'gallery')!;
  const file = new File(['image'], 'photo.png', { type: 'image/png' });
  const move = { id: 'a', beforeId: 'c', expectedIds: ['a', 'b', 'c'] };
  state.update({ imports: [{ id: 'retry-id', file }], failures: [{ id: 'retry-id', error: '磁盘失败' }], move, moveError: '正文顺序已改变' });
  const hostApi = library(api.showcase!);
  const reopened = getShowcaseRenderOperations(hostApi, 'gallery')!;
  assert.equal(reopened, state);
  assert.equal(reopened.getSnapshot().imports[0].file, file);
  assert.equal(reopened.getSnapshot().imports[0].id, 'retry-id');
  assert.equal(reopened.getSnapshot().failures[0].error, '磁盘失败');
  assert.deepEqual(reopened.getSnapshot().move?.expectedIds, ['a', 'b', 'c']);
  assert.equal(reopened.getSnapshot().moveError, '正文顺序已改变');
  reopened.update({ move: null, moveError: '' });
  assert.equal(state.getSnapshot().move, null);
  assert.equal(state.getSnapshot().imports[0].id, 'retry-id');
});

test('operation subscriptions release on close without clearing retries; libraries and modules remain isolated', () => {
  const api = library(), state = getShowcaseRenderOperations(api, 'gallery')!;
  let updates = 0;
  const close = state.subscribe(() => { updates++; });
  state.update({ importing: true });
  close(); state.update({ importing: false, failures: [{ id: 'a', error: '保留' }] });
  assert.equal(updates, 1);
  assert.equal(getShowcaseRenderOperations(api, 'gallery')!.getSnapshot().failures[0].error, '保留');
  assert.deepEqual(getShowcaseRenderOperations(api, 'other')!.getSnapshot().failures, []);
  assert.deepEqual(getShowcaseRenderOperations(library(), 'gallery')!.getSnapshot().failures, []);
  assert.equal(getShowcaseRenderOperations({} as CardsAPI, 'gallery'), undefined);
});
