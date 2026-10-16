/** Native DOM bridge. Hosts never share React or CardsStore instances. */
export interface MagicalCardsModule { id: string; title: string; kind: 'book' | 'film' | 'showcase'; }
export interface MagicalCardsSnapshot { rootFolder: string; modules: MagicalCardsModule[]; loading: boolean; error: string; }
export interface MagicalCardsMount { flush(): Promise<void>; dispose(): Promise<void>; }
export interface MagicalCardsMountOptions { rootFolder: string; moduleId: string; actions?: HTMLElement; }
export interface MagicalCardsHostAPI {
  version: 1;
  instanceId: string;
  getSnapshot(): MagicalCardsSnapshot;
  subscribe(listener: () => void): () => void;
  mountModule(container: HTMLElement, options: MagicalCardsMountOptions): MagicalCardsMount;
  /** Pauses all affected native mounts, commits drafts, then returns an idempotent unlock. */
  prepareModules(rootFolder: string, moduleIds: string[]): Promise<() => void>;
}
export interface MagicalCardsUnavailable { instanceId: string; }
export const MAGICAL_CARDS_REQUEST_API = 'magical-cards:request-api';
export const MAGICAL_CARDS_API_READY = 'magical-cards:api-ready';
export const MAGICAL_CARDS_API_UNAVAILABLE = 'magical-cards:api-unavailable';
