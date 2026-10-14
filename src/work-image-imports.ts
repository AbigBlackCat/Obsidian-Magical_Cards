import type { CardsAPI, WorkImageImport } from './types';

interface ImportState { imports: WorkImageImport[]; failures: Array<{ id: string; error: string }>; importing: boolean; }
export const EMPTY_WORK_IMAGE_IMPORTS: ImportState = { imports: [], failures: [], importing: false };
type Importer = NonNullable<CardsAPI['importWorkImages']>;

/** Keep Files and their retry identities with the shared importer until the library closes. */
export class WorkImageImportOperations {
  private state: ImportState = { ...EMPTY_WORK_IMAGE_IMPORTS };
  private listeners = new Set<() => void>();
  constructor(private importer: Importer, private collectionId: string) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<ImportState>) { this.state = { ...this.state, ...patch }; for (const listener of [...this.listeners]) listener(); }
  add(files: File[]): void {
    if (this.state.importing) throw new Error('图片正在导入，请等待完成后再添加。');
    this.update({ imports: [...this.state.imports, ...files.map(file => ({ id: crypto.randomUUID(), file }))] });
  }
  discard(): void {
    if (this.state.importing) throw new Error('图片正在导入，请等待完成后再操作。');
    this.update({ imports: [], failures: [] });
  }
  async retry(): Promise<void> {
    if (this.state.importing || !this.state.imports.length) return;
    const batch = [...this.state.imports];
    this.update({ importing: true, failures: [] });
    try {
      const result = await this.importer(this.collectionId, batch);
      const failures = new Map(result.failed.map(item => [item.id, item.error]));
      for (const item of batch) if (!result.imported.includes(item.id) && !failures.has(item.id)) failures.set(item.id, '导入结果未确认，已保留图片供重试。');
      this.update({ imports: batch.filter(item => failures.has(item.id)), failures: batch.filter(item => failures.has(item.id)).map(item => ({ id: item.id, error: failures.get(item.id)! })) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.update({ failures: batch.map(item => ({ id: item.id, error: message })) });
    } finally { this.update({ importing: false }); }
  }
}

const key = Symbol.for('magical-cards.work-image-import-operations.v1');
type ImporterWithState = Importer & { [key]?: Map<string, WorkImageImportOperations> };
export function getWorkImageImports(api: CardsAPI, collectionId: string): WorkImageImportOperations | undefined {
  const importer: ImporterWithState | undefined = api.importWorkImages;
  if (!importer) return undefined;
  const collections = importer[key] ??= new Map<string, WorkImageImportOperations>();
  let operations = collections.get(collectionId);
  if (!operations) { operations = new WorkImageImportOperations(importer, collectionId); collections.set(collectionId, operations); }
  return operations;
}
export function hasPendingWorkImageImports(api: CardsAPI): boolean {
  return workImageImportQueues(api).some(([, operations]) => { const state = operations.getSnapshot(); return state.importing || state.imports.length > 0; });
}
export function workImageImportQueues(api: CardsAPI): Array<[string, WorkImageImportOperations]> {
  const importer: ImporterWithState | undefined = api.importWorkImages;
  return [...(importer?.[key]?.entries() ?? [])];
}
