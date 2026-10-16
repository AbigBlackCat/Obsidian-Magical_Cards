// Browser acceptance fixture: real store/components, disposable in-memory Obsidian adapter.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { App as ObsidianApp } from 'obsidian';
import { App } from './obsidian-mock';
import { CardsStore } from '../src/store';
import { CardsOnboarding, type CardsPluginData } from '../src/onboarding';
import CardsDashboardView from '../src/CardsDashboardView';
import { WorkPropertiesManager } from '../src/WorkPropertiesSessions';
import { CARD_LAYOUTS, CARD_RATIOS } from '../src/settings';
import type { CardLayout, CardRatio } from '../src/types';

const app = new App();
const bytes64 = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), byte => String.fromCharCode(byte)).join('');
app.vault.createBinary = (path, bytes) => app.vault.create(path, btoa(bytes64(bytes)));
app.vault.getResourcePath = file => file.extension === 'svg' && file.contents.startsWith('<') ? `data:image/svg+xml,${encodeURIComponent(file.contents)}` : `data:image/${file.extension === 'svg' ? 'svg+xml' : file.extension === 'jpg' ? 'jpeg' : file.extension};base64,${file.contents}`;
const api = new CardsStore(app as unknown as ObsidianApp, '卡片库');
await api.initialize();
let data: CardsPluginData = { rootFolder: '卡片库', installationOrigin: 'fresh' };
const board = new CardsOnboarding({ app: app as unknown as ObsidianApp, api, rootFolder: '卡片库', ready: Promise.resolve(), data: () => data, update: async patch => { data = { ...data, ...patch }; }, assertActive() {}, open: async () => {} });
await board.run();
const boards = api.getSnapshot().settings.dashboards!;
await api.saveSettings({ dashboards: [...boards, ...Array.from({ length: 5 }, (_, i) => ({ id: `mobile-${i}`, title: `分类 ${i + 1}`, moduleIds: ['book'] }))] });
const manager = new WorkPropertiesManager(api);
// Obsidian supplies this cross-window DOM helper.
Object.defineProperty(Element.prototype, 'instanceOf', { value: function (type: typeof Element) { return this instanceof type; } });
function Fixture() {
  const [selected, select] = useState(boards[0].id);
  const [layout, setLayout] = useState<CardLayout>('cylinder'), [ratio, setRatio] = useState<CardRatio>('2:3');
  const update = async (patch: Record<string, unknown>) => {
    const settings = api.getSnapshot().settings;
    await api.saveSettings({ bookCardAppearance: { ...settings.bookCardAppearance, ...patch }, filmCardAppearance: { ...settings.filmCardAppearance, ...patch } });
  };
  return <main><header><h1>手机兼容验收</h1><p>六张原图已离线解压，资料仅保存在此页内存。</p><label>布局<select aria-label="验收布局" value={layout} onChange={event => { setLayout(event.target.value as CardLayout); void update({ layout: event.target.value }); }}>{Object.entries(CARD_LAYOUTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>比例<select aria-label="验收比例" value={ratio} onChange={event => { setRatio(event.target.value as CardRatio); void update({ ratio: event.target.value }); }}>{Object.entries(CARD_RATIOS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button onClick={() => { void update({ orientation: 'vertical' }); }}>竖向画廊</button></header><CardsDashboardView api={api} manager={manager} dashboardId={selected} viewId="mobile-acceptance" onDashboardChange={select} /></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
