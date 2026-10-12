import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import CardsSurface from '../src/CardsSurface';
import type CardsDashboardView from '../src/CardsDashboardView';
import { WorkPropertiesManager } from '../src/WorkPropertiesSessions';
import { getShowcaseManager, releaseShowcaseManager } from '../src/showcase-sessions';
import { createWork } from '../src/domain';
import { freshCardsSettings } from '../src/settings';
import type { CardsAPI, CardsDashboard, CardsSettings, CardsSnapshot, ShowcaseCard, WorkProperties, WorkPropertyValues } from '../src/types';
import type { CardsEmbed } from '../src/embed-source';

const boardA: CardsDashboard = { id: 'board-a', title: '书与收藏', moduleIds: ['custom-a', 'book', 'missing', 'film'] };
const boardB: CardsDashboard = { id: 'board-b', title: '电影', moduleIds: ['film', 'book'] };
const timerWindow = { setTimeout: () => 1, clearTimeout() {} } as unknown as Window;
const tick = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
const moduleOrder = (html: string) => [...html.matchAll(/data-cards-module="([^"]+)"/g)].map(match => match[1]);

function fixture(supported = true) {
  const settings = freshCardsSettings();
  settings.customModules = [{ id: 'custom-a', title: '收藏', kind: 'book', appearance: { material: 'paper', style: 'cover' } }];
  settings.dashboards = [structuredClone(boardA), structuredClone(boardB)];
  settings.standaloneOrder = ['film', 'custom-a', 'book'];
  const work = { ...createWork('book'), id: 'reading', title: '书', summary: '原摘要' };
  let snapshot: CardsSnapshot = { settings, entities: [work], workOrder: null, loading: false, error: '' };
  let properties: WorkProperties = { id: work.id, kind: 'book', path: '书.md', coverPresent: false, values: { ...work } };
  let card: ShowcaseCard = { id: 'image', image: 'image.png', name: '原名称', description: '原描述' };
  const listeners = new Set<() => void>(), patches: Partial<CardsSettings>[] = [], writes: Array<{ kind: string; patch: object }> = [];
  let workError = '', settingsError = '';
  let pause: (() => Promise<void>) | undefined;
  const api = {
    ...(supported ? { supportsDashboards: true } : {}),
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    coverUrl: (value: string) => value,
    saveSettings: async (patch: Partial<CardsSettings>) => {
      patches.push(structuredClone(patch));
      if (settingsError) throw new Error(settingsError);
      snapshot = { ...snapshot, settings: { ...snapshot.settings, ...patch } };
      for (const listener of listeners) listener();
    },
    readWorkProperties: async () => structuredClone(properties),
    patchWorkProperties: async (_id: string, patch: Partial<WorkPropertyValues>) => {
      writes.push({ kind: 'work', patch: structuredClone(patch) });
      if (pause) await pause();
      if (workError) throw new Error(workError);
      properties = { ...properties, values: { ...properties.values, ...patch } };
      return structuredClone(properties);
    },
    showcase: {
      read: async () => ({ moduleId: 'showcase', path: '橱窗.md', revision: '', cards: [{ ...card }] }),
      patchCard: async (_module: string, _id: string, patch: Partial<ShowcaseCard>) => { writes.push({ kind: 'showcase', patch: { ...patch } }); card = { ...card, ...patch }; return { ...card }; },
    },
  } as unknown as CardsAPI;
  const manager = new WorkPropertiesManager(api, timerWindow);
  return {
    api, manager, patches, writes,
    replace: (next: CardsSnapshot) => { snapshot = next; for (const listener of listeners) listener(); },
    workFail: (message: string) => { workError = message; },
    settingsFail: (message: string) => { settingsError = message; },
    pauseWrite: (wait: (() => Promise<void>) | undefined) => { pause = wait; },
    dispose: () => { manager.dispose(); releaseShowcaseManager(api); },
  };
}

