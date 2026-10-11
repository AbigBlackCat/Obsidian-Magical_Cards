export type CarouselMotion = { position: number; velocity: number; target: number | null };

function wrap(value: number, count: number): number {
  return ((value % count) + count) % count;
}

export function constrainPosition(position: number, count: number): number {
  return count >= 3 ? position : Math.max(0, Math.min(Math.max(0, count - 1), position));
}

export function carouselIndex(position: number, count: number): number {
  return count >= 3 ? wrap(Math.round(position), count) : Math.round(constrainPosition(position, count));
}

export function carouselOffset(index: number, position: number, count: number): number {
  return count >= 3 ? wrap(index - position + count / 2, count) - count / 2 : index - position;
}

export function carouselSlots(position: number, count: number): number[] {
  if (count < 3) return Array.from({ length: Math.max(0, count) }, (_, index) => index);
  const center = Math.round(position);
  return [...new Set(Array.from({ length: 7 }, (_, offset) => wrap(center + offset - 3, count)))];
}

export function carouselLimit(count: number, sides: number, threeCardView = false): number {
  // At half a card turn, the outgoing side disappears before the incoming side appears.
  return count > 2 ? Math.min(threeCardView ? 1.5 : sides + 0.65, count / 2 - 0.02) : 1.7;
}

export function carouselOpacity(offset: number, count: number, sides: number, threeCardView = false): number {
  return Math.max(0, Math.min(1, (carouselLimit(count, sides, threeCardView) - Math.abs(offset)) / 0.4));
}

export function advanceCarousel(state: CarouselMotion, dt: number): boolean {
  if (state.target === null) return false;
  const seconds = Math.max(0, Math.min(0.05, dt));
  const displacement = state.position - state.target;
  const coupledVelocity = state.velocity + 18 * displacement;
  const decay = Math.exp(-18 * seconds);
  state.position = state.target + (displacement + coupledVelocity * seconds) * decay;
  state.velocity = (state.velocity - 18 * coupledVelocity * seconds) * decay;
  if (Math.abs(state.position - state.target) < 0.001 && Math.abs(state.velocity) < 0.02) {
    state.position = state.target;
    state.velocity = 0;
    state.target = null;
    return false;
  }
  return true;
}
