import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { File } from 'node:buffer';
import { freshCardsSettings } from '../src/settings';
import CardsSurface from '../src/CardsSurface';
import { getWorkImageImports } from '../src/work-image-imports';
import type { NativeCardsHost } from '../src/native-host';
import type { CardsLease } from '../src/runtime';
import type { CardsSnapshot } from '../src/types';
import type { CardDraftSession } from '../src/draft-lifecycle';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = await build({
  stdin: { contents: "export * from './src/native-host';export * from './src/draft-lifecycle';export {registerCardModuleSurface} from './src/CardsSurface';export {roots} from 'react-dom/client';", resolveDir: root },
  bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react', 'react/jsx-runtime'],
  plugins: [{ name: 'native-host-fixture', setup(builder) {
    builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'native-fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'native-fixture' }, () => ({ contents: 'export class Notice { constructor(message){globalThis.__nativeNotices.push(message);} } export const normalizePath=path=>path;', loader: 'js' }));
    builder.onResolve({ filter: /^react-dom\/client$/ }, () => ({ path: 'roots', namespace: 'native-roots' }));
    builder.onLoad({ filter: /.*/, namespace: 'native-roots' }, () => ({ contents: 'export const roots=[];export function createRoot(container){const root={container,element:null,unmounts:0,render(element){this.element=element;},unmount(){this.unmounts++;}};roots.push(root);return root;}', loader: 'js' }));
  } }],
});
const require = createRequire(import.meta.url), memory = { exports: {} };
(globalThis as any).__nativeNotices = [];
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, memory, memory.exports);
const ui = memory.exports as {
  NativeCardsHost: typeof NativeCardsHost;
  nativeModuleCatalog: typeof import('../src/native-host').nativeModuleCatalog;
  recoveryJSON: typeof import('../src/native-host').recoveryJSON;
  registerCardDraft(element: HTMLElement, session: CardDraftSession): () => void;
  registerCardModuleSurface: typeof import('../src/CardsSurface').registerCardModuleSurface;
  roots: Array<{ container: HTMLElement; element: React.ReactElement<{ nativeModule: { id: string; actions?: HTMLElement } }>; unmounts: number }>;
};

class Container {
  inert = false;
  ownerDocument = { name: crypto.randomUUID() };
  attributes = new Map<string, string>();
  listeners = new Map<string, Set<EventListener>>();
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  addEventListener(name: string, callback: EventListener) { const listeners = this.listeners.get(name) ?? new Set(); listeners.add(callback); this.listeners.set(name, listeners); }
  removeEventListener(name: string, callback: EventListener) { this.listeners.get(name)?.delete(callback); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  contains(element: unknown) { return element === this; }
  get element() { return this as unknown as HTMLElement; }
}
function fixture(folder = '工作台') {
  let snapshot: CardsSnapshot = { settings: freshCardsSettings(), loading: false, error: '', entities: [], workOrder: null };
  snapshot.settings.customModules = [
    { id: 'ordinary', title: '收藏', kind: 'book', appearance: { style: 'cover', material: 'paper' } },
    { id: 'showcase', title: '图片', kind: 'film', mode: 'showcase', appearance: { style: 'cover', material: 'paper' } },
  ];
  snapshot.settings.dashboards = [];
  const listeners = new Set<() => void>(), events: Array<[string, unknown]> = [], files = new Map<string, string>();
  let flushes = 0;
  const api = { rootFolder: folder, getSnapshot: () => snapshot, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } };
  const manager = { flushAll: async () => { flushes++; }, recoveryDrafts: () => [] };
  const lease = { api, propertiesManager: manager, ready: Promise.resolve(), release: async () => {} } as unknown as CardsLease;
  const app = { workspace: { trigger: (name: string, value: unknown) => events.push([name, value]) }, vault: { adapter: { write: async (path: string, text: string) => { files.set(path, text); } } } } as unknown as import('obsidian').App;
  const host = new ui.NativeCardsHost(app, lease, '.obsidian/plugins/magical-cards');
  return { host, lease, events, files, listeners, flushes: () => flushes, replace: (next: CardsSnapshot) => { snapshot = next; for (const listener of listeners) listener(); } };
}
const tick = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

