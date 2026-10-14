import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './primitives';

export interface MenuAction {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  title?: string;
  disabled?: boolean;
  expanded?: boolean;
  danger?: boolean;
  select: () => void;
}

/** A compact toolbar: the owner window owns its focus, dismissal and listeners. */
export default function ActionMenu({ label, actions, disabled = false }: { label: string; actions: MenuAction[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const focusOnOpen = useRef<'first' | 'last' | null>(null);
  const id = useId();
  const buttons = () => Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) trigger.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    if (!open) return;
    const element = root.current, doc = element?.ownerDocument, owner = doc?.defaultView;
    if (!element || !doc || !owner) return;
    if (focusOnOpen.current) {
      const items = buttons();
      (focusOnOpen.current === 'last' ? items.at(-1) : items[0])?.focus({ preventScroll: true });
      focusOnOpen.current = null;
    }
    const outside = (event: Event) => { if (!event.composedPath().includes(element)) close(); };
    const blur = () => close();
    doc.addEventListener('pointerdown', outside, true);
    doc.addEventListener('focusin', outside, true);
    owner.addEventListener('blur', blur);
    return () => { doc.removeEventListener('pointerdown', outside, true); doc.removeEventListener('focusin', outside, true); owner.removeEventListener('blur', blur); };
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const keyboard = (event: React.KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (!open) { focusOnOpen.current = ['ArrowLeft', 'ArrowUp', 'End'].includes(event.key) ? 'last' : 'first'; setOpen(true); return; }
    const items = buttons(), current = items.findIndex(item => item === root.current?.ownerDocument.activeElement);
    const reverse = ['ArrowLeft', 'ArrowUp'].includes(event.key);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : current < 0 ? reverse ? items.length - 1 : 0 : (current + (reverse ? -1 : 1) + items.length) % items.length;
    items[next]?.focus({ preventScroll: true });
  };
  return <div ref={root} className="bw-action-menu" data-open={open ? 'true' : undefined} onKeyDown={keyboard}>
    <button ref={trigger} type="button" className="bw-icon-button bw-action-menu-trigger" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id} disabled={disabled} onClick={() => { if (!open) focusOnOpen.current = 'first'; setOpen(value => !value); }}><Icon name="menu" /></button>
    <div id={id} role="menu" aria-label={label} aria-hidden={!open} inert={!open} className="bw-action-menu-tray">
      <div className="bw-action-menu-items">{actions.map((action, index) => <button key={action.id} type="button" role="menuitem" className={`bw-icon-button bw-action-menu-item${action.danger ? ' is-danger' : ''}`} data-menu-action={action.id} style={{ '--menu-index': index } as React.CSSProperties} aria-label={action.label} title={action.title ?? action.label} aria-expanded={action.expanded} disabled={disabled || action.disabled || !open} tabIndex={open ? 0 : -1} onClick={() => { close(true); action.select(); }}><Icon name={action.icon} /><span className="bw-action-menu-label">{action.label}</span></button>)}</div>
    </div>
  </div>;
}
