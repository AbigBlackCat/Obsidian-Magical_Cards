export type WorkKind = 'book' | 'film';
export type CoverTemplate = 'water' | 'pages' | 'orbit';
export type CardMaterial = 'paper' | 'matte' | 'foil';
export type CardStyle = 'minimal' | 'cover';
export type CardLayout = 'cylinder' | 'coverflow-carousel' | 'album-rail' | 'scroll-bend' | 'skewed-carousel';
export type CardDirection = 'horizontal' | 'vertical';
export type CardTextAlignment = 'left' | 'center' | 'right';
export interface WorkCardAppearance { material: CardMaterial; style: CardStyle; layout?: CardLayout; orientation?: CardDirection; ratio?: CardRatio; imageFit?: 'contain' | 'cover'; }
export type CardRatio = '1:1' | '4:3' | '3:4' | '2:3' | '16:9';
export interface CustomCardModule { id: string; title: string; kind: WorkKind; appearance: WorkCardAppearance; ratio?: CardRatio; imageFit?: 'contain' | 'cover'; }
export interface WorkOrder { book: string[]; film: string[]; }
export interface BaseEntity { id: string; type: string; title: string; path: string; createdAt: string; updatedAt: string; body?: string; revision?: string; }
export interface SourceNote { id: string; kind: 'highlight' | 'thought'; text: string; quote?: string; chapter?: string; date?: string; }
export interface Book extends BaseEntity { type: 'book'; moduleId?: string; linkedNote?: string; sourceId: string; author: string; cover: string; progress: number; lastRead: string; status: 'want' | 'reading' | 'finished'; notes: SourceNote[]; deepLink: string; summary: string; rating: number | null; pinned: boolean; cardTitleAlign?: CardTextAlignment; cardSummaryAlign?: CardTextAlignment; }
export interface Film extends BaseEntity { type: 'film'; moduleId?: string; linkedNote?: string; director: string; year: string; cover: string; date: string; status: 'want' | 'watching' | 'finished'; summary: string; rating: number | null; pinned: boolean; link: string; cardTitleAlign?: CardTextAlignment; cardSummaryAlign?: CardTextAlignment; }
export type Work = Book | Film;
export interface WorkPropertyValues { linkedNote?: string; title: string; cover: string; summary: string; rating: number | null; pinned: boolean; status: Book['status'] | Film['status']; cardTitleAlign?: CardTextAlignment; cardSummaryAlign?: CardTextAlignment; author?: string; progress?: number; lastRead?: string; deepLink?: string; director?: string; year?: string; date?: string; link?: string; }
export interface WorkProperties { id: string; kind: WorkKind; moduleId?: string; path: string; coverPresent: boolean; values: WorkPropertyValues; }
export type CardLayoutPatch = Partial<Pick<WorkPropertyValues, 'cardTitleAlign' | 'cardSummaryAlign'>>;
export interface CardLayoutResult { updated: number; skipped: number; failed: Array<{ id: string; path: string; title: string; error: string }>; }
export type WorkbenchAnchor = 'reflection' | 'actions' | 'gantt' | 'quadrants' | 'collections' | 'end' | 'inside-collections';
export interface WorkbenchCardPlacement { module: string; before: WorkbenchAnchor; }
export interface CardsSettings { bookCardAppearance: WorkCardAppearance; filmCardAppearance: WorkCardAppearance; customModules: CustomCardModule[]; threeCardView: boolean; workbenchText: Record<string, string>; workbenchCards: WorkbenchCardPlacement[]; standaloneOrder: string[]; }
export interface CardsSnapshot { entities: Work[]; workOrder: WorkOrder | null; settings: CardsSettings; loading: boolean; error: string; }
export interface CardsAPI {
  getSnapshot: () => CardsSnapshot; subscribe: (listener: () => void) => () => void;
  save(work: Work): Promise<void>; deleteWork(id: string): Promise<void>;
  readWorkProperties(id: string): Promise<WorkProperties>; patchWorkProperties(id: string, patch: Partial<WorkPropertyValues>, expected: WorkProperties): Promise<WorkProperties>;
  applyCardLayout(patch: CardLayoutPatch): Promise<CardLayoutResult>;
  openWorkOrder(kind: WorkKind): Promise<void>; moveWork(kind: WorkKind, id: string, beforeId: string | null): Promise<void>;
  listNoteCandidates(query: string): Promise<Array<{ path: string; title: string }>>; openNote(path: string): Promise<void>;
  attachCover(file: File): Promise<string>; makeCover(template: CoverTemplate, title: string, color: string): Promise<string>; coverUrl(path: string, sourcePath?: string): string;
  readCoverSvg?: (path: string, sourcePath?: string) => Promise<string>;
  saveSettings(patch: Partial<CardsSettings>): Promise<void>;
}
export const DEFAULT_CARD_SETTINGS: CardsSettings = { bookCardAppearance: { material: 'foil', style: 'minimal' }, filmCardAppearance: { material: 'foil', style: 'minimal' }, customModules: [], threeCardView: false, workbenchText: {}, workbenchCards: [], standaloneOrder: [] };
