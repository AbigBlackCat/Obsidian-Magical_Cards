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
