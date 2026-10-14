import { TFile, TFolder, normalizePath, type App } from 'obsidian';
import { sanitizeSvg } from './covers';
import { prepareNativeWrite, validFolder } from './persistence';
import { appendShowcaseMarkdown, assertShowcaseId, deleteShowcaseMarkdown, moveShowcaseMarkdown, newShowcaseMarkdown, patchShowcaseMarkdown, readShowcaseMarkdown } from './showcase-markdown';
import type { CustomCardModule, ShowcaseAPI, ShowcaseCard, ShowcaseDocument, ShowcaseImport } from './types';

export interface ShowcaseServiceOptions {
  app: App;
  rootFolder: string;
  getModule: (id: string) => CustomCardModule | undefined;
  notify: () => void;
  assertActive?: () => void;
  serialize?: <T>(task: () => Promise<T>) => Promise<T>;
}
export function createShowcaseService(options: ShowcaseServiceOptions): ShowcaseAPI {
  const { app, getModule, notify } = options;
  if (!validFolder(options.rootFolder)) throw new Error('橱窗目录必须位于当前笔记库内。');
  const root = normalizePath(options.rootFolder), active = options.assertActive ?? (() => {});
  let queue: Promise<unknown> = Promise.resolve();
  const serial = options.serialize ?? (<T>(task: () => Promise<T>): Promise<T> => { const next = queue.catch(() => {}).then(task); queue = next; return next; });
  const run = <T>(task: () => Promise<T>): Promise<T> => serial(() => { active(); return task(); });
  const defaultPath = (id: string) => `${root}/橱窗/${id}/橱窗.md`;
  const repairHint = (path: string) => `请将原笔记恢复到 ${path}，或在 ${root}/_数据/卡片配置.md 的对应模块中修正 showcaseNote 路径。`;
  function modulePath(id: string): string {
    active(); assertShowcaseId(id);
    const module = getModule(id);
    if (module?.mode !== 'showcase') throw new Error('橱窗模块已移除或类型改变，草稿已保留。');
    const path = module.showcaseNote;
    if (!path || !validFolder(path) || !path.startsWith(`${root}/`) || !path.endsWith('.md')) throw new Error('橱窗笔记位置无效，请检查模块设置。');
    return normalizePath(path);
  }
  function fileFor(id: string): TFile {
    const path = modulePath(id), file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error(`橱窗笔记已移动或删除；没有创建空笔记。${repairHint(path)}`);
    return file;
  }
  function assertFile(id: string, file: TFile): void {
    active(); if (fileFor(id) !== file) throw new Error('橱窗笔记位置已变化，草稿已保留。');
  }
  async function folders(path: string): Promise<void> {
    let current = '';
    for (const part of path.split('/')) {
      active(); current = current ? `${current}/${part}` : part;
      const existing = app.vault.getAbstractFileByPath(current);
      if (existing && !(existing instanceof TFolder)) throw new Error('橱窗目录被文件占用，原内容已保留。');
      if (!existing) await app.vault.createFolder(current);
    }
    active();
  }
  async function read(moduleId: string): Promise<ShowcaseDocument> {
    const file = fileFor(moduleId), text = await app.vault.read(file); assertFile(moduleId, file);
    return readShowcaseMarkdown(text, file.path, moduleId);
  }
  async function change<T>(moduleId: string, update: (text: string, file: TFile) => { text: string; result: T }): Promise<T> {
    const file = fileFor(moduleId), assertEditors = await prepareNativeWrite(app, file, active);
    let outcome: { result: T } | undefined;
    await app.vault.process(file, text => {
      assertFile(moduleId, file); assertEditors(text);
      const result = update(text, file); outcome = result; return result.text;
    });
    active(); if (!outcome) throw new Error('橱窗保存未完成。'); notify(); return outcome.result;
  }
  return {
    create: (moduleId, title) => run(async () => {
      assertShowcaseId(moduleId); const contents = newShowcaseMarkdown(moduleId, title), module = getModule(moduleId);
      if (module && module.mode !== 'showcase') throw new Error('现有作品模块不能转换为橱窗。');
      const path = module?.showcaseNote ?? defaultPath(moduleId);
      if (!validFolder(path) || !path.startsWith(`${root}/`) || !path.endsWith('.md')) throw new Error('橱窗笔记位置无效。');
      const existing = app.vault.getAbstractFileByPath(path);
      if (existing instanceof TFile) { readShowcaseMarkdown(await app.vault.read(existing), path, moduleId); active(); return path; }
      if (existing) throw new Error('橱窗笔记位置被文件夹占用。');
      if (module?.showcaseNote) throw new Error(`橱窗笔记已删除；没有自动重新创建。${repairHint(path)}`);
      await folders(path.slice(0, path.lastIndexOf('/'))); active();
      await app.vault.create(path, contents); active(); notify(); return path;
    }),
    read,
    importImages: (moduleId, images) => {
      const requests = images.map(incoming => ({ ...incoming }));
      return run(async () => {
      const result: { imported: string[]; failed: Array<{ id: string; error: string }> } = { imported: [], failed: [] }, ids = new Set<string>();
      for (const incoming of requests) {
        try {
          assertShowcaseId(incoming.id);
          if (ids.has(incoming.id)) throw new Error('本次导入包含重复卡片标识。');
          ids.add(incoming.id); active();
          const document = await read(moduleId);
          if (document.cards.some(card => card.id === incoming.id)) { result.imported.push(incoming.id); continue; }
          await importOne(moduleId, incoming); result.imported.push(incoming.id);
        } catch (error) { result.failed.push({ id: incoming.id, error: error instanceof Error ? error.message : '图片导入未完成，请重试。' }); }
      }
      return result;
      });
    },
    patchCard: (moduleId, id, patch, expected) => {
      const changes = { ...patch }, baseline = { ...expected };
      return run(() => change(moduleId, (text, file) => { const result = patchShowcaseMarkdown(text, file.path, moduleId, id, changes, baseline); return { text: result.text, result: result.card }; }));
    },
    deleteCard: (moduleId, id, expected) => {
      const baseline = { ...expected };
      return run(() => change(moduleId, (text, file) => ({ text: deleteShowcaseMarkdown(text, file.path, moduleId, id, baseline), result: undefined })));
    },
    moveCard: (moduleId, id, beforeId, expectedIds) => {
      const order = [...expectedIds];
      return run(() => change(moduleId, (text, file) => ({ text: moveShowcaseMarkdown(text, file.path, moduleId, id, beforeId, order), result: undefined })));
    },
  };
  async function importOne(moduleId: string, incoming: ShowcaseImport): Promise<void> {
    const { file: upload } = incoming;
    if (upload.size > 10 * 1024 * 1024) throw new Error('图片应小于 10 MB。');
    const extension = upload.name.split('.').at(-1)?.toLowerCase();
    if (!extension || !['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(extension)) throw new Error('请选择 PNG、JPEG、WebP、GIF 或 SVG 图片。');
    if (extension === 'svg' && upload.size > 2_000_000) throw new Error('SVG 封面超过 2 MB，请缩小文件后重试。');
    const note = fileFor(moduleId), sourcePath = note.path, image = `图片-${incoming.id}.${extension}`, path = `${sourcePath.slice(0, sourcePath.lastIndexOf('/'))}/${image}`;
    const content = extension === 'svg' ? sanitizeSvg(await upload.text()) : await upload.arrayBuffer();
    assertFile(moduleId, note); if (note.path !== sourcePath) throw new Error('橱窗目录已移动，请重新导入；原图片已保留。');
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing && !(existing instanceof TFile)) throw new Error('图片位置被文件夹占用，原内容已保留。');
    if (existing instanceof TFile) {
      const previous = typeof content === 'string' ? await app.vault.read(existing) : await app.vault.readBinary(existing);
      active();
      const equal = typeof content === 'string' ? previous === content : typeof previous !== 'string' && equalBytes(previous, content);
      if (!equal) throw new Error('导入标识对应的图片已有不同内容，没有覆盖原文件。');
    } else if (typeof content === 'string') await app.vault.create(path, content);
    else await app.vault.createBinary(path, content);
    assertFile(moduleId, note); if (note.path !== sourcePath) throw new Error('橱窗目录已移动，请重新导入；原图片已保留。');
    const card: ShowcaseCard = { id: incoming.id, image, name: '', description: '' };
    await change(moduleId, (text, file) => {
      const document = readShowcaseMarkdown(text, file.path, moduleId);
      if (document.cards.some(item => item.id === incoming.id)) return { text, result: undefined };
      return { text: appendShowcaseMarkdown(text, file.path, moduleId, card), result: undefined };
    });
  }
}
function equalBytes(left: ArrayBuffer, right: ArrayBuffer): boolean {
  const a = new Uint8Array(left), b = new Uint8Array(right); return a.length === b.length && a.every((value, index) => value === b[index]);
}