// Render only the outer component with controlled hooks, keeping real React elements.
// This exposes its event callbacks without adding a production or test-renderer dependency.
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
  useMemo = (create: () => unknown) => { this.cursor++; return create(); };
  useContext = () => { this.cursor++; return null; };
  useLayoutEffect = (effect: () => void | (() => void), dependencies: unknown[]) => this.useEffect(effect, dependencies);
  useId = () => { this.cursor++; return 'dashboard-test-panel'; };
  useSyncExternalStore = (_subscribe: unknown, read: () => unknown) => { this.cursor++; return read(); };
  useEffect = (effect: () => void | (() => void), dependencies: unknown[]) => {
    const index = this.cursor++, previous = this.slots[index] as unknown[] | undefined;
    if (!previous || previous.length !== dependencies.length || previous.some((value, offset) => !Object.is(value, dependencies[offset]))) {
      this.slots[index] = dependencies; this.effects.push(effect);
    }
  };
  render<P>(component: (props: P) => React.ReactNode, props: P) {
    activeHooks = this; this.cursor = 0;
    try { return component(props); } finally { activeHooks = undefined; }
  }
  runEffects() { for (const effect of this.effects.splice(0)) { const cleanup = effect(); if (cleanup) this.cleanups.push(cleanup); } }
  dispose() { for (const cleanup of this.cleanups.splice(0)) cleanup(); }
}
let activeHooks: Hooks | undefined;
const reactProxy = { ...React, ...Object.fromEntries(['useState', 'useRef', 'useMemo', 'useContext', 'useId', 'useSyncExternalStore', 'useEffect', 'useLayoutEffect'].map(name => [name, (...args: unknown[]) => {
  const owner = activeHooks ?? React;
  return Reflect.apply(Reflect.get(owner, name) as (...args: unknown[]) => unknown, owner, args);
}])) };
const nodes = (value: React.ReactNode): React.ReactElement<any>[] => {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement<{ children?: React.ReactNode }>(value)) return [];
  return [value, ...nodes(value.props.children)];
};
const directory = dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url);
const source = await readFile(resolve(directory, '../src/main.tsx'), 'utf8');
const memoryBundle = await build({
  stdin: { contents: `${source}\nexport { CardsView };\nexport { default as Dashboard, flushDashboardEdits } from './CardsDashboardView';\nexport { default as Surface } from './CardsSurface';\nexport { default as Text } from './EditableText';\nexport { renderedRoots } from 'react-dom/client';`, resolveDir: resolve(directory, '../src'), loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react', 'react/jsx-runtime'],
  plugins: [{ name: 'dashboard-view-platform', setup(builder) {
    builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'platform', namespace: 'dashboard-test' }));
    builder.onLoad({ filter: /.*/, namespace: 'dashboard-test' }, () => ({ contents: `export * from ${JSON.stringify(resolve(directory, 'obsidian-mock.ts'))};
      export const Platform={isDesktopApp:true}; export const requireApiVersion=()=>false; export function addIcon(){}
      export class PluginSettingTab {} export class Modal {} export class Setting {}
      export class ItemView { constructor(leaf){this.app=leaf.app;this.contentEl=leaf.contentEl;} getState(){return {existing:'retained'};} async setState(){} }`, resolveDir: directory, loader: 'js' }));
    builder.onResolve({ filter: /^react-dom\/client$/ }, () => ({ path: 'roots', namespace: 'dashboard-roots' }));
    builder.onLoad({ filter: /.*/, namespace: 'dashboard-roots' }, () => ({ contents: 'export const renderedRoots=[];export function createRoot(){const root={element:null,unmounted:false,render(element){this.element=element;},unmount(){this.unmounted=true;}};renderedRoots.push(root);return root;}', loader: 'js' }));
  } }],
});
const memoryModule = { exports: {} };
new Function('require', 'module', 'exports', memoryBundle.outputFiles[0].text)((name: string) => name === 'react' ? reactProxy : require(name), memoryModule, memoryModule.exports);
interface RootStub { element: React.ReactElement<{ dashboardId: string; onDashboardChange(id: string): void }>; unmounted: boolean; }
interface ViewStub { getState(): { existing: string; dashboardId: string }; setState(state: unknown, result: object): Promise<void>; getViewType(): string; onOpen(): Promise<void>; onClose(): Promise<void>; }
const ui = memoryModule.exports as {
  Dashboard: typeof CardsDashboardView; Surface: typeof CardsSurface; renderedRoots: RootStub[];
  Text: typeof import('../src/EditableText').default;
  flushDashboardEdits: typeof import('../src/CardsDashboardView').flushDashboardEdits;
  CardsView: new (leaf: unknown, plugin: unknown, closed: () => void) => ViewStub;
};
const flushDashboardEdits = ui.flushDashboardEdits;
const surfaceList = (hooks: Hooks, props: React.ComponentProps<typeof CardsSurface>) => nodes(hooks.render(ui.Surface, props)).find(node => typeof node.props.save === 'function' && Array.isArray(node.props.ids))!;


