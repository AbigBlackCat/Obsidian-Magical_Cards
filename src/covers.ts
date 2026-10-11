import type { CoverTemplate } from './types';

export function decodeSvgDataUrl(source: string): string {
  const comma = source.indexOf(',');
  if (comma < 0 || !/^data:image\/svg\+xml(?:;[^,]*)?$/i.test(source.slice(0, comma))) throw new Error('SVG 数据地址无效。');
  const content = source.slice(comma + 1);
  return /;base64$/i.test(source.slice(0, comma))
    ? new TextDecoder().decode(Uint8Array.from(atob(content), char => char.charCodeAt(0)))
    : decodeURIComponent(content);
}

const escapeXml = (value: string) => value.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);

/** Imported SVGs are a small declarative drawing format, never a document with executable content. */
export function sanitizeSvg(svg: string): string {
  if (svg.length > 2_000_000) throw new Error('SVG 封面超过 2 MB，请缩小文件后重试。');
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<\?(?!xml\s)/i.test(svg)) throw new Error('SVG 包含外部资源或可执行内容。');
  let result = svg.trim().replace(/^<\?xml[^?]*\?>\s*/i, '').replace(/<!--[\s\S]*?-->/g, '');
  const tags = new Set(['svg', 'g', 'path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'title', 'desc', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern', 'symbol', 'use', 'animate', 'animateTransform', 'animateMotion', 'mpath']);
  const attrs = new Set(['xmlns', 'xmlns:xlink', 'id', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity', 'transform', 'clip-path', 'mask', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'patternUnits', 'patternContentUnits', 'patternTransform', 'preserveAspectRatio', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'dx', 'dy', 'href', 'xlink:href', 'attributeName', 'attributeType', 'from', 'to', 'by', 'values', 'dur', 'begin', 'end', 'repeatCount', 'repeatDur', 'keyTimes', 'keySplines', 'keyPoints', 'calcMode', 'additive', 'accumulate', 'type', 'rotate', 'path', 'aria-label', 'role']);
  const animationAttrs = new Set(['transform', 'd', 'fill', 'stroke', 'stop-color', 'stop-opacity', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-width', 'stroke-dashoffset', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'width', 'height', 'points']);
  const stack: string[] = [];
  let roots = 0;
  const tokens = result.match(/<[^>]*>|[^<]+/g) ?? [];
  if (tokens.join('') !== result) throw new Error('SVG 文件格式无效。');
  for (const token of tokens) {
    if (!token.startsWith('<')) {
      if (!stack.length && token.trim()) throw new Error('SVG 根元素之外有额外内容。');
      continue;
    }
    const tag = token.match(/^<(\/)?([A-Za-z][\w:.-]*)([\s\S]*?)(\/?)>$/);
    if (!tag || !tags.has(tag[2])) throw new Error('SVG 含不支持的元素。仅支持图形、文字及声明式动画。');
    const [, closing, name, raw, selfClosing] = tag;
    if (closing) {
      if (raw.trim() || selfClosing || stack.pop() !== name) throw new Error('SVG 标签没有正确闭合。');
      continue;
    }
    if (!stack.length && (++roots !== 1 || name !== 'svg')) throw new Error('请选择单个完整的 SVG 封面。');
    let rest = raw;
    const seen = new Set<string>();
    while (rest.trim()) {
      const attribute = rest.match(/^\s+([A-Za-z_][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/);
      if (!attribute) throw new Error('SVG 属性格式无效。');
      const key = attribute[1];
      const value = attribute[2].slice(1, -1);
      if (!attrs.has(key) || seen.has(key)) throw new Error(`SVG 包含不支持的属性：${key}。`);
      seen.add(key);
      if ((key === 'xmlns' && value !== 'http://www.w3.org/2000/svg') || (key === 'xmlns:xlink' && value !== 'http://www.w3.org/1999/xlink')) throw new Error('SVG 命名空间无效。');
      if (key === 'href' || key === 'xlink:href') {
        if (!/^#[A-Za-z_][\w:.-]*$/.test(value)) throw new Error('SVG 不能引用外部资源。');
      }
      if (key === 'attributeName' && !animationAttrs.has(value)) throw new Error('SVG 动画只能改变安全的图形属性。');
      if ((key === 'begin' || key === 'end') && !/^(?:\d+(?:\.\d+)?(?:ms|s)|indefinite)(?:;\s*\d+(?:\.\d+)?(?:ms|s))*$/.test(value)) throw new Error('SVG 动画时间不能关联外部事件。');
      if (key !== 'xmlns' && key !== 'xmlns:xlink' && /(?:url\s*\(|[\\]|[<>]|\b(?:javascript|vbscript|data|https?|file):)/i.test(value) && !/^url\(#[A-Za-z_][\w:.-]*\)$/.test(value)) throw new Error('SVG 属性含外部资源或不安全内容。');
      rest = rest.slice(attribute[0].length);
    }
    if (!selfClosing) stack.push(name);
  }
  if (stack.length || roots !== 1) throw new Error('SVG 文件没有完整闭合。');
  return result;
}

/** Remove SMIL itself; CSS animation rules on an img cannot stop SVG timeline animation. */
export function staticCoverSvg(svg: string): string {
  return sanitizeSvg(svg).replace(/<(animate|animateTransform|animateMotion)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1\s*>)/g, '');
}

export function createCoverSvg(template: CoverTemplate, title: string, color: string, animated = true): string {
  const accent = /^#[0-9a-f]{6}$/i.test(color) ? color : '#b54e39';
  const words = Array.from(title.trim() || '未命名作品');
  const lines = [words.slice(0, 9).join(''), words.slice(9, 18).join('')].filter(Boolean);
  const anim = (content: string) => animated ? content : '';
  let drawing: string;
  if (template === 'water') {
    drawing = `<circle cx="300" cy="230" r="110" fill="${accent}" opacity=".12"/>${[0, 1, 2, 3].map(i => `<ellipse cx="300" cy="260" rx="${55 + i * 37}" ry="${20 + i * 17}" fill="none" stroke="${accent}" stroke-width="1.5" opacity="${.65 - i * .12}">${anim(`<animate attributeName="rx" values="${55 + i * 37};${68 + i * 37};${55 + i * 37}" dur="${5 + i}s" repeatCount="indefinite"/><animate attributeName="opacity" values="${.65 - i * .12};.18;${.65 - i * .12}" dur="${5 + i}s" repeatCount="indefinite"/>`)}</ellipse>`).join('')}<path d="M90 170 Q230 80 420 155 M110 355 Q280 415 465 315" fill="none" stroke="${accent}" stroke-width="2" opacity=".3"/>`;
  } else if (template === 'pages') {
    drawing = `${[0, 1, 2, 3].map(i => `<g transform="translate(${i * 17} ${i * -12})"><path d="M115 160 Q195 145 285 200 Q375 145 455 160 L455 355 Q375 340 285 395 Q195 340 115 355 Z" fill="#f4ead7" stroke="${accent}" stroke-width="1.5"/><path d="M285 200V395" stroke="${accent}" stroke-width="1" opacity=".45"/></g>`).join('')}<g fill="none" stroke="${accent}" stroke-width="1" opacity=".45">${[0, 1, 2, 3].map(i => `<path d="M145 ${225 + i * 25}Q205 ${210 + i * 25}255 ${242 + i * 25} M315 ${242 + i * 25}Q375 ${210 + i * 25}425 ${225 + i * 25}"/>`).join('')}${anim('<animate attributeName="opacity" values=".25;.65;.25" dur="6s" repeatCount="indefinite"/>')}</g>`;
  } else {
    drawing = `<circle cx="300" cy="250" r="118" fill="none" stroke="${accent}" stroke-width="1" opacity=".25"/><circle cx="300" cy="250" r="80" fill="none" stroke="${accent}" stroke-width="1" opacity=".4"/><g transform="rotate(-28 300 250)"><ellipse cx="300" cy="250" rx="205" ry="75" fill="none" stroke="${accent}" stroke-width="2"/><circle cx="505" cy="250" r="7" fill="${accent}"/>${anim('<animateTransform attributeName="transform" type="rotate" from="-28 300 250" to="332 300 250" dur="28s" repeatCount="indefinite"/>')}</g><circle cx="300" cy="250" r="25" fill="${accent}" opacity=".8"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><rect width="600" height="800" fill="#eee6d0"/><rect x="32" y="32" width="536" height="736" rx="16" fill="none" stroke="${accent}" stroke-width="1" opacity=".3"/>${drawing}<path d="M80 505H520" stroke="${accent}" stroke-width="1" opacity=".35"/>${lines.map((line, index) => `<text x="80" y="${590 + index * 54}" fill="#30251e" font-family="serif" font-size="40">${escapeXml(line)}</text>`).join('')}<rect x="456" y="685" width="58" height="58" rx="4" fill="${accent}"/><text x="485" y="723" fill="#fff7e8" font-family="serif" font-size="25" text-anchor="middle">记</text></svg>`;
}
