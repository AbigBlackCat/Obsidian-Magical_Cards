import { TFile, normalizePath, type App } from 'obsidian';
import { brotliDecompress } from 'node:zlib';
import { Buffer } from 'node:buffer';
import { createWork } from './domain';
import { safeFilePart, validFolder } from './persistence';
import { freshCardsSettings, readCardsSettings, validateCardsPatch } from './settings';
import { STARTER_ASSETS, type StarterAsset } from './starter-assets';
import { GUIDE_TEMPLATE } from './onboarding-template';
import type { CardsSettings, Work, WorkKind } from './types';
import type { CardsStore } from './store';

export interface StarterItem {
  asset: string; id: string; kind: WorkKind; title: string; createdAt: string;
  coverPath: string; notePath: string; assetDone: boolean; workDone: boolean;
  retiredSkipped?: true;
}
export interface OnboardingJournal {
  version: 1; rootFolder: string; status: 'pending' | 'complete' | 'skipped';
  items: StarterItem[]; defaultsBefore: Partial<CardsSettings>; defaultsDone: boolean;
  guideId: string; guidePath: string; guideCreated: boolean; helpOpened: boolean;
}
export interface CardsPluginData extends Record<string, unknown> {
  rootFolder: string; installationOrigin?: 'fresh' | 'legacy'; legacyCardsMigration?: boolean;
  firstRunIntent?: { version: 1; rootFolder: string; defaultsBefore: Partial<CardsSettings> };
  onboarding?: OnboardingJournal; guideNotes?: Record<string, { id: string; path: string; created: boolean }>;
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
// Metadata only: old eight-item journals remain readable without bundling retired cover bytes.
const RETIRED_STARTER_ASSETS = [
  { id: 'demo-book-crime', type: 'book', title: '罪与罚', cover: 'demo-book-crime.jpg' },
  { id: 'demo-book-gone', type: 'book', title: '飘（四十年荣誉珍藏版）', cover: 'demo-book-gone.jpg' },
] as const;

export async function decodeStarterAsset(asset: StarterAsset): Promise<Uint8Array<ArrayBuffer>> {
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    if(asset.encoding!=='brotli-base64'||!Number.isSafeInteger(asset.byteLength)||asset.byteLength<=0)throw new Error('格式无效');
    const compressed=Buffer.from(asset.data,'base64');
    const decoded=await new Promise<Uint8Array>((resolve,reject)=>{
      brotliDecompress(compressed,{maxOutputLength:asset.byteLength},(error,result)=>{if(error)reject(error);else resolve(result);});
    });
    bytes=new Uint8Array(decoded);
  }catch{throw new Error(`示例封面解压失败：${asset.title}。首次导入进度已保留，请检查插件文件后重试。`);}
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.buffer)),value=>value.toString(16).padStart(2,'0')).join('');
  if(bytes.byteLength!==asset.byteLength||hash!==asset.sha256)throw new Error(`示例封面校验失败：${asset.title}。未写入封面，首次导入进度已保留。`);
  return bytes;
}

/** The new plugin's values win; old data is only read and remains available for recovery. */
export async function loadCardsPluginData(app: App, saved: unknown): Promise<{ data: CardsPluginData; needsSave: boolean }> {
  if (saved != null && !record(saved)) throw new Error('插件配置格式无效，原文件已保留。');
  const current = record(saved) ? saved : {};
  let legacy: Record<string, unknown> | undefined;
  if (!current.legacyCardsMigration) {
    const old = normalizePath(`${app.vault.configDir}/plugins/barry-cards/data.json`);
    if (await app.vault.adapter.exists(old)) {
      try { const value: unknown = JSON.parse(await app.vault.adapter.read(old)); if (!record(value)) throw new Error('格式无效'); legacy = {rootFolder:'工作台',...value}; }
      catch { throw new Error('旧 Barry Cards 配置未能读取，未建立替代配置，请检查后重试。'); }
    }else if(await app.vault.adapter.exists(normalizePath(`${app.vault.configDir}/plugins/barry-cards/manifest.json`))){legacy={rootFolder:'工作台'};}
  }
  const combined = { ...legacy, ...current };
  const rootFolder = combined.rootFolder ?? '卡片库';
  if (typeof rootFolder !== 'string' || !validFolder(rootFolder)) throw new Error('卡片目录无效，请检查插件配置。');
  const data: CardsPluginData = { ...combined, rootFolder: normalizePath(rootFolder), installationOrigin: current.installationOrigin === 'fresh' ? 'fresh' : legacy || Object.keys(current).length ? 'legacy' : 'fresh', ...(legacy ? { legacyCardsMigration: true } : {}) };
  return { data, needsSave: JSON.stringify(data) !== JSON.stringify(current) };
}