test('dashboard, complete library and embed render their own order without changing membership', () => {
  const f = fixture();
  try {
    const original = structuredClone(f.api.getSnapshot());
    assert.deepEqual(moduleOrder(renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager, dashboard: boardA }))), boardA.moduleIds);
    assert.deepEqual(moduleOrder(renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager }))), ['film', 'custom-a', 'book']);
    const embed: CardsEmbed = { id: 'note-block', modules: [{ id: 'reading-instance', collection: 'book' }, { id: 'film-instance', collection: 'film' }] };
    assert.deepEqual(moduleOrder(renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager, embed }))), ['reading-instance', 'film-instance']);
    assert.deepEqual(f.api.getSnapshot(), original);
    assert.equal(f.patches.length, 0);
  } finally { f.dispose(); }
});

test('hidden dashboard members remain referenced and embedded hidden modules retain restoration placeholders', () => {
  const f = fixture();
  try {
    f.replace({ ...f.api.getSnapshot(), settings: { ...f.api.getSnapshot().settings, hiddenModuleIds: ['book'] } });
    const html = renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager, dashboard: boardA }));
    assert.deepEqual(moduleOrder(html), ['custom-a', 'missing', 'film']);
    assert.ok(html.includes('集合未找到'));
    assert.deepEqual(f.api.getSnapshot().settings.dashboards![0].moduleIds, boardA.moduleIds);
    const embed = { id: 'alias-block', modules: [{ id: 'preserved', collection: 'book' }] };
    const hidden = renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager, embed }));
    assert.deepEqual(moduleOrder(hidden), ['preserved']);
    assert.ok(hidden.includes('恢复模块'));
  } finally { f.dispose(); }
});

test('older shared API renders the complete library without pretending dashboards can be edited', () => {
  const f = fixture(false);
  try {
    const html = renderToStaticMarkup(React.createElement(ui.Dashboard, { api: f.api, manager: f.manager, dashboardId: boardA.id, onDashboardChange() {} }));
    assert.equal([...html.matchAll(/role="tab"/g)].length, 1);
    assert.ok(html.includes('>全部</button>'));
    assert.equal(html.includes('>书与收藏</button>'), false);
    assert.deepEqual(moduleOrder(html), ['film', 'custom-a', 'book']);
    assert.deepEqual(f.api.getSnapshot().settings.dashboards, [boardA, boardB]);
    assert.equal(f.patches.length, 0);
  } finally { f.dispose(); }
});

test('navigation flush saves both work and showcase drafts before allowing another dashboard', async () => {
  const f = fixture();
  try {
    const work = f.manager.getSession('reading'), showcase = getShowcaseManager(f.api, timerWindow)!.getSession('showcase', 'image');
    await Promise.all([work.refresh(), showcase.refresh()]);
    work.update({ summary: '新摘要' }); showcase.updateName('新名称'); showcase.update('新描述');
    await flushDashboardEdits(f.api, f.manager);
    assert.deepEqual(f.writes.map(write => write.kind), ['work', 'showcase']);
    assert.deepEqual(f.writes[1].patch, { name: '新名称', description: '新描述' });
    assert.equal(work.getSnapshot().dirty, false); assert.equal(showcase.getSnapshot().dirty, false);
  } finally { f.dispose(); }
});

test('failed navigation keeps both drafts and the same session for an explicit retry', async () => {
  const f = fixture();
  try {
    const work = f.manager.getSession('reading'), showcase = getShowcaseManager(f.api, timerWindow)!.getSession('showcase', 'image');
    await Promise.all([work.refresh(), showcase.refresh()]);
    work.update({ summary: '保留摘要' }); showcase.update('保留描述'); f.workFail('磁盘不可写');
    await assert.rejects(flushDashboardEdits(f.api, f.manager), /磁盘不可写/);
    assert.equal(work.getSnapshot().values!.summary, '保留摘要'); assert.equal(work.getSnapshot().dirty, true);
    assert.equal(showcase.getSnapshot().description, '保留描述'); assert.equal(showcase.getSnapshot().dirty, true);
    assert.equal(f.writes.some(write => write.kind === 'showcase'), false);
    assert.equal(f.manager.getSession('reading'), work);
    f.workFail(''); await flushDashboardEdits(f.api, f.manager);
    assert.equal(work.getSnapshot().dirty, false); assert.equal(showcase.getSnapshot().dirty, false);
  } finally { f.dispose(); }
});

