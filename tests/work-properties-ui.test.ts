import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWork } from '../src/domain';
import { WorkPropertiesManager } from '../src/WorkPropertiesSessions';
import type { CardsAPI, Work, WorkKind, WorkProperties, WorkPropertyValues } from '../src/types';
import type { WorkPropertiesPanel } from '../src/WorkProperties';
import type WorkEditor from '../src/WorkEditor';

class Hooks {
  private cursor = 0;
  private slots: unknown[] = [];
  private effects: Array<() => void | (() => void)> = [];
  private cleanups: Array<() => void> = [];
  useState = (initial: unknown) => {
    const index = this.cursor++;
    if (!(index in this.slots)) this.slots[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
    return [this.slots[index], (next: unknown) => { this.slots[index] = typeof next === 'function' ? (next as (previous: unknown) => unknown)(this.slots[index]) : next; }];
  };
  useRef = (initial: unknown) => { const index = this.cursor++; return this.slots[index] ??= { current: initial }; };
  useSyncExternalStore = (_subscribe: unknown, read: () => unknown) => { this.cursor++; return read(); };
  useEffect = (effect: () => void | (() => void), dependencies: unknown[]) => {
    const index = this.cursor++, previous = this.slots[index] as unknown[] | undefined;
    if (!previous || previous.some((value, offset) => !Object.is(value, dependencies[offset]))) {
      this.slots[index] = dependencies; this.effects.push(effect);
    }
  };
  render<P>(component: (props: P) => React.ReactNode, props: P) {
    active = this; this.cursor = 0;
    try { return component(props); } finally { active = undefined; }
  }
  runEffects() { for (const effect of this.effects.splice(0)) { const cleanup = effect(); if (cleanup) this.cleanups.push(cleanup); } }
  dispose() { for (const cleanup of this.cleanups.splice(0)) cleanup(); }
}
let active: Hooks | undefined;
const reactProxy = { ...React, ...Object.fromEntries(['useState', 'useRef', 'useEffect', 'useSyncExternalStore'].map(name => [name, (...args: unknown[]) => {
  const owner = active ?? React;
  return Reflect.apply(Reflect.get(owner, name) as (...args: unknown[]) => unknown, owner, args);
}])) };
const directory = dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url);
const bundle = await build({
  stdin: { contents: "export { WorkPropertiesPanel as Panel } from './WorkProperties'; export { default as Editor } from './WorkEditor';", resolveDir: resolve(directory, '../src'), loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react', 'react/jsx-runtime'],
});
const memory = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)((name: string) => name === 'react' ? reactProxy : require(name), memory, memory.exports);
const ui = memory.exports as { Panel: typeof WorkPropertiesPanel; Editor: typeof WorkEditor };
const nodes = (value: React.ReactNode): React.ReactElement<any>[] => {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement<{ children?: React.ReactNode }>(value)) return [];
  return [value, ...nodes(value.props.children)];
};
const field = (tree: React.ReactNode, label: string) => nodes(tree).find(node => node.props.label === label)!;
const control = (tree: React.ReactNode, label: string) => nodes(field(tree, label)).find(node => node.type === 'input' || node.type === 'textarea' || node.type === 'select')!;
const tick = async () => { for (let round = 0; round < 15; round++) await Promise.resolve(); };

async function fixture(kind: WorkKind = 'film', custom = false, supported = true) {
  const entity = { ...createWork(kind), path: '作品.md', ...(custom ? { moduleId: 'custom-film' } : {}), title: '作品名称', summary: '摘要原文' };
  if (entity.type === 'film') { entity.director = '原导演'; entity.date = '2026-01-02'; entity.status = 'watching'; }
  let stored: WorkProperties = { id: entity.id, kind, path: entity.path, ...(custom ? { moduleId: entity.moduleId } : {}), coverPresent: false, values: { ...entity } };
  const writes: Partial<WorkPropertyValues>[] = [], saves: Work[] = [];
  let failure = '';
  const api = {
    ...(supported ? { supportsWorkPropertyLabels: true } : {}),
    subscribe: () => () => {},
    getSnapshot: () => ({ entities: [entity], settings: { customModules: custom ? [{ id: 'custom-film', title: '游戏', kind: 'film', appearance: { material: 'paper', style: 'cover' } }] : [] } }),
    coverUrl: (cover: string) => cover,
    listNoteCandidates: async () => [],
    readWorkProperties: async () => structuredClone(stored),
    patchWorkProperties: async (_id: string, patch: Partial<WorkPropertyValues>) => {
      writes.push(structuredClone(patch));
      if (failure) throw new Error(failure);
      stored = { ...stored, values: { ...stored.values, ...patch } }; return structuredClone(stored);
    },
    save: async (work: Work) => { if (failure) throw new Error(failure); saves.push(structuredClone(work)); },
  } as unknown as CardsAPI;
  const clock = { setTimeout: () => 1, clearTimeout() {} } as unknown as Window;
  const manager = new WorkPropertiesManager(api, clock), session = manager.getSession(entity.id); await session.refresh();
  return { api, entity, manager, session, writes, saves, stored: () => stored, fail: (message: string) => { failure = message; } };
}

