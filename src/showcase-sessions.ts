import type { CardsAPI, ShowcaseAPI, ShowcaseCard } from './types';

export interface ShowcaseSessionState {
  card: ShowcaseCard | null;
  path: string;
  name: string;
  description: string;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  error: string;
}
type Field = 'name' | 'description';
const fields: Field[] = ['name', 'description'];
export class ShowcaseDescriptionSession {
  private state: ShowcaseSessionState = { card: null, path: '', name: '', description: '', loading: true, saving: false, dirty: false, error: '' };
  private listeners = new Set<() => void>();
  private generation = 0;
  private epoch = 0;
  private composing = 0;
  private interrupted = false;
  private retained = new Set<Field>();
  private versions = new Map<Field, number>();
  private blocked = false;
  private disposed = false;
  private timer?: number;
  private reading?: Promise<void>;
  private writing?: Promise<void>;
  constructor(private api: ShowcaseAPI, readonly moduleId: string, readonly id: string, private ownerWindow?: Window) { void this.refresh(); }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<ShowcaseSessionState>) { this.state = { ...this.state, ...patch }; if (!this.disposed) for (const listener of [...this.listeners]) listener(); }
  private clearTimer() { if (this.timer !== undefined) this.ownerWindow?.clearTimeout(this.timer); this.timer = undefined; }
  private schedule() {
    this.clearTimer();
    if (this.ownerWindow && !this.disposed && !this.composing && !this.interrupted && !this.blocked && this.state.dirty) this.timer = this.ownerWindow.setTimeout(() => { this.timer = undefined; void this.flush().catch(() => {}); }, 500);
  }
  private patch(): Partial<Pick<ShowcaseCard, Field>> {
    const patch: Partial<Pick<ShowcaseCard, Field>> = {};
    if (this.state.card) for (const field of fields) if (this.retained.has(field) || this.state[field] !== this.state.card[field]) patch[field] = this.state[field];
    return patch;
  }
  private updateField(field: Field, value: string) {
    if (this.disposed || !this.state.card || value === this.state[field]) return;
    this.resumeInterruptedComposition();
    this.versions.set(field, ++this.generation); this.emit({ [field]: value }); this.emit({ dirty: Object.keys(this.patch()).length > 0 }); this.schedule();
  }
  update(description: string) { this.updateField('description', description); }
  updateName(name: string) { this.updateField('name', name); }
  startComposition() { this.composing++; this.clearTimer(); }
  endComposition() { this.composing = Math.max(0, this.composing - 1); this.resumeInterruptedComposition(); this.schedule(); }
  /** Unmount releases this editor's counter without treating unfinished input as confirmed text. */
  interruptComposition() {
    if (!this.composing) return;
    this.composing--; this.interrupted = true; this.clearTimer();
    if (this.state.dirty && !this.blocked) this.emit({ error: '输入法输入已中断，草稿已保留；请继续编辑或点击重试保存。' });
  }
  private resumeInterruptedComposition() {
    if (!this.interrupted) return;
    this.interrupted = false;
    if (!this.blocked) this.emit({ error: '' });
  }
  /** Only an explicit save/retry or subsequent editing confirms an interrupted composition. */
  retry = (): Promise<void> => {
    if (this.composing) return Promise.resolve();
    this.resumeInterruptedComposition(); return this.flush();
  };
  refresh = (): Promise<void> => {
    if (this.disposed || this.state.saving) return Promise.resolve();
    if (this.reading) return this.reading;
    const epoch = this.epoch;
    this.reading = Promise.resolve().then(async () => {
      try {
        const document = await this.api.read(this.moduleId), incoming = document.cards.find(card => card.id === this.id);
        if (this.disposed || epoch !== this.epoch) return;
        if (!incoming) throw new Error('卡片已删除或标识改变，草稿已保留。');
        const card = { ...incoming };
        const values = { name: card.name, description: card.description };
        let dirty = false;
        if (this.state.dirty && this.state.card) {
          for (const field of fields) if (this.retained.has(field) || this.state[field] !== this.state.card[field]) {
            if (card[field] === this.state[field]) this.retained.delete(field);
            else { values[field] = this.state[field]; card[field] = this.state.card[field]; dirty = true; }
          }
        }
        this.emit({ card, path: document.path, ...values, dirty, loading: false, error: this.blocked || this.interrupted ? this.state.error : '' });
      } catch (error) { if (!this.disposed && epoch === this.epoch) this.emit({ loading: false, error: `读取失败：${message(error)}` }); }
    }).finally(() => { this.reading = undefined; });
    return this.reading;
  };
  flush = (): Promise<void> => {
    this.clearTimer();
    if (this.writing) return this.writing;
    if (this.disposed || this.composing || this.interrupted) return Promise.resolve();
    this.writing = Promise.resolve().then(async () => {
      if (this.reading) await this.reading;
      if (!this.state.card) return;
      this.blocked = false;
      let attempted: Field[] = [], attemptedVersions = new Map<Field, number>();
      try {
        while (this.state.dirty && this.state.card && !this.composing && !this.interrupted) {
          const expected = { ...this.state.card }, patch = this.patch(), versions = new Map(this.versions);
          attempted = fields.filter(field => Object.hasOwn(patch, field)); attemptedVersions = versions; this.epoch++; this.emit({ saving: true, error: '' });
          const saved = { ...await this.api.patchCard(this.moduleId, this.id, patch, expected) };
          for (const field of attempted) this.retained.delete(field);
          const values = { name: saved.name, description: saved.description };
          for (const field of fields) if (this.versions.get(field) !== versions.get(field)) values[field] = this.state[field];
          this.emit({ card: saved, ...values, dirty: fields.some(field => values[field] !== saved[field]) });
        }
      } catch (error) {
        for (const field of attempted) if (this.versions.get(field) !== attemptedVersions.get(field)) this.retained.add(field);
        this.blocked = true; this.emit({ dirty: true, error: `未保存：${message(error)}` }); throw error;
      } finally { this.emit({ saving: false }); }
    }).finally(() => { this.writing = undefined; });
    return this.writing;
  };
  reload = async () => {
    if (this.writing) return;
    this.clearTimer(); this.retained.clear(); this.blocked = false; this.interrupted = false; this.epoch++;
    if (this.reading) await this.reading;
    this.emit({ card: null, name: '', description: '', dirty: false, loading: true, error: '' }); await this.refresh();
  };
  dispose() { this.disposed = true; this.clearTimer(); this.listeners.clear(); }
}
function message(error: unknown): string { return error instanceof Error ? error.message : '操作没有完成，请重试。'; }
export class ShowcaseSessionsManager {
  private sessions = new Map<string, ShowcaseDescriptionSession>();
  private unsubscribe: () => void;
  constructor(private api: ShowcaseAPI, subscribe: CardsAPI['subscribe'], private ownerWindow?: Window) { this.unsubscribe = subscribe(() => { for (const session of this.sessions.values()) void session.refresh(); }); }
  getSession(moduleId: string, id: string): ShowcaseDescriptionSession {
    const key = `${moduleId}\0${id}`;
    let session = this.sessions.get(key);
    if (!session) { session = new ShowcaseDescriptionSession(this.api, moduleId, id, this.ownerWindow); this.sessions.set(key, session); }
    return session;
  }
  flush(moduleId: string, id: string) { return this.sessions.get(`${moduleId}\0${id}`)?.flush() ?? Promise.resolve(); }
  async flushAll() {
    const results = await Promise.allSettled([...this.sessions.values()].map(session => session.flush()));
    const failed = results.find(result => result.status === 'rejected'); if (failed?.status === 'rejected') throw failed.reason;
    if ([...this.sessions.values()].some(session => session.getSnapshot().dirty)) throw new Error('输入法尚未结束，橱窗草稿已保留。');
  }
  recoveryDrafts() {
    const drafts: Array<{ moduleId: string; id: string; path: string; name: string; description: string }> = [];
    for (const session of this.sessions.values()) {
      const state = session.getSnapshot();
      if (state.dirty) drafts.push({ moduleId: session.moduleId, id: session.id, path: state.path, name: state.name, description: state.description });
    }
    return drafts;
  }
  dispose() { this.unsubscribe(); for (const session of this.sessions.values()) session.dispose(); this.sessions.clear(); }
}
const managerKey = Symbol.for('magical-cards.showcase.sessions.v1');
type SharedShowcaseAPI = ShowcaseAPI & { [managerKey]?: ShowcaseSessionsManager };
export function getShowcaseManager(api: CardsAPI, ownerWindow?: Window): ShowcaseSessionsManager | undefined {
  const service: SharedShowcaseAPI | undefined = api.showcase;
  return service ? service[managerKey] ??= new ShowcaseSessionsManager(service, api.subscribe, ownerWindow) : undefined;
}
export function releaseShowcaseManager(api: CardsAPI): void {
  const service: SharedShowcaseAPI | undefined = api.showcase;
  service?.[managerKey]?.dispose(); if (service) delete service[managerKey];
}