test('active composition prevents all navigation writes, including other cleanly edited cards', async () => {
  const f = fixture();
  try {
    const work = f.manager.getSession('reading'), showcase = getShowcaseManager(f.api, timerWindow)!.getSession('showcase', 'image');
    await Promise.all([work.refresh(), showcase.refresh()]);
    work.startComposition(); work.update({ summary: '输入法中间稿' }); showcase.update('另一个草稿');
    await assert.rejects(flushDashboardEdits(f.api, f.manager), /输入法/);
    assert.equal(f.writes.length, 0); assert.equal(work.getSnapshot().dirty, true); assert.equal(showcase.getSnapshot().dirty, true);
  } finally { f.dispose(); }
});

test('composition begun during a slow navigation save retains the newer text instead of writing a second patch', async () => {
  const f = fixture();
  let resolveWrite!: () => void;
  const pending = new Promise<void>(resolve => { resolveWrite = resolve; });
  try {
    const work = f.manager.getSession('reading'); await work.refresh();
    work.update({ summary: '已确认的第一稿' }); f.pauseWrite(() => pending);
    const flushing = flushDashboardEdits(f.api, f.manager); await tick();
    assert.equal(f.writes.length, 1);
    work.startComposition(); work.update({ summary: '还未确认的第二稿' }); resolveWrite();
    await assert.rejects(flushing, /输入法|草稿/);
    assert.equal(f.writes.length, 1); assert.equal(work.getSnapshot().dirty, true);
    assert.equal(work.getSnapshot().values!.summary, '还未确认的第二稿');
    work.endComposition(); f.pauseWrite(undefined); await flushDashboardEdits(f.api, f.manager);
    assert.equal(f.writes.length, 2); assert.deepEqual(f.writes[1].patch, { summary: '还未确认的第二稿' });
  } finally { resolveWrite(); f.dispose(); }
});

test('interrupted showcase composition blocks navigation until the retained draft is explicitly confirmed', async () => {
  const f = fixture();
  try {
    const showcase = getShowcaseManager(f.api, timerWindow)!.getSession('showcase', 'image'); await showcase.refresh();
    showcase.startComposition(); showcase.updateName('名称中间稿'); showcase.update('描述中间稿'); showcase.interruptComposition();
    await assert.rejects(flushDashboardEdits(f.api, f.manager), /输入法/);
    assert.equal(f.writes.length, 0);
    assert.equal(getShowcaseManager(f.api)!.recoveryDrafts()[0].name, '名称中间稿');
    await showcase.retry(); await flushDashboardEdits(f.api, f.manager); assert.equal(f.writes.length, 1);
  } finally { f.dispose(); }
});

test('module title pending and failed saves synchronously block navigation until a successful retry', async () => {
  const f = fixture(), hooks = new Hooks();
  let finish!: (saved: boolean) => void;
  let pending = new Promise<boolean>(resolve => { finish = resolve; });
  const element = { textContent: '原模块', dataset: {} as Record<string, string>, ownerDocument: { getSelection: () => null } };
  const surface = { ownerDocument: { activeElement: null }, querySelector: (selector: string) => {
    if (selector.includes('editable-composing')) return element.dataset.editableComposing === 'true' ? element : null;
    return element.dataset.editableSaving === 'true' || element.dataset.editableError === 'true' ? element : null;
  } } as unknown as HTMLElement;
  try {
    const tree = hooks.render(ui.Text, { value: '原模块', onSave: () => pending }), title = nodes(tree).find(node => node.props.contentEditable)!;
    title.props.ref.current = element; hooks.runEffects(); element.textContent = '保留名称';
    title.props.onInput({ currentTarget: element, nativeEvent: { isComposing: false } }); title.props.onBlur({ currentTarget: element });
    assert.equal(element.dataset.editableSaving, 'true');
    await assert.rejects(flushDashboardEdits(f.api, f.manager, surface), /模块名称尚未保存/);
    assert.equal(f.writes.length, 0); finish(false); await tick();
    assert.equal(element.dataset.editableSaving, 'false'); assert.equal(element.dataset.editableError, 'true'); assert.equal(element.textContent, '保留名称');
    await assert.rejects(flushDashboardEdits(f.api, f.manager, surface), /模块名称尚未保存/);
    pending = new Promise<boolean>(resolve => { finish = resolve; }); title.props.onBlur({ currentTarget: element }); finish(true); await tick();
    assert.equal(element.dataset.editableSaving, 'false'); assert.equal(element.dataset.editableError, 'false');
    await flushDashboardEdits(f.api, f.manager, surface);
  } finally { finish(true); hooks.dispose(); f.dispose(); }
});

