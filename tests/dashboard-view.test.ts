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
import { getShowcaseRenderOperations } from '../src/showcase-render-state';
import { createWork } from '../src/domain';
import { freshCardsSettings, readModuleDraft } from '../src/settings';
import type { CardsAPI, CardsDashboard, CardsSettings, CardsSnapshot, ShowcaseCard, Work, WorkProperties, WorkPropertyValues } from '../src/types';
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
  let pause: (() => Promise<void>) | undefined, settingsPause: (() => Promise<void>) | undefined;
  const api = {
    ...(supported ? { supportsDashboards: true, supportsDashboardOnlyNavigation: true, supportsStandaloneModuleVisibility: true, supportsModuleDeletion: true } : {}),
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    coverUrl: (value: string) => value,
    saveSettings: async (patch: Partial<CardsSettings>) => {
      patches.push(structuredClone(patch));
      if (settingsPause) await settingsPause();
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
    pauseSettings: (wait: (() => Promise<void>) | undefined) => { settingsPause = wait; },
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
  stdin: { contents: `${source}\nexport { CardsView };\nexport { default as Dashboard, DashboardEditor, flushDashboardEdits } from './CardsDashboardView';\nexport { default as ActionMenu } from './ActionMenu';\nexport { default as ModuleRemovalDialog } from './ModuleRemovalDialog';\nexport { default as Surface, registerCardModuleSurface, assertCardModuleRemovalSettled } from './CardsSurface';\nexport { default as Text } from './EditableText';\nexport { default as ModuleList } from './ModuleList';\nexport { WorkOrderList } from './WorkOrder';\nexport { default as WorkCollection } from './WorkCollection';\nexport { default as ShowcaseCollection } from './ShowcaseCollection';\nexport { DeleteWorkDialog } from './WorkEditor';\nexport { renderedRoots } from 'react-dom/client';`, resolveDir: resolve(directory, '../src'), loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react', 'react/jsx-runtime'],
  plugins: [{ name: 'dashboard-view-platform', setup(builder) {
    builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'platform', namespace: 'dashboard-test' }));
    builder.onLoad({ filter: /.*/, namespace: 'dashboard-test' }, () => ({ contents: `export * from ${JSON.stringify(resolve(directory, 'obsidian-mock.ts'))};
      export const Platform={isDesktopApp:true}; export const requireApiVersion=()=>false; export function addIcon(){} export function setIcon(){}
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
  Dashboard: typeof CardsDashboardView; DashboardEditor: typeof import('../src/CardsDashboardView').DashboardEditor; ActionMenu: typeof import('../src/ActionMenu').default; Surface: typeof CardsSurface; renderedRoots: RootStub[];
  Text: typeof import('../src/EditableText').default;
  ModuleList: typeof import('../src/ModuleList').default;
  WorkOrderList: typeof import('../src/WorkOrder').WorkOrderList;
  WorkCollection: typeof import('../src/WorkCollection').default;
  ShowcaseCollection: typeof import('../src/ShowcaseCollection').default;
  DeleteWorkDialog: typeof import('../src/WorkEditor').DeleteWorkDialog;
  ModuleRemovalDialog: typeof import('../src/ModuleRemovalDialog').default;
  registerCardModuleSurface: typeof import('../src/CardsSurface').registerCardModuleSurface;
  assertCardModuleRemovalSettled: typeof import('../src/CardsSurface').assertCardModuleRemovalSettled;
  flushDashboardEdits: typeof import('../src/CardsDashboardView').flushDashboardEdits;
  CardsView: new (leaf: unknown, plugin: unknown, closed: () => void) => ViewStub;
};
const peerModule = { exports: {} };
new Function('require', 'module', 'exports', memoryBundle.outputFiles[0].text)((name: string) => name === 'react' ? reactProxy : require(name), peerModule, peerModule.exports);
const peerUI = peerModule.exports as typeof ui;
const flushDashboardEdits = ui.flushDashboardEdits;
const surfaceList = (hooks: Hooks, props: React.ComponentProps<typeof CardsSurface>) => nodes(hooks.render(ui.Surface, props)).find(node => typeof node.props.save === 'function' && Array.isArray(node.props.ids))!;


test('dashboard and embed render their own order while no-dashboard surfaces stay empty without changing membership', () => {
  const f = fixture();
  try {
    const original = structuredClone(f.api.getSnapshot());
    assert.deepEqual(moduleOrder(renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager, dashboard: boardA }))), boardA.moduleIds);
    assert.deepEqual(moduleOrder(renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager }))), []);
    const embed: CardsEmbed = { id: 'note-block', modules: [{ id: 'reading-instance', collection: 'book' }, { id: 'film-instance', collection: 'film' }] };
    assert.deepEqual(moduleOrder(renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager, embed }))), ['reading-instance', 'film-instance']);
    assert.deepEqual(f.api.getSnapshot(), original);
    assert.equal(f.patches.length, 0);
  } finally { f.dispose(); }
});

test('legacy runtime hides former dashboard members and embeds explain the missing capability', () => {
  const f = fixture(false);
  try {
    f.replace({ ...f.api.getSnapshot(), settings: { ...f.api.getSnapshot().settings, hiddenModuleIds: ['book'] } });
    const html = renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager, dashboard: boardA }));
    assert.deepEqual(moduleOrder(html), ['custom-a', 'missing', 'film']);
    assert.ok(html.includes('集合未找到'));
    assert.deepEqual(f.api.getSnapshot().settings.dashboards![0].moduleIds, boardA.moduleIds);
    const embed = { id: 'alias-block', modules: [{ id: 'preserved', collection: 'book' }] };
    const hidden = renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager, embed }));
    assert.deepEqual(moduleOrder(hidden), ['preserved']);
    assert.ok(hidden.includes('升级兼容插件')); assert.equal(hidden.includes('恢复模块'), false);
  } finally { f.dispose(); }
});

test('older shared API renders existing classifications read-only without showing an all-library page', () => {
  const f = fixture(false);
  try {
    const html = renderToStaticMarkup(React.createElement(ui.Dashboard, { api: f.api, manager: f.manager, dashboardId: boardA.id, onDashboardChange() {} }));
    assert.equal([...html.matchAll(/role="tab"/g)].length, 2);
    assert.equal(html.includes('>全部</button>'), false);
    assert.ok(html.includes('仅支持只读分类')); assert.ok(html.includes('>书与收藏</button>'));
    assert.deepEqual(moduleOrder(html), boardA.moduleIds);
    assert.equal(html.includes('bw-module-handle'), false); assert.equal(html.includes('添加书籍'), false);
    assert.deepEqual(f.api.getSnapshot().settings.dashboards, [boardA, boardB]); assert.equal(f.patches.length, 0);
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
    if (selector.includes('data-cards-pending')) return null;
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

for (const phase of ['before compositionstart', 'during composition', 'after compositionend'] as const) {
  test(`editable title ignores IME Enter and Escape ${phase}, then handles confirmed keys`, async () => {
    for (const key of ['Enter', 'Escape']) {
      const hooks = new Hooks(), saves: string[] = [];
      let title: React.ReactElement<any>, blurred = 0, prevented = 0, stopped = 0;
      const element = {
        textContent: '原模块', dataset: { editableError: 'true' } as Record<string, string>,
        ownerDocument: { getSelection: () => null },
        blur: () => { blurred++; title.props.onBlur({ currentTarget: element }); },
      };
      try {
        title = nodes(hooks.render(ui.Text, { value: '原模块', onSave: async value => { saves.push(value); return true; } })).find(node => node.props.contentEditable)!;
        title.props.ref.current = element; hooks.runEffects(); title.props.onFocus();
        if (phase !== 'before compositionstart') title.props.onCompositionStart({ currentTarget: element });
        element.textContent = '候选名称😀';
        if (phase === 'after compositionend') title.props.onCompositionEnd({ currentTarget: element });
        else title.props.onInput({ currentTarget: element, nativeEvent: { isComposing: false } });
        const event = { key, keyCode: phase === 'during composition' ? (key === 'Enter' ? 13 : 27) : 229, nativeEvent: { isComposing: false }, currentTarget: element, preventDefault: () => { prevented++; }, stopPropagation: () => { stopped++; } };
        title.props.onKeyDown(event); await tick();
        assert.equal(element.textContent, '候选名称😀'); assert.equal(element.dataset.editableError, 'true');
        assert.equal(blurred, 0); assert.equal(prevented, 0); assert.equal(stopped, 0); assert.deepEqual(saves, []);
        assert.equal(element.dataset.editableSaving, undefined);
        if (phase === 'during composition') title.props.onCompositionEnd({ currentTarget: element });
        title.props.onKeyDown({ ...event, keyCode: key === 'Enter' ? 13 : 27 }); await tick();
        assert.equal(blurred, 1); assert.equal(prevented, 1); assert.equal(stopped, 1);
        assert.equal(element.textContent, key === 'Enter' ? '候选名称😀' : '原模块');
        assert.deepEqual(saves, key === 'Enter' ? ['候选名称😀'] : []);
        assert.equal(element.dataset.editableError, 'false');
      } finally { hooks.dispose(); }
    }
  });
}

for (const [kind, limit] of [['title', 180], ['subtitle', 300]] as const) {
  test(`paste inserts only sanitized ${kind} plain text through insertText without the range fallback`, async () => {
    const hooks = new Hooks(), saves: string[] = [], reads: string[] = [], commands: unknown[][] = [];
    let prevented = 0;
    const expected = `前 😀${'字'.repeat(limit - 3)}`;
    const element = {
      textContent: '', dataset: {} as Record<string, string>, ownerDocument: {
        execCommand: (...args: unknown[]) => { commands.push(args); element.textContent = String(args[2]); return true; },
        getSelection: () => { assert.fail('successful insertText must not use the range fallback'); },
        createRange: () => { assert.fail('successful insertText must not create a range'); },
        createTextNode: () => { assert.fail('successful insertText must not create a fallback text node'); },
      },
    };
    try {
      const title = nodes(hooks.render(ui.Text, { kind, value: '原模块', onSave: async value => { saves.push(value); return true; } })).find(node => node.props.contentEditable)!;
      title.props.ref.current = element; hooks.runEffects();
      title.props.onPaste({ currentTarget: element, preventDefault: () => { prevented++; }, clipboardData: { getData: (type: string) => { reads.push(type); return type === 'text/plain' ? `前\r\n\t\u2028\u2029\u0000\u007f😀${'字'.repeat(limit)}` : '<img src=x onerror=alert(1)>'; } } });
      assert.equal(prevented, 1); assert.deepEqual(reads, ['text/plain']); assert.deepEqual(commands, [['insertText', false, expected]]);
      assert.equal(element.textContent, expected); assert.equal(Array.from(element.textContent).length, limit);
      assert.deepEqual(saves, []); title.props.onBlur({ currentTarget: element }); await tick(); assert.deepEqual(saves, [expected]);
    } finally { hooks.dispose(); }
  });
}

test('paste range fallback replaces only the selection inside the editable title with a text node', async () => {
  const hooks = new Hooks(), saves: string[] = [], reads: string[] = [], calls: string[] = [];
  const child = {}, expected = '丁 丙<b>字</b>';
  const range = {
    commonAncestorContainer: child,
    deleteContents: () => { calls.push('delete'); element.textContent = '甲'; },
    insertNode: (node: { textContent: string }) => { calls.push('insert'); element.textContent += node.textContent; },
    setStartAfter: (node: { textContent: string }) => { calls.push('caret'); assert.equal(node.textContent, expected); },
    collapse: (start: boolean) => { calls.push('collapse'); assert.equal(start, true); },
  };
  const selection = { rangeCount: 1, getRangeAt: () => range, removeAllRanges: () => { calls.push('remove'); }, addRange: (next: unknown) => { calls.push('add'); assert.equal(next, range); } };
  const element = {
    textContent: '甲乙', dataset: {} as Record<string, string>, contains: (node: unknown) => node === child,
    ownerDocument: {
      execCommand: (command: string, _ui: boolean, plain: string) => { assert.equal(command, 'insertText'); assert.equal(plain, expected); return false; },
      getSelection: () => selection,
      createTextNode: (plain: string) => { assert.equal(plain, expected); return { textContent: plain }; },
      createRange: () => { assert.fail('an existing inside selection must be reused'); },
    },
    append: () => { assert.fail('inside selection must be replaced instead of appended'); },
  };
  try {
    const title = nodes(hooks.render(ui.Text, { value: '甲乙', onSave: async value => { saves.push(value); return true; } })).find(node => node.props.contentEditable)!;
    title.props.ref.current = element; hooks.runEffects();
    let prevented = 0;
    title.props.onPaste({ currentTarget: element, preventDefault: () => { prevented++; }, clipboardData: { getData: (type: string) => { reads.push(type); return type === 'text/plain' ? '丁\n丙<b>字</b>' : '<strong>不应插入</strong>'; } } });
    assert.equal(prevented, 1); assert.deepEqual(reads, ['text/plain']);
    assert.deepEqual(calls, ['delete', 'insert', 'caret', 'collapse', 'remove', 'add']);
    assert.equal(element.textContent, `甲${expected}`); title.props.onBlur({ currentTarget: element }); await tick(); assert.deepEqual(saves, [`甲${expected}`]);
  } finally { hooks.dispose(); }
});

test('paste without insertText appends safely when selection is outside and clamps the complete draft', async () => {
  const hooks = new Hooks(), saves: string[] = [], reads: string[] = [], caretTargets: unknown[] = [];
  const outside = {}, expected = `${'甲'.repeat(179)}😀`;
  const externalRange = { commonAncestorContainer: outside, deleteContents: () => assert.fail('outside content must not be deleted'), insertNode: () => assert.fail('outside content must not receive clipboard text') };
  const caretRange = { selectNodeContents: (target: unknown) => { caretTargets.push(target); }, collapse: (start: boolean) => { assert.equal(start, false); } };
  const selection = { rangeCount: 1, getRangeAt: () => externalRange, removeAllRanges() {}, addRange: (range: unknown) => { assert.equal(range, caretRange); } };
  const element = {
    textContent: '甲'.repeat(179), dataset: {} as Record<string, string>, contains: () => false,
    ownerDocument: { getSelection: () => selection, createTextNode: (plain: string) => ({ textContent: plain }), createRange: () => caretRange },
    append: (node: { textContent: string }) => { assert.equal(node.textContent, '😀 后文'); element.textContent += node.textContent; },
  };
  try {
    const title = nodes(hooks.render(ui.Text, { value: element.textContent, onSave: async value => { saves.push(value); return true; } })).find(node => node.props.contentEditable)!;
    title.props.ref.current = element; hooks.runEffects();
    let prevented = 0;
    title.props.onPaste({ currentTarget: element, preventDefault: () => { prevented++; }, clipboardData: { getData: (type: string) => { reads.push(type); return type === 'text/plain' ? '😀\n后文' : '<iframe>不应插入</iframe>'; } } });
    assert.equal(prevented, 1); assert.deepEqual(reads, ['text/plain']); assert.equal(element.textContent, expected);
    assert.equal(caretTargets.length, 2); assert.ok(caretTargets.every(target => target === element));
    title.props.onBlur({ currentTarget: element }); await tick(); assert.deepEqual(saves, [expected]);
  } finally { hooks.dispose(); }
});

test('navigation checks title status again after a slow card save', async () => {
  const f = fixture(); let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const manager = { flushAll: () => pending, recoveryDrafts: () => [] } as unknown as WorkPropertiesManager;
  let failedTitle = false;
  const surface = { ownerDocument: { activeElement: null }, querySelector: (selector: string) => !selector.includes('data-cards-pending') && !selector.includes('editable-composing') && failedTitle ? {} : null } as unknown as HTMLElement;
  try {
    const flush = flushDashboardEdits(f.api, manager, surface); failedTitle = true; finish();
    await assert.rejects(flush, /模块名称尚未保存/);
  } finally { finish(); f.dispose(); }
});

test('failed sorting drafts stay separate for each dashboard and note embeds across remounts', async () => {
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
  const props = { api: f.api, manager, dashboardId: boardB.id, onDashboardChange: (id: string) => changes.push(id) };
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
    work.endComposition(); const fallback = nodes(tree).find(node => node.props.children === '切换到可用 Dashboard')!;
    fallback.props.onClick(); await tick(); assert.deepEqual(changes, [boardB.id]); assert.equal(work.getSnapshot().dirty, false);
  } finally { hooks.dispose(); f.dispose(); }
});

test('dashboard keyboard focus uses the initiating tab owner and leaves IME keys alone', () => {
  const f = fixture(), hooks = new Hooks(), focused: number[] = [];
  try {
    const tree = hooks.render(ui.Dashboard, { api: f.api, manager: f.manager, dashboardId: boardA.id, onDashboardChange() {} });
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
    assert.equal(first.getState().existing, 'retained'); assert.equal(first.getState().dashboardId, boardA.id);
    assert.equal(second.getState().existing, 'retained'); assert.equal(second.getState().dashboardId, boardB.id);
    assert.equal(first.getViewType(), 'barry-cards');
    const root = ui.renderedRoots[start]; root.element.props.onDashboardChange(boardB.id);
    assert.equal(first.getState().dashboardId, boardB.id); assert.equal(second.getState().dashboardId, boardB.id); assert.equal(requested, 1);
    await first.onClose(); assert.equal(root.unmounted, true); assert.equal(ui.renderedRoots[start + 1].unmounted, false);
    assert.equal(closed, 1); assert.equal(disposed, 0);
    await second.setState({ dashboardId: 42 }, {}); assert.equal(second.getState().dashboardId, '');
  } finally { await second.onClose(); f.dispose(); }
});

const dashboardProps = (f: ReturnType<typeof fixture>, dashboardId = boardA.id) => ({ api: f.api, manager: f.manager, dashboardId, onDashboardChange() {} });
const dashboardSurface = (tree: React.ReactNode) => nodes(tree).find(node => node.type === ui.Surface)!;
const menuActions = (tree: React.ReactNode) => nodes(tree).find(node => node.type === ui.ActionMenu)!.props.actions as import('../src/ActionMenu').MenuAction[];
const menuAction = (tree: React.ReactNode, id: string) => menuActions(tree).find(action => action.id === id)!;
const visibleStatus = (tree: React.ReactNode) => nodes(tree).filter(node => node.props.role === 'status').map(node => String(node.props.children)).join('\n');

test('another standalone window protects its sorting and title drafts until saved or closed', async () => {
  const f = fixture(), hooks = new Hooks();
  let pending = 'sorting';
  const element = { ownerDocument: { activeElement: null }, querySelector: (selector: string) => {
    if (selector === '[data-cards-pending]') return pending === 'sorting' ? {} : null;
    if (selector.includes('editable-composing')) return pending === 'composition' ? {} : null;
    return pending === 'title-error' ? {} : null;
  } } as unknown as HTMLDivElement;
  try {
    const tree = hooks.render(ui.Surface, { api: f.api, manager: f.manager, dashboard: boardA });
    nodes(tree).find(node => node.props.className === 'bw-app bw-cards-surface')!.props.ref.current = element;
    hooks.runEffects();
    await assert.rejects(flushDashboardEdits(f.api, f.manager), /排序/);
    pending = 'composition'; await assert.rejects(flushDashboardEdits(f.api, f.manager), /输入法/);
    pending = 'title-error'; await assert.rejects(flushDashboardEdits(f.api, f.manager), /模块名称尚未保存/);
    assert.equal(f.patches.length, 0); assert.equal(f.writes.length, 0);
    hooks.dispose(); await flushDashboardEdits(f.api, f.manager);
  } finally { hooks.dispose(); f.dispose(); }
});

test('updated navigation ignores retired hiding flags and leaves unclassified modules available to embeds', () => {
  const f = fixture();
  try {
    const before = structuredClone(f.api.getSnapshot());
    f.replace({ ...before, settings: { ...before.settings, standaloneHiddenModuleIds: ['book', 'custom-a'], hiddenModuleIds: ['book'] } });
    assert.deepEqual(moduleOrder(renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager }))), []);
    assert.deepEqual(moduleOrder(renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager, dashboard: boardA }))), boardA.moduleIds);
    const embed: CardsEmbed = { id: 'unclassified-note', modules: [{ id: 'reading', collection: 'book' }, { id: 'custom', collection: 'custom-a' }] };
    const html = renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager, embed }));
    assert.deepEqual(moduleOrder(html), ['reading', 'custom']); assert.ok(html.includes('data-work-id="reading"'));
    assert.equal(html.includes('隐藏模块'), false); assert.equal(html.includes('恢复模块'), false);
    assert.deepEqual(f.api.getSnapshot().entities, before.entities); assert.equal(f.patches.length, 0);
  } finally { f.dispose(); }
});

test('deleted modules are absent from standalone and dashboards while note embeds keep missing-module placeholders without restoration', () => {
  const f = fixture();
  try {
    const before = structuredClone(f.api.getSnapshot());
    f.replace({ ...before, settings: { ...before.settings, deletedModuleIds: ['book', 'custom-a'] } });
    assert.deepEqual(moduleOrder(renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager }))), []);
    assert.deepEqual(moduleOrder(renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager, dashboard: boardA }))), ['missing', 'film']);
    const embed: CardsEmbed = { id: 'removed-module-note', modules: [{ id: 'reading', collection: 'book' }, { id: 'custom', collection: 'custom-a' }] };
    const html = renderToStaticMarkup(React.createElement(CardsSurface, { api: f.api, manager: f.manager, embed }));
    assert.deepEqual(moduleOrder(html), ['reading', 'custom']); assert.ok(html.includes('模块已删除'));
    assert.equal(html.includes('恢复模块'), false); assert.equal(html.includes('data-work-id="reading"'), false);
    assert.deepEqual(f.api.getSnapshot().entities, before.entities); assert.equal(f.patches.length, 0);
  } finally { f.dispose(); }
});

test('ordinary, showcase and empty modules expose one menu without module hide, unlink or deletion controls', () => {
  const f = fixture();
  try {
    const snapshot = f.api.getSnapshot();
    const dashboard = { id: 'empty', title: '空模块', moduleIds: ['book', 'film', 'showcase'] };
    f.replace({ ...snapshot, entities: [], settings: { ...snapshot.settings, dashboards: [dashboard], customModules: [...snapshot.settings.customModules, { id: 'showcase', title: '空图片橱窗', kind: 'book', mode: 'showcase', appearance: { style: 'cover', material: 'paper' } }] } });
    const html = renderToStaticMarkup(React.createElement(ui.Dashboard, dashboardProps(f, dashboard.id)));
    assert.equal((html.match(/bw-action-menu-trigger/g) ?? []).length, 4);
    assert.equal(html.includes('data-module-action'), false); assert.equal(html.includes('已隐藏模块'), false);
    assert.ok(/aria-label="删除当前书籍"[^>]*disabled/.test(html)); assert.ok(/aria-label="删除当前图片"[^>]*disabled/.test(html));
  } finally { f.dispose(); }
});

test('settings module deletion confirmation preserves files on cancellation and failure and clears every reference on success', async () => {
  const f = fixture(), hooks = new Hooks(); let cancelled = 0, removed = 0;
  const draft = readModuleDraft(f.api.getSnapshot().settings, 'custom-a')!;
  const props = { api: f.api, manager: f.manager, baseline: draft, close: () => { cancelled++; }, removed: () => { removed++; } };
  try {
    const before = structuredClone(f.api.getSnapshot());
    let tree = hooks.render(ui.ModuleRemovalDialog, props); hooks.runEffects();
    assert.match(renderToStaticMarkup(React.createElement(ui.ModuleRemovalDialog, props)), /所有 Dashboard.*作品笔记和图片文件保留/);
    nodes(tree).find(node => node.props.children === '取消')!.props.onClick(); assert.equal(cancelled, 1); assert.deepEqual(f.api.getSnapshot(), before);
    f.settingsFail('配置不可写'); nodes(tree).find(node => node.props.children === '确认删除模块')!.props.onClick(); await tick(); tree = hooks.render(ui.ModuleRemovalDialog, props);
    assert.ok(nodes(tree).some(node => node.props.role === 'alert' && String(node.props.children).includes('配置不可写'))); assert.deepEqual(f.api.getSnapshot(), before);
    f.settingsFail(''); nodes(tree).find(node => node.props.children === '确认删除模块')!.props.onClick(); await tick();
    assert.equal(removed, 1); assert.equal(cancelled, 2); assert.deepEqual(f.api.getSnapshot().settings.deletedModuleIds, ['custom-a']);
    assert.ok(f.api.getSnapshot().settings.dashboards!.every(board => !board.moduleIds.includes('custom-a'))); assert.deepEqual(f.api.getSnapshot().entities, before.entities); assert.equal(f.writes.length, 0);
  } finally { hooks.dispose(); f.dispose(); }
});

test('closed-view sorting drafts permit returning to their dashboard but prevent settings deletion until discarded', async () => {
  const f = fixture(), original = new Hooks(), hooks = new Hooks(), restored = new Hooks(), changes: string[] = [];
  const props = { ...dashboardProps(f, boardB.id), onDashboardChange: (id: string) => { changes.push(id); } }, draft = ['film', 'missing', 'book', 'custom-a'];
  try {
    const list = surfaceList(original, { api: f.api, manager: f.manager, dashboard: boardA });
    f.settingsFail('排序冲突'); list.props.retainDraft(draft); await assert.rejects(list.props.save(draft), /排序冲突/); original.dispose(); f.settingsFail('');
    await flushDashboardEdits(f.api, f.manager); assert.throws(() => ui.assertCardModuleRemovalSettled(f.api), /排序/);
    const tree = hooks.render(ui.Dashboard, props); hooks.runEffects(); nodes(tree).find(node => node.props.role === 'tab' && node.props.children === boardA.title)!.props.onClick(); await tick(); assert.deepEqual(changes, [boardA.id]);
    const retry = surfaceList(restored, { api: f.api, manager: f.manager, dashboard: boardA }); assert.deepEqual(retry.props.initialDraft, draft);
    retry.props.retainDraft(null); assert.doesNotThrow(() => ui.assertCardModuleRemovalSettled(f.api));
  } finally { original.dispose(); hooks.dispose(); restored.dispose(); f.dispose(); }
});

test('separate plugin bundles share registered surfaces and retained sorting drafts, with cleanup releasing removal guards', () => {
  assert.notEqual(ui.registerCardModuleSurface, peerUI.registerCardModuleSurface);
  for (const [first, second] of [[ui, peerUI], [peerUI, ui]]) {
    const f = fixture(), original = new Hooks(), restored = new Hooks();
    const element = { querySelector: (selector: string) => selector === '[data-cards-pending]' ? {} : null } as unknown as HTMLElement;
    const unregister = first.registerCardModuleSurface(f.api, element), draft = ['film', 'missing', 'book', 'custom-a'];
    try {
      assert.throws(() => second.assertCardModuleRemovalSettled(f.api), /排序/); unregister(); assert.doesNotThrow(() => second.assertCardModuleRemovalSettled(f.api));
      const tree = original.render(first.Surface, { api: f.api, manager: f.manager, dashboard: boardA });
      nodes(tree).find(node => typeof node.props.save === 'function' && Array.isArray(node.props.ids))!.props.retainDraft(draft); original.dispose();
      assert.throws(() => second.assertCardModuleRemovalSettled(f.api), /排序/);
      const remounted = restored.render(second.Surface, { api: f.api, manager: f.manager, dashboard: boardA });
      const retry = nodes(remounted).find(node => typeof node.props.save === 'function' && Array.isArray(node.props.ids))!;
      assert.deepEqual(retry.props.initialDraft, draft); retry.props.retainDraft(null);
      assert.doesNotThrow(() => second.assertCardModuleRemovalSettled(f.api)); assert.equal(f.patches.length, 0);
    } finally { unregister(); original.dispose(); restored.dispose(); f.dispose(); }
  }
});

test('Dashboard category creation has no member controls and saves an empty ordinary classification', async () => {
  const f = fixture(), view = new Hooks(), editor = new Hooks(); let changes: string[] = [];
  const props = { ...dashboardProps(f), onDashboardChange: (id: string) => { changes.push(id); } };
  try {
    let tree = view.render(ui.Dashboard, props); view.runEffects(); menuAction(tree, 'create').select(); await tick(); tree = view.render(ui.Dashboard, props);
    const modal = nodes(tree).find(node => node.type === ui.DashboardEditor)!; let body = editor.render(ui.DashboardEditor, modal.props); editor.runEffects();
    assert.equal(nodes(body).some(node => node.props.type === 'checkbox'), false); assert.deepEqual(modal.props.state.draft.moduleIds, []);
    nodes(body).find(node => node.type === 'input')!.props.onChange({ target: { value: '新分类' } }); body = editor.render(ui.DashboardEditor, modal.props);
    nodes(body).find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} }); await tick();
    const board = f.api.getSnapshot().settings.dashboards!.at(-1)!; assert.equal(board.title, '新分类'); assert.deepEqual(board.moduleIds, []); assert.deepEqual(changes, [board.id]); assert.equal(f.writes.length, 0);
  } finally { view.dispose(); editor.dispose(); f.dispose(); }
});

test('rename and delete category preserve modules, other classification references and data', async () => {
  const f = fixture(), rename = new Hooks(), removal = new Hooks(); const close: string[] = [];
  try {
    const before = structuredClone(f.api.getSnapshot());
    const props = { api: f.api, manager: f.manager, state: { draft: structuredClone(boardA), baseline: structuredClone(boardA) }, close: (id?: string) => { if (id !== undefined) close.push(id); } };
    let tree = rename.render(ui.DashboardEditor, props); rename.runEffects(); nodes(tree).find(node => node.type === 'input')!.props.onChange({ target: { value: '改名' } }); tree = rename.render(ui.DashboardEditor, props); nodes(tree).find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} }); await tick();
    const current = f.api.getSnapshot().settings.dashboards![0]; assert.equal(current.title, '改名'); assert.deepEqual(current.moduleIds, boardA.moduleIds); assert.deepEqual(f.api.getSnapshot().settings.dashboards![1], boardB);
    const deletion = { ...props, state: { draft: structuredClone(current), baseline: structuredClone(current), remove: true } };
    tree = removal.render(ui.DashboardEditor, deletion); removal.runEffects(); assert.equal(nodes(tree).some(node => node.type === 'input'), false); nodes(tree).find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} }); await tick();
    assert.deepEqual(f.api.getSnapshot().settings.dashboards, [boardB]); assert.deepEqual(f.api.getSnapshot().settings.customModules, before.settings.customModules); assert.deepEqual(f.api.getSnapshot().entities, before.entities); assert.equal(f.writes.length, 0); assert.deepEqual(close, [boardA.id, '']);
  } finally { rename.dispose(); removal.dispose(); f.dispose(); }
});

test('composition before or during category navigation prevents writes and preserves the current view', async () => {
  const f = fixture(), hooks = new Hooks(), props = dashboardProps(f);
  try {
    let tree = hooks.render(ui.Dashboard, props); hooks.runEffects();
    const wrapper = nodes(tree).find(node => typeof node.props.onCompositionStartCapture === 'function')!, target = new EventTarget(); wrapper.props.onCompositionStartCapture({ target });
    const toolbar = nodes(tree).find(node => node.props.className === 'bw-dashboard-toolbar')!; let prevented = false; toolbar.props.onPointerDownCapture({ preventDefault: () => { prevented = true; } }); menuAction(tree, 'create').select(); await tick();
    assert.equal(prevented, true); assert.equal(f.patches.length, 0); assert.equal(f.writes.length, 0); assert.equal(nodes(hooks.render(ui.Dashboard, props)).some(node => node.type === ui.DashboardEditor), false);
    wrapper.props.onCompositionEndCapture({ target }); menuAction(hooks.render(ui.Dashboard, props), 'create').select(); await tick(); tree = hooks.render(ui.Dashboard, props); assert.ok(nodes(tree).some(node => node.type === ui.DashboardEditor));
  } finally { hooks.dispose(); f.dispose(); }
});

test('pending card or module operations block category actions before any draft is flushed', async () => {
  const f = fixture(), hooks = new Hooks(), props = dashboardProps(f); let pending = true;
  try {
    const work = f.manager.getSession('reading'); await work.refresh(); work.update({ summary: '保留草稿' }); let tree = hooks.render(ui.Dashboard, props); hooks.runEffects();
    nodes(tree).find(node => node.props.role === 'tabpanel')!.props.ref.current = { querySelector: (selector: string) => selector.includes('data-cards-pending') && pending ? {} : null, ownerDocument: { activeElement: null } };
    menuAction(tree, 'create').select(); await tick(); assert.equal(f.patches.length, 0); assert.equal(f.writes.length, 0); assert.equal(work.getSnapshot().dirty, true);
    tree = hooks.render(ui.Dashboard, props); assert.ok(nodes(tree).some(node => node.props.role === 'alert' && String(node.props.children).includes('排序')));
    pending = false; menuAction(tree, 'create').select(); await tick(); assert.equal(work.getSnapshot().dirty, false);
  } finally { hooks.dispose(); f.dispose(); }
});

test('showcase import retries and failed moves block visibility without discarding their original queue or order baseline', async () => {
  const f = fixture();
  try {
    const snapshot = f.api.getSnapshot(); f.replace({ ...snapshot, settings: { ...snapshot.settings, customModules: [...snapshot.settings.customModules, { id: 'showcase', title: '橱窗', kind: 'book', mode: 'showcase', appearance: { style: 'cover', material: 'paper' } }] } });
    const operations = getShowcaseRenderOperations(f.api, 'showcase')!, file = {} as File;
    operations.update({ imports: [{ id: 'retained-import', file }], importing: true });
    await assert.rejects(flushDashboardEdits(f.api, f.manager), /图片导入或排序/);
    operations.update({ importing: false, failures: [{ id: 'retained-import', error: '图片不可写' }] });
    await assert.rejects(flushDashboardEdits(f.api, f.manager), /图片导入或排序/);
    assert.equal(operations.getSnapshot().imports[0].file, file);
    const move = { id: 'image', beforeId: null, expectedIds: ['image', 'other'] };
    operations.update({ imports: [], failures: [], move, moveError: '正文冲突' });
    await assert.rejects(flushDashboardEdits(f.api, f.manager), /图片导入或排序/);
    assert.equal(operations.getSnapshot().move, move); assert.deepEqual(operations.getSnapshot().move!.expectedIds, ['image', 'other']);
    assert.equal(f.patches.length, 0); assert.equal(f.writes.length, 0);
    operations.update({ move: null, moveError: '' }); await flushDashboardEdits(f.api, f.manager);
  } finally { f.dispose(); }
});

test('ModuleList marks sorting synchronously, retains a failed draft and blocks unmount until retry or discard', async () => {
  const f = fixture(), hooks = new Hooks(); let fail = true;
  const attributes = new Set<string>(), retained: Array<string[] | null> = [], attempts: string[][] = [];
  const props = { ids: ['book', 'film'], save: async (order: string[]) => { attempts.push(order); if (fail) throw new Error('排序磁盘错误'); }, children: (_id: string, handle: React.ReactNode) => handle, retainDraft: (draft: string[] | null) => retained.push(draft) };
  const surface = { querySelector: (selector: string) => selector.includes('data-cards-pending') && attributes.has('data-cards-pending') ? {} : null, ownerDocument: { activeElement: null } } as unknown as HTMLElement;
  try {
    let tree = hooks.render(ui.ModuleList, props); hooks.runEffects();
    nodes(tree).find(node => node.props.className === 'bw-cards-modules')!.props.ref.current = { setAttribute: (name: string) => attributes.add(name), removeAttribute: (name: string) => attributes.delete(name) };
    nodes(tree).find(node => node.props.className?.includes('bw-module-handle'))!.props.onKeyDown({ altKey: true, key: 'ArrowDown', preventDefault() {}, stopPropagation() {}, currentTarget: { isConnected: false } });
    assert.equal(attributes.has('data-cards-pending'), true); await assert.rejects(flushDashboardEdits(f.api, f.manager, surface), /排序/); await tick();
    tree = hooks.render(ui.ModuleList, props); assert.equal(nodes(tree).find(node => node.props.className === 'bw-cards-modules')!.props['data-cards-pending'], 'module-sort');
    assert.deepEqual(retained[0], ['film', 'book']); assert.ok(nodes(tree).some(node => node.props.role === 'alert'));
    fail = false; nodes(tree).find(node => node.props.children === '重试排序草稿')!.props.onClick(); await tick();
    assert.deepEqual(attempts, [['film', 'book'], ['film', 'book']]); assert.equal(attributes.has('data-cards-pending'), false); assert.equal(retained.at(-1), null);
    await flushDashboardEdits(f.api, f.manager, surface);
  } finally { hooks.dispose(); f.dispose(); }
});

test('ordinary card sorting retains its first failed baseline, rejects external changes on retry and releases only after explicit discard', async () => {
  const f = fixture(), hooks = new Hooks(); let moves = 0;
  try {
    const snapshot = f.api.getSnapshot(), first = { ...snapshot.entities[0], moduleId: 'custom-a' }, second = { ...first, id: 'second', title: '第二张' };
    f.replace({ ...snapshot, entities: [first, second], workOrder: { book: ['reading', 'second'], film: [] } });
    f.api.moveWork = async () => { moves++; throw new Error('排序不可写'); };
    const props = { api: f.api, kind: 'book' as const, moduleId: 'custom-a' };
    let tree = hooks.render(ui.WorkOrderList, props); hooks.runEffects();
    nodes(tree).find(node => node.props.className === 'bw-order-handle')!.props.onKeyDown({ altKey: true, key: 'ArrowDown', preventDefault() {}, stopPropagation() {} }); await tick();
    tree = hooks.render(ui.WorkOrderList, props);
    assert.equal(nodes(tree).find(node => node.props.className === 'bw-work-order')!.props['data-cards-pending'], 'work-sort');
    assert.deepEqual(nodes(tree).filter(node => node.type === 'li').map(node => node.props['data-work-id']), ['reading', 'second']);
    assert.equal(moves, 1); f.replace({ ...f.api.getSnapshot(), workOrder: { book: ['second', 'reading'], film: [] } });
    nodes(tree).find(node => node.props.children === '重试排序草稿')!.props.onClick(); await tick(); tree = hooks.render(ui.WorkOrderList, props);
    assert.equal(moves, 1); assert.ok(nodes(tree).some(node => node.type === 'p' && String(node.props.children).includes('其他位置改变')));
    assert.equal(nodes(tree).find(node => node.props.className === 'bw-work-order')!.props['data-cards-pending'], 'work-sort');
    nodes(tree).find(node => node.props.children === '放弃排序草稿')!.props.onClick(); tree = hooks.render(ui.WorkOrderList, props);
    assert.equal(nodes(tree).find(node => node.props.className === 'bw-work-order')!.props['data-cards-pending'], undefined);
    assert.deepEqual(f.api.getSnapshot().workOrder!.book, ['second', 'reading']);
  } finally { hooks.dispose(); f.dispose(); }
});

test('single-card delete tooltips and confirmation explicitly name the current ordinary and showcase card', () => {
  const f = fixture(), ordinary = new Hooks(), showcase = new Hooks();
  try {
    const work = f.api.getSnapshot().entities[0];
    const props = { kind: 'book' as const, works: [work], appearance: f.api.getSnapshot().settings.bookCardAppearance, threeCardView: false, manager: f.manager, api: f.api, run: async () => true, edit() {} };
    let tree = ordinary.render(ui.WorkCollection, props); nodes(tree).find(node => typeof node.props.onActiveChange === 'function')!.props.onActiveChange(work.id);
    tree = ordinary.render(ui.WorkCollection, props); const trash = menuAction(tree, 'delete');
    assert.equal(trash.label, '删除当前书籍《书》');
    const dialog = renderToStaticMarkup(React.createElement(ui.DeleteWorkDialog, { work, busy: false, close() {}, remove() {} }));
    assert.ok(dialog.includes('删除当前书籍《书》？')); assert.ok(dialog.includes('确认删除《书》'));
    const module = { id: 'showcase', title: '收藏图', kind: 'book' as const, mode: 'showcase' as const, appearance: { material: 'paper' as const, style: 'cover' as const } };
    const showcaseProps = { module, api: f.api, previewCards: [{ id: 'picture', name: '山顶', image: 'cover.jpg', description: '' }] };
    tree = showcase.render(ui.ShowcaseCollection, showcaseProps); nodes(tree).find(node => typeof node.props.onActiveChange === 'function')!.props.onActiveChange('picture');
    tree = showcase.render(ui.ShowcaseCollection, showcaseProps); const pictureTrash = menuAction(tree, 'delete');
    assert.equal(pictureTrash.label, '删除当前图片《山顶》'); pictureTrash.select();
    tree = showcase.render(ui.ShowcaseCollection, showcaseProps); const pictureDialog = nodes(tree).find(node => typeof node.type === 'function' && node.props.card?.id === 'picture')!;
    assert.ok(renderToStaticMarkup(pictureDialog).includes('确认删除《山顶》'));
  } finally { ordinary.dispose(); showcase.dispose(); f.dispose(); }
});

test('legacy all and invalid leaf selections resolve to the first ordinary Dashboard without creating a classification', async () => {
  for (const selected of ['all', 'missing', '']) {
    const f = fixture(), hooks = new Hooks(), changed: string[] = [];
    try {
      const tree = hooks.render(ui.Dashboard, { ...dashboardProps(f, selected), onDashboardChange: id => changed.push(id) }); hooks.runEffects(); await tick();
      assert.equal(nodes(tree).filter(node => node.props.role === 'tab').length, 2); assert.equal(dashboardSurface(tree).props.dashboard.id, boardA.id);
      assert.deepEqual(changed, [boardA.id]); assert.equal(f.patches.length, 0); assert.equal(f.writes.length, 0);
    } finally { hooks.dispose(); f.dispose(); }
  }
});

test('zero Dashboard renders a creation state while unclassified card data stays untouched', async () => {
  const f = fixture(), hooks = new Hooks(), changed: string[] = [];
  try {
    const before = structuredClone(f.api.getSnapshot()); f.replace({ ...before, settings: { ...before.settings, dashboards: [] } });
    const tree = hooks.render(ui.Dashboard, { ...dashboardProps(f, 'all'), onDashboardChange: id => changed.push(id) }); hooks.runEffects(); await tick();
    assert.equal(nodes(tree).some(node => node.type === ui.Surface), false); assert.equal(nodes(tree).some(node => node.props.role === 'tab'), false);
    assert.ok(nodes(tree).some(node => node.props.children === '新建 Dashboard')); assert.deepEqual(changed, ['']);
    assert.deepEqual(f.api.getSnapshot().entities, before.entities); assert.deepEqual(f.api.getSnapshot().settings.customModules, before.settings.customModules); assert.equal(f.patches.length, 0);
  } finally { hooks.dispose(); f.dispose(); }
});

test('Alt / Option arrows reorder Dashboard tabs only, leaving current selection and inner membership orders intact', async () => {
  const f = fixture(), hooks = new Hooks(), props = dashboardProps(f), changed: string[] = [];
  try {
    const before = structuredClone(f.api.getSnapshot()); const tree = hooks.render(ui.Dashboard, { ...props, onDashboardChange: id => changed.push(id) }); hooks.runEffects();
    const tab = nodes(tree).find(node => node.props.role === 'tab')!;
    tab.props.onKeyDown({ key: 'ArrowRight', altKey: true, nativeEvent: { isComposing: false }, preventDefault() {} }); await tick();
    assert.deepEqual(f.api.getSnapshot().settings.dashboards, [boardB, boardA]); assert.deepEqual(f.api.getSnapshot().settings.standaloneOrder, before.settings.standaloneOrder);
    assert.deepEqual(f.api.getSnapshot().entities, before.entities); assert.deepEqual(changed, []); assert.equal(f.patches.length, 1);
    assert.match(visibleStatus(hooks.render(ui.Dashboard, props)), /顺序已保存/); assert.doesNotThrow(() => ui.assertCardModuleRemovalSettled(f.api));
  } finally { hooks.dispose(); f.dispose(); }
});

test('failed Dashboard tab order restores persisted order, retains its first baseline and retries without changing card data', async () => {
  const f = fixture(), hooks = new Hooks(), props = { ...dashboardProps(f), viewId: 'sorting-window' };
  try {
    const before = structuredClone(f.api.getSnapshot()); let tree = hooks.render(ui.Dashboard, props); hooks.runEffects(); f.settingsFail('磁盘不可写');
    nodes(tree).find(node => node.props.role === 'tab')!.props.onKeyDown({ key: 'ArrowRight', altKey: true, nativeEvent: { isComposing: false }, preventDefault() {} }); await tick(); tree = hooks.render(ui.Dashboard, props);
    assert.deepEqual(f.api.getSnapshot(), before); assert.deepEqual(nodes(tree).filter(node => node.props.role === 'tab').map(node => node.props.children), [boardA.title, boardB.title]);
    assert.ok(nodes(tree).some(node => node.props.role === 'alert' && String(node.props.children).includes('磁盘不可写'))); assert.throws(() => ui.assertCardModuleRemovalSettled(f.api), /Dashboard 排序/);
    f.settingsFail(''); nodes(tree).find(node => node.props.children === '重试 Dashboard 排序')!.props.onClick(); await tick(); tree = hooks.render(ui.Dashboard, props);
    assert.deepEqual(f.api.getSnapshot().settings.dashboards, [boardB, boardA]); assert.equal(nodes(tree).some(node => node.props.children === '重试 Dashboard 排序'), false);
    assert.deepEqual(f.api.getSnapshot().entities, before.entities); assert.doesNotThrow(() => ui.assertCardModuleRemovalSettled(f.api));
  } finally { hooks.dispose(); f.dispose(); }
});

test('tab retry drafts survive remount per leaf and external tab reordering cannot be overwritten', async () => {
  const f = fixture(), first = new Hooks(), resumed = new Hooks(), other = new Hooks(), props = { ...dashboardProps(f), viewId: 'leaf-one' };
  try {
    let tree = first.render(ui.Dashboard, props); first.runEffects(); f.settingsFail('失败'); nodes(tree).find(node => node.props.role === 'tab')!.props.onKeyDown({ key: 'ArrowRight', altKey: true, nativeEvent: { isComposing: false }, preventDefault() {} }); await tick(); first.dispose(); f.settingsFail('');
    const third = { id: 'board-c', title: '外部新增', moduleIds: [] }; f.replace({ ...f.api.getSnapshot(), settings: { ...f.api.getSnapshot().settings, dashboards: [boardA, third, boardB] } });
    tree = resumed.render(ui.Dashboard, props); resumed.runEffects(); assert.ok(nodes(tree).some(node => node.props.children === '重试 Dashboard 排序'));
    assert.equal(nodes(other.render(ui.Dashboard, { ...props, viewId: 'leaf-two' })).some(node => node.props.children === '重试 Dashboard 排序'), false);
    const writes = f.patches.length; nodes(tree).find(node => node.props.children === '重试 Dashboard 排序')!.props.onClick(); await tick(); tree = resumed.render(ui.Dashboard, props);
    assert.equal(f.patches.length, writes); assert.deepEqual(f.api.getSnapshot().settings.dashboards, [boardA, third, boardB]); assert.ok(nodes(tree).some(node => node.props.role === 'alert' && String(node.props.children).includes('草稿已保留')));
    nodes(tree).find(node => node.props.children === '放弃 Dashboard 排序')!.props.onClick(); assert.doesNotThrow(() => ui.assertCardModuleRemovalSettled(f.api));
  } finally { first.dispose(); resumed.dispose(); other.dispose(); f.dispose(); }
});

test('tab dragging uses horizontal midpoint targets and suppresses the trailing click after a move', async () => {
  const f = fixture(), hooks = new Hooks(), changed: string[] = [], props = { ...dashboardProps(f), onDashboardChange: (id: string) => changed.push(id) };
  const owner = { hasPointerCapture: () => true, setPointerCapture() {}, releasePointerCapture() {} };
  try {
    let tree = hooks.render(ui.Dashboard, props); hooks.runEffects();
    const tablist = nodes(tree).find(node => node.props.role === 'tablist')!;
    tablist.props.ref.current = { querySelectorAll: () => [{ dataset: { dashboardId: boardA.id }, getBoundingClientRect: () => ({ left: 0, width: 100 }) }, { dataset: { dashboardId: boardB.id }, getBoundingClientRect: () => ({ left: 100, width: 100 }) }], getBoundingClientRect: () => ({ left: 0, right: 200 }), scrollBy() {} };
    const tab = nodes(tree).find(node => node.props.role === 'tab')!;
    tab.props.onPointerDown({ button: 0, isPrimary: true, pointerId: 1, clientX: 20, currentTarget: owner });
    tab.props.onPointerMove({ pointerId: 1, clientX: 185, preventDefault() {} }); tree = hooks.render(ui.Dashboard, props); assert.equal(nodes(tree).filter(node => node.props['data-drop-after']).length, 1);
    tab.props.onPointerUp({ pointerId: 1 }); tab.props.onClick(); await tick(); assert.deepEqual(f.api.getSnapshot().settings.dashboards, [boardB, boardA]); assert.deepEqual(changed, []);
  } finally { hooks.dispose(); f.dispose(); }
});

test('touch scrolls Dashboard labels without reordering; menu moves preserve membership and reject save failures', async () => {
  const f = fixture(), hooks = new Hooks(), props = dashboardProps(f);
  try {
    const before = structuredClone(f.api.getSnapshot());
    let tree = hooks.render(ui.Dashboard, props); hooks.runEffects();
    const tab = nodes(tree).find(node => node.props.role === 'tab')!;
    tab.props.onPointerDown({ pointerType: 'touch', button: 0, isPrimary: true, pointerId: 7, clientX: 20, currentTarget: { setPointerCapture() { assert.fail('touch must keep native tab scrolling'); } } });
    tab.props.onPointerMove({ pointerId: 7, clientX: 180, preventDefault() { assert.fail('touch scrolling must not be cancelled'); } });
    tab.props.onPointerUp({ pointerId: 7 });
    assert.deepEqual(f.api.getSnapshot(), before);
    assert.equal(menuAction(tree, 'move-before').disabled, true);
    f.settingsFail('移动保存失败'); menuAction(tree, 'move-after').select(); await tick();
    assert.deepEqual(f.api.getSnapshot(), before);
    tree = hooks.render(ui.Dashboard, props);
    assert.ok(nodes(tree).some(node => node.props.role === 'alert' && String(node.props.children).includes('移动保存失败')));
    f.settingsFail(''); nodes(tree).find(node => node.props.children === '重试 Dashboard 排序')!.props.onClick(); await tick();
    assert.deepEqual(f.api.getSnapshot().settings.dashboards, [boardB, boardA]);
    assert.deepEqual(f.api.getSnapshot().entities, before.entities);
  } finally { hooks.dispose(); f.dispose(); }
});

test('Dashboard success notices use the owner window timer and disappear while errors remain', async () => {
  const f = fixture(), hooks = new Hooks(), props = dashboardProps(f), timers: Array<{ callback: () => void; delay: number }> = [], cleared: number[] = [];
  try {
    let tree = hooks.render(ui.Dashboard, props); nodes(tree).find(node => node.props.className === 'bw-app bw-dashboard-view')!.props.ref.current = { ownerDocument: { defaultView: { setTimeout: (callback: () => void, delay: number) => { timers.push({ callback, delay }); return timers.length; }, clearTimeout: (id: number) => cleared.push(id) } } }; hooks.runEffects();
    nodes(tree).find(node => node.props.role === 'tab')!.props.onKeyDown({ key: 'ArrowRight', altKey: true, nativeEvent: { isComposing: false }, preventDefault() {} }); await tick(); tree = hooks.render(ui.Dashboard, props); hooks.runEffects();
    assert.match(visibleStatus(tree), /顺序已保存/); assert.equal(timers.at(-1)!.delay, 4000); timers.at(-1)!.callback(); assert.equal(visibleStatus(hooks.render(ui.Dashboard, props)), '');
    f.settingsFail('不能保存'); tree = hooks.render(ui.Dashboard, props); nodes(tree).find(node => node.props.role === 'tab')!.props.onKeyDown({ key: 'ArrowRight', altKey: true, nativeEvent: { isComposing: false }, preventDefault() {} }); await tick(); tree = hooks.render(ui.Dashboard, props); hooks.runEffects(); assert.ok(nodes(tree).some(node => node.props.role === 'alert' && String(node.props.children).includes('不能保存')));
    nodes(tree).find(node => node.props.children === '放弃 Dashboard 排序')!.props.onClick(); hooks.dispose(); assert.ok(cleared.length > 0);
  } finally { hooks.dispose(); f.dispose(); }
});

test('horizontal menu keeps collapsed actions inert, supports owner-document keyboard focus and cleans up listeners', () => {
  const hooks = new Hooks(), focus: number[] = [], selected: string[] = [];
  const docEvents = new Map<string, (event: Event) => void>(), windowEvents = new Map<string, () => void>();
  const owner = { addEventListener: (name: string, callback: () => void) => windowEvents.set(name, callback), removeEventListener: (name: string) => windowEvents.delete(name) };
  const doc = { defaultView: owner, activeElement: null as object | null, addEventListener: (name: string, callback: (event: Event) => void) => docEvents.set(name, callback), removeEventListener: (name: string) => docEvents.delete(name) };
  const items = [0, 1].map(index => ({ focus: () => { focus.push(index); doc.activeElement = items[index]; } }));
  const root = { ownerDocument: doc, querySelectorAll: () => items };
  const props = { label: '模块操作', actions: [{ id: 'search', label: '搜索', icon: 'search' as const, select: () => selected.push('search') }, { id: 'delete', label: '删除', icon: 'trash' as const, select: () => selected.push('delete') }] };
  const key = (value: string, composing = false) => ({ key: value, nativeEvent: { isComposing: composing }, preventDefault() {}, stopPropagation() {} });
  try {
    let tree = hooks.render(ui.ActionMenu, props); nodes(tree)[0].props.ref.current = root;
    const trigger = nodes(tree).find(node => node.props['aria-haspopup'] === 'menu')!; trigger.props.ref.current = { focus: () => focus.push(-1) };
    assert.ok(nodes(tree).filter(node => node.props.role === 'menuitem').every(node => node.props.disabled && node.props.tabIndex === -1));
    nodes(tree)[0].props.onKeyDown(key('ArrowRight', true)); assert.equal(nodes(hooks.render(ui.ActionMenu, props))[0].props['data-open'], undefined);
    nodes(tree)[0].props.onKeyDown(key('ArrowRight')); tree = hooks.render(ui.ActionMenu, props); hooks.runEffects(); assert.deepEqual(focus, [0]); assert.equal(docEvents.size, 2); assert.equal(windowEvents.size, 1);
    nodes(tree)[0].props.onKeyDown(key('ArrowLeft')); assert.deepEqual(focus, [0, 1]); nodes(tree)[0].props.onKeyDown(key('Home')); assert.equal(focus.at(-1), 0);
    nodes(tree).find(node => node.props['data-menu-action'] === 'search')!.props.onClick(); assert.deepEqual(selected, ['search']); assert.equal(focus.at(-1), -1); assert.equal(nodes(hooks.render(ui.ActionMenu, props))[0].props['data-open'], undefined);
    hooks.dispose(); assert.equal(docEvents.size, 0); assert.equal(windowEvents.size, 0);
  } finally { hooks.dispose(); }
});

test('menu dismissal uses event paths for outside focus and pointer events and ignores IME Escape', () => {
  const hooks = new Hooks(), listeners = new Map<string, (event: Event) => void>(); let restored = 0;
  const root = { ownerDocument: { defaultView: { addEventListener() {}, removeEventListener() {} }, addEventListener: (name: string, callback: (event: Event) => void) => listeners.set(name, callback), removeEventListener: (name: string) => listeners.delete(name) }, querySelectorAll: () => [] };
  const props = { label: '操作', actions: [] };
  try {
    let tree = hooks.render(ui.ActionMenu, props); nodes(tree)[0].props.ref.current = root; const trigger = nodes(tree).find(node => node.props['aria-haspopup'] === 'menu')!; trigger.props.ref.current = { focus: () => { restored++; } }; trigger.props.onClick(); tree = hooks.render(ui.ActionMenu, props); hooks.runEffects();
    listeners.get('pointerdown')!({ composedPath: () => [root] } as unknown as Event); assert.equal(nodes(hooks.render(ui.ActionMenu, props))[0].props['data-open'], 'true');
    nodes(tree)[0].props.onKeyDown({ key: 'Escape', nativeEvent: { isComposing: true }, preventDefault() {}, stopPropagation() {} }); assert.equal(restored, 0);
    listeners.get('focusin')!({ composedPath: () => [] } as unknown as Event); assert.equal(nodes(hooks.render(ui.ActionMenu, props))[0].props['data-open'], undefined);
    trigger.props.onClick(); tree = hooks.render(ui.ActionMenu, props); nodes(tree)[0].props.onKeyDown({ key: 'Escape', nativeEvent: { isComposing: false }, preventDefault() {}, stopPropagation() {} }); assert.equal(restored, 1);
  } finally { hooks.dispose(); }
});

test('Dashboard form preserves unconfirmed IME input and keeps the dialog open after a saving conflict', async () => {
  const f = fixture(), hooks = new Hooks(), closed: string[] = [];
  const props = { api: f.api, manager: f.manager, state: { draft: structuredClone(boardA), baseline: structuredClone(boardA) }, close: (id?: string) => { if (id !== undefined) closed.push(id); } };
  try {
    let tree = hooks.render(ui.DashboardEditor, props); hooks.runEffects(); nodes(tree)[0].props.onCompositionStartCapture(); nodes(tree).find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} }); await tick(); assert.equal(f.patches.length, 0); assert.deepEqual(closed, []);
    tree = hooks.render(ui.DashboardEditor, props); assert.ok(nodes(tree).some(node => node.props.role === 'alert' && String(node.props.children).includes('输入法')));
    nodes(tree)[0].props.onCompositionEndCapture(); nodes(tree).find(node => node.type === 'input')!.props.onChange({ target: { value: '保留名称' } }); tree = hooks.render(ui.DashboardEditor, props); f.settingsFail('并发冲突'); nodes(tree).find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} }); await tick(); tree = hooks.render(ui.DashboardEditor, props);
    assert.equal(nodes(tree).find(node => node.type === 'input')!.props.value, '保留名称'); assert.deepEqual(closed, []); assert.ok(nodes(tree).some(node => node.props.role === 'alert' && String(node.props.children).includes('并发冲突')));
  } finally { hooks.dispose(); f.dispose(); }
});

test('deleting a Dashboard cannot strand a closed-leaf module ordering draft', async () => {
  const f = fixture(), original = new Hooks(), editor = new Hooks(), recovered = new Hooks(); let closed = false;
  const props = { api: f.api, manager: f.manager, state: { draft: structuredClone(boardA), baseline: structuredClone(boardA), remove: true }, close: () => { closed = true; } };
  try {
    const list = surfaceList(original, { api: f.api, manager: f.manager, dashboard: boardA }); list.props.retainDraft(['film', 'missing', 'book', 'custom-a']); original.dispose();
    let tree = editor.render(ui.DashboardEditor, props); editor.runEffects(); nodes(tree).find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} }); await tick(); tree = editor.render(ui.DashboardEditor, props);
    assert.equal(closed, false); assert.equal(f.patches.length, 0); assert.deepEqual(f.api.getSnapshot().settings.dashboards, [boardA, boardB]); assert.ok(nodes(tree).some(node => node.props.role === 'alert' && String(node.props.children).includes('排序草稿')));
    const retry = surfaceList(recovered, { api: f.api, manager: f.manager, dashboard: boardA }); assert.deepEqual(retry.props.initialDraft, ['film', 'missing', 'book', 'custom-a']); retry.props.retainDraft(null);
    nodes(tree).find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} }); await tick(); assert.equal(closed, true); assert.deepEqual(f.api.getSnapshot().settings.dashboards, [boardB]); assert.doesNotThrow(() => ui.assertCardModuleRemovalSettled(f.api));
  } finally { original.dispose(); editor.dispose(); recovered.dispose(); f.dispose(); }
});

test('a new leaf recovers closed-leaf tab-order drafts without claiming another active window draft', async () => {
  const f = fixture(), first = new Hooks(), active = new Hooks(), reopened = new Hooks();
  try {
    let tree = first.render(ui.Dashboard, { ...dashboardProps(f), viewId: 'closed-leaf' }); first.runEffects(); f.settingsFail('排序失败'); nodes(tree).find(node => node.props.role === 'tab')!.props.onKeyDown({ key: 'ArrowRight', altKey: true, nativeEvent: { isComposing: false }, preventDefault() {} }); await tick();
    tree = active.render(ui.Dashboard, { ...dashboardProps(f), viewId: 'active-leaf' }); active.runEffects(); tree = active.render(ui.Dashboard, { ...dashboardProps(f), viewId: 'active-leaf' }); assert.equal(nodes(tree).some(node => node.props.children === '重试 Dashboard 排序'), false);
    first.dispose(); assert.throws(() => ui.assertCardModuleRemovalSettled(f.api), /排序/);
    const newProps = { ...dashboardProps(f), viewId: 'new-leaf' }; reopened.render(ui.Dashboard, newProps); reopened.runEffects(); tree = reopened.render(ui.Dashboard, newProps); assert.ok(nodes(tree).some(node => node.props.children === '重试 Dashboard 排序'));
    nodes(tree).find(node => node.props.children === '放弃 Dashboard 排序')!.props.onClick(); assert.doesNotThrow(() => ui.assertCardModuleRemovalSettled(f.api)); assert.deepEqual(f.api.getSnapshot().settings.dashboards, [boardA, boardB]);
    tree = reopened.render(ui.Dashboard, newProps); assert.equal(nodes(tree).some(node => node.props.children === '重试 Dashboard 排序'), false);
  } finally { first.dispose(); active.dispose(); reopened.dispose(); f.dispose(); }
});

test('missing post-drag click cannot suppress the next intentional tab click and reset timers belong to the owner window', async () => {
  const f = fixture(), hooks = new Hooks(), changed: string[] = [], timers: Array<() => void> = [], cleared: number[] = [];
  const props = { ...dashboardProps(f), onDashboardChange: (id: string) => changed.push(id) };
  const owner = { hasPointerCapture: () => true, setPointerCapture() {}, releasePointerCapture() {}, ownerDocument: { defaultView: { setTimeout: (callback: () => void, delay: number) => { assert.equal(delay, 0); timers.push(callback); return timers.length; }, clearTimeout: (id: number) => cleared.push(id) } } };
  try {
    let tree = hooks.render(ui.Dashboard, props); hooks.runEffects(); const list = nodes(tree).find(node => node.props.role === 'tablist')!;
    list.props.ref.current = { querySelectorAll: () => [{ dataset: { dashboardId: boardA.id }, getBoundingClientRect: () => ({ left: 0, width: 100 }) }, { dataset: { dashboardId: boardB.id }, getBoundingClientRect: () => ({ left: 100, width: 100 }) }], getBoundingClientRect: () => ({ left: 0, right: 200 }), scrollBy() {} };
    const tab = nodes(tree).find(node => node.props.role === 'tab')!; tab.props.onPointerDown({ button: 0, isPrimary: true, pointerId: 1, clientX: 20, currentTarget: owner }); tab.props.onPointerMove({ pointerId: 1, clientX: 185, preventDefault() {} }); tab.props.onPointerUp({ pointerId: 1 }); await tick();
    assert.equal(timers.length, 1); timers[0](); tree = hooks.render(ui.Dashboard, props); const second = nodes(tree).find(node => node.props['data-dashboard-id'] === boardB.id)!; second.props.onClick(); await tick(); assert.deepEqual(changed, [boardB.id]);
    // A cancelled subsequent gesture also owns and releases its pointer without an extra save.
    const current = nodes(hooks.render(ui.Dashboard, props)).find(node => node.props['data-dashboard-id'] === boardA.id)!; current.props.onPointerDown({ button: 0, isPrimary: true, pointerId: 2, clientX: 120, currentTarget: owner }); current.props.onPointerMove({ pointerId: 2, clientX: 10, preventDefault() {} }); current.props.onPointerUp({ pointerId: 2 }); hooks.dispose(); assert.ok(cleared.includes(2));
  } finally { hooks.dispose(); f.dispose(); }
});

test('native keyboard menu activation focuses first and a reverse arrow from the trigger reaches the last action', () => {
  const hooks = new Hooks(), focused: number[] = [];
  const doc = { defaultView: { addEventListener() {}, removeEventListener() {} }, activeElement: null as object | null, addEventListener() {}, removeEventListener() {} };
  const items = [0, 1, 2].map(index => ({ focus: () => { focused.push(index); doc.activeElement = items[index]; } }));
  const root = { ownerDocument: doc, querySelectorAll: () => items }, trigger = { focus: () => { doc.activeElement = trigger; } };
  const props = { label: '操作', actions: ['search', 'add', 'delete'].map(id => ({ id, label: id, icon: 'plus' as const, select() {} })) };
  try {
    let tree = hooks.render(ui.ActionMenu, props); nodes(tree)[0].props.ref.current = root; const button = nodes(tree).find(node => node.props['aria-haspopup'] === 'menu')!; button.props.ref.current = trigger;
    // Enter and Space activate native buttons through click.
    button.props.onClick(); tree = hooks.render(ui.ActionMenu, props); hooks.runEffects(); assert.deepEqual(focused, [0]); trigger.focus();
    nodes(tree)[0].props.onKeyDown({ key: 'ArrowLeft', nativeEvent: { isComposing: false }, preventDefault() {}, stopPropagation() {} }); assert.equal(focused.at(-1), 2);
  } finally { hooks.dispose(); }
});

test('closing a Dashboard dialog during draft flushing cancels every category write', async () => {
  for (const remove of [false, true]) {
    const f = fixture(), hooks = new Hooks(); let finish!: () => void, closed = false;
    const waiting = new Promise<void>(resolve => { finish = resolve; });
    const manager = { flushAll: () => waiting, recoveryDrafts: () => [] } as unknown as WorkPropertiesManager;
    const props = { api: f.api, manager, state: { draft: { ...structuredClone(boardA), title: '未提交名称' }, baseline: structuredClone(boardA), remove }, close: () => { closed = true; } };
    try {
      const before = structuredClone(f.api.getSnapshot()); const tree = hooks.render(ui.DashboardEditor, props); hooks.runEffects(); nodes(tree).find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} }); await tick(); hooks.dispose(); finish(); await tick();
      assert.equal(f.patches.length, 0); assert.equal(closed, false); assert.deepEqual(f.api.getSnapshot(), before);
    } finally { finish(); hooks.dispose(); f.dispose(); }
  }
});

test('editing current ordinary card waits for its summary draft and preserves the editor state when saving fails', async () => {
  const f = fixture(), hooks = new Hooks(), edited: Work[] = []; let error = '';
  const work = f.api.getSnapshot().entities[0];
  const props = { kind: 'book' as const, works: [work], appearance: f.api.getSnapshot().settings.bookCardAppearance, threeCardView: false, manager: f.manager, api: f.api, run: async (action: () => Promise<unknown>) => { try { await action(); return true; } catch (failure) { error = String(failure); return false; } }, edit: (card: Work) => edited.push(card) };
  try {
    const session = f.manager.getSession(work.id); await session.refresh(); session.startComposition(); session.update({ summary: '尚未确认的输入' });
    let tree = hooks.render(ui.WorkCollection, props); nodes(tree).find(node => typeof node.props.onActiveChange === 'function')!.props.onActiveChange(work.id); tree = hooks.render(ui.WorkCollection, props); menuAction(tree, 'edit').select(); await tick(); assert.deepEqual(edited, []); assert.match(error, /输入法/); assert.equal(f.writes.length, 0);
    session.endComposition(); f.workFail('不可写'); menuAction(tree, 'edit').select(); await tick(); assert.deepEqual(edited, []); assert.match(error, /不可写/); assert.equal(session.getSnapshot().dirty, true);
    f.workFail(''); menuAction(tree, 'edit').select(); await tick(); assert.equal(edited.length, 1); assert.equal(session.getSnapshot().dirty, false);
  } finally { hooks.dispose(); f.dispose(); }
});

test('keyboard tab ordering restores the same owner-document tab focus after disabled saving controls re-enable', async () => {
  const f = fixture(), hooks = new Hooks(), props = dashboardProps(f); let focused = 0;
  const body = {}, doc = { body, activeElement: body as object };
  const handle = { isConnected: true, ownerDocument: doc, focus: () => { focused++; doc.activeElement = handle; } };
  try {
    let tree = hooks.render(ui.Dashboard, props); hooks.runEffects();
    nodes(tree).find(node => node.props['data-dashboard-id'] === boardA.id)!.props.onKeyDown({ key: 'ArrowRight', altKey: true, nativeEvent: { isComposing: false }, currentTarget: handle, preventDefault() {} }); await tick(); tree = hooks.render(ui.Dashboard, props); hooks.runEffects(); assert.equal(focused, 1); assert.equal(doc.activeElement, handle);
    doc.activeElement = body; nodes(tree).find(node => node.props['data-dashboard-id'] === boardA.id)!.props.onKeyDown({ key: 'ArrowLeft', altKey: true, nativeEvent: { isComposing: false }, currentTarget: handle, preventDefault() {} }); await tick(); hooks.render(ui.Dashboard, props); hooks.runEffects(); assert.equal(focused, 2); assert.deepEqual(f.api.getSnapshot().settings.dashboards, [boardA, boardB]);
  } finally { hooks.dispose(); f.dispose(); }
});
