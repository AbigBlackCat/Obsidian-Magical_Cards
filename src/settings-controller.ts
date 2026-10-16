import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Notice, Platform, Setting, setIcon } from 'obsidian';
import type { DropdownComponent, SettingDefinitionRender, SettingGroup, TextComponent, ToggleComponent } from 'obsidian';
import type { CardsAPI, CardsDashboard } from './types';
import { CARD_APPEARANCE_FIELDS, newModuleDraft, readModuleDraft, saveModuleDraft, type CardModuleDraft, type ModuleDashboardAssignment } from './settings';
import { cardModuleChoices } from './module-choice';
import { newCardsBlock } from './embed-source';
import SettingsCardPreview from './SettingsCardPreview';
import ModuleRemovalDialog from './ModuleRemovalDialog';
import type { WorkPropertiesManager } from './WorkPropertiesSessions';
import { saveDashboard } from './dashboards';
import { assertCardModuleRemovalSettled, flushDashboardEdits } from './CardsSurface';

interface ControllerOptions {
  directory?: { get: () => string; apply: (folder: string) => Promise<void> };
  structureChanged?: () => void;
  domStateChanged?: () => void;
}
interface EditorState {
  key: string;
  draft: CardModuleDraft;
  baseline: CardModuleDraft | null;
  creating: boolean;
  creator?: 'add-module' | 'add-showcase';
  busy: boolean;
  fields: Map<string, { setValue: (value: string | boolean) => unknown }>;
  error: string;
  errorEl?: HTMLElement;
  preview?: HTMLElement;
  root?: Root;
  dashboardIds: string[];
  baselineDashboards: CardsDashboard[];
  newDashboard: { id: string; title: string };
}
interface MountedRow { element: HTMLElement; list: HTMLElement; section?: string; cleanup: () => void; }
interface WrappedRows { outer: HTMLDetailsElement; cleanup: () => void; }
type CardSettingRow = Omit<SettingDefinitionRender, 'render'> & { render: (setting: Setting, group: Pick<SettingGroup, 'listEl'>) => void | (() => void) };
type CardSettingItem = CardSettingRow | { type: 'group'; cls: string; items: CardSettingRow[] };
const DIRECTORY_DESCRIPTION = '填写当前笔记库内的相对目录，例如 卡片库。作品保存在其下的书籍／观影目录，配置保存在 _数据/卡片配置.md。切换目录不会搬运原有作品。';
const THREE_DESCRIPTION = '同屏最多显示当前卡和两张邻卡；仍可浏览全部作品，作品数量不会改变。';

/** Both host generations render the same real rows and use the same pending module drafts. */
export class CardsSettingsController {
  private editors = new Map<string, EditorState>();
  private rows = new Set<MountedRow>();
  private wraps = new Map<HTMLElement, WrappedRows>();
  private opened = new Map<string, boolean>();
  private documents = new Map<Document, () => void>();
  private unsubscribe: () => void;
  private structure: string;
  private active = false;
  private disposed = false;
  private layoutQueued = false;
  private structurePending = false;
  private selected = new Set(['book']);
  private output?: HTMLTextAreaElement;
  private generated = '';
  private generate?: { setDisabled: (disabled: boolean) => unknown };
  private copy?: { setDisabled: (disabled: boolean) => unknown };
  private directoryDraft: string;
  private removal?: { root: Root; host: HTMLElement; state: EditorState };

