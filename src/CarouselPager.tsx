import React, { useLayoutEffect, useRef } from 'react';
import { useOwnerWindow } from './owner-window';
import { createCarouselRepeat } from './carousel-repeat';

export default function CarouselPager({ index, count, disabled, step, settle }: { index: number; count: number; disabled: boolean; step: (direction: number) => boolean; settle: () => void }) {
  return <div className="bw-carousel-pager" role="group" aria-label="卡片翻页">
    <PageButton direction={-1} disabled={disabled || count < 2 || count === 2 && index === 0} step={step} settle={settle}>上一张</PageButton>
    <span aria-live="polite" aria-atomic="true">{index + 1} / {count}</span>
    <PageButton direction={1} disabled={disabled || count < 2 || count === 2 && index === count - 1} step={step} settle={settle}>下一张</PageButton>
  </div>;
}

function PageButton({ direction, disabled, step, settle, children }: { direction: number; disabled: boolean; step: (direction: number) => boolean; settle: () => void; children: React.ReactNode }) {
  const button = useRef<HTMLButtonElement>(null), owner = useOwnerWindow(button);
  const latest = useRef({ disabled, step, settle }); latest.current = { disabled, step, settle };
  const repeat = useRef<ReturnType<typeof createCarouselRepeat> | null>(null);
  const pointer = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!owner) return;
    const control = createCarouselRepeat(owner, () => !latest.current.disabled && latest.current.step(direction), () => latest.current.settle());
    repeat.current = control;
    const end = () => { pointer.current = null; control.stop(); };
    const cancel = () => { pointer.current = null; control.cancel(); };
    const hidden = () => { if (owner.document.hidden) cancel(); };
    const visibility = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) cancel(); });
    if (button.current) visibility.observe(button.current);
    owner.addEventListener('pointerup', end);
    owner.addEventListener('pointercancel', cancel);
    owner.addEventListener('blur', cancel);
    owner.document.addEventListener('visibilitychange', hidden);
    return () => {
      cancel(); repeat.current = null;
      visibility.disconnect();
      owner.removeEventListener('pointerup', end);
      owner.removeEventListener('pointercancel', cancel);
      owner.removeEventListener('blur', cancel);
      owner.document.removeEventListener('visibilitychange', hidden);
    };
  }, [owner, direction]);
  useLayoutEffect(() => { if (disabled) repeat.current?.cancel(); }, [disabled]);
  return <button ref={button} type="button" disabled={disabled} title={`${direction < 0 ? '上一张' : '下一张'}；长按连续翻页`} onPointerDown={event => {
    if (disabled || !event.isPrimary || event.button !== 0) return;
    pointer.current = event.pointerId; repeat.current?.start();
  }} onPointerMove={event => {
    if (pointer.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { pointer.current = null; repeat.current?.cancel(); }
  }} onPointerLeave={() => { pointer.current = null; repeat.current?.cancel(); }} onPointerCancel={() => repeat.current?.cancel()} onLostPointerCapture={() => repeat.current?.stop()} onContextMenu={event => event.preventDefault()} onClick={event => repeat.current?.click(event.detail === 0)}>{children}</button>;
}
