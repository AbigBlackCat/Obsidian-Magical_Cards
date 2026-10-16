/** A single timer: never queue turns behind an animation or a delayed event loop. */
export function createCarouselRepeat(clock: Pick<Window, 'setTimeout' | 'clearTimeout'>, step: () => boolean, settle: () => void) {
  let timer: number | undefined, active = false, suppressClick = false;
  const stop = () => {
    clock.clearTimeout(timer); timer = undefined;
    if (active) settle();
    active = false;
  };
  const tick = () => {
    timer = undefined;
    if (!active) return;
    suppressClick = true;
    if (step()) timer = clock.setTimeout(tick, 160);
    else stop();
  };
  return {
    start() { stop(); suppressClick = false; active = true; timer = clock.setTimeout(tick, 400); },
    stop,
    cancel() { if (active) suppressClick = true; stop(); },
    click(keyboard = false) { const suppressed = suppressClick; suppressClick = false; if (!suppressed || keyboard) step(); },
  };
}
