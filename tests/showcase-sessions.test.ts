import test from 'node:test';
import assert from 'node:assert/strict';
import { getShowcaseManager, releaseShowcaseManager } from '../src/showcase-sessions';
import type { CardsAPI, ShowcaseAPI, ShowcaseCard } from '../src/types';

function fixture() {
  let card: ShowcaseCard = { id: 'a', image: '图片-a.png', name: '旧名称', description: '旧描述' };
  const listeners = new Set<() => void>(), writes: Array<Partial<Pick<ShowcaseCard, 'name' | 'description'>>> = [], timers = new Map<number, () => void>();
  let timerId = 0, fail = '', intercept: (() => Promise<void>) | undefined;
  const window = { setTimeout(callback: () => void, delay: number) { assert.equal(delay, 500); timers.set(++timerId, callback); return timerId; }, clearTimeout(id: number) { timers.delete(id); } } as unknown as Window;
  const service: ShowcaseAPI = {
    create: async () => '橱窗.md', read: async () => ({ moduleId: 'photos', path: '橱窗.md', cards: [{ ...card }], revision: 'revision' }),
    importImages: async () => ({ imported: [], failed: [] }), deleteCard: async () => {}, moveCard: async () => {},
    patchCard: async (_module, id, patch, expected) => {
      writes.push({ ...patch }); if (intercept) await intercept();
      if (fail) { const error = fail; fail = ''; throw new Error(error); }
      assert.equal(id, card.id);
      for (const key of ['name', 'description'] as const) if (Object.hasOwn(patch, key) && card[key] !== expected[key]) throw new Error('所编辑字段在其他窗口更新');
      card = { ...card, ...patch }; for (const listener of [...listeners]) listener(); return { ...card };
    },
  };
  const api = { showcase: service, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } } as unknown as CardsAPI;
  const manager = getShowcaseManager(api, window)!;
  return { api, manager, window, writes, listeners, timers, session: manager.getSession('photos', 'a'), card: () => card, replace: (patch: Partial<ShowcaseCard>) => { card = { ...card, ...patch }; for (const listener of [...listeners]) listener(); }, fail: (error: string) => { fail = error; }, intercept: (callback?: () => Promise<void>) => { intercept = callback; } };
}

test('showcase names and descriptions share one manager across bundles and preserve both in recovery', async () => {
  const f = fixture(); await f.session.refresh();
  assert.equal(getShowcaseManager(f.api, f.window), f.manager); assert.equal(f.manager.getSession('photos', 'a'), f.session);
  f.session.startComposition(); f.session.updateName('名称草稿'); f.session.update('描述草稿');
  assert.deepEqual(f.manager.recoveryDrafts(), [{ moduleId: 'photos', id: 'a', path: '橱窗.md', name: '名称草稿', description: '描述草稿' }]);
  releaseShowcaseManager(f.api); assert.equal(f.listeners.size, 0); assert.equal(f.timers.size, 0);
  const next = getShowcaseManager(f.api, f.window)!; assert.notEqual(next, f.manager); releaseShowcaseManager(f.api);
});

test('IME pauses autosave and blur flush, then commits final text; final release can back up unfinished composition', async () => {
  const f = fixture(); await f.session.refresh();
  try {
    f.session.startComposition(); f.session.updateName('输入中'); f.session.update('正在拼音');
    assert.equal(f.timers.size, 0); await f.session.flush(); assert.equal(f.writes.length, 0);
    await assert.rejects(f.manager.flushAll(), /输入法尚未结束/); assert.equal(f.manager.recoveryDrafts()[0].description, '正在拼音');
    f.session.update('最终描述'); f.session.endComposition(); assert.equal(f.timers.size, 1);
    for (const callback of [...f.timers.values()]) callback(); await f.session.flush();
    assert.deepEqual(f.writes, [{ name: '输入中', description: '最终描述' }]); assert.equal(f.session.getSnapshot().dirty, false); assert.deepEqual(f.manager.recoveryDrafts(), []);
  } finally { releaseShowcaseManager(f.api); }
});

test('external edits merge untouched fields while same-field conflicts retain the visible draft until reload', async () => {
  const f = fixture(); await f.session.refresh();
  try {
    f.session.updateName('我的名称'); f.replace({ description: '外部描述' }); await f.session.refresh();
    assert.equal(f.session.getSnapshot().description, '外部描述'); await f.session.flush(); assert.equal(f.card().name, '我的名称');
    f.session.update('我的描述'); f.replace({ description: '再次外部更新' }); await f.session.refresh();
    assert.equal(f.session.getSnapshot().description, '我的描述'); await assert.rejects(f.session.flush(), /其他窗口/);
    assert.equal(f.session.getSnapshot().dirty, true); assert.equal(f.timers.size, 0); assert.equal(f.manager.recoveryDrafts()[0].description, '我的描述');
    await f.session.reload(); assert.equal(f.session.getSnapshot().description, '再次外部更新'); assert.equal(f.session.getSnapshot().dirty, false);
  } finally { releaseShowcaseManager(f.api); }
});