test('native module catalog has stable IDs, independent classification and hides only deleted modules', async () => {
  const f = fixture();
  const current = f.host.getSnapshot();
  assert.equal(f.host.version, 1); assert.ok(f.host.instanceId);
  assert.deepEqual(current.modules.map(module => [module.id, module.kind]), [['book', 'book'], ['film', 'film'], ['ordinary', 'book'], ['showcase', 'showcase']]);
  assert.equal(f.host.getSnapshot(), current);
  let notifications = 0; const unsubscribe = f.host.subscribe(() => { notifications++; });
  const state = f.lease.api.getSnapshot();
  f.replace({ ...state, settings: { ...state.settings, hiddenModuleIds: ['ordinary'], standaloneHiddenModuleIds: ['showcase'], deletedModuleIds: ['film'], customModules: state.settings.customModules.map(module => module.id === 'ordinary' ? { ...module, title: '新标题' } : module) } });
  assert.equal(notifications, 1);
  assert.deepEqual(f.host.getSnapshot().modules.map(module => module.id), ['book', 'ordinary', 'showcase']);
  assert.equal(f.host.getSnapshot().modules[1].title, '新标题');
  f.host.announce(); assert.equal(f.events.at(-1)?.[0], 'magical-cards:api-ready'); assert.equal(f.events.at(-1)?.[1], f.host);
  unsubscribe(); await f.host.stop(); assert.equal(f.listeners.size, 0);
  assert.deepEqual(f.events.at(-1), ['magical-cards:api-unavailable', { instanceId: f.host.instanceId }]);
  assert.throws(() => f.host.mountModule(new Container().element, { rootFolder: '工作台', moduleId: 'book' }), /停用/);
});

test('native mounts pass a DOM action slot and use their owner document without a code block', async () => {
  const f = fixture(), container = new Container(), actions = new Container();
  const mount = f.host.mountModule(container.element, { rootFolder: '工作台', moduleId: 'ordinary', actions: actions.element });
  const rendered = ui.roots.at(-1)!;
  assert.equal(rendered.container, container.element);
  assert.deepEqual(rendered.element.props.nativeModule, { id: 'ordinary', actions: actions.element });
  assert.throws(() => f.host.mountModule(container.element, { rootFolder: '工作台', moduleId: 'book' }), /已经挂载/);
  assert.throws(() => f.host.mountModule(new Container().element, { rootFolder: '另一个库', moduleId: 'ordinary' }), /目录已改变/);
  assert.throws(() => f.host.mountModule(new Container().element, { rootFolder: '工作台', moduleId: 'missing' }), /已删除/);
  await mount.dispose(); await mount.dispose(); assert.equal(rendered.unmounts, 1);
  assert.ok([...container.listeners.values()].every(listeners => listeners.size === 0));
  await f.host.stop();
});

test('prepare pauses every duplicate window and late mounts until all nested locks release', async () => {
  const f = fixture(), first = new Container(), second = new Container(), late = new Container();
  f.host.mountModule(first.element, { rootFolder: '工作台', moduleId: 'book' });
  f.host.mountModule(second.element, { rootFolder: '工作台', moduleId: 'book' });
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const unregister = ui.registerCardDraft(first.element, { flush: () => pending, recoveryDrafts: () => [] });
  const preparing = f.host.prepareModules('工作台', ['book']);
  assert.equal(first.inert, true); assert.equal(second.inert, true);
  f.host.mountModule(late.element, { rootFolder: '工作台', moduleId: 'book' }); assert.equal(late.inert, true);
  const nested = f.host.prepareModules('工作台', ['book']);
  finish(); const releaseFirst = await preparing, releaseNested = await nested;
  releaseFirst(); releaseFirst(); assert.equal(first.inert, true); assert.equal(late.inert, true);
  releaseNested(); assert.equal(first.inert, false); assert.equal(second.inert, false); assert.equal(late.inert, false);
  unregister(); await f.host.stop();
});

test('failed flush unlocks all windows and disposal retains its rendering and draft for retry', async () => {
  const f = fixture(), container = new Container();
  const mount = f.host.mountModule(container.element, { rootFolder: '工作台', moduleId: 'book' });
  const rendered = ui.roots.at(-1)!;
  let failure = true;
  const unregister = ui.registerCardDraft(container.element, { flush: async () => { if (failure) throw new Error('保存冲突'); }, recoveryDrafts: () => [{ type: 'work-editor', title: '未保存中文' }] });
  await assert.rejects(f.host.prepareModules('工作台', ['book']), /保存冲突/); assert.equal(container.inert, false);
  await assert.rejects(mount.dispose(), /保存冲突/); assert.equal(rendered.unmounts, 0); assert.equal(container.inert, false);
  failure = false; unregister(); await mount.dispose(); assert.equal(rendered.unmounts, 1);
  await f.host.stop();
});