test('work notes show only name and summary initially and retain film metadata behind closed more information', async t => {
  for (const custom of [false, true]) {
    const f = await fixture('film', custom); t.after(() => f.manager.dispose());
    const html = renderToStaticMarkup(React.createElement(ui.Panel, { api: f.api, session: f.session, onReady() {}, onRawChange() {} }));
    const [visible, more] = html.split('<details');
    assert.ok(visible.includes('名称')); assert.ok(visible.includes('摘要')); assert.equal(visible.includes('导演'), false); assert.equal(visible.includes('原始属性'), false);
    assert.ok(more.startsWith(' class="bw-properties-more"')); assert.equal(more.startsWith(' open'), false);
    for (const label of ['更多信息', custom ? '关联笔记' : '封面', '字段名称（默认导演）', '导演', '年份', '评分', '卡片排版', '原始属性']) assert.ok(more.includes(label), label);
    assert.equal(html.includes('观看状态'), false); assert.equal(html.includes('观看日期'), false); assert.equal(html.includes('type="date"'), false);
    assert.equal(f.stored().values.status, 'watching'); assert.equal(f.stored().values.date, '2026-01-02'); assert.equal(f.writes.length, 0);
  }
});

test('book reading details move into more information without changing their values', async t => {
  const f = await fixture('book'); t.after(() => f.manager.dispose());
  const html = renderToStaticMarkup(React.createElement(ui.Panel, { api: f.api, session: f.session, onReady() {}, onRawChange() {} }));
  const [visible, more] = html.split('<details');
  for (const label of ['作者', '阅读状态', '阅读进度', '最近阅读']) { assert.equal(visible.includes(label), false); assert.ok(more.includes(label)); }
  assert.equal(f.writes.length, 0);
});

test('custom film labels use the shared property session and IME defers label writes until composition ends', async t => {
  const f = await fixture('film', true), hooks = new Hooks(); t.after(() => { hooks.dispose(); f.manager.dispose(); });
  const props = { api: f.api, session: f.session, onReady() {}, onRawChange() {} };
  let tree = hooks.render(ui.Panel, props); hooks.runEffects();
  const label = control(tree, '字段名称（默认导演）'); assert.equal(label.props.maxLength, 40); assert.equal(label.props.disabled, false);
  label.props.onCompositionStart(); label.props.onChange({ target: { value: 'kaifa' } });
  await f.session.flush(); assert.equal(f.writes.length, 0); assert.equal(f.session.isComposing, true);
  label.props.onChange({ target: { value: '开发商' } }); label.props.onCompositionEnd();
  tree = hooks.render(ui.Panel, props); control(tree, '开发商').props.onChange({ target: { value: 'Team Cherry' } });
  await f.manager.flushAll();
  assert.deepEqual(f.writes, [{ directorLabel: '开发商', director: 'Team Cherry' }]);
  assert.equal(f.stored().values.date, '2026-01-02'); assert.equal(f.stored().values.status, 'watching'); assert.equal(f.session.getSnapshot().dirty, false);
  tree = hooks.render(ui.Panel, props); control(tree, '字段名称（默认导演）').props.onChange({ target: { value: '' } });
  assert.ok(field(hooks.render(ui.Panel, props), '导演')); await f.manager.flushAll();
});

test('a failed label save retains draft and unrelated metadata for retry', async t => {
  const f = await fixture(), hooks = new Hooks(); t.after(() => { hooks.dispose(); f.manager.dispose(); });
  const props = { api: f.api, session: f.session, onReady() {}, onRawChange() {} };
  control(hooks.render(ui.Panel, props), '字段名称（默认导演）').props.onChange({ target: { value: '开发商' } });
  f.fail('模拟冲突'); await assert.rejects(f.manager.flushAll(), /模拟冲突/);
  assert.equal(f.session.getSnapshot().values!.directorLabel, '开发商'); assert.equal(f.session.getSnapshot().dirty, true);
  assert.ok(renderToStaticMarkup(React.createElement(ui.Panel, props)).includes('模拟冲突'));
  f.fail(''); await f.manager.flushAll(); assert.equal(f.stored().values.directorLabel, '开发商');
  assert.equal(f.stored().values.date, '2026-01-02'); assert.equal(f.stored().values.status, 'watching');
});