test('unmounted unfinished composition stays recoverable and resumes only through user editing or explicit retry', async () => {
  const f = fixture(); await f.session.refresh();
  try {
    f.session.startComposition(); f.session.updateName('正在组词'); f.session.interruptComposition();
    await f.session.flush(); await f.session.refresh();
    assert.equal(f.writes.length, 0); assert.equal(f.timers.size, 0); assert.match(f.session.getSnapshot().error, /输入已中断/);
    await assert.rejects(f.manager.flushAll(), /输入法尚未结束/); assert.equal(f.manager.recoveryDrafts()[0].name, '正在组词');
    await f.session.retry(); assert.equal(f.card().name, '正在组词'); assert.equal(f.session.getSnapshot().dirty, false);
    f.session.startComposition(); f.session.update('拼音中间输入'); f.session.interruptComposition(); await f.session.flush();
    assert.equal(f.writes.length, 1);
    f.session.update('重新打开后完成的描述'); assert.equal(f.timers.size, 1); await f.session.flush();
    assert.equal(f.card().description, '重新打开后完成的描述'); assert.equal(f.session.getSnapshot().error, '');
    f.session.startComposition(); f.session.update('第三次中间输入'); f.session.interruptComposition(); await f.session.reload();
    f.session.update('放弃草稿后继续编辑'); await f.session.flush(); assert.equal(f.card().description, '放弃草稿后继续编辑');
  } finally { releaseShowcaseManager(f.api); }
});

test('explicit retry cannot confirm another window\'s ongoing composition', async () => {
  const f = fixture(); await f.session.refresh();
  try {
    f.session.startComposition(); f.session.startComposition(); f.session.update('两个窗口共用的输入');
    f.session.interruptComposition(); await f.session.retry(); assert.equal(f.writes.length, 0); assert.equal(f.timers.size, 0);
    f.session.update('另一窗口确认的完整描述'); f.session.endComposition(); await f.session.flush();
    assert.equal(f.card().description, '另一窗口确认的完整描述'); assert.equal(f.session.getSnapshot().dirty, false);
  } finally { releaseShowcaseManager(f.api); }
});

test('newer changes including reverting either field during an in-flight save are committed next', async () => {
  const f = fixture(); await f.session.refresh();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }); let first = true;
  f.intercept(async () => { if (first) { first = false; await gate; } });
  try {
    f.session.updateName('先保存名称'); f.session.update('先保存描述'); const saving = f.session.flush();
    await Promise.resolve(); await Promise.resolve();
    f.session.updateName('旧名称'); f.session.update('旧描述'); release(); await saving;
    assert.deepEqual(f.writes, [{ name: '先保存名称', description: '先保存描述' }, { name: '旧名称', description: '旧描述' }]); assert.equal(f.session.getSnapshot().dirty, false);
  } finally { releaseShowcaseManager(f.api); }
});

test('a newer revert after a failed save remains recoverable and explicit retry writes it once', async () => {
  const f = fixture(); await f.session.refresh();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); f.intercept(() => gate); f.fail('磁盘失败');
  try {
    f.session.updateName('先保存'); f.session.update('先保存描述'); const saving = f.session.flush(); await Promise.resolve(); await Promise.resolve();
    f.session.updateName('旧名称'); f.session.update('旧描述'); release(); await assert.rejects(saving, /磁盘失败/);
    assert.equal(f.session.getSnapshot().dirty, true); assert.equal(f.manager.recoveryDrafts().length, 1); assert.equal(f.timers.size, 0);
    f.intercept(); await f.session.flush(); assert.equal(f.session.getSnapshot().dirty, false); assert.deepEqual(f.writes.at(-1), { name: '旧名称', description: '旧描述' });
  } finally { releaseShowcaseManager(f.api); }
});

test('manager flush reports save failure and retains name drafts after view disposal', async () => {
  const f = fixture(); await f.session.refresh();
  try {
    f.session.updateName('失败名称'); f.fail('只读磁盘'); await assert.rejects(f.manager.flushAll(), /只读磁盘/);
    assert.equal(f.manager.recoveryDrafts()[0].name, '失败名称'); assert.equal(f.session.getSnapshot().name, '失败名称');
    await f.manager.flushAll(); assert.equal(f.card().name, '失败名称'); assert.deepEqual(f.manager.recoveryDrafts(), []);
  } finally { releaseShowcaseManager(f.api); }
});
