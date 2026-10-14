import React from 'react';

export function Icon({ name, size = 17 }: { name: 'left' | 'right' | 'plus' | 'open' | 'refresh' | 'check' | 'settings' | 'search' | 'trash' | 'sort' | 'menu'; size?: number }) {
  const paths = { left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7', plus: 'M12 5v14M5 12h14', open: 'M14 5h5v5M19 5l-9 9M19 13v6H5V5h6', refresh: 'M19 8a8 8 0 1 0 1 7M19 3v5h-5', check: 'M5 12l4 4L19 6', settings: 'M9.5 3h5l.7 2.7 2 1.2 2.7-.8 2.5 4.3-2 1.9v2.3l2 1.9-2.5 4.3-2.7-.8-2 1.2-.7 2.7h-5l-.7-2.7-2-1.2-2.7.8-2.5-4.3 2-1.9v-2.3l-2-1.9 2.5-4.3 2.7.8 2-1.2.7-2.7z M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0', search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7' };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={name === 'sort' ? 'M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4' : name === 'menu' ? 'M5 12h.01M12 12h.01M19 12h.01' : paths[name]} /></svg>;
}
export function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={`bw-field${wide ? ' bw-wide' : ''}`}><span>{label}</span>{children}</label>; }

export function Empty({ children }: { children: React.ReactNode }) { return <p className="bw-empty">{children}</p>; }
