/** Drafts belong to the rendering plugin, including forms outside property sessions. */
export interface CardDraftSession {
  flush(): Promise<void>;
  recoveryDrafts(): unknown[];
}
const sessions = new Map<HTMLElement, CardDraftSession>();
export function registerCardDraft(element: HTMLElement, session: CardDraftSession): () => void {
  sessions.set(element, session);
  return () => { if (sessions.get(element) === session) sessions.delete(element); };
}
function within(surface: HTMLElement): CardDraftSession[] {
  return [...sessions].filter(([element]) => element === surface || surface.contains(element)).map(([, session]) => session);
}
export async function flushSurfaceDrafts(surface: HTMLElement): Promise<void> {
  for (const session of within(surface)) await session.flush();
}
export function surfaceRecoveryDrafts(surface: HTMLElement): unknown[] {
  return within(surface).flatMap(session => session.recoveryDrafts());
}
