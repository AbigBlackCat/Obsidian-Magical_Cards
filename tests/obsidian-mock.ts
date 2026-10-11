import { parse, stringify } from 'yaml';
import { posix } from 'node:path';

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
}
export const parseYaml = parse;
export const stringifyYaml = stringify;

export class TFile {
  constructor(public path: string, public contents: string) {}
  get extension() { return this.path.split('.').at(-1) ?? ''; }
  get name() { return this.path.split('/').at(-1)!; }
  get basename() { return this.name.replace(/\.[^.]*$/, ''); }
}
export class TFolder {
  constructor(public path: string) {}
}

export class MemoryVault {
  configDir = '.obsidian';
  events = new Map<string, Set<(...args: any[]) => void>>();
  on(name: string, handler: (...args: any[]) => void) { const listeners = this.events.get(name) ?? new Set(); listeners.add(handler); this.events.set(name, listeners); return { e: this, name, handler }; }
  offref(ref: { name: string; handler: (...args: any[]) => void }) { this.events.get(ref.name)?.delete(ref.handler); }
  trigger(name: string, ...args: any[]) { for (const listener of this.events.get(name) ?? []) listener(...args); }
  adapter = { exists: async (path: string) => this.files.has(path), read: async (path: string) => this.text(path), write: async (path: string, text: string) => { const file = this.getAbstractFileByPath(path); if (file instanceof TFile) file.contents = text; else await this.create(path, text); } };
  files = new Map<string, TFile | TFolder>();
  getAbstractFileByPath(path: string) { return this.files.get(normalizePath(path)) ?? null; }
  getMarkdownFiles() { return [...this.files.values()].filter((file): file is TFile => file instanceof TFile && file.extension === 'md'); }
  async createFolder(path: string) {
    path = normalizePath(path);
    if (this.files.has(path)) throw new Error(`Path already exists: ${path}`);
    this.files.set(path, new TFolder(path));
  }
  async create(path: string, contents: string) {
    path = normalizePath(path);
    if (this.files.has(path)) throw new Error(`Path already exists: ${path}`);
    const file = new TFile(path, contents);
    this.files.set(path, file);
    return file;
  }
  async createBinary(path: string, contents: ArrayBuffer) { return this.create(path, Buffer.from(contents).toString('base64')); }
  async read(file: TFile) { return file.contents; }
  async cachedRead(file: TFile) { return file.contents; }
  async modify(file: TFile, contents: string) { file.contents = contents; }
  async process(file: TFile, update: (contents: string) => string) { file.contents = update(file.contents); return file.contents; }
  getResourcePath(file: TFile) { return `mock-resource://${file.path}`; }
  text(path: string) {
    const file = this.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error(`Missing file: ${path}`);
    return file.contents;
  }
  dump() { return Object.fromEntries([...this.files.values()].filter((file): file is TFile => file instanceof TFile).map(file => [file.path, file.contents])); }
}

export class App {
  vault = new MemoryVault();
  opened: string[] = [];
  openedStates: unknown[] = [];
  secrets = new Map<string, string>();
  trashed = new Map<string, string>();
  markdownViews: Array<{ file: TFile; getViewData(): string; save(clear?: boolean): Promise<void> }> = [];
  secretStorage = { getSecret: (id: string) => this.secrets.get(id) ?? null, setSecret: (id: string, value: string) => this.secrets.set(id, value) };
  layoutReadyCallbacks:Array<()=>void>=[];
  workspace = { layoutReady:true, onLayoutReady:(callback:()=>void)=>{if(this.workspace.layoutReady)callback();else this.layoutReadyCallbacks.push(callback);}, on: (..._args: any[]) => ({ e: { offref() {} } }), trigger: (..._args: any[]) => {}, getLeavesOfType: (type: string) => type === 'markdown' ? this.markdownViews.map(view => ({ view })) : [], getLeaf: (_kind?: unknown) => ({ openFile: async (file: TFile, options?: unknown) => { this.opened.push(file.path); this.openedStates.push(options); } }) };
  metadataCache = { getFirstLinkpathDest: (target: string, sourcePath: string) => {
    const exact = this.vault.getAbstractFileByPath(target);
    if (exact instanceof TFile) return exact;
    const relative = this.vault.getAbstractFileByPath(posix.join(posix.dirname(sourcePath), target));
    if (relative instanceof TFile) return relative;
    const matches = [...this.vault.files.values()].filter((file): file is TFile => file instanceof TFile && file.name === target);
    return matches.find(file => posix.dirname(file.path) === posix.dirname(sourcePath)) ?? matches[0] ?? null;
  } };
  fileManager = {
    trashFile: async (file: TFile) => { this.trashed.set(file.path, file.contents); this.vault.files.delete(file.path); },
    processFrontMatter: async (file: TFile, update: (frontmatter: Record<string, any>) => void) => {
      const match = file.contents.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      const fields = match ? parse(match[1]) ?? {} : {};
      update(fields);
      const body = match ? file.contents.slice(match[0].length) : file.contents;
      file.contents = `---\n${stringify(fields)}---\n${body}`;
    },
  };
}

export interface RequestOptions { url: string; method?: string; headers?: Record<string, string>; body?: string; throw?: boolean; }
export interface Response { status: number; json: unknown; }
export type RequestHandler = (options: RequestOptions) => Promise<Response>;
let requestHandler: RequestHandler = async () => { throw new Error('Tests must configure network responses'); };
export function setRequestHandler(handler: RequestHandler) { requestHandler = handler; }
export function requestUrl(options: RequestOptions) { return requestHandler(options); }

export class Component {
  private loaded = false;
  private cleanup: Array<() => void> = [];
  load() { this.loaded = true; this.onload(); }
  onload() {}
  onunload() {}
  unload() { if (!this.loaded) return; this.loaded = false; for (const callback of this.cleanup.splice(0).reverse()) callback(); this.onunload(); }
  register(callback: () => void) { this.cleanup.push(callback); }
  registerEvent(ref: any) { this.register(() => ref.e.offref(ref)); }
}
export class Plugin extends Component {
  static languages = new Map<string, unknown>();
  static constructions = 0;
  constructor(public app: App, public manifest: unknown) { super(); Plugin.constructions++; }
  registerMarkdownCodeBlockProcessor(language: string, callback: unknown) {
    if (Plugin.languages.has(language)) throw new Error('Language already registered');
    Plugin.languages.set(language, callback); this.register(() => Plugin.languages.delete(language));
  }
}
export class MarkdownRenderChild extends Component { constructor(public containerEl: HTMLElement) { super(); } }
export class MarkdownView {}
export class Notice { static messages: string[] = []; constructor(message: string) { Notice.messages.push(message); } }