test('closing more information or disposing the panel hides native raw attributes again', async t => {
  const f = await fixture(), hooks = new Hooks(), raw: boolean[] = []; t.after(() => { hooks.dispose(); f.manager.dispose(); });
  const props = { api: f.api, session: f.session, onReady() {}, onRawChange: (expanded: boolean) => raw.push(expanded) };
  let tree = hooks.render(ui.Panel, props); hooks.runEffects(); raw.length = 0;
  nodes(tree).find(node => node.props.className === 'bw-properties-raw')!.props.onClick(); assert.deepEqual(raw, [true]);
  tree = hooks.render(ui.Panel, props);
  nodes(tree).find(node => node.type === 'details')!.props.onToggle({ currentTarget: { open: false } });
  assert.deepEqual(raw, [true, false]);
  tree = hooks.render(ui.Panel, props); assert.equal(nodes(tree).find(node => node.props.className === 'bw-properties-raw')!.props['aria-expanded'], false);
  hooks.dispose(); assert.deepEqual(raw, [true, false, false]); assert.equal(f.writes.length, 0);
});

test('legacy APIs explain the disabled label field while allowing director contents and existing labels', async t => {
  const f = await fixture('film', true, false), hooks = new Hooks(); t.after(() => { hooks.dispose(); f.manager.dispose(); });
  f.stored().values.directorLabel = '开发商'; await f.session.refresh();
  const props = { api: f.api, session: f.session, onReady() {}, onRawChange() {} };
  const tree = hooks.render(ui.Panel, props), label = control(tree, '字段名称（默认导演）');
  assert.equal(label.props.disabled, true); assert.equal(label.props.value, '开发商');
  label.props.onChange({ target: { value: '未授权新标签' } }); assert.equal(f.session.getSnapshot().values!.directorLabel, '开发商');
  control(tree, '开发商').props.onChange({ target: { value: 'ConcernedApe' } }); await f.manager.flushAll();
  assert.deepEqual(f.writes, [{ director: 'ConcernedApe' }]);
  assert.ok(renderToStaticMarkup(React.createElement(ui.Panel, props)).includes('升级正在提供卡片数据的插件'));
});

test('new-card forms place name and summary before closed metadata and saving preserves film date and status', async t => {
  const f = await fixture('film', true), hooks = new Hooks(); t.after(() => { hooks.dispose(); f.manager.dispose(); });
  let closed = 0;
  const props = { entity: { ...f.entity, path: '' }, genericCard: true, api: f.api, run: async (action: () => Promise<unknown>) => { await action(); return true; }, close: () => { closed++; } };
  let tree = hooks.render(ui.Editor, props), html = renderToStaticMarkup(tree), visible = html.split('<details')[0];
  assert.ok(visible.includes('名称')); assert.ok(visible.includes('摘要')); assert.equal(visible.includes('导演字段名称'), false);
  assert.equal(html.includes('观看状态'), false); assert.equal(html.includes('观看日期'), false);
  assert.equal(nodes(tree).find(node => node.type === 'details')!.props.open, undefined);
  control(tree, '字段名称（默认导演）').props.onChange({ target: { value: '开发商' } });
  tree = hooks.render(ui.Editor, props); control(tree, '开发商').props.onChange({ target: { value: 'ConcernedApe' } });
  tree = hooks.render(ui.Editor, props); nodes(tree).find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} }); await tick();
  assert.equal(closed, 1); assert.equal(f.saves.length, 1);
  assert.equal(f.saves[0].type, 'film'); const saved = f.saves[0]; if (saved.type !== 'film') throw new Error('Expected film');
  assert.equal(saved.directorLabel, '开发商'); assert.equal(saved.director, 'ConcernedApe'); assert.equal(saved.date, '2026-01-02'); assert.equal(saved.status, 'watching');
});

test('an editor losing label capability refuses that save and keeps all entered text', async t => {
  const f = await fixture('film', true), hooks = new Hooks(); t.after(() => { hooks.dispose(); f.manager.dispose(); });
  let closed = false;
  const props = { entity: f.entity, genericCard: true, api: f.api, run: async (action: () => Promise<unknown>) => { await action(); return true; }, close: () => { closed = true; } };
  control(hooks.render(ui.Editor, props), '字段名称（默认导演）').props.onChange({ target: { value: '开发商' } }); delete f.api.supportsWorkPropertyLabels;
  let tree = hooks.render(ui.Editor, props); nodes(tree).find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} }); await tick();
  tree = hooks.render(ui.Editor, props); assert.ok(renderToStaticMarkup(tree).includes('草稿已保留')); assert.equal(control(tree, '字段名称（默认导演）').props.value, '开发商');
  assert.equal(f.saves.length, 0); assert.equal(closed, false);
});