test('module title composition and cancellation set the same synchronous flags checked by navigation', async () => {
  const f = fixture(), hooks = new Hooks();
  let title: React.ReactElement<any>;
  const element = { textContent: '原模块', dataset: {} as Record<string, string>, ownerDocument: { getSelection: () => null }, blur: () => title.props.onBlur({ currentTarget: element }) };
  const surface = { ownerDocument: { activeElement: null }, querySelector: (selector: string) => selector.includes('editable-composing') && element.dataset.editableComposing === 'true' ? element : null } as unknown as HTMLElement;
  let saves = 0;
  try {
    title = nodes(hooks.render(ui.Text, { value: '原模块', onSave: async () => { saves++; return true; } })).find(node => node.props.contentEditable)!;
    title.props.ref.current = element; hooks.runEffects(); title.props.onCompositionStart({ currentTarget: element }); element.textContent = '输入中';
    await assert.rejects(flushDashboardEdits(f.api, f.manager, surface), /输入法/); assert.equal(saves, 0);
    title.props.onCompositionEnd({ currentTarget: element }); assert.equal(element.dataset.editableComposing, 'false');
    element.dataset.editableError = 'true';
    title.props.onKeyDown({ key: 'Escape', keyCode: 27, nativeEvent: { isComposing: false }, currentTarget: element, preventDefault() {}, stopPropagation() {} });
    assert.equal(element.textContent, '原模块'); assert.equal(element.dataset.editableError, 'false'); assert.equal(saves, 0);
    await flushDashboardEdits(f.api, f.manager, surface);
  } finally { hooks.dispose(); f.dispose(); }
});

test('navigation checks title status again after a slow card save', async () => {
  const f = fixture(); let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const manager = { flushAll: () => pending, recoveryDrafts: () => [] } as unknown as WorkPropertiesManager;
  let failedTitle = false;
  const surface = { ownerDocument: { activeElement: null }, querySelector: (selector: string) => !selector.includes('editable-composing') && failedTitle ? {} : null } as unknown as HTMLElement;
  try {
    const flush = flushDashboardEdits(f.api, manager, surface); failedTitle = true; finish();
    await assert.rejects(flush, /模块名称尚未保存/);
  } finally { finish(); f.dispose(); }
});

test('failed sorting drafts stay separate for each dashboard, all modules and note embeds across remounts', async () => {
  const f = fixture(), first = new Hooks(), second = new Hooks(), all = new Hooks(), embedded = new Hooks(), restored = new Hooks();
  try {
    const props = { api: f.api, manager: f.manager, dashboard: boardA };
    const list = surfaceList(first, props), failedOrder = ['film', 'missing', 'book', 'custom-a'];
    f.settingsFail('排序冲突'); list.props.retainDraft(failedOrder); await assert.rejects(list.props.save(failedOrder), /排序冲突/);
    assert.equal(surfaceList(second, { ...props, dashboard: boardB }).props.initialDraft, undefined);
    assert.equal(surfaceList(all, { api: f.api, manager: f.manager }).props.initialDraft, undefined);
    assert.deepEqual(surfaceList(restored, props).props.initialDraft, failedOrder);
    const embed = { id: 'note', modules: [{ id: 'one', collection: 'book' }, { id: 'two', collection: 'film' }] };
    let retained: string[] | null = null;
    const local = surfaceList(embedded, { api: f.api, manager: f.manager, embed, retainDraft: draft => { retained = draft; } });
    local.props.retainDraft(['two', 'one']); assert.deepEqual(retained, ['two', 'one']);
    assert.deepEqual(surfaceList(new Hooks(), props).props.initialDraft, failedOrder);
    assert.deepEqual(f.api.getSnapshot().settings.standaloneOrder, ['film', 'custom-a', 'book']);
    f.settingsFail(''); await surfaceList(restored, props).props.save(failedOrder); list.props.retainDraft(null);
    assert.deepEqual(f.api.getSnapshot().settings.dashboards![0].moduleIds, failedOrder);
    assert.deepEqual(f.api.getSnapshot().settings.dashboards![1], boardB);
    assert.equal(surfaceList(new Hooks(), props).props.initialDraft, undefined);
  } finally { for (const hooks of [first, second, all, embedded, restored]) hooks.dispose(); f.dispose(); }
});

