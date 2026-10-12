import { addIcon } from 'obsidian';

export const MAGICAL_CARDS_ICON = 'magical-cards-brand';
export function registerCardsIcon(): void {
  addIcon(MAGICAL_CARDS_ICON, '<g class="magical-cards-brand" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><rect x="31" y="16" width="49" height="69" rx="8"/><path d="M24 24H18a8 8 0 0 0-8 8v52a8 8 0 0 0 8 8h38"/><path d="m44 42 11-11 12 11-12 11Z"/><path d="M44 68h22"/></g>');
}
