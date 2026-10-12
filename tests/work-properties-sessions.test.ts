import test from 'node:test';
import assert from 'node:assert/strict';
import type { WorkProperties, WorkPropertyValues } from '../src/types';
import { WorkPropertiesManager } from '../src/WorkPropertiesSessions';

test('manager navigation flush preflights all active compositions before committing any session and retains both drafts', async t => {
  const properties = new Map<string, WorkProperties>(['first', 'composing'].map(id => [id, { id, kind: 'film', path: `${id}.md`, coverPresent: false, values: { title: id, cover: '', summary: '', rating: null, pinned: false, status: 'want' } }]));
  const writes: string[] = [];
  const api = { subscribe: () => () => {}, readWorkProperties: async (id: string) => structuredClone(properties.get(id)!), patchWorkProperties: async (id: string, patch: Partial<WorkPropertyValues>) => {
    writes.push(id); const item = properties.get(id)!; const updated = { ...item, values: { ...item.values, ...patch } }; properties.set(id, updated); return structuredClone(updated);
  } };
  const clock = { setTimeout: () => 1, clearTimeout: () => {} } as unknown as Window;
  const manager = new WorkPropertiesManager(api, clock); t.after(() => manager.dispose());
  const first = manager.getSession('first'), composing = manager.getSession('composing'); await Promise.all([first.refresh(), composing.refresh()]);
  first.update({ summary: '待保存的完整摘要' }); composing.startComposition(); composing.update({ summary: '拼音中间文本' });
  assert.equal(composing.isComposing, true);
  await assert.rejects(manager.flushAll(), /输入法仍在编辑.*草稿已保留/);
  assert.deepEqual(writes, []); assert.equal(properties.get('first')!.values.summary, ''); assert.equal(properties.get('composing')!.values.summary, '');
  assert.equal(first.getSnapshot().dirty, true); assert.equal(composing.getSnapshot().dirty, true); assert.equal(manager.recoveryDrafts().length, 2);
  composing.update({ summary: '输入完成后的摘要' }); composing.endComposition(); assert.equal(composing.isComposing, false);
  await manager.flushAll(); assert.deepEqual(new Set(writes), new Set(['first', 'composing']));
  assert.equal(properties.get('composing')!.values.summary, '输入完成后的摘要'); assert.equal(manager.recoveryDrafts().length, 0);
});

test('a composition that starts during a slow write stops the next flush iteration and blocks navigation while retaining the new text', async t => {
  let stored: WorkProperties = { id: 'slow', kind: 'film', path: 'slow.md', coverPresent: false, values: { title: '慢写入', cover: '', summary: '', rating: null, pinned: false, status: 'want' } };
  let releaseWrite: (() => void) | undefined;
  const blocked = new Promise<void>(resolve => { releaseWrite = resolve; }), patches: Array<Partial<WorkPropertyValues>> = [];
  const api = { subscribe: () => () => {}, readWorkProperties: async () => structuredClone(stored), patchWorkProperties: async (_id: string, patch: Partial<WorkPropertyValues>) => {
    patches.push(structuredClone(patch)); await blocked; stored = { ...stored, values: { ...stored.values, ...patch } }; return structuredClone(stored);
  } };
  const clock = { setTimeout: () => 1, clearTimeout: () => {} } as unknown as Window;
  const manager = new WorkPropertiesManager(api, clock); t.after(() => manager.dispose());
  const session = manager.getSession('slow'); await session.refresh(); session.update({ summary: '首次完整输入' });
  const saving = manager.flushAll();
  for (let round = 0; !patches.length && round < 10; round++) await Promise.resolve();
  assert.equal(patches.length, 1);
  session.startComposition(); session.update({ summary: '输入法中间文本' }); releaseWrite!();
  await assert.rejects(saving, /未保存的输入.*草稿已保留/);
  assert.equal(patches.length, 1); assert.equal(stored.values.summary, '首次完整输入');
  assert.equal(session.getSnapshot().values?.summary, '输入法中间文本'); assert.equal(session.getSnapshot().dirty, true); assert.equal(manager.recoveryDrafts().length, 1);
  session.update({ summary: '最终完成的输入' }); session.endComposition(); await manager.flushAll();
  assert.equal(patches.length, 2); assert.equal(stored.values.summary, '最终完成的输入'); assert.equal(session.getSnapshot().dirty, false);
});