test('remounted failed dashboard sorting keeps its first baseline and rejects an external reorder on retry', async () => {
  const f = fixture(), original = new Hooks(), restored = new Hooks();
  const draft = ['film', 'missing', 'book', 'custom-a'], externalOrder = ['book', 'custom-a', 'missing', 'film'];
  try {
    const list = surfaceList(original, { api: f.api, manager: f.manager, dashboard: boardA });
    f.settingsFail('首次排序未保存'); list.props.retainDraft(draft);
    await assert.rejects(list.props.save(draft), /首次排序未保存/);
    original.dispose(); f.settingsFail('');
    const external = { ...boardA, moduleIds: externalOrder };
    f.replace({ ...f.api.getSnapshot(), settings: { ...f.api.getSnapshot().settings, dashboards: [external, boardB] } });
    const retry = surfaceList(restored, { api: f.api, manager: f.manager, dashboard: external });
    assert.deepEqual(retry.props.initialDraft, draft);
    // ModuleList retains again before every attempt; that must not replace the original baseline.
    retry.props.retainDraft(draft); const writesBeforeRetry = f.patches.length;
    await assert.rejects(retry.props.save(draft), /其他位置修改.*草稿已保留/);
    assert.equal(f.patches.length, writesBeforeRetry);
    assert.deepEqual(f.api.getSnapshot().settings.dashboards![0].moduleIds, externalOrder);
    assert.deepEqual(surfaceList(new Hooks(), { api: f.api, manager: f.manager, dashboard: external }).props.initialDraft, draft);
    assert.equal(surfaceList(new Hooks(), { api: f.api, manager: f.manager, dashboard: boardB }).props.initialDraft, undefined);
    assert.equal(surfaceList(new Hooks(), { api: f.api, manager: f.manager }).props.initialDraft, undefined);
    retry.props.retainDraft(null);
    assert.equal(surfaceList(new Hooks(), { api: f.api, manager: f.manager, dashboard: external }).props.initialDraft, undefined);
  } finally { original.dispose(); restored.dispose(); f.dispose(); }
});

test('composition starting during a pending tab click prevents the view change even without a dirty session', async () => {
  const f = fixture(), hooks = new Hooks(), changes: string[] = [];
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const manager = { flushAll: () => pending, recoveryDrafts: () => [] } as unknown as WorkPropertiesManager;
  const props = { api: f.api, manager, dashboardId: 'all', onDashboardChange: (id: string) => changes.push(id) };
  try {
    const tree = hooks.render(ui.Dashboard, props); hooks.runEffects();
    const tab = nodes(tree).find(node => node.props.role === 'tab' && node.props.children === boardA.title)!;
    tab.props.onClick();
    const wrapper = nodes(tree).find(node => typeof node.props.onCompositionStartCapture === 'function')!, target = new EventTarget();
    wrapper.props.onCompositionStartCapture({ target }); finish(); await tick();
    assert.deepEqual(changes, []);
    assert.ok(nodes(hooks.render(ui.Dashboard, props)).some(node => node.props.role === 'alert' && String(node.props.children).includes('输入法')));
    wrapper.props.onCompositionEndCapture({ target }); tab.props.onClick(); await tick(); assert.deepEqual(changes, [boardA.id]);
  } finally { finish(); hooks.dispose(); f.dispose(); }
});

