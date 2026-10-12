import type { CardsAPI, ShowcaseImport } from './types';

export interface ShowcasePendingMove { id: string; beforeId: string | null; expectedIds: string[]; }
interface ShowcaseOperationsSnapshot { imports: ShowcaseImport[]; failures: Array<{ id: string; error: string }>; move: ShowcasePendingMove | null; moveError: string; importing: boolean; }
export const EMPTY_SHOWCASE_OPERATIONS: ShowcaseOperationsSnapshot = { imports: [], failures: [], move: null, moveError: '', importing: false };

/** Retain retry IDs, Files and expected order while the same library remains open. */
export class ShowcaseRenderOperations {
  private state: ShowcaseOperationsSnapshot = { ...EMPTY_SHOWCASE_OPERATIONS };
  private listeners = new Set<() => void>();
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  update(patch: Partial<ShowcaseOperationsSnapshot>) { this.state = { ...this.state, ...patch }; for (const listener of [...this.listeners]) listener(); }
}
const key = Symbol.for('magical-cards.showcase-render-operations.v1');
type ServiceWithOperations = NonNullable<CardsAPI['showcase']> & { [key]?: Map<string, ShowcaseRenderOperations> };
export function getShowcaseRenderOperations(api: CardsAPI, moduleId: string): ShowcaseRenderOperations | undefined {
  const library: ServiceWithOperations | undefined = api.showcase;
  if (!library) return undefined;
  const modules = library[key] ??= new Map<string, ShowcaseRenderOperations>();
  let operations = modules.get(moduleId);
  if (!operations) { operations = new ShowcaseRenderOperations(); modules.set(moduleId, operations); }
  return operations;
}