export function starterSettingsPatch(settings: CardsSettings): Partial<CardsSettings> {
  return { bookCardAppearance: settings.bookCardAppearance, filmCardAppearance: settings.filmCardAppearance, threeCardView: settings.threeCardView, workbenchText: settings.workbenchText };
}
async function onlyRootFiles(app: App, rootFolder: string, allowed: ReadonlySet<string>, assertActive: () => void): Promise<boolean> {
  const adapter = app.vault.adapter;
  if (!await adapter.exists(rootFolder)) { assertActive(); return true; }
  assertActive();
  if (typeof adapter.list !== 'function') {
    // A partially indexed vault cannot prove that an existing directory is empty.
    if (app.workspace.layoutReady === false || typeof app.vault.getAllLoadedFiles !== 'function') return false;
    return !app.vault.getAllLoadedFiles().some(file => file instanceof TFile && file.path.startsWith(`${rootFolder}/`) && !allowed.has(file.path));
  }
  const folders = [rootFolder], seen = new Set<string>();
  while (folders.length) {
    const folder = folders.pop()!; if (seen.has(folder)) continue; seen.add(folder);
    const contents = await adapter.list(folder); assertActive();
    if (contents.files.some(path => !allowed.has(normalizePath(path)))) return false;
    for (const path of contents.folders) {
      const child = normalizePath(path);
      if (!child.startsWith(`${rootFolder}/`)) throw new Error('卡片目录列表无效，首次展示已暂停。');
      folders.push(child);
    }
  }
  return true;
}
/** Persist this before acquiring a store, which may create its configuration note. */
export async function prepareFirstRunIntent(app: App, data: CardsPluginData, assertActive: () => void): Promise<CardsPluginData['firstRunIntent'] | undefined> {
  if (data.installationOrigin !== 'fresh' || data.onboarding || data.firstRunIntent) return;
  assertActive();
  if (await onlyRootFiles(app, data.rootFolder, new Set(), assertActive)) {
    return { version: 1, rootFolder: data.rootFolder, defaultsBefore: starterSettingsPatch(readCardsSettings(undefined)) };
  }
}
function makeItems(rootFolder: string): StarterItem[] {
  return STARTER_ASSETS.map(asset => {
    const id = crypto.randomUUID(), createdAt = new Date().toISOString();
    const folder = asset.type === 'book' ? '书籍' : '观影';
    return { asset: asset.id, id, kind: asset.type, title: asset.title, createdAt,
      coverPath: `${rootFolder}/附件/示例-${id}.${asset.cover.split('.').at(-1)}`,
      notePath: `${rootFolder}/${folder}/${folder}-${safeFilePart(asset.title)}-${safeFilePart(id).slice(-16)}.md`, assetDone: false, workDone: false };
  });
}
export function starterWork(item: StarterItem): Work {
  return { ...createWork(item.kind), id: item.id, title: item.title, cover: item.coverPath, createdAt: item.createdAt, updatedAt: item.createdAt };
}
export function guideMarkdown(rootFolder: string, guideId: string): string {
  return GUIDE_TEMPLATE.replace(/\{\{([^}]+)\}\}/g, (_match, token: string) => token === 'rootFolder' ? rootFolder : `${token}-${guideId}`);
}
function journalValid(value: unknown, rootFolder: string): value is OnboardingJournal {
  const uuid=(id:unknown):id is string=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
  if (!record(value) || value.version !== 1 || value.rootFolder !== rootFolder || !['pending', 'complete', 'skipped'].includes(String(value.status)) || !Array.isArray(value.items) || !record(value.defaultsBefore) || !uuid(value.guideId) || typeof value.guidePath !== 'string' || !validFolder(value.guidePath) || normalizePath(value.guidePath)!==value.guidePath || !value.guidePath.startsWith(`${rootFolder}/`)) return false;
  if(!['defaultsDone','guideCreated','helpOpened'].every(key=>typeof value[key]==='boolean'))return false;
  try{validateCardsPatch(value.defaultsBefore);}catch{return false;}
  const assets=value.status==='skipped'?[]:value.items.length===STARTER_ASSETS.length?STARTER_ASSETS:value.items.length===8?[...STARTER_ASSETS,...RETIRED_STARTER_ASSETS]:undefined;
  if(!assets||value.items.length!==assets.length)return false;
  if(value.helpOpened&&!value.guideCreated)return false;
  if(value.status==='complete'&&(!value.defaultsDone||!value.items.every(item=>record(item)&&(item.assetDone&&item.workDone||item.retiredSkipped===true))))return false;
  if(new Set(value.items.map(item=>record(item)?item.id:undefined)).size!==value.items.length||new Set(value.items.map(item=>record(item)?item.asset:undefined)).size!==value.items.length)return false;
  return value.items.every(item => {
    if(!record(item)||!uuid(item.id)||typeof item.asset!=='string'||typeof item.createdAt!=='string'||!Number.isFinite(Date.parse(item.createdAt))||typeof item.assetDone!=='boolean'||typeof item.workDone!=='boolean')return false;
    const asset=assets.find(asset=>asset.id===item.asset);if(!asset||item.kind!==asset.type||item.title!==asset.title)return false;
    if(item.retiredSkipped!==undefined&&(item.retiredSkipped!==true||!RETIRED_STARTER_ASSETS.some(asset=>asset.id===item.asset)))return false;
    const folder=asset.type==='book'?'书籍':'观影';
    return item.coverPath===`${rootFolder}/附件/示例-${item.id}.${asset.cover.split('.').at(-1)}`&&item.notePath===`${rootFolder}/${folder}/${folder}-${safeFilePart(asset.title)}-${safeFilePart(item.id).slice(-16)}.md`;
  });
}

