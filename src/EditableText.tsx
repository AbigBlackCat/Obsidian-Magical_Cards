import React, {createContext, useContext, useLayoutEffect, useRef, useState} from 'react';
import {editableTextDraft, editableTextValue, type EditableTextKind} from './editable-text';

interface WorkbenchTextContextValue {
  values: Record<string, string>;
  save: (key: string, value: string) => Promise<boolean>;
}

const WorkbenchTextContext = createContext<WorkbenchTextContextValue | null>(null);

/** A clean draft follows committed changes, including after Escape during a pending save. */
export function reconcileEditableText(text: string, committed: string, dirty: boolean, pending: number) {
  if (pending > 0) return {text, dirty};
  const next = dirty ? text : committed;
  return {text: next, dirty: next !== committed};
}

export function WorkbenchTextProvider({values, save, children}: WorkbenchTextContextValue & {children: React.ReactNode}) {
  return <WorkbenchTextContext.Provider value={{values, save}}>{children}</WorkbenchTextContext.Provider>;
}

export type EditableTextProps = {
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  className?: string;
  kind?: EditableTextKind;
  ariaLabel?: string;
} & ({textKey: string; defaultText: string; value?: never; onSave?: never} | {
  value: string; onSave: (value: string) => Promise<boolean>; textKey?: never; defaultText?: never;
});

