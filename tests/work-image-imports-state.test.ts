import assert from 'node:assert/strict';
import test from 'node:test';
import type { CardsAPI, WorkImageImport } from '../src/types';
import { getWorkImageImports, hasPendingWorkImageImports } from '../src/work-image-imports';
import { assertCardModuleOperationsSettled, assertCardModuleRemovalSettled } from '../src/CardsSurface';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkImageImportRecovery from '../src/WorkImageImportRecovery';

test('normal import partial retries retain File identity across view/API wrappers and never resend successful IDs', async () => {
  const calls: WorkImageImport[][] = [];
  const importWorkImages: NonNullable<CardsAPI['importWorkImages']> = async (_collection, images) => {
    calls.push([...images]);
    return calls.length === 1 ? { imported: [images[0].id], failed: [{ id: images[1].id, error: '磁盘暂不可写' }] } : { imported: images.map(item => item.id), failed: [] };
  };
  const api = { importWorkImages } as CardsAPI, operations = getWorkImageImports(api, 'book')!;
  const files = [new File(['a'], 'one.png'), new File(['b'], 'two.svg')];
  operations.add(files); const ids = operations.getSnapshot().imports.map(item => item.id);
  assert.equal(hasPendingWorkImageImports(api), true);
  await operations.retry();
  const reopened = getWorkImageImports({ importWorkImages } as CardsAPI, 'book')!;
  assert.equal(reopened, operations); assert.equal(reopened.getSnapshot().imports[0].file, files[1]);
  assert.equal(reopened.getSnapshot().imports[0].id, ids[1]);
  await reopened.retry();
  assert.deepEqual(calls.map(batch => batch.map(item => item.id)), [ids, [ids[1]]]);
  assert.equal(hasPendingWorkImageImports(api), false);
});

test('in-flight normal import is shared, refuses discard/add, and retains ambiguous acknowledgements', async () => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  const api = { importWorkImages: async () => { calls++; await pending; return { imported: [], failed: [] }; } } as unknown as CardsAPI;
  const operations = getWorkImageImports(api, 'film')!;
  operations.add([new File(['a'], 'cover.jpg')]); const saved = operations.getSnapshot().imports[0];
  const first = operations.retry(); await operations.retry();
  assert.equal(calls, 1); assert.throws(() => operations.discard(), /正在导入/); assert.throws(() => operations.add([]), /正在导入/);
  release(); await first;
  assert.equal(operations.getSnapshot().imports[0], saved); assert.match(operations.getSnapshot().failures[0].error, /未确认/);
  operations.discard(); assert.equal(hasPendingWorkImageImports(api), false);
});

test('normal import failures keep retries, subscriptions clean up, and modules/libraries stay isolated', async () => {
  const api = { importWorkImages: async () => { throw new Error('写入失败'); } } as unknown as CardsAPI;
  const state = getWorkImageImports(api, 'custom')!;
  let notifications = 0; const close = state.subscribe(() => { notifications++; });
  state.add([new File(['image'], 'game.png')]); close(); await state.retry();
  assert.equal(notifications, 1); assert.match(state.getSnapshot().failures[0].error, /写入失败/);
  assert.equal(hasPendingWorkImageImports(api), true); assert.equal(getWorkImageImports(api, 'book')!.getSnapshot().imports.length, 0);
  assert.equal(hasPendingWorkImageImports({ importWorkImages: async () => ({ imported: [], failed: [] }) } as unknown as CardsAPI), false);
  assert.equal(getWorkImageImports({} as CardsAPI, 'book'), undefined);
});

test('unmounted normal import retry drafts protect Dashboard switching and module deletion until explicitly discarded', async () => {
  const api = { getSnapshot: () => ({ settings: { customModules: [] } }), importWorkImages: async () => { throw new Error('等待重试'); } } as unknown as CardsAPI;
  const state = getWorkImageImports(api, 'book')!;
  state.add([new File(['a'], 'book.svg')]); await state.retry();
  assert.throws(() => assertCardModuleOperationsSettled(api), /图片导入尚未完成/);
  assert.throws(() => assertCardModuleRemovalSettled(api), /图片导入尚未完成/);
  state.discard(); assert.doesNotThrow(() => assertCardModuleOperationsSettled(api)); assert.doesNotThrow(() => assertCardModuleRemovalSettled(api));
});

test('orphaned retries remain explicitly discardable after external module deletion or zero Dashboards', async () => {
  const settings = { customModules: [{ id: 'games', title: '游戏', kind: 'film', appearance: { material: 'paper', style: 'cover' } }], deletedModuleIds: [] as string[] };
  const api = { getSnapshot: () => ({ settings }), subscribe: () => () => {}, importWorkImages: async () => { throw new Error('模块改变'); } } as unknown as CardsAPI;
  const operations = getWorkImageImports(api, 'games')!; operations.add([new File(['a'], '横图.png')]); await operations.retry();
  const render = (visibleCollectionIds: string[] = []) => renderToStaticMarkup(React.createElement(WorkImageImportRecovery, { api, visibleCollectionIds }));
  assert.equal(render(['games']), '');
  assert.match(render(), /重试未完成图片/);
  settings.deletedModuleIds.push('games');
  const orphan = render(['games']); assert.match(orphan, /模块已删除或改变类型/); assert.match(orphan, /放弃未完成导入/); assert.doesNotMatch(orphan, /重试未完成图片/);
  assert.equal(operations.getSnapshot().imports.length, 1); operations.discard(); assert.equal(render(), '');
  assert.equal(hasPendingWorkImageImports(api), false);
});