  constructor(private api: CardsAPI, private manager?: WorkPropertiesManager, private options: ControllerOptions = {}) {
    this.directoryDraft = options.directory?.get() ?? '';
    this.structure = this.structureKey();
    this.unsubscribe = api.subscribe(this.sync);
  }
  private structureKey() { const settings = this.api.getSnapshot().settings; return JSON.stringify([cardModuleChoices(settings, true), settings.dashboards ?? [], Boolean(this.api.supportsDashboardOnlyNavigation)]); }
  private editor(key: string, creator?: EditorState['creator']): EditorState {
    let state = this.editors.get(key);
    if (!state) {
      const draft = creator ? newModuleDraft(creator === 'add-showcase' ? 'showcase' : undefined) : readModuleDraft(this.api.getSnapshot().settings, key);
      if (!draft) throw new Error('模块已删除，请重新打开设置。');
      const dashboards = structuredClone(this.api.getSnapshot().settings.dashboards ?? []);
      state = { key, draft, baseline: creator ? null : structuredClone(draft), creating: Boolean(creator), creator, busy: false, fields: new Map(), error: '', dashboardIds: dashboards.filter(board => board.moduleIds.includes(draft.id)).map(board => board.id), baselineDashboards: dashboards, newDashboard: { id: crypto.randomUUID(), title: '' } };
      this.editors.set(key, state);
    }
    return state;
  }
  private editorLabel(state: EditorState) { return state.creating ? state.creator === 'add-showcase' ? '添加图片橱窗' : '添加卡片模块' : state.draft.title; }
  private resetCreator(state: EditorState) { return newModuleDraft(state.creator === 'add-showcase' ? 'showcase' : undefined); }
  private resetDashboardDraft(state: EditorState) {
    state.baselineDashboards = structuredClone(this.api.getSnapshot().settings.dashboards ?? []);
    state.dashboardIds = state.baselineDashboards.filter(board => board.moduleIds.includes(state.draft.id)).map(board => board.id);
    state.newDashboard = { id: crypto.randomUUID(), title: '' };
  }
  private assignment(state: EditorState): ModuleDashboardAssignment {
    const title = state.newDashboard.title.trim();
    return { dashboardIds: [...state.dashboardIds, ...(title ? [state.newDashboard.id] : [])], newDashboards: title ? [{ id: state.newDashboard.id, title, moduleIds: [] }] : [], baselineDashboards: structuredClone(state.baselineDashboards) };
  }
  private classificationDirty(state: EditorState) {
    return Boolean(state.newDashboard.title) || JSON.stringify(state.dashboardIds) !== JSON.stringify(state.baselineDashboards.filter(board => board.moduleIds.includes(state.draft.id)).map(board => board.id));
  }
  private row(name: string, section: string | undefined, render: (setting: Setting) => void | (() => void), extras: Pick<SettingDefinitionRender, 'desc' | 'aliases' | 'searchable' | 'visible'> = {}): CardSettingRow {
    return { name, ...extras, render: (setting, group) => {
      if (this.disposed) return;
      this.active = true;
      const element = setting.settingEl, doc = element.ownerDocument, win = doc.defaultView;
      if (!this.documents.has(doc)) {
        const listener = () => this.syncPreviews();
        doc.addEventListener('visibilitychange', listener);
        this.documents.set(doc, () => doc.removeEventListener('visibilitychange', listener));
      }
      const renderedCleanup = render(setting);
      const focus = () => this.reveal(element, false);
      element.addEventListener('focusin', focus); element.addEventListener('beforematch', focus);
      // Obsidian's native search flashes its actual target row after navigation.
      const observer = win && typeof win.MutationObserver === 'function' ? new win.MutationObserver(() => {
        if (element.classList.contains('is-flashing')) this.reveal(element, true);
      }) : undefined;
      observer?.observe(element, { attributes: true, attributeFilter: ['class'] });
      const mounted: MountedRow = { element, list: group.listEl, section, cleanup: () => {
        observer?.disconnect(); element.removeEventListener('focusin', focus); element.removeEventListener('beforematch', focus);
        renderedCleanup?.(); this.rows.delete(mounted);
        if (![...this.rows].some(row => row.list === mounted.list)) { this.wraps.get(mounted.list)?.cleanup(); this.wraps.delete(mounted.list); }
      } };
      this.rows.add(mounted); this.queueLayout();
      return mounted.cleanup;
    } };
  }
  private reveal(element: HTMLElement, scroll: boolean) {
    if (!this.active || this.disposed) return;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') {
        (parent as HTMLDetailsElement).open = true;
        const key = parent.dataset.cardSettingsKey ?? parent.dataset.cardCollection ?? parent.dataset.settingsGroup; if (key) this.opened.set(key, true);
      }
    }
    this.syncPreviews();
    if (scroll) {
      element.scrollIntoView({ block: 'center' });
      element.querySelector<HTMLElement>('input,select,textarea,button')?.focus({ preventScroll: true });
    }
  }
  private details(parent: HTMLElement, key: string, label: string, open = false): WrappedRows & { body: HTMLElement } {
    const outer = parent.createEl('details'), summary = outer.createEl('summary'), body = outer.createDiv();
    outer.dataset.cardSettingsKey = key;
    outer.className = 'bw-cards-settings-group'; body.className = 'bw-cards-settings-body'; summary.textContent = label;
    outer.open = this.opened.get(key) ?? open; outer.append(summary, body); parent.append(outer);
    const toggle = () => { this.opened.set(key, outer.open); this.syncPreviews(); };
    outer.addEventListener('toggle', toggle);
    return { outer, body, cleanup: () => outer.removeEventListener('toggle', toggle) };
  }
  private styleGroup(outer: HTMLDetailsElement, kind: 'module' | 'showcase' | 'examples' | 'add-module' | 'add-showcase') {
    outer.dataset.cardSettingsKind = kind;
    const summary = outer.querySelector('summary');
    if (summary) { const icon = summary.createSpan({ cls: 'bw-cards-settings-kind-icon' }); icon.setAttribute('aria-hidden', 'true'); setIcon(icon, { module: 'panels-top-left', showcase: 'images', examples: 'sparkles', 'add-module': 'square-plus', 'add-showcase': 'image-plus' }[kind]); summary.insertBefore(icon, summary.firstChild); }
  }
  private queueLayout() {
    if (this.layoutQueued) return;
    this.layoutQueued = true;
    void Promise.resolve().then(() => { this.layoutQueued = false; if (this.active) this.layout(); });
  }
  private layout() {
    const lists = new Map<HTMLElement, MountedRow[]>();
    for (const row of this.rows) if (row.section) { const rows = lists.get(row.list) ?? []; rows.push(row); lists.set(row.list, rows); }
    for (const [list, rows] of lists) {
      const current = this.wraps.get(list);
      if (current?.outer.isConnected && rows.every(row => current.outer.contains(row.element))) continue;
      current?.cleanup(); this.wraps.delete(list);
      const section = rows[0].section!;
      if (section.startsWith('examples/')) {
        const examples = this.details(list, 'examples', '示例'); examples.outer.dataset.settingsGroup = 'examples'; this.styleGroup(examples.outer, 'examples');
        const intro = examples.body.createEl('p'); intro.textContent = '阅读和影视是两个起步集合。可调整外观、加入 Dashboard，或删除模块；笔记和图片始终保留。';
        const cleanups = [examples.cleanup];
        for (const id of ['book', 'film']) {
          const moduleRows = rows.filter(row => row.section === `examples/${id}`); if (!moduleRows.length) continue;
          const state = this.editor(id), child = this.details(examples.body, id, state.draft.title, true); child.outer.dataset.cardCollection = id; this.styleGroup(child.outer, 'module');
          cleanups.push(this.placeEditorRows(child.body, moduleRows, state), child.cleanup);
        }
        this.wraps.set(list, { outer: examples.outer, cleanup: () => cleanups.forEach(cleanup => cleanup()) });
      } else {
        const state = this.editors.get(section), label = section === 'code' ? '笔记代码块生成' : state ? this.editorLabel(state) : section;
        const wrapped = this.details(list, section, label);
        if (section === 'code' || state?.creating) wrapped.outer.dataset.settingsGroup = state?.creator ?? section;
        else wrapped.outer.dataset.cardCollection = section;
        if (state) this.styleGroup(wrapped.outer, state.creator ?? (state.draft.mode === 'showcase' ? 'showcase' : 'module'));
        const cleanup = state ? this.placeEditorRows(wrapped.body, rows, state) : undefined;
        if (!state) for (const row of rows) wrapped.body.append(row.element);
        this.wraps.set(list, { outer: wrapped.outer, cleanup: () => { cleanup?.(); wrapped.cleanup(); } });
      }
    }
    this.syncPreviews();
  }
  private placeEditorRows(parent: HTMLElement, rows: MountedRow[], state: EditorState) {
    parent.parentElement?.classList.add('bw-cards-settings-module');
    const form = parent.createEl('fieldset'); form.className = 'bw-cards-settings-form';
    const advanced = this.details(parent, `advanced:${state.key}`, '高级设置'); advanced.outer.dataset.settingsGroup = 'advanced'; advanced.outer.dataset.cardAdvanced = state.key;
    const advancedForm = advanced.body.createEl('fieldset'); advancedForm.className = 'bw-cards-settings-form';
    const summary = parent.parentElement?.querySelector('summary');
    for (const row of rows) {
      if (row.element.dataset.cardSettingsLevel === 'header' && summary) summary.append(row.element);
      else if (row.element.dataset.cardPreview === 'true') advanced.body.append(row.element);
      else (row.element.dataset.cardSettingsLevel === 'advanced' ? advancedForm : form).append(row.element);
    }
    form.disabled = advancedForm.disabled = state.busy;
    return advanced.cleanup;
  }
  private visible(node: HTMLElement) {
    if (!this.active || this.disposed || node.ownerDocument.hidden || !node.isConnected) return false;
    for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS' && !(parent as HTMLDetailsElement).open) return false;
    return true;
  }
  private syncPreviews() {
    for (const state of this.editors.values()) {
      if (!this.manager || !state.preview || !this.visible(state.preview)) { state.root?.unmount(); state.root = undefined; continue; }
      state.root ??= createRoot(state.preview);
      state.root.render(React.createElement(SettingsCardPreview, { api: this.api, manager: this.manager, draft: state.draft, rename: title => {
        state.draft = { ...state.draft, title }; state.fields.get('title')?.setValue(title); this.syncPreviews();
      } }));
    }
  }
  private sync = () => {
    for (const state of this.editors.values()) {
      if (state.busy) continue;
      if (!state.creating) {
        const current = readModuleDraft(this.api.getSnapshot().settings, state.key);
        if (current && JSON.stringify(state.draft) === JSON.stringify(state.baseline) && JSON.stringify(current) !== JSON.stringify(state.baseline)) {
          state.draft = structuredClone(current); state.baseline = structuredClone(current); this.refreshFields(state);
        }
      }
      if (!this.classificationDirty(state)) {
        state.baselineDashboards = structuredClone(this.api.getSnapshot().settings.dashboards ?? []);
        state.dashboardIds = state.baselineDashboards.filter(board => board.moduleIds.includes(state.draft.id)).map(board => board.id);
      }
    }
    this.syncPreviews();
    const structure = this.structureKey();
    if (structure !== this.structure) {
      this.structure = structure; this.generated = '';
      if (this.output) { this.output.value = ''; this.output.hidden = true; }
      this.copy?.setDisabled(true);
      if ([...this.editors.values()].some(state => state.busy)) this.structurePending = true;
      else this.options.structureChanged?.();
    }
  };
  private refreshFields(state: EditorState) {
    state.fields.get('title')?.setValue(state.draft.title);
    for (const field of CARD_APPEARANCE_FIELDS) state.fields.get(field.field)?.setValue(String(state.draft.appearance[field.field] ?? field.fallback));
    state.fields.get('threeCardView')?.setValue(state.draft.appearance.threeCardView ?? this.api.getSnapshot().settings.threeCardView);
    state.fields.get('flipEnabled')?.setValue(state.draft.appearance.flipEnabled ?? true);
    state.fields.get('namePosition')?.setValue(state.draft.appearance.namePosition ?? 'back');
    state.fields.get('newDashboard')?.setValue(state.newDashboard.title);
    for (const board of this.api.getSnapshot().settings.dashboards ?? []) state.fields.get(`dashboard:${board.id}`)?.setValue(state.dashboardIds.includes(board.id));
    this.refreshConditionalRows(state);
  }
  private setError(state: EditorState, failure: unknown) {
    state.error = failure instanceof Error ? failure.message : String(failure);
    if (state.errorEl) { state.errorEl.textContent = state.error; state.errorEl.hidden = !state.error; }
  }
  private closeEditor(state: EditorState) {
    this.opened.set(state.key, false);
    for (const wrap of this.wraps.values()) {
      const group = wrap.outer.dataset.cardSettingsKey === state.key ? wrap.outer : wrap.outer.querySelector<HTMLDetailsElement>(`[data-card-collection="${state.key}"]`);
      if (group) { group.open = false; group.querySelector<HTMLElement>('summary')?.focus(); }
    }
    this.syncPreviews();
  }
  private setBusy(state: EditorState, busy: boolean) {
    state.busy = busy;
    for (const row of this.rows) if (row.section === state.key || row.section === `examples/${state.key}`) {
      const form = row.element.closest('fieldset'); if (form) form.disabled = busy;
      if (row.element.dataset.cardSettingsLevel === 'header') { const button = row.element.querySelector<HTMLButtonElement>('button'); if (button) button.disabled = busy; }
    }
    if (!busy && this.structurePending && ![...this.editors.values()].some(editor => editor.busy)) {
      this.structurePending = false; this.options.structureChanged?.();
    }
  }
  private refreshConditionalRows(state: EditorState) {
    for (const row of this.rows) if (row.section === state.key || row.section === `examples/${state.key}`) {
      if (row.element.dataset.cardField === 'orientation') row.element.hidden = state.draft.appearance.layout !== 'scroll-bend';
      if (['flipEnabled', 'namePosition'].includes(row.element.dataset.cardField ?? '')) row.element.hidden = state.draft.mode !== 'showcase';
    }
    this.options.domStateChanged?.();
  }
  private dashboardRows(state: EditorState, section: string, label: string): CardSettingRow[] {
    const supported = Boolean(this.api.supportsDashboardOnlyNavigation);
    const rows = [this.row(`${label} · Dashboard`, section, setting => {
      setting.setName('Dashboard').setDesc(supported
        ? '可加入多个分类；不选择则留在设置中，随时可以加入。取消分类不删除模块、笔记或图片。'
        : '请升级已启用的兼容卡片插件后再保存或分类。已有模块和资料已保留。');
      setting.settingEl.dataset.cardField = 'dashboards';
    }, { searchable: false })];
    for (const board of this.api.getSnapshot().settings.dashboards ?? []) rows.push(this.row(`${label} · Dashboard · ${board.title}`, section, setting => {
      setting.setName(`Dashboard：${board.title}`); setting.settingEl.dataset.cardDashboard = board.id;
      if (!state.creating && board.moduleIds.includes(state.draft.id)) {
        setting.setDesc('已加入').addButton(control => control.setIcon('log-out').setTooltip(`移出「${board.title}」`).setDisabled(!supported).onClick(async () => {
          if (state.busy) return;
          this.setBusy(state, true); this.setError(state, '');
          try {
            assertCardModuleRemovalSettled(this.api); await flushDashboardEdits(this.api, this.manager); assertCardModuleRemovalSettled(this.api);
            await saveDashboard(this.api, { ...board, moduleIds: board.moduleIds.filter(id => id !== state.draft.id) }, board);
            state.dashboardIds = state.dashboardIds.filter(id => id !== board.id);
            state.baselineDashboards = state.baselineDashboards.map(item => item.id === board.id ? { ...board, moduleIds: board.moduleIds.filter(id => id !== state.draft.id) } : item);
            new Notice(`已移出「${board.title}」。可在设置中重新加入。`, 4000);
          } catch (failure) { if (!this.disposed) this.setError(state, failure); }
          finally { this.setBusy(state, false); }
        }));
        setting.settingEl.querySelector('button')?.setAttribute('aria-label', `移出「${board.title}」`);
      } else setting.addToggle(control => {
        this.bindToggle(state, `dashboard:${board.id}`, control); control.toggleEl.setAttribute('aria-label', `加入「${board.title}」`);
        control.setDisabled(!supported).setValue(state.dashboardIds.includes(board.id)).onChange(selected => {
          if (selected && !state.baselineDashboards.some(item => item.id === board.id)) state.baselineDashboards.push(structuredClone(board));
          state.dashboardIds = selected ? [...new Set([...state.dashboardIds, board.id])] : state.dashboardIds.filter(id => id !== board.id);
        });
      });
      return () => state.fields.delete(`dashboard:${board.id}`);
    }, { aliases: ['分类', '加入 Dashboard', '移出 Dashboard', board.title] }));
    rows.push(this.row(`${label} · 新建 Dashboard`, section, setting => {
      setting.setName('新建 Dashboard').setDesc('选填名称，与模块一起保存并加入；留空则不新建。').addText(control => {
        this.bindField(state, 'newDashboard', control); control.inputEl.setAttribute('aria-label', '新建 Dashboard 名称');
        control.setDisabled(!supported).setValue(state.newDashboard.title).onChange(title => { state.newDashboard.title = title; });
      });
      setting.settingEl.dataset.cardField = 'newDashboard';
      return () => state.fields.delete('newDashboard');
    }, { aliases: ['新建分类', '分类名称'] }));
    return rows;
  }
  private editorRows(state: EditorState): CardSettingRow[] {
    const section = state.key === 'book' || state.key === 'film' ? `examples/${state.key}` : state.key;
    const label = this.editorLabel(state), rows: CardSettingRow[] = [];
    rows.push(this.row(`${label} · 模块名称`, section, setting => {
      setting.settingEl.dataset.cardField = 'title';
      setting.setName('模块名称').addText(control => { this.bindField(state, 'title', control); control.inputEl.setAttribute('aria-label', '模块名称'); control.setValue(state.draft.title).onChange(title => { state.draft = { ...state.draft, title }; this.syncPreviews(); }); });
      return () => state.fields.delete('title');
    }));
    const dropdown = (field: typeof CARD_APPEARANCE_FIELDS[number]) => this.row(`${label} · ${field.name}`, section, setting => {
      setting.setName(field.name).addDropdown(control => {
        this.bindField(state, field.field, control); control.selectEl.setAttribute('aria-label', field.name);
        control.addOptions(field.options);
        if (field.field === 'style' && state.draft.mode === 'showcase') setting.setDesc('图片橱窗模块；卡片类型固定，可继续调整外观。');
        control.setValue(String(state.draft.appearance[field.field] ?? field.fallback)).onChange(value => {
          state.draft = { ...state.draft, appearance: { ...state.draft.appearance, [field.field]: value } };
          this.refreshConditionalRows(state); this.syncPreviews();
        });
      });
      setting.settingEl.dataset.cardField = field.field;
      if (field.field !== 'ratio') setting.settingEl.dataset.cardSettingsLevel = 'advanced';
      if (field.field === 'orientation') setting.settingEl.hidden = state.draft.appearance.layout !== 'scroll-bend';
      return () => { state.fields.delete(field.field); };
    }, { aliases: [...Object.values(field.options), ...(field.field === 'imageFit' ? ['贴满卡片', '封面裁切'] : []), ...(field.field === 'style' && state.creator === 'add-showcase' ? ['添加图片橱窗', '橱窗式卡片'] : [])], ...(field.field === 'orientation' ? { visible: () => state.draft.appearance.layout === 'scroll-bend' } : {}) });
    rows.push(dropdown(CARD_APPEARANCE_FIELDS.find(field => field.field === 'ratio')!));
    rows.push(...this.dashboardRows(state, section, label));
    rows.push(this.row(`${label} · 保存并收起`, section, setting => {
      setting.setName('').setDesc(Platform.isMobile ? '在命令面板运行「打开 Magical Cards」体验。高级选项与基本设置一起保存。' : '点击左侧紫色卡片图标，在 Magical Cards 标签页体验。高级选项与基本设置一起保存。');
      const error = setting.settingEl.createEl('p'); error.setAttribute('role', 'alert'); error.className = 'bw-cards-settings-error'; error.textContent = state.error; error.hidden = !state.error; state.errorEl = error;
      setting.addButton(control => control.setButtonText('保存并收起').setCta().onClick(async () => {
        if (state.busy) return; this.setBusy(state, true); this.setError(state, '');
        const appearanceChanged = Boolean(state.baseline && JSON.stringify(state.draft.appearance) !== JSON.stringify(state.baseline.appearance));
        try {
          if (!this.api.supportsDashboardOnlyNavigation) throw new Error('请升级已启用的兼容卡片插件后再保存模块。已有模块和资料已保留。');
          if (state.creating || this.classificationDirty(state)) { assertCardModuleRemovalSettled(this.api); await flushDashboardEdits(this.api, this.manager); assertCardModuleRemovalSettled(this.api); }
          await saveModuleDraft(this.api, state.draft, state.baseline, this.assignment(state));
          if (this.disposed) return;
          if (state.creating) { state.draft = this.resetCreator(state); state.baseline = null; }
          else { const current = readModuleDraft(this.api.getSnapshot().settings, state.key); if (current) { state.baseline = current; state.draft = structuredClone(current); } }
          this.resetDashboardDraft(state); this.refreshFields(state);
          this.closeEditor(state);
          new Notice(Platform.isMobile ? `已保存。在命令面板运行「打开 Magical Cards」体验。${appearanceChanged ? '若标签页黑屏，请重启 Obsidian 后重新打开笔记库。' : ''}` : appearanceChanged
            ? '已保存。点击左侧紫色卡片图标体验；若标签页黑屏，请重启 Obsidian 后重新打开笔记库。'
            : '已保存。点击左侧紫色卡片图标，在 Magical Cards 标签页体验。', 4000);
        } catch (failure) { if (!this.disposed) this.setError(state, failure); }
        finally { this.setBusy(state, false); if (!this.disposed) this.refreshFields(state); }
      }));
      return () => { if (state.errorEl === error) state.errorEl = undefined; };
    }, { aliases: ['保存模块'] }));
    for (const field of CARD_APPEARANCE_FIELDS) if (field.field !== 'ratio' && field.field !== 'orientation') rows.push(dropdown(field));
    const toggle = (field: 'threeCardView' | 'flipEnabled', name: string, desc: string) => this.row(`${label} · ${name}`, section, setting => {
      setting.setName(name).setDesc(desc).addToggle(control => {
        control.toggleEl.setAttribute('aria-label', name); this.bindToggle(state, field, control);
        control.setValue(field === 'threeCardView' ? state.draft.appearance.threeCardView ?? this.api.getSnapshot().settings.threeCardView : state.draft.appearance.flipEnabled ?? true).onChange(value => { state.draft = { ...state.draft, appearance: { ...state.draft.appearance, [field]: value } }; this.syncPreviews(); });
      });
      setting.settingEl.dataset.cardSettingsLevel = 'advanced'; setting.settingEl.dataset.cardField = field;
      if (field === 'flipEnabled') setting.settingEl.hidden = state.draft.mode !== 'showcase';
      return () => state.fields.delete(field);
    }, { desc, ...(field === 'flipEnabled' ? { visible: () => state.draft.mode === 'showcase' } : {}) });
    rows.push(toggle('threeCardView', '仅显示三张卡片', THREE_DESCRIPTION));
    rows.push(dropdown(CARD_APPEARANCE_FIELDS.find(field => field.field === 'orientation')!));
    rows.push(toggle('flipEnabled', '允许翻面', '关闭后仅浏览正面，名称和描述仍保存在橱窗笔记中。'));
    rows.push(this.row(`${label} · 名称位置`, section, setting => {
      setting.setName('名称位置').addDropdown(control => { this.bindField(state, 'namePosition', control); control.selectEl.setAttribute('aria-label', '名称位置'); control.addOptions({ front: '正面', back: '背面', hidden: '不显示' }).setValue(state.draft.appearance.namePosition ?? 'back').onChange(value => { state.draft = { ...state.draft, appearance: { ...state.draft.appearance, namePosition: value as 'front' | 'back' | 'hidden' } }; this.syncPreviews(); }); });
      setting.settingEl.dataset.cardSettingsLevel = 'advanced'; setting.settingEl.dataset.cardField = 'namePosition'; setting.settingEl.hidden = state.draft.mode !== 'showcase';
      return () => state.fields.delete('namePosition');
    }, { visible: () => state.draft.mode === 'showcase', aliases: ['正面名称', '背面名称', '隐藏名称'] }));
    rows.push(this.row(`${label} · 重新载入`, section, setting => {
      setting.setName('').setDesc('替换此处未保存的选择。'); setting.settingEl.dataset.cardSettingsLevel = 'advanced';
      setting.addButton(control => control.setButtonText('重新载入').setTooltip('替换此处未保存的选择').onClick(() => {
        if (state.creating && state.draft.showcaseNote) { this.setError(state, '橱窗笔记已创建，请保留当前模块并重试保存。'); return; }
        const current = state.creating ? this.resetCreator(state) : readModuleDraft(this.api.getSnapshot().settings, state.key);
        if (!current) { this.setError(state, '模块已删除，当前草稿仍保留。'); return; }
        state.draft = structuredClone(current); state.baseline = state.creating ? null : structuredClone(current); this.resetDashboardDraft(state); this.setError(state, ''); this.refreshFields(state); this.syncPreviews();
      }));
    }, { aliases: ['重新载入设置'] }));
    rows.push(this.row(`${label} · 预览`, section, setting => {
      setting.settingEl.replaceChildren(); setting.settingEl.className = 'bw-cards-settings-preview-host'; setting.settingEl.dataset.cardPreview = 'true'; state.preview = setting.settingEl;
      return () => { state.root?.unmount(); state.root = undefined; if (state.preview === setting.settingEl) state.preview = undefined; };
    }, { searchable: false }));
    if (!state.creating) rows.push(this.row(`${label} · 删除模块`, section, setting => {
      setting.setName(''); setting.settingEl.className = 'bw-cards-settings-remove'; setting.settingEl.dataset.cardSettingsLevel = 'header';
      const stop = (event: Event) => { event.preventDefault(); event.stopPropagation(); }; setting.settingEl.addEventListener('click', stop);
      setting.addButton(control => control.setIcon('trash-2').setTooltip('删除模块及全部分类引用，保留笔记和图片').onClick(() => {
        if (state.busy || this.removal) return;
        const baseline = readModuleDraft(this.api.getSnapshot().settings, state.key);
        if (!this.api.supportsModuleDeletion || !this.api.supportsDashboardOnlyNavigation) { this.setError(state, '请升级已启用的兼容卡片插件后再删除模块。已有模块和资料已保留。'); return; }
        if (!baseline) { this.setError(state, '模块已删除，当前草稿仍保留。'); return; }
        this.setBusy(state, true); this.setError(state, '');
        const host = (setting.settingEl.ownerDocument.body ?? setting.settingEl).createDiv();
        const root = createRoot(host); this.removal = { root, host, state };
        root.render(React.createElement(ModuleRemovalDialog, { api: this.api, manager: this.manager, baseline: structuredClone(baseline), close: () => {
          if (this.removal?.root !== root) return;
          this.removal = undefined; root.unmount(); host.remove(); this.setBusy(state, false);
        }, removed: () => new Notice('模块已删除，作品笔记和图片已保留。', 4000) }));
      }));
      setting.settingEl.querySelector('button')?.setAttribute('aria-label', `删除模块：${state.draft.title}`);
      return () => setting.settingEl.removeEventListener('click', stop);
    }, { aliases: ['删除模块', '垃圾桶', '保留作品'] }));
    return rows;
  }
  private bindField(state: EditorState, field: string, control: DropdownComponent | TextComponent) { state.fields.set(field, { setValue: value => control.setValue(String(value)) }); }
  private bindToggle(state: EditorState, field: string, control: ToggleComponent) { state.fields.set(field, { setValue: value => control.setValue(value === true || value === 'true') }); }
  getDefinitions(): CardSettingItem[] {
    const definitions: CardSettingItem[] = [];
    if (this.options.directory) definitions.push(this.row('卡片目录', undefined, setting => {
      setting.setName('卡片目录').setDesc(DIRECTORY_DESCRIPTION).addText(control => control.setValue(this.directoryDraft).onChange(value => { this.directoryDraft = value; })).addButton(control => control.setButtonText('应用').onClick(async () => {
        control.setDisabled(true); try { await this.options.directory?.apply(this.directoryDraft); } catch (failure) { new Notice(failure instanceof Error ? failure.message : String(failure)); } finally { control.setDisabled(false); }
      }));
    }, { desc: DIRECTORY_DESCRIPTION, aliases: ['作品文件夹', '保存目录'] }));
    const group = (items: CardSettingRow[]): CardSettingItem => ({ type: 'group', cls: 'bw-cards-settings-native-group', items });
    const settings = this.api.getSnapshot().settings;
    const defaults = ['book', 'film'].filter(id => !settings.deletedModuleIds?.includes(id));
    if (defaults.length) definitions.push(group(defaults.flatMap(id => this.editorRows(this.editor(id)))));
    definitions.push(group(this.editorRows(this.editor('creator:add-module', 'add-module'))));
    definitions.push(group(this.editorRows(this.editor('creator:add-showcase', 'add-showcase'))));
    for (const module of settings.customModules) if (!settings.deletedModuleIds?.includes(module.id)) definitions.push(group(this.editorRows(this.editor(module.id))));
    const available = cardModuleChoices(settings, true);
    for (const id of this.selected) if (!available.some(module => module.id === id)) this.selected.delete(id);
    const choices = available.map(module => this.row(`笔记代码块生成 · ${module.label}`, 'code', setting => {
      setting.setName(module.label).addToggle(control => { control.toggleEl.setAttribute('aria-label', module.label); control.setValue(this.selected.has(module.id)).onChange(value => {
        if (value) this.selected.add(module.id); else this.selected.delete(module.id);
        this.generated = ''; if (this.output) { this.output.value = ''; this.output.hidden = true; } this.generate?.setDisabled(!this.selected.size); this.copy?.setDisabled(true);
      }); });
    }, { aliases: ['选择已有模块', '嵌入笔记'] }));
    choices.push(this.row('笔记代码块生成', 'code', setting => {
      setting.setDesc('选择一个或多个已有模块。代码引用原有作品，并随模块设置更新。').addButton(control => { this.generate = control; control.setButtonText('生成代码').setDisabled(!this.selected.size).onClick(() => {
        try { this.generated = newCardsBlock([...this.selected]); if (this.output) { this.output.value = this.generated; this.output.hidden = false; } this.copy?.setDisabled(false); } catch (failure) { new Notice(failure instanceof Error ? failure.message : String(failure)); }
      }); }).addButton(control => { this.copy = control; control.setButtonText('复制代码').setDisabled(!this.generated).onClick(async () => {
        try { const clipboard = setting.settingEl.ownerDocument.defaultView?.navigator.clipboard; if (!clipboard) throw new Error('Clipboard unavailable'); await clipboard.writeText(this.generated); new Notice('卡片模块代码已复制。'); }
        catch { this.output?.focus(); this.output?.select(); new Notice('无法自动复制，请复制已选中的代码。'); }
      }); });
      return () => { this.generate = undefined; this.copy = undefined; };
    }, { aliases: ['生成代码', '复制代码', '插入卡片模块'] }));
    choices.push(this.row('生成的卡片模块代码', 'code', setting => {
      const output = setting.settingEl.createEl('textarea'); output.setAttribute('aria-label', '卡片模块代码'); output.readOnly = true; output.rows = 9; output.value = this.generated; output.hidden = !this.generated; setting.settingEl.replaceChildren(output); this.output = output;
      return () => { if (this.output === output) this.output = undefined; };
    }, { searchable: false }));
    definitions.push(group(choices)); return definitions;
  }
  renderFallback(el: HTMLElement) {
    this.hide(); el.replaceChildren(); this.active = true;
    for (const definition of this.getDefinitions()) {
      if ('type' in definition) {
        const listEl = el.createDiv();
        for (const item of definition.items) item.render(new Setting(listEl), { listEl });
      } else {
        const listEl = el.createDiv(); definition.render(new Setting(listEl), { listEl });
      }
    }
    this.layout();
  }
  hide() {
    this.active = false;
    if (this.removal) { const { root, host, state } = this.removal; this.removal = undefined; root.unmount(); host.remove(); state.busy = false; }
    for (const row of [...this.rows]) row.cleanup();
    for (const wrap of this.wraps.values()) wrap.cleanup(); this.wraps.clear();
    for (const cleanup of this.documents.values()) cleanup(); this.documents.clear();
    for (const state of this.editors.values()) { state.root?.unmount(); state.root = undefined; state.preview = undefined; }
  }
  dispose() { if (this.disposed) return; this.disposed = true; this.hide(); this.unsubscribe(); this.editors.clear(); }
}