test('forced stop revokes discovery first, backs up forms, inline titles, sorting and import bytes then unmounts once', async () => {
  const f = fixture(), container = new Container();
  const mount = f.host.mountModule(container.element, { rootFolder: '工作台', moduleId: 'showcase' });
  const rendered = ui.roots.at(-1)!;
  const file = new File([new Uint8Array([0, 1, 128, 255])], '中文图片.png', { type: 'image/png', lastModified: 12 });
  const drafts = [{ type: 'work-editor', work: { title: '中文输入中' } }, { type: 'inline-text', value: '模块名' }, { type: 'work-sort', order: ['second', 'first'] }, { type: 'work-image-imports', imports: [{ id: 'retry-id', file }] }];
  const unregister = ui.registerCardDraft(container.element, { flush: async () => { throw new Error('输入法尚未结束'); }, recoveryDrafts: () => drafts });
  const stopping = f.host.stop(); assert.equal(f.events.at(-1)?.[0], 'magical-cards:api-unavailable');
  assert.equal(rendered.unmounts, 0); assert.equal(container.inert, true);
  await stopping; await f.host.stop(); await mount.dispose(); assert.equal(rendered.unmounts, 1);
  assert.equal(f.files.size, 1);
  const recovered = JSON.parse([...f.files.values()][0]);
  assert.equal(recovered.rootFolder, '工作台'); assert.match(recovered.error, /输入法/);
  assert.ok(recovered.drafts.some((draft: any) => draft.type === 'work-editor' && draft.work.title === '中文输入中'));
  const image = recovered.drafts.find((draft: any) => draft.type === 'work-image-imports').imports[0];
  assert.equal(image.id, 'retry-id'); assert.equal(image.file.name, '中文图片.png'); assert.equal(image.file.data, 'AAGA/w==');
  unregister();
});

test('switching a prepared library keeps instance identity, disposes old roots and publishes only the new catalog', async () => {
  const f = fixture(), next = fixture('新卡片库'), container = new Container();
  f.host.mountModule(container.element, { rootFolder: '工作台', moduleId: 'book' });
  const rendered = ui.roots.at(-1)!, instance = f.host.instanceId;
  const release = await f.host.prepareModules('工作台', f.host.moduleIds());
  f.host.changeLease(next.lease); release();
  assert.equal(f.host.instanceId, instance); assert.equal(rendered.unmounts, 1); assert.equal(f.host.getSnapshot().rootFolder, '新卡片库'); assert.equal(f.listeners.size, 0);
  assert.throws(() => f.host.mountModule(new Container().element, { rootFolder: '工作台', moduleId: 'book' }), /目录已改变/);
  await f.host.stop(); await next.host.stop();
});

test('single native module rendering has one module header and no ModuleList or embedded-code wrapper', () => {
  const f = fixture();
  const html = renderToStaticMarkup(React.createElement(CardsSurface, { api: { ...f.lease.api, supportsDashboardOnlyNavigation: true, coverUrl: (value: string) => value } as unknown as CardsLease['api'], manager: f.lease.propertiesManager, nativeModule: { id: 'ordinary' } }));
  assert.equal((html.match(/class="bw-work-stack bw-module"/g) ?? []).length, 1);
  assert.equal(html.includes('bw-cards-module-slot'), false); assert.equal(html.includes('data-cards-embed'), false); assert.ok(html.includes('bw-native-card-surface'));
  void f.host.stop();
});


test('native modules show only their own import retries while embeds retain global orphan recovery', () => {
  const f = fixture();
  const api = { ...f.lease.api, supportsDashboardOnlyNavigation: true as const, coverUrl: (value: string) => value, importWorkImages: async () => ({ imported: [], failed: [] }) } as unknown as CardsLease['api'];
  getWorkImageImports(api, 'film')!.add([new File(['retry'], '电影图片.png', { type: 'image/png' }) as unknown as globalThis.File]);
  const native = renderToStaticMarkup(React.createElement(CardsSurface, { api, manager: f.lease.propertiesManager, nativeModule: { id: 'ordinary' } }));
  assert.equal(native.includes('data-work-import-recovery'), false); assert.equal(native.includes('电影图片.png'), false);
  const embedded = renderToStaticMarkup(React.createElement(CardsSurface, { api, manager: f.lease.propertiesManager, embed: { id: 'test', modules: [{ id: 'ordinary', collection: 'ordinary' }] } }));
  assert.ok(embedded.includes('data-work-import-recovery="影视"'));
  void f.host.stop();
});
