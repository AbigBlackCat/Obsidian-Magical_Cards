import React, { useLayoutEffect, useRef, useState } from 'react';
import type { Book, CardRatio, Film, WorkCardAppearance } from './types';
import { advanceCarousel, carouselIndex, carouselLimit, carouselOffset, carouselOpacity, carouselSlots, constrainPosition, type CarouselMotion } from './carousel-motion';
import { cardGeometry, cardTransform } from './layouts/geometry';
import { createScrollBend } from './layouts/scroll-bend';

type Work = Book | Film;
type Press = { id: number; x: number; y: number; position: number; moved: boolean; samples: { time: number; position: number }[] };

export default function WorkCarousel({ works, label, appearance, ratio = '2:3', imageFit, threeCardView = false, renderWork, renderBack, open, empty, onActiveChange }: { works: Work[]; label: string; appearance: WorkCardAppearance; ratio?: CardRatio; imageFit?: 'contain' | 'cover'; threeCardView?: boolean; renderWork: (work: Work) => React.ReactNode; renderBack: (work: Work, active: boolean, flip: () => void, open: () => void) => React.ReactNode; open: (work: Work) => void; empty: React.ReactNode; onActiveChange?: (id: string | null) => void }) {
  const layout = appearance.layout ?? 'cylinder';
  const vertical = layout === 'scroll-bend' && appearance.orientation === 'vertical';
  const [ratioWidth, ratioHeight] = ratio.split(':').map(Number);
  const heightFactor = ratioHeight / ratioWidth;
  const root = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const worksRef = useRef(works);
  worksRef.current = works;
  const threeCardViewRef = useRef(threeCardView);
  threeCardViewRef.current = threeCardView;
  const openRef = useRef(open);
  openRef.current = open;
  const motion = useRef<CarouselMotion>({ position: 0, velocity: 0, target: null });
  const interaction = useRef<{ press: Press | null; suppressClick: boolean; wheelTimer?: ReturnType<typeof setTimeout> }>({ press: null, suppressClick: false });
  const geometry = useRef(cardGeometry(800, heightFactor, layout, vertical));
  const canvas = useRef<HTMLCanvasElement>(null);
  const bend = useRef<ReturnType<typeof createScrollBend> | null>(null);
  const intro = useRef({ seen: false, start: 0 });
  const selectedId = useRef<string | null>(null);
  const [anchor, setAnchor] = useState(0);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const flippedRef = useRef(flippedId);
  flippedRef.current = flippedId;
  const previousFlip = useRef<string | null>(null);
  const anchorRef = useRef(0);
  const paintRef = useRef<() => void>(() => {});
  const wakeRef = useRef<() => void>(() => {});
  const focusRef = useRef<(position: number) => void>(() => {});
  const reducedRef = useRef(false);
  const hasWorks = works.length > 0;
  const sequence = works.map(work => work.id).join('\0');

  useLayoutEffect(() => {
    const state = motion.current;
    const index = worksRef.current.findIndex(work => work.id === selectedId.current);
    state.position = index >= 0 ? index : Math.min(carouselIndex(state.position, worksRef.current.length), Math.max(0, worksRef.current.length - 1));
    state.velocity = 0;
    state.target = null;
    bend.current?.reset();
    interaction.current.press = null;
    clearTimeout(interaction.current.wheelTimer);
    interaction.current.wheelTimer = undefined;
    if (worksRef.current.length) selectedId.current = worksRef.current[state.position].id;
    anchorRef.current = state.position;
    setAnchor(state.position);
    paintRef.current();
  }, [sequence]);

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const state = motion.current;
    const input = interaction.current;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedRef.current = preference.matches;
    let raf = 0;
    let last = 0;
    let visible = false;

    const publish = () => {
      const nearest = Math.round(state.position);
      const index = carouselIndex(state.position, worksRef.current.length);
      if (worksRef.current[index]) selectedId.current = worksRef.current[index].id;
      if (nearest !== anchorRef.current) { anchorRef.current = nearest; setAnchor(nearest); }
    };
    const paint = () => {
      const g = geometry.current;
      const now = performance.now();
      const progress = intro.current.start ? Math.min(1, (now - intro.current.start) / 520) : 1;
      const lift = 28 * Math.pow(1 - progress, 4);
      if (progress === 1) intro.current.start = 0;
      const count = worksRef.current.length;
      const useCanvas = layout === 'scroll-bend' && bend.current?.mode === 'webgl' && !reducedRef.current;
      element.dataset.reducedMotion = String(reducedRef.current);
      element.dataset.scrollEditing = String(Boolean(flippedRef.current));
      for (const [id, node] of cards.current) {
        const index = worksRef.current.findIndex(work => work.id === id);
        if (index < 0) continue;
        const offset = carouselOffset(index, state.position, count);
        const distance = Math.abs(offset);
        const opacity = carouselOpacity(offset, count, g.sides, threeCardViewRef.current);
        const shown = opacity > 0 && (!useCanvas || flippedRef.current === id);
        const transform = cardTransform(layout, offset, g, vertical);
        node.style.transform = `translate(-50%, -50%) translate3d(${transform.x.toFixed(2)}px, ${(transform.y + lift).toFixed(2)}px, ${transform.z.toFixed(2)}px) rotateY(${transform.rotateY.toFixed(2)}deg) rotateZ(${transform.rotateZ.toFixed(2)}deg) scale(${transform.scale})`;
        node.style.opacity = String(opacity * (layout === 'coverflow-carousel' ? Math.max(0, 1 - distance * 0.1) : 1) * (0.8 + 0.2 * progress));
        node.style.visibility = shown ? 'visible' : 'hidden';
        if (!shown && node.contains(document.activeElement)) element.focus({ preventScroll: true });
        node.inert = !shown;
        node.setAttribute('aria-hidden', String(!shown));
        node.style.zIndex = String(100 - Math.round(distance * 10));
        node.style.setProperty('--bw-card-shade', String(transform.shade));
      }
      publish();
      if (layout === 'scroll-bend' && bend.current && !flippedRef.current) {
        const center = Math.round(state.position);
        return bend.current.draw({ geometry: g, position: state.position, anchor: center, vertical, limit: carouselLimit(count, g.sides, threeCardViewRef.current), reduced: reducedRef.current, tiles: Array.from({ length: 7 }, (_, slot) => {
          const position = center + slot - 3;
          if (count < 3 && (position < 0 || position >= count)) return null;
          const work = worksRef.current[carouselIndex(position, count)];
          return work ? { id: work.id, title: work.title, summary: work.summary, node: cards.current.get(work.id) } : null;
        }) }, now);
      }
      return false;
    };
    paintRef.current = paint;
    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;
      const busy = input.press?.moved || input.wheelTimer ? false : advanceCarousel(state, dt);
      const bending = paint();
      if ((busy || bending || intro.current.start) && visible && !document.hidden) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const wake = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
    wakeRef.current = wake;
    const focus = (position: number) => {
      clearTimeout(input.wheelTimer);
      input.wheelTimer = undefined;
      intro.current.start = 0;
      state.target = constrainPosition(position, worksRef.current.length);
      if (reducedRef.current) { state.position = state.target; state.velocity = 0; state.target = null; paint(); }
      else wake();
    };
    focusRef.current = focus;
    const measure = () => {
      const width = element.clientWidth;
      if (!width) return;
      const g = cardGeometry(width, heightFactor, layout, vertical);
      geometry.current = g;
      element.style.setProperty('--bw-card-width', `${g.cardWidth}px`);
      element.style.setProperty('--bw-card-height', `${g.cardHeight}px`);
      element.style.height = `${layout === 'scroll-bend' && vertical ? Math.min(720, Math.max(420, g.cardHeight * 1.7 + 64)) : g.cardHeight + 64}px`;
      element.style.perspective = layout === 'coverflow-carousel' ? `${g.cardWidth * 3}px` : layout === 'album-rail' ? `${Math.max(700, g.cardWidth * 4.5)}px` : layout === 'skewed-carousel' ? '800px' : '1400px';
      paint();
    };
    const settle = () => {
      input.press = null;
      clearTimeout(input.wheelTimer);
      input.wheelTimer = undefined;
      state.position = constrainPosition(Math.round(state.position), worksRef.current.length);
      state.velocity = 0;
      state.target = null;
      intro.current.start = 0;
      bend.current?.reset();
      element.removeAttribute('data-dragging');
      paint();
    };
    const wheel = (event: WheelEvent) => {
      if ((event.target as Element).closest('textarea, input, select, [data-card-control]')) return;
      if (event.ctrlKey || worksRef.current.length < 2 || (layout !== 'scroll-bend' && Math.abs(event.deltaX) <= Math.abs(event.deltaY))) return;
      const delta = vertical ? event.deltaY : layout === 'scroll-bend' && Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (!delta) return;
      event.preventDefault();
      intro.current.start = 0;
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? vertical ? element.clientHeight : geometry.current.width : 1;
      state.position = constrainPosition(state.position + delta * scale / geometry.current.pitch, worksRef.current.length);
      state.target = null;
      state.velocity = 0;
      clearTimeout(input.wheelTimer);
      // macOS already supplies trackpad momentum; adding another fling here doubles it.
      input.wheelTimer = setTimeout(() => { input.wheelTimer = undefined; focus(Math.round(state.position)); }, 140);
      paint();
      wake();
    };
    const onPreference = () => { reducedRef.current = preference.matches; if (preference.matches) settle(); };
    const onVisibility = () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; last = 0; settle(); }
      else wake();
    };
    const resize = new ResizeObserver(measure);
    resize.observe(element);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        if (!intro.current.seen) { intro.current.seen = true; if (!reducedRef.current) intro.current.start = performance.now(); }
        wake();
      } else { cancelAnimationFrame(raf); raf = 0; last = 0; settle(); }
    });
    intersection.observe(element);
    element.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('visibilitychange', onVisibility);
    preference.addEventListener('change', onPreference);
    if (layout === 'scroll-bend' && canvas.current) bend.current = createScrollBend(canvas.current, mode => { element.dataset.scrollRenderer = mode; paint(); }, wake);
    measure();
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(input.wheelTimer);
      input.wheelTimer = undefined;
      input.press = null;
      resize.disconnect();
      intersection.disconnect();
      element.removeEventListener('wheel', wheel);
      document.removeEventListener('visibilitychange', onVisibility);
      preference.removeEventListener('change', onPreference);
      bend.current?.dispose();
      bend.current = null;
      paintRef.current = () => {};
      wakeRef.current = () => {};
      focusRef.current = () => {};
    };
  }, [hasWorks, heightFactor, layout, vertical]);

  useLayoutEffect(() => { paintRef.current(); });
  useLayoutEffect(() => {
    const id = flippedId ?? previousFlip.current;
    const node = id ? cards.current.get(id) : undefined;
    // Front hover tilt can put the flipped face behind its article's hit-testing plane.
    node?.style.removeProperty('--bw-tilt-x');
    node?.style.removeProperty('--bw-tilt-y');
    if (flippedId) node?.querySelector<HTMLButtonElement>('.bw-card-back button')?.focus({ preventScroll: true });
    else if (document.activeElement === document.body || node?.contains(document.activeElement)) node?.querySelector<HTMLButtonElement>('.bw-card-front > .bw-card-flip')?.focus({ preventScroll: true });
    previousFlip.current = flippedId;
  }, [flippedId]);

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const input = interaction.current;
    input.suppressClick = false;
    if ((event.target as Element).closest('textarea, input, select, [data-card-control]')) return;
    if (event.button !== 0 || !event.isPrimary || works.length < 2) return;
    input.press = { id: event.pointerId, x: event.clientX, y: event.clientY, position: motion.current.position, moved: false, samples: [{ time: performance.now(), position: motion.current.position }] };
  };
  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const input = interaction.current;
    const press = input.press;
    if (!press || press.id !== event.pointerId) return;
    const dx = vertical ? event.clientY - press.y : event.clientX - press.x, dy = vertical ? event.clientX - press.x : event.clientY - press.y;
    if (!press.moved) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.2) { input.press = null; return; }
      press.moved = true;
      press.position = motion.current.position;
      press.samples = [{ time: performance.now(), position: press.position }];
      intro.current.start = 0;
      motion.current.target = null;
      motion.current.velocity = 0;
      clearTimeout(input.wheelTimer);
      input.wheelTimer = undefined;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.setAttribute('data-dragging', '');
    }
    motion.current.position = constrainPosition(press.position - dx / geometry.current.pitch, works.length);
    const now = performance.now();
    press.samples.push({ time: now, position: motion.current.position });
    while (press.samples.length > 2 && now - press.samples[0].time > 110) press.samples.shift();
    paintRef.current();
    wakeRef.current();
  };
  const release = (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const input = interaction.current;
    const press = input.press;
    if (!press || press.id !== event.pointerId) return;
    input.press = null;
    event.currentTarget.removeAttribute('data-dragging');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!press.moved) return;
    input.suppressClick = true;
    const first = press.samples[0], last = press.samples[press.samples.length - 1];
    const span = (last.time - first.time) / 1000;
    const velocity = !cancelled && !reducedRef.current && performance.now() - last.time < 110 && span > 0.008 ? Math.max(-12, Math.min(12, (last.position - first.position) / span)) : 0;
    motion.current.velocity = velocity;
    focusRef.current(Math.round(motion.current.position + velocity * 0.16));
  };
  const openCurrent = () => { const item = worksRef.current[carouselIndex(motion.current.position, worksRef.current.length)]; if (item) openRef.current(item); };
  const activeIndex = carouselIndex(anchor, works.length);
  const active = works[activeIndex];
  useLayoutEffect(() => { if (flippedId && flippedId !== active?.id) setFlippedId(null); }, [active?.id, flippedId]);
  useLayoutEffect(() => { onActiveChange?.(active?.id ?? null); }, [active?.id, onActiveChange]);
  if (!hasWorks) return <>{empty}</>;

  return <><div ref={root} className="bw-paper-stage" data-layout={layout} data-orientation={vertical ? 'vertical' : 'horizontal'} data-scroll-renderer={layout === 'scroll-bend' ? 'fallback' : undefined} data-material={appearance.material} data-card-style={appearance.style} data-ratio={ratio} data-image-fit={imageFit} data-three-card-view={threeCardView} role="region" aria-roledescription="轮播" aria-label={label} tabIndex={0}
    onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => release(event)} onPointerCancel={event => release(event, true)} onLostPointerCapture={event => release(event, true)}
    onPointerLeave={() => { if (!interaction.current.press?.moved) interaction.current.press = null; }}
    onClickCapture={event => { if (interaction.current.suppressClick && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); interaction.current.suppressClick = false; } }}
    onKeyDown={event => {
      const target = event.target as Element;
      if (event.nativeEvent.isComposing || target.closest('textarea, input, select, [data-card-control]')) return;
      const state = motion.current;
      const previous = vertical ? 'ArrowUp' : 'ArrowLeft', next = vertical ? 'ArrowDown' : 'ArrowRight';
      if (event.key === previous || event.key === next) focusRef.current((state.target ?? Math.round(state.position)) + (event.key === previous ? -1 : 1));
      else if (event.key === 'Home' || event.key === 'End') { const index = event.key === 'Home' ? 0 : works.length - 1; focusRef.current(state.position + carouselOffset(index, state.position, works.length)); }
      else if (event.key === 'Enter' || event.key === ' ') openCurrent();
      else if (event.key.toLowerCase() === 'f' && active) setFlippedId(current => current === active.id ? null : active.id);
      else if (event.key === 'Escape' && flippedId) setFlippedId(null);
      else return;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
    }}>
    {layout === 'scroll-bend' && <canvas ref={canvas} className="bw-scroll-bend-canvas" aria-hidden="true" />}
    {carouselSlots(anchor, works.length).map(index => {
      const work = works[index];
      const flipped = flippedId === work.id;
      const central = index === activeIndex;
      const flip = () => setFlippedId(current => current === work.id ? null : work.id);
      return <article className="bw-paper" key={work.id} data-work-id={work.id} data-flipped={flipped} ref={node => { if (node) cards.current.set(work.id, node); else cards.current.delete(work.id); }} onPointerMove={event => {
        if (flipped || interaction.current.press?.moved || !central || reducedRef.current || layout === 'scroll-bend') return;
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty('--bw-tilt-x', `${(0.5 - (event.clientY - rect.top) / rect.height) * 6}deg`);
        event.currentTarget.style.setProperty('--bw-tilt-y', `${((event.clientX - rect.left) / rect.width - 0.5) * 6}deg`);
        event.currentTarget.style.setProperty('--bw-light-x', `${(event.clientX - rect.left) / rect.width * 100}%`);
        event.currentTarget.style.setProperty('--bw-light-y', `${(event.clientY - rect.top) / rect.height * 100}%`);
      }} onPointerLeave={event => { event.currentTarget.style.removeProperty('--bw-tilt-x'); event.currentTarget.style.removeProperty('--bw-tilt-y'); event.currentTarget.style.removeProperty('--bw-light-x'); event.currentTarget.style.removeProperty('--bw-light-y'); }}>
       <div className="bw-card-rotor">
        <div className="bw-card-face bw-card-front" inert={flipped} aria-hidden={flipped}>
        <button className="bw-paper-open" tabIndex={central && !flipped ? 0 : -1} aria-label={central ? `打开笔记：${work.title}` : `居中：${work.title}`} onClick={() => {
          const currentIndex = worksRef.current.findIndex(item => item.id === work.id);
          if (currentIndex < 0) return;
          const offset = carouselOffset(currentIndex, motion.current.position, worksRef.current.length);
          if (Math.abs(offset) < 0.08) openRef.current(worksRef.current[currentIndex]);
          else focusRef.current(motion.current.position + offset);
        }}>{renderWork(work)}</button>
        {central && <button type="button" className="bw-card-flip" data-card-control aria-label={`翻到背面：${work.title}`} title="翻到背面 · F" onClick={flip}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 4H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V9M16 3v6h6M20 4l-4 5" /></svg></button>}
        </div>
        <div className="bw-card-face bw-card-back" inert={!flipped} aria-hidden={!flipped}>{flipped && renderBack(work, central && flipped, flip, () => openRef.current(work))}</div>
       </div>
      </article>;
    })}
    <span className="bw-sr-only" aria-live="polite" aria-atomic="true">{activeIndex + 1} / {works.length}，{active?.title}</span>
  </div>{layout === 'scroll-bend' && active && <div className="bw-scroll-bend-current" data-card-control>
    <div><strong>{active.title}</strong>{active.summary && <p>{active.summary}</p>}</div>
    <div className="bw-scroll-bend-actions">
      <button type="button" aria-label="上一张卡片" disabled={works.length < 2 || (works.length === 2 && activeIndex === 0)} onClick={() => focusRef.current((motion.current.target ?? Math.round(motion.current.position)) - 1)}>‹</button>
      <span>{activeIndex + 1} / {works.length}</span>
      <button type="button" aria-label="下一张卡片" disabled={works.length < 2 || (works.length === 2 && activeIndex === works.length - 1)} onClick={() => focusRef.current((motion.current.target ?? Math.round(motion.current.position)) + 1)}>›</button>
      <button type="button" onClick={openCurrent}>打开笔记</button>
      <button type="button" aria-pressed={flippedId === active.id} onClick={() => setFlippedId(current => current === active.id ? null : active.id)}>{flippedId === active.id ? '回到正面' : '编辑摘要'}</button>
    </div>
  </div>}</>;
}
