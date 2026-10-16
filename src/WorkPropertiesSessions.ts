import type { CardsAPI, WorkProperties, WorkPropertyValues } from './types';

type Field = keyof WorkPropertyValues;
type PropertiesAPI = Pick<CardsAPI, 'subscribe' | 'readWorkProperties' | 'patchWorkProperties'>;
export interface WorkPropertiesState { properties: WorkProperties | null; values: WorkPropertyValues | null; loading: boolean; saving: boolean; dirty: boolean; error: string; }
const keys = (value: object) => Object.keys(value) as Field[];
const clone = (properties: WorkProperties): WorkProperties => ({ ...properties, values: { ...properties.values } });

export class WorkPropertiesSession {
  private state: WorkPropertiesState = { properties: null, values: null, loading: true, saving: false, dirty: false, error: '' };
  private listeners = new Set<() => void>();
  private versions = new Map<Field, number>();
  private retained = new Set<Field>();
  private generation = 0;
  private epoch = 0;
  private composing = 0;
  private blocked = false;
  private disposed = false;
  private timer?: number;
  private reading?: Promise<void>;
  private writing?: Promise<void>;

  constructor(private api: PropertiesAPI, readonly id: string, private timerWindow?: Window) { void this.refresh(); }
  get isComposing(): boolean { return this.composing > 0; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<WorkPropertiesState>) { this.state = { ...this.state, ...patch }; if (!this.disposed) for (const listener of [...this.listeners]) listener(); }
  private patch() {
    const patch: Partial<WorkPropertyValues> = {};
    if (this.state.properties && this.state.values) for (const key of keys(this.state.values)) {
      if (this.retained.has(key) || !Object.is(this.state.values[key], this.state.properties.values[key])) Object.assign(patch, { [key]: this.state.values[key] });
    }
    return patch;
  }
  private schedule() {
    this.clearTimer();
    if (!this.disposed && !this.composing && !this.blocked && this.state.dirty) this.timer = (this.timerWindow ?? window).setTimeout(() => { this.timer = undefined; void this.flush().catch(() => {}); }, 500);
  }
  private clearTimer() { if (this.timer !== undefined) { (this.timerWindow ?? window).clearTimeout(this.timer); this.timer = undefined; } }
  update(patch: Partial<WorkPropertyValues>) {
    if (this.disposed || !this.state.values) return;
    const values = { ...this.state.values };
    let changed = false;
    for (const key of keys(patch)) if (!Object.is(values[key], patch[key])) {
      Object.assign(values, { [key]: patch[key] });
      this.versions.set(key, ++this.generation);
      changed = true;
    }
    if (!changed) return;
    this.emit({ values });
    this.emit({ dirty: keys(this.patch()).length > 0 });
    this.schedule();
  }
  startComposition() { this.composing++; this.clearTimer(); }
  endComposition() { this.composing = Math.max(0, this.composing - 1); this.schedule(); }

  refresh = (): Promise<void> => {
    if (this.disposed || this.state.saving) return Promise.resolve();
    if (this.reading) return this.reading;
    const epoch = this.epoch;
    const read = async () => {
      try {
        const incoming = clone(await this.api.readWorkProperties(this.id));
        if (epoch !== this.epoch || this.disposed) return;
        const dirty = keys(this.patch()), previous = this.state;
        const values = { ...incoming.values }, expected = clone(incoming);
        for (const key of dirty) {
          if (Object.is(incoming.values[key], previous.values![key])) { this.retained.delete(key); continue; }
          Object.assign(values, { [key]: previous.values![key] });
          Object.assign(expected.values, { [key]: previous.properties!.values[key] });
        }
        if (dirty.includes('cover') && !Object.is(incoming.values.cover, previous.values!.cover)) expected.coverPresent = previous.properties!.coverPresent;
        this.emit({ properties: expected, values, loading: false, error: this.blocked ? this.state.error : '' });
        this.emit({ dirty: keys(this.patch()).length > 0 });
      } catch (failure) {
        if (epoch === this.epoch && !this.disposed) this.emit({ loading: false, error: `读取失败：${(failure as Error).message}` });
      }
    };
    // Mark the read before calling the API: its own store notification must not start another read.
    this.reading = Promise.resolve().then(read).finally(() => { this.reading = undefined; });
    return this.reading;
  };