/** Edit the existing copy in place. The DOM owns the draft so rerenders never discard it. */
export default function EditableText(props: EditableTextProps) {
  const context = useContext(WorkbenchTextContext);
  const {as = 'span', className, kind = 'title', ariaLabel} = props;
  const value = props.textKey !== undefined ? context?.values[props.textKey] ?? props.defaultText : props.value;
  const textKey = props.textKey;
  const save = textKey !== undefined
    ? (next: string) => context?.save(textKey, next) ?? Promise.resolve(false)
    : props.onSave;
  const element = useRef<HTMLElement | null>(null);
  const initial = useRef(value);
  const external = useRef(value);
  const committed = useRef(value);
  const dirty = useRef(false);
  const composing = useRef(false);
  const focused = useRef(false);
  const skipBlur = useRef(false);
  const pending = useRef(0);
  const request = useRef(0);
  const saves = useRef<Promise<void>>(Promise.resolve());
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  useLayoutEffect(() => {
    if (value === external.current) return;
    external.current = value;
    committed.current = value;
    if (!element.current) return;
    const synced = reconcileEditableText(element.current.textContent ?? '', value, dirty.current, pending.current);
    if (element.current.textContent !== synced.text) {
      element.current.textContent = synced.text;
      if (focused.current) moveCaretToEnd(element.current);
    }
    dirty.current = composing.current || synced.dirty;
    if (!dirty.current && pending.current === 0) setStatus(current => current === 'error' ? 'idle' : current);
  }, [value]);

  const moveCaretToEnd = (target: HTMLElement) => {
    const selection = target.ownerDocument.getSelection();
    if (!selection) return;
    const range = target.ownerDocument.createRange();
    range.selectNodeContents(target); range.collapse(false);
    selection.removeAllRanges(); selection.addRange(range);
  };

  const readDraft = (target: HTMLElement) => {
    const raw = target.textContent ?? '';
    const next = editableTextDraft(raw, kind);
    if (raw !== next) { target.textContent = next; moveCaretToEnd(target); }
    // Typing back to the previous value while a save is pending is still a new draft.
    dirty.current = next !== committed.current || pending.current > 0;
  };

  const commit = (target: HTMLElement) => {
    const next = editableTextValue(target.textContent ?? '', committed.current, kind);
    target.textContent = next;
    dirty.current = next !== committed.current;
    if (!dirty.current && pending.current === 0) { target.dataset.editableError = 'false'; setStatus('idle'); return; }
    dirty.current = true;
    const id = ++request.current;
    pending.current += 1;
    target.dataset.editableSaving = 'true'; target.dataset.editableError = 'false';
    setStatus('saving');
    // A second edit can finish while the first save is pending; preserve their order.
    saves.current = saves.current.then(async () => {
      let saved = false;
      try { saved = await save(next); } catch { /* Retain the draft and offer a retry in place. */ }
      pending.current -= 1;
      if (saved) committed.current = next;
      const synced = reconcileEditableText(element.current?.textContent ?? next, committed.current, dirty.current, pending.current);
      if (element.current && element.current.textContent !== synced.text) {
        element.current.textContent = synced.text;
        if (focused.current) moveCaretToEnd(element.current);
      }
      dirty.current = composing.current || synced.dirty;
      if (element.current) { element.current.dataset.editableSaving = String(pending.current > 0); element.current.dataset.editableError = String(pending.current === 0 && !saved && dirty.current); }
      if (id === request.current) setStatus(saved || !dirty.current ? 'idle' : 'error');
    });
  };

  const text = React.createElement(as, {
    ref: element,
    className: ['bw-editable-text', className, status === 'saving' ? 'is-saving' : status === 'error' ? 'is-save-error' : ''].filter(Boolean).join(' '),
    contentEditable: true,
    suppressContentEditableWarning: true,
    tabIndex: 0,
    'data-editable-kind': kind,
    'aria-label': ariaLabel ?? `编辑${kind === 'title' ? '标题' : '副标题'}：${props.defaultText ?? props.value}`,
    'aria-busy': status === 'saving' || undefined,
    title: status === 'error' ? '未保存。点击文字重新编辑，离开后重试。' : '点击编辑，离开或按 Enter 保存，Esc 取消',
    onFocus: () => { focused.current = true; skipBlur.current = false; },
    onInput: (event: React.SyntheticEvent<HTMLElement, InputEvent>) => { if (!composing.current && !event.nativeEvent.isComposing) readDraft(event.currentTarget); },
    onCompositionStart: (event: React.CompositionEvent<HTMLElement>) => { composing.current = true; dirty.current = true; event.currentTarget.dataset.editableComposing = 'true'; },
    onCompositionEnd: (event: React.CompositionEvent<HTMLElement>) => { composing.current = false; event.currentTarget.dataset.editableComposing = 'false'; readDraft(event.currentTarget); },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      // Legacy composition key 229 is still emitted by some IMEs before isComposing.
      if (event.nativeEvent.isComposing || composing.current || event.keyCode === 229) return;
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); event.currentTarget.blur(); }
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); skipBlur.current = true;
        event.currentTarget.textContent = committed.current; dirty.current = false;
        event.currentTarget.dataset.editableError = 'false';
        setStatus(pending.current ? 'saving' : 'idle'); event.currentTarget.blur();
      }
    },
    onBeforeInput: (event: React.SyntheticEvent<HTMLElement, InputEvent>) => {
      const input = event.nativeEvent;
      if (!composing.current && !input.isComposing && (input.inputType === 'insertParagraph' || input.inputType === 'insertLineBreak')) {
        event.preventDefault(); event.currentTarget.blur();
      }
    },
    onPaste: (event: React.ClipboardEvent<HTMLElement>) => {
      event.preventDefault();
      const target = event.currentTarget;
      const plain = editableTextDraft(event.clipboardData.getData('text/plain'), kind);
      const doc = target.ownerDocument;
      // insertText keeps native undo history; the range fallback never inserts clipboard HTML.
      if (!doc.execCommand?.('insertText', false, plain)) {
        const selection = doc.getSelection();
        if (selection?.rangeCount && target.contains(selection.getRangeAt(0).commonAncestorContainer)) {
          const range = selection.getRangeAt(0); range.deleteContents();
          const node = doc.createTextNode(plain); range.insertNode(node); range.setStartAfter(node); range.collapse(true);
          selection.removeAllRanges(); selection.addRange(range);
        } else { target.append(doc.createTextNode(plain)); moveCaretToEnd(target); }
      }
      readDraft(target);
    },
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      focused.current = false; composing.current = false;
      event.currentTarget.dataset.editableComposing = 'false';
      if (skipBlur.current) { skipBlur.current = false; return; }
      commit(event.currentTarget);
    },
  }, initial.current);

  return <>{text}{status === 'error' && <span className="bw-editable-status" role="status">未保存，点击文字重试</span>}</>;
}