interface OnboardingOptions {
  app: App; api: CardsStore; rootFolder: string; ready: Promise<void>;
  data(): CardsPluginData; update(patch: Partial<CardsPluginData>): Promise<void>; assertActive: () => void;
  open(file: TFile): Promise<void>;
}

/** A persisted list of intended writes makes a partially completed first run resumable. */
export class CardsOnboarding {
  private running?: Promise<void>;
  constructor(private options: OnboardingOptions) {}
  run(): Promise<void> {
    this.running ??= this.runNow().finally(() => { this.running = undefined; });
    return this.running;
  }
  private async write(journal: OnboardingJournal) { this.options.assertActive(); await this.options.update({ onboarding: journal }); this.options.assertActive(); }
  private async folder(path: string) {
    let current = '';
    for (const part of path.split('/')) {
      current = current ? `${current}/${part}` : part; this.options.assertActive();
      const existing = this.options.app.vault.getAbstractFileByPath(current);
      if (existing instanceof TFile) throw new Error(`路径被文件占用：${current}`);
      if (!existing) await this.options.app.vault.createFolder(current);
    }
    this.options.assertActive();
  }
  private guidePath(rootFolder: string, id: string): string {
    const base = `${rootFolder}/Magical_Cards示例及用法说明.md`;
    return this.options.app.vault.getAbstractFileByPath(base) ? `${rootFolder}/Magical_Cards示例及用法说明-${id}.md` : base;
  }
  private async ensureGuide(journal: OnboardingJournal): Promise<TFile> {
    const existing = this.options.app.vault.getAbstractFileByPath(journal.guidePath);
    if (existing) {
      if (!(existing instanceof TFile)) throw new Error('说明页路径被文件夹占用，未覆盖原内容。');
      if(!journal.guideCreated){const text=await this.options.app.vault.read(existing);this.options.assertActive();if(!text.startsWith('# Magical Cards 示例及用法说明')||!text.includes(journal.guideId))throw new Error('说明页路径已有其他内容，未覆盖原笔记，请检查后重试。');}
      return existing;
    }
    await this.folder(this.options.rootFolder); this.options.assertActive();
    return this.options.app.vault.create(journal.guidePath, guideMarkdown(journal.rootFolder, journal.guideId));
  }
  private async runNow() {
    const { app, api, rootFolder, ready, assertActive } = this.options;
    await ready; assertActive();
    let journal = this.options.data().onboarding;
    if (journal && journal.rootFolder !== rootFolder) return; // Changing a directory never starts a second automatic import.
    if (!journal && this.options.data().firstRunIntent && this.options.data().firstRunIntent!.rootFolder !== rootFolder) return;
    if (journal && !journalValid(journal, rootFolder)) throw new Error('首次展示进度格式无效，未重新导入或覆盖笔记。');
    if (!journal) {
      const capable=typeof api.getInitializationInfo==='function'&&typeof api.saveStarterWork==='function';
      const info=capable?api.getInitializationInfo():{hadExistingFiles:true,hadConfig:true,usedLegacySettings:true}, snapshot = api.getSnapshot();
      const data = this.options.data(), intent = data.firstRunIntent;
      let resumed = false;
      if (data.installationOrigin === 'fresh' && intent?.rootFolder === rootFolder) {
        if (intent.version !== 1 || !record(intent.defaultsBefore)) throw new Error('首次展示意图格式无效，未导入或覆盖笔记。');
        validateCardsPatch(intent.defaultsBefore);
        resumed = await onlyRootFiles(app, rootFolder, new Set([`${rootFolder}/_数据/卡片配置.md`]), assertActive);
      }
      const fresh = data.installationOrigin === 'fresh' && capable && (intent ? resumed : !info.hadExistingFiles && !info.hadConfig) && !info.usedLegacySettings && !snapshot.entities.length && !snapshot.error;
      const guideId = crypto.randomUUID();
      journal = { version: 1, rootFolder, status: fresh ? 'pending' : 'skipped', items: fresh ? makeItems(rootFolder) : [], defaultsBefore: fresh && intent?.rootFolder === rootFolder ? intent.defaultsBefore : starterSettingsPatch(snapshot.settings), defaultsDone: !fresh,
        guideId, guidePath: this.guidePath(rootFolder, guideId), guideCreated: false, helpOpened: false };
      await this.write(journal);
    }
    if(journal.status==='skipped')return;
    if (journal.status === 'pending') {
      if(typeof api.getInitializationInfo!=='function'||typeof api.saveStarterWork!=='function')throw new Error('当前卡片库版本暂不支持首次导入，请更新提供此卡片库的插件后重试；进度和原作品已保留。');
      if (!journal.defaultsDone) {
        const current = starterSettingsPatch(api.getSnapshot().settings), desired = starterSettingsPatch(freshCardsSettings());
        // A user edit between failed attempts always takes precedence over starter defaults.
        if (JSON.stringify(current) === JSON.stringify(journal.defaultsBefore)) { assertActive(); await api.saveSettings(desired, assertActive); assertActive(); }
        journal = { ...journal, defaultsDone: true }; await this.write(journal);
      }
      for (const item of journal.items) {
        const index = journal.items.indexOf(item);
        let updated = item;
        if(item.retiredSkipped)continue;
        const asset=STARTER_ASSETS.find(asset=>asset.id===item.asset);
        // Resume old writes using an existing retired cover; never replace or remove user files.
        if(!asset&&!app.vault.getAbstractFileByPath(item.coverPath)){
          updated={...item,retiredSkipped:true};
          journal={...journal,items:journal.items.map((value,i)=>i===index?updated:value)};await this.write(journal);
          continue;
        }
        if (!item.assetDone) {
          assertActive(); const existing = app.vault.getAbstractFileByPath(item.coverPath);
          if (existing && !(existing instanceof TFile)) throw new Error(`示例封面路径被占用：${item.coverPath}`);
          if (!existing) {
            await this.folder(`${rootFolder}/附件`); assertActive();
            if(!asset)throw new Error('旧示例封面已移除，首次导入进度已保留。');
            const bytes = await decodeStarterAsset(asset); assertActive();
            await app.vault.createBinary(item.coverPath, bytes.buffer); assertActive();
          }
          updated = { ...updated, assetDone: true };
          journal = { ...journal, items: journal.items.map((value, i) => i === index ? updated : value) }; await this.write(journal);
        }
        if (!item.workDone) {
          assertActive(); await api.saveStarterWork(starterWork(updated), assertActive); assertActive();
          updated = { ...updated, workDone: true };
          journal = { ...journal, items: journal.items.map((value, i) => i === index ? updated : value) }; await this.write(journal);
        }
      }
      journal = { ...journal, status: 'complete' }; await this.write(journal);
    }
    if (!journal.guideCreated) { await this.ensureGuide(journal); journal = { ...journal, guideCreated: true }; await this.write(journal); }
    if (!journal.helpOpened) {
      const file = app.vault.getAbstractFileByPath(journal.guidePath);
      if (!(file instanceof TFile)) return; // Deleting the guide does not trigger another automatic creation.
      assertActive(); await this.options.open(file); assertActive();
      await this.write({ ...journal, helpOpened: true });
    }
  }
  async openGuide() {
    const alreadyOpened=this.options.data().onboarding?.helpOpened;
    await this.run(); this.options.assertActive();
    if(!alreadyOpened&&this.options.data().onboarding?.helpOpened)return;
    const saved = this.options.data().onboarding;
    if (saved?.rootFolder === this.options.rootFolder) {
      const file = await this.ensureGuide(saved); this.options.assertActive(); await this.options.open(file); this.options.assertActive();
      await this.write({...saved,guideCreated:true,helpOpened:true});return;
    }
    const rootFolder=this.options.rootFolder,notes=this.options.data().guideNotes??{};
    if(!record(notes))throw new Error('说明页记录格式无效，原配置已保留。');
    let guide=notes[rootFolder];
    if(guide&&(!record(guide)||typeof guide.path!=='string'||typeof guide.created!=='boolean'||!validFolder(guide.path)||!guide.path.startsWith(`${rootFolder}/`)||normalizePath(guide.path)!==guide.path||typeof guide.id!=='string'))throw new Error('说明页位置无效，未写入其他目录。');
    if(!guide){const id=crypto.randomUUID();guide={id,path:this.guidePath(rootFolder,id),created:false};await this.options.update({guideNotes:{...notes,[rootFolder]:guide}});}
    await this.folder(rootFolder);this.options.assertActive();
    let file=this.options.app.vault.getAbstractFileByPath(guide.path);
    if(file){if(!(file instanceof TFile))throw new Error('说明页路径被文件夹占用。');if(!guide.created){const text=await this.options.app.vault.read(file);this.options.assertActive();if(!text.includes(guide.id))throw new Error('说明页路径已有其他内容，未覆盖原笔记。');}}
    else {this.options.assertActive();file=await this.options.app.vault.create(guide.path,guideMarkdown(rootFolder,guide.id));}
    if(!(file instanceof TFile))throw new Error('说明页未能建立，首次导入进度已保留。');
    this.options.assertActive();await this.options.open(file);this.options.assertActive();
    await this.options.update({guideNotes:{...this.options.data().guideNotes,[rootFolder]:{...guide,created:true}}});
  }
}
