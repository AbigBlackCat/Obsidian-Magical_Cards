import type { WorkCardAppearance } from '../types';

export type CardLayout = NonNullable<WorkCardAppearance['layout']>;
export type CardGeometry = { width: number; cardWidth: number; cardHeight: number; pitch: number; radius: number; angle: number; sides: number };

export function cardGeometry(width: number, heightFactor: number, layout: CardLayout, vertical = false): CardGeometry {
  const cardWidth = Math.max(1, Math.min(layout === 'skewed-carousel' ? 240 : 300, Math.max(208, width * 0.72), width - 32));
  const cardHeight = cardWidth * heightFactor;
  const angle = width >= 1000 ? 32 : width <= 360 ? 46 : 38;
  const pitch = layout === 'coverflow-carousel' ? cardWidth * 1.05 : layout === 'album-rail' ? cardWidth * 0.58 : layout === 'skewed-carousel' ? cardWidth : layout === 'scroll-bend' ? (vertical ? cardHeight : cardWidth) + 16 : width <= 360 ? cardWidth * 0.85 + 18 : cardWidth + 30;
  return { width, cardWidth, cardHeight, pitch, angle, radius: pitch / (2 * Math.sin(angle * Math.PI / 360)), sides: width >= 1000 ? 2 : 1 };
}

export function cardPerspective(layout: CardLayout, cardWidth: number): number {
  return layout === 'coverflow-carousel' ? cardWidth * 3 : layout === 'album-rail' ? Math.max(700, cardWidth * 4.5) : layout === 'skewed-carousel' ? 800 : 1400;
}

/** Project the front corners, including the face's small depth, just as CSS does. */
export function cardBounds(layout: CardLayout, offset: number, geometry: CardGeometry, vertical = false) {
  const t = cardTransform(layout, offset, geometry, vertical), perspective = cardPerspective(layout, geometry.cardWidth);
  const ry = t.rotateY * Math.PI / 180, rz = t.rotateZ * Math.PI / 180;
  const points = [-1, 1].flatMap(sx => [-1, 1].map(sy => {
    const x = sx * geometry.cardWidth / 2 * t.scale, y = sy * geometry.cardHeight / 2 * t.scale;
    const rotatedX = x * Math.cos(rz) - y * Math.sin(rz), rotatedY = x * Math.sin(rz) + y * Math.cos(rz);
    const z = t.z - rotatedX * Math.sin(ry) + 3 * Math.cos(ry);
    const projection = perspective / (perspective - z);
    return { x: (t.x + rotatedX * Math.cos(ry) + 3 * Math.sin(ry)) * projection, y: (t.y + rotatedY) * projection };
  }));
  return { x: Math.max(...points.map(point => Math.abs(point.x))), y: Math.max(...points.map(point => Math.abs(point.y))) };
}

export function mobileCardGeometry(width: number, heightFactor: number, layout: CardLayout, vertical: boolean, viewportHeight: number) {
  const base = cardGeometry(width, heightFactor, layout, vertical);
  const maxHeight = Math.min(360, viewportHeight * 0.55), margin = 14;
  const scaled = (scale: number): CardGeometry => ({ ...base, cardWidth: base.cardWidth * scale, cardHeight: base.cardHeight * scale, pitch: base.pitch * scale, radius: base.radius * scale, sides: 1 });
  const bounds = (g: CardGeometry) => {
    const cards = [-1, 0, 1].map(offset => cardBounds(layout, offset, g, vertical));
    return { x: Math.max(...cards.map(card => card.x)), y: Math.max(...cards.map(card => card.y)) };
  };
  let low = 0.001, high = 1;
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2, b = bounds(scaled(middle));
    if (b.x * 2 + margin * 2 <= width && b.y * 2 + margin * 2 <= maxHeight) low = middle;
    else high = middle;
  }
  const geometry = scaled(low);
  return { geometry, height: Math.min(maxHeight, bounds(geometry).y * 2 + margin * 2) };
}

export function cardTransform(layout: CardLayout, offset: number, geometry: CardGeometry, vertical = false) {
  const { cardWidth, cardHeight, pitch, radius, angle } = geometry;
  const distance = Math.abs(offset), direction = Math.sign(offset);
  let x = offset * pitch, y = 0, z = 0, rotateY = 0, rotateZ = 0, scale = 1, shade = 0;
  if (layout === 'cylinder') {
    rotateY = offset * angle;
    const radians = rotateY * Math.PI / 180;
    x = Math.sin(radians) * radius;
    z = (Math.cos(radians) - 1) * radius;
    y = -z * 0.09;
    shade = Math.min(0.18, (1 - Math.cos(radians)) * 0.22);
  } else if (layout === 'coverflow-carousel') {
    const ramp = Math.pow(distance, 0.56);
    z = -0.6 * cardWidth * ramp;
    rotateY = -Math.min(44 * ramp, 82) * direction;
  } else if (layout === 'album-rail') {
    const ramp = Math.sqrt(distance);
    x = direction * ramp * pitch;
    y = ramp * cardHeight * 0.022;
    z = -ramp * cardWidth * 0.5 * 0.13;
    rotateY = -direction * Math.min(75, 22 * ramp);
    rotateZ = direction * 6 * ramp;
    scale = 1 / (1 + ramp * 0.1);
    shade = Math.min(distance * 0.45 * 0.55, 0.85);
  } else if (layout === 'skewed-carousel') {
    rotateY = Math.max(-82, Math.min(82, -offset * 60));
    scale = 1 - Math.min(distance, 1) * 0.15;
  } else if (vertical) {
    y = x;
    x = 0;
  }
  return { x, y, z, rotateY, rotateZ, scale, shade };
}

export function bendForSpeed(velocity: number) {
  return Number.isFinite(velocity) ? 0.38 * Math.tanh(Math.abs(velocity) / 950) * Math.sign(velocity) : 0;
}