  flush = (): Promise<void> => {
    this.clearTimer();
    if (this.writing) return this.writing;
    if (this.disposed) return Promise.resolve();
    const write = async () => {
      if (this.reading) await this.reading;
      if (!this.state.properties || this.composing) return;
      this.blocked = false;
      let attempted: Field[] = [], attemptedVersions = new Map<Field, number>();
      try {
        for (let patch = this.patch(); keys(patch).length; patch = this.patch()) {
          if (this.composing) return;
          const expected = clone(this.state.properties), versions = new Map(this.versions);
          attempted = keys(patch); attemptedVersions = versions;
          this.epoch++;
          this.emit({ saving: true, error: '' });
          const saved = clone(await this.api.patchWorkProperties(this.id, patch, expected));
          for (const key of attempted) this.retained.delete(key);
          const values = { ...saved.values };
          for (const key of keys(this.state.values!)) {
            if ((this.versions.get(key) ?? 0) > (versions.get(key) ?? 0)) Object.assign(values, { [key]: this.state.values![key] });
          }
          this.emit({ properties: saved, values });
          this.emit({ dirty: keys(this.patch()).length > 0 });
        }
      } catch (failure) {
        for (const key of attempted) if ((this.versions.get(key) ?? 0) > (attemptedVersions.get(key) ?? 0)) this.retained.add(key);
        this.blocked = true;
        this.emit({ dirty: true, error: `未保存：${(failure as Error).message}` });
        throw failure;
      } finally { this.emit({ saving: false }); }
    };
    this.writing = Promise.resolve().then(write).finally(() => { this.writing = undefined; });
    return this.writing;
  };

  reload = async () => {
    if (this.writing) return;
    this.clearTimer();
    this.blocked = false;
    this.versions.clear();
    this.retained.clear();
    this.emit({ properties: null, values: null, loading: true, dirty: false, error: '' });
    await this.refresh();
  };
  dispose() { this.disposed = true; this.clearTimer(); this.listeners.clear(); }
}

export class WorkPropertiesManager {
  private sessions = new Map<string, WorkPropertiesSession>();
  private unsubscribe: () => void;
  constructor(private api: PropertiesAPI, private timerWindow?: Window) { this.unsubscribe = api.subscribe(() => { for (const session of this.sessions.values()) void session.refresh(); }); }
  getSession(id: string) {
    let session = this.sessions.get(id);
    if (!session) { session = new WorkPropertiesSession(this.api, id, this.timerWindow); this.sessions.set(id, session); }
    return session;
  }
  flush(id: string) { return this.sessions.get(id)?.flush() ?? Promise.resolve(); }
  flushAll() { return this.flushSessions([...this.sessions.values()]); }
  flushModules(moduleIds: string[]) {
    const ids = new Set(moduleIds);
    return this.flushSessions([...this.sessions.values()].filter(session => {
      const properties = session.getSnapshot().properties;
      return properties && ids.has(properties.moduleId ?? properties.kind);
    }));
  }
  private async flushSessions(sessions: WorkPropertiesSession[]) {
    if (sessions.some(session => session.isComposing)) throw new Error('输入法仍在编辑，请完成输入后重试。卡片草稿已保留。');
    const results = await Promise.allSettled(sessions.map(session => session.flush()));
    const failure = results.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    if (sessions.some(session => session.isComposing || session.getSnapshot().dirty)) throw new Error('卡片仍有未保存的输入，请完成输入后重试。草稿已保留。');
  }
  recoveryDrafts() {
    const drafts: Array<{ id: string; path: string; values: WorkPropertyValues }> = [];
    for (const session of this.sessions.values()) {
      const state = session.getSnapshot();
      if (state.dirty && state.values) drafts.push({ id: session.id, path: state.properties?.path ?? '', values: { ...state.values } });
    }
    return drafts;
  }
  dispose() { this.unsubscribe(); for (const session of this.sessions.values()) session.dispose(); this.sessions.clear(); }
}