test('deleted selected dashboard retains its modules when draft flushing fails, then permits explicit fallback', async () => {
  const f = fixture(), hooks = new Hooks(), changes: string[] = [];
  const props = { api: f.api, manager: f.manager, dashboardId: boardA.id, onDashboardChange: (id: string) => changes.push(id) };
  try {
    const work = f.manager.getSession('reading'); await work.refresh(); work.startComposition(); work.update({ summary: '保留的摘要' });
    hooks.render(ui.Dashboard, props); hooks.runEffects();
    f.replace({ ...f.api.getSnapshot(), settings: { ...f.api.getSnapshot().settings, dashboards: [boardB] } });
    hooks.render(ui.Dashboard, props); hooks.runEffects(); await tick();
    const tree = hooks.render(ui.Dashboard, props), surface = nodes(tree).find(node => node.type === ui.Surface)!;
    assert.equal(surface.props.dashboard.id, boardA.id); assert.deepEqual(changes, []);
    const panel = nodes(tree).find(node => node.props.role === 'tabpanel')!;
    assert.ok(nodes(tree).some(node => node.props.id === panel.props['aria-labelledby'] && node.props['aria-selected']));
    assert.equal(work.getSnapshot().values!.summary, '保留的摘要');
    work.endComposition(); const allTab = nodes(tree).find(node => node.props.role === 'tab' && node.props.children === '全部')!;
    allTab.props.onClick(); await tick(); assert.deepEqual(changes, ['all']); assert.equal(work.getSnapshot().dirty, false);
  } finally { hooks.dispose(); f.dispose(); }
});

test('dashboard keyboard focus uses the initiating tab owner and leaves IME keys alone', () => {
  const f = fixture(), hooks = new Hooks(), focused: number[] = [];
  try {
    const tree = hooks.render(ui.Dashboard, { api: f.api, manager: f.manager, dashboardId: 'all', onDashboardChange() {} });
    const tab = nodes(tree).find(node => node.props.role === 'tab')!, targets = [0, 1, 2].map(index => ({ focus: () => focused.push(index) }));
    const currentTarget = { parentElement: { querySelectorAll: () => targets } };
    let prevented = 0;
    tab.props.onKeyDown({ key: 'ArrowRight', nativeEvent: { isComposing: true }, currentTarget, preventDefault: () => { prevented++; } });
    assert.deepEqual(focused, []); assert.equal(prevented, 0);
    tab.props.onKeyDown({ key: 'ArrowRight', nativeEvent: { isComposing: false }, currentTarget, preventDefault: () => { prevented++; } });
    tab.props.onKeyDown({ key: 'End', nativeEvent: { isComposing: false }, currentTarget, preventDefault: () => { prevented++; } });
    assert.deepEqual(focused, [1, 2]); assert.equal(prevented, 2);
  } finally { hooks.dispose(); f.dispose(); }
});

test('native leaf state preserves each dashboard independently and closes only its own root', async () => {
  const f = fixture(), start = ui.renderedRoots.length;
  let requested = 0, closed = 0, disposed = 0;
  const manager = { flushAll: async () => {}, recoveryDrafts: () => [], dispose: () => { disposed++; } } as unknown as WorkPropertiesManager;
  const app = { workspace: { requestSaveLayout: () => { requested++; } } };
  const leaf = () => ({ app, contentEl: { empty() {}, querySelector() { return null; }, contains() { return false; }, ownerDocument: { defaultView: timerWindow, activeElement: null } } });
  const plugin = { cardsLease: { api: f.api, propertiesManager: manager } };
  const first = new ui.CardsView(leaf(), plugin, () => { closed++; }), second = new ui.CardsView(leaf(), plugin, () => { closed++; });
  try {
    await first.setState({ dashboardId: boardA.id }, {}); await first.onOpen();
    await second.setState({ dashboardId: boardB.id }, {}); await second.onOpen();
    assert.deepEqual(first.getState(), { existing: 'retained', dashboardId: boardA.id });
    assert.deepEqual(second.getState(), { existing: 'retained', dashboardId: boardB.id });
    assert.equal(first.getViewType(), 'barry-cards');
    const root = ui.renderedRoots[start]; root.element.props.onDashboardChange('all');
    assert.equal(first.getState().dashboardId, 'all'); assert.equal(second.getState().dashboardId, boardB.id); assert.equal(requested, 1);
    await first.onClose(); assert.equal(root.unmounted, true); assert.equal(ui.renderedRoots[start + 1].unmounted, false);
    assert.equal(closed, 1); assert.equal(disposed, 0);
    await second.setState({ dashboardId: 42 }, {}); assert.equal(second.getState().dashboardId, 'all');
  } finally { await second.onClose(); f.dispose(); }
});
