export type EditableTextKind = 'title' | 'subtitle';

/** Keep inline copy on one line and count Unicode characters without splitting emoji. */
export function editableTextDraft(text: string, kind: EditableTextKind): string {
  const plain = text.replace(/[\r\n\t\u2028\u2029]+/g, ' ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  return Array.from(plain).slice(0, kind === 'title' ? 180 : 300).join('');
}

export function editableTextValue(text: string, previous: string, kind: EditableTextKind): string {
  const value = editableTextDraft(text, kind).trim();
  return value || (kind === 'title' ? previous : '');
}
