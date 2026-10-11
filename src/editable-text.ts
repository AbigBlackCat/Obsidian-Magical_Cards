export type EditableTextKind = 'title' | 'subtitle';

/** Keep inline copy on one line and count Unicode characters without splitting emoji. */
export function editableTextDraft(text: string, kind: EditableTextKind): string {
  const plain = Array.from(text.replace(/[\r\n\t\u2028\u2029]+/g, ' ')).filter(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127).join('');
  return Array.from(plain).slice(0, kind === 'title' ? 180 : 300).join('');
}

export function editableTextValue(text: string, previous: string, kind: EditableTextKind): string {
  const value = editableTextDraft(text, kind).trim();
  return value || (kind === 'title' ? previous : '');
}
