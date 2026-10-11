import { bendForSpeed, type CardGeometry } from './geometry';
import { fragmentShader, vertexShader } from './shaders';

export type BendTile = { id: string; title: string; summary: string; node?: HTMLElement };
type BendFrame = { geometry: CardGeometry; position: number; anchor: number; vertical: boolean; limit: number; reduced: boolean; tiles: Array<BendTile | null> };

function textLines(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number, maxLines: number) {
  let line = '', row = 0;
  const characters = [...text.replace(/\s+/g, ' ').trim()];
  for (let index = 0; index < characters.length; index++) {
    const candidate = line + characters[index];
    if (context.measureText(candidate).width > width && line) {
      if (row === maxLines - 1) {
        while (line && context.measureText(`${line}…`).width > width) line = [...line].slice(0, -1).join('');
        context.fillText(`${line}…`, x, y + row * lineHeight);
        return row + 1;
      }
      context.fillText(line, x, y + row++ * lineHeight);
      line = characters[index];
    } else line = candidate;
  }
  if (line) context.fillText(line, x, y + row * lineHeight);
  return line ? row + 1 : row;
}

export function createScrollBend(canvas: HTMLCanvasElement, changed: (mode: 'webgl' | 'fallback') => void, wake: () => void) {
  let gl: WebGLRenderingContext | null = null;
  let program: WebGLProgram | null = null, buffer: WebGLBuffer | null = null, texture: WebGLTexture | null = null;
  let mode: 'webgl' | 'fallback' = 'fallback', disposed = false, atlasKey = '';
  let atlasSize = { width: 1, height: 1 }, bend = 0, bendVelocity = 0, previousPosition: number | null = null, previousTime = 0;
  let speed = 0, lastMovement = 0;
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  const watched = new Set<HTMLImageElement>();
  const imageChanged = () => { atlasKey = ''; wake(); };

  function destroy() {
    if (gl) {
      if (texture) gl.deleteTexture(texture);
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
    }
    texture = null; buffer = null; program = null;
    uniforms.clear(); atlasKey = '';
  }
  function fallback() {
    destroy(); gl = null; mode = 'fallback'; bend = 0; bendVelocity = 0; previousPosition = null; previousTime = 0; speed = 0; lastMovement = 0; changed(mode);
  }
  function initialize() {
    const shaders: WebGLShader[] = [];
    let compiler: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false });
      if (!gl) throw new Error('WebGL unavailable');
      compiler = gl;
      for (const [kind, source] of [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, fragmentShader]] as const) {
        const shader = gl.createShader(kind);
        if (!shader) throw new Error('Shader allocation failed');
        shaders.push(shader);
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader compile failed');
      }
      program = gl.createProgram(); buffer = gl.createBuffer(); texture = gl.createTexture();
      if (!program || !buffer || !texture) throw new Error('WebGL allocation failed');
      shaders.forEach(shader => gl!.attachShader(program!, shader));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader link failed');
      gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const attribute = gl.getAttribLocation(program, 'aPosition');
      if (attribute < 0) throw new Error('Shader attribute unavailable');
      gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      mode = 'webgl'; changed(mode);
    } catch { fallback(); }
    finally { shaders.forEach(shader => compiler?.deleteShader(shader)); }
    wake();
  }
  function watchImages(images: HTMLImageElement[]) {
    const current = new Set(images);
    for (const image of watched) if (!current.has(image)) {
      image.removeEventListener('load', imageChanged); image.removeEventListener('error', imageChanged); watched.delete(image);
    }
    for (const image of current) if (!watched.has(image)) {
      image.addEventListener('load', imageChanged); image.addEventListener('error', imageChanged); watched.add(image);
    }
  }
  function rebuild(tiles: BendFrame['tiles'], geometry: CardGeometry) {
    if (!gl || !texture) return;
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, ratio = geometry.cardWidth / geometry.cardHeight;
    const pixels = geometry.cardWidth * Math.min(canvas.ownerDocument.defaultView?.devicePixelRatio || 1, 2);
    const cellWidth = Math.max(1, Math.floor(Math.min(768, pixels, max / 3, max * ratio / 3))), cellHeight = Math.max(1, Math.floor(cellWidth / ratio));
    const atlas = canvas.ownerDocument.createElement('canvas');
    atlas.width = cellWidth * 3; atlas.height = cellHeight * 3;
    const context = atlas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    tiles.forEach((tile, index) => {
      if (!tile?.node) return;
      const style = getComputedStyle(tile.node), coverStyle = tile.node.closest('[data-card-style]')?.getAttribute('data-card-style') === 'cover';
      const image = tile.node.querySelector<HTMLImageElement>('.bw-card-front img');
      const region = tile.node.querySelector<HTMLElement>('.bw-paper-image'), copy = tile.node.querySelector<HTMLElement>('.bw-paper-copy');
      const titleElement = copy?.querySelector<HTMLElement>('h3'), summaryElement = copy?.querySelector<HTMLElement>('p');
      const x = (index % 3) * cellWidth, y = Math.floor(index / 3) * cellHeight, scale = cellWidth / geometry.cardWidth;
      const surface = style.getPropertyValue('--bw-card-surface').trim() || '#eee6d0', ink = style.getPropertyValue('--bw-card-ink').trim() || '#30251e';
      context.save(); context.translate(x, y); context.beginPath(); context.rect(0, 0, cellWidth, cellHeight); context.clip();
      context.fillStyle = surface; context.fillRect(0, 0, cellWidth, cellHeight);
      const imageHeight = coverStyle ? cellHeight : region?.offsetHeight ? cellHeight * region.offsetHeight / geometry.cardHeight : cellHeight * 0.58;
      if (image?.complete && image.naturalWidth > 0) {
        const contain = getComputedStyle(image).objectFit === 'contain';
        const factor = (contain ? Math.min : Math.max)(cellWidth / image.naturalWidth, imageHeight / image.naturalHeight);
        const width = image.naturalWidth * factor, height = image.naturalHeight * factor;
        context.save(); context.beginPath(); context.rect(0, 0, cellWidth, imageHeight); context.clip();
        context.drawImage(image, (cellWidth - width) / 2, (imageHeight - height) / 2, width, height); context.restore();
      } else {
        context.fillStyle = ink; context.font = `${22 * scale}px "Songti SC", serif`;
        textLines(context, tile.title, 24 * scale, imageHeight / 2, cellWidth - 48 * scale, 29 * scale, 2);
      }
      if (coverStyle) {
        const gradient = context.createLinearGradient(0, cellHeight * 0.55, 0, cellHeight);
        gradient.addColorStop(0, 'transparent'); gradient.addColorStop(1, 'rgba(9,17,21,.94)');
        context.fillStyle = gradient; context.fillRect(0, cellHeight * 0.55, cellWidth, cellHeight * 0.45);
      }
      if (tile.node.closest('[data-material]')?.getAttribute('data-material') === 'foil') {
        const foil = context.createLinearGradient(0, 0, cellWidth, cellHeight);
        foil.addColorStop(0, 'rgba(211,245,249,.16)'); foil.addColorStop(.4, 'transparent'); foil.addColorStop(.65, 'rgba(215,172,205,.10)'); foil.addColorStop(1, 'rgba(170,223,206,.07)');
        context.fillStyle = foil; context.fillRect(0, 0, cellWidth, cellHeight);
      }
      const titleStyle = titleElement ? getComputedStyle(titleElement) : null, summaryStyle = summaryElement ? getComputedStyle(summaryElement) : null, copyStyle = copy ? getComputedStyle(copy) : null;
      const titleSize = parseFloat(titleStyle?.fontSize ?? '') || 22, titleLineHeight = parseFloat(titleStyle?.lineHeight ?? '') || titleSize * 1.35;
      const inset = (parseFloat(copyStyle?.paddingLeft ?? '') || 23) * scale;
      const titleY = coverStyle ? Math.max(imageHeight * 0.68, cellHeight - 118 * scale) : imageHeight + ((parseFloat(copyStyle?.paddingTop ?? '') || 19) + titleSize) * scale;
      const align = (value?: string) => { context.textAlign = value === 'center' || value === 'right' ? value : 'left'; return context.textAlign === 'center' ? cellWidth / 2 : context.textAlign === 'right' ? cellWidth - inset : inset; };
      context.fillStyle = coverStyle ? '#fff' : ink; context.font = `600 ${titleSize * scale}px "Songti SC", serif`;
      const titleRows = textLines(context, titleElement?.textContent || tile.title, align(titleStyle?.textAlign), titleY, cellWidth - inset * 2, titleLineHeight * scale, Number(titleStyle?.webkitLineClamp) || 2);
      context.fillStyle = coverStyle ? '#e0e5e6' : style.getPropertyValue('--bw-card-muted').trim() || '#655541';
      const summarySize = parseFloat(summaryStyle?.fontSize ?? '') || 14, summaryLineHeight = parseFloat(summaryStyle?.lineHeight ?? '') || summarySize * 1.65;
      context.font = `${summarySize * scale}px "Songti SC", serif`;
      if (tile.summary) textLines(context, summaryElement?.textContent || tile.summary, align(summaryStyle?.textAlign), titleY + (titleRows * titleLineHeight + 8) * scale, cellWidth - inset * 2, summaryLineHeight * scale, Number(summaryStyle?.webkitLineClamp) || 2);
      const footer = copy?.querySelector('footer')?.textContent?.trim();
      if (footer) { context.font = `${11 * scale}px system-ui`; context.textAlign = 'left'; textLines(context, footer, inset, cellHeight - 16 * scale, cellWidth - inset * 2, 14 * scale, 1); }
      context.restore();
    });
    gl.bindTexture(gl.TEXTURE_2D, texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    atlasSize = { width: atlas.width, height: atlas.height };
  }
  function location(name: string) {
    if (!uniforms.has(name)) uniforms.set(name, gl!.getUniformLocation(program!, name));
    return uniforms.get(name)!;
  }
  function draw(frame: BendFrame, now: number) {
    if (disposed || !gl || !program) return false;
    const g = frame.geometry, dt = Math.min(1 / 30, Math.max(1 / 240, (now - previousTime) / 1000 || 1 / 60));
    const movement = frame.position - (previousPosition ?? frame.position);
    // Pointer samples can arrive between RAF ticks; retain their speed briefly.
    if (Math.abs(movement) > 0.000001) { speed = movement * g.pitch / dt; lastMovement = now; }
    else if (now - lastMovement > 80) speed = 0;
    previousPosition = frame.position; previousTime = now;
    const desired = frame.reduced ? 0 : bendForSpeed(speed), omega = 4 / 0.32;
    const steps = Math.max(1, Math.ceil(dt * omega / 0.4));
    for (let step = 0; step < steps; step++) {
      const tick = dt / steps;
      bendVelocity += ((desired - bend) * omega * omega - 2 * (1 - 0.25 * 0.65) * omega * bendVelocity) * tick;
      bend = Math.max(-0.45, Math.min(0.45, bend + bendVelocity * tick));
    }
    if (frame.reduced) { bend = 0; bendVelocity = 0; }
    try {
      const resolution = Math.min(canvas.ownerDocument.defaultView?.devicePixelRatio || 1, 2);
      const images = frame.tiles.flatMap(tile => { const image = tile?.node?.querySelector<HTMLImageElement>('.bw-card-front img'); return image ? [image] : []; });
      watchImages(images);
      const key = `${g.cardWidth}:${g.cardHeight}:${resolution}:${frame.tiles.map(tile => tile ? `${tile.id}:${tile.title}:${tile.summary}:${tile.node?.textContent}:${tile.node?.querySelector('.bw-paper-copy h3')?.getAttribute('style')}:${tile.node?.querySelector('.bw-paper-copy p')?.getAttribute('style')}:${tile.node?.closest('[data-material]')?.getAttribute('data-material')}:${tile.node?.closest('[data-card-style]')?.getAttribute('data-card-style')}` : '').join('|')}:${images.map(image => `${image.currentSrc || image.src}:${image.complete}:${image.naturalWidth}:${getComputedStyle(image).objectFit}`).join('|')}`;
      if (key !== atlasKey) { rebuild(frame.tiles, g); atlasKey = key; }
      const height = canvas.clientHeight || g.cardHeight + 64;
      const widthPixels = Math.max(1, Math.round(g.width * resolution)), heightPixels = Math.max(1, Math.round(height * resolution));
      if (canvas.width !== widthPixels || canvas.height !== heightPixels) { canvas.width = widthPixels; canvas.height = heightPixels; gl.viewport(0, 0, widthPixels, heightPixels); }
      gl.useProgram(program);
      gl.uniform2f(location('uSize'), g.width, height); gl.uniform2f(location('uTile'), g.cardWidth, g.cardHeight);
      gl.uniform2f(location('uGrid'), 3, 3); gl.uniform2f(location('uAtlasSize'), atlasSize.width, atlasSize.height);
      for (const [name, value] of Object.entries({ uStep: g.pitch, uPosition: (frame.position - frame.anchor + 3) * g.pitch, uCount: 7, uVertical: frame.vertical ? 1 : 0, uInfinite: 0, uBend: bend, uBias: 0.75, uLens: 1, uRadius: 14, uFade: 0.16, uShade: 0.22, uAberration: 0.4, uLimit: frame.limit })) gl.uniform1f(location(name), value);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } catch { fallback(); return false; }
    return Math.abs(bend) > 0.0001 || Math.abs(bendVelocity) > 0.001;
  }
  const lost = (event: Event) => { event.preventDefault(); fallback(); wake(); };
  const restored = () => { if (!disposed) initialize(); };
  canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored);
  initialize();
  return {
    get mode() { return mode; }, draw,
    reset() { previousPosition = null; previousTime = 0; bend = 0; bendVelocity = 0; speed = 0; lastMovement = 0; },
    dispose() {
      disposed = true; destroy(); gl = null;
      canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored);
      for (const image of watched) { image.removeEventListener('load', imageChanged); image.removeEventListener('error', imageChanged); }
      watched.clear();
    },
  };
}
