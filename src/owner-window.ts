import { useLayoutEffect, useState, type RefObject } from 'react';

/** Moving a leaf keeps its React tree, but timers must follow its new document. */
export function useOwnerWindow(element: RefObject<HTMLElement | null>): Window | undefined {
  const [owner, setOwner] = useState<Window>();
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    setOwner(node.ownerDocument.defaultView ?? undefined);
    if (typeof node.onWindowMigrated === 'function') return node.onWindowMigrated(win => setOwner(win));
  });
  return owner;
}
