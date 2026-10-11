export const vertexShader = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() { vUv = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

export const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uAtlas;
uniform vec2 uSize;
uniform vec2 uTile;
uniform vec2 uGrid;
uniform vec2 uAtlasSize;
uniform float uStep;
uniform float uPosition;
uniform float uCount;
uniform float uVertical;
uniform float uInfinite;
uniform float uBend;
uniform float uBias;
uniform float uLens;
uniform float uRadius;
uniform float uFade;
uniform float uShade;
uniform float uAberration;
uniform float uLimit;

vec4 imageColor(vec2 uv, vec2 cell) {
  vec2 inset = 0.5 / (uAtlasSize / uGrid);
  return texture2D(uAtlas, (cell + clamp(uv, inset, 1.0-inset)) / uGrid);
}

void main() {
  vec2 screen = vec2(vUv.x, 1.0-vUv.y) * uSize - uSize * 0.5;
  vec2 p = screen;
  float extent = mix(uSize.x, uSize.y, uVertical);
  float crossSize = mix(uTile.y, uTile.x, uVertical);
  // Invert one continuous radial lens, so the image edges and gaps bow together.
  for (int i=0; i<8; i++) {
    float along = mix(p.x, p.y, uVertical) / (extent * 0.5 * uLens);
    float across = mix(p.y, p.x, uVertical) / max(crossSize, 1.0);
    float weight = 1.0 / (1.0 + along*along*2.5 + across*across*1.5);
    float crossScale = 1.0 + uBend * 1.7 * weight;
    float axisScale = 1.0 + uBend * 0.7 * uBias * weight;
    vec2 stretch = mix(vec2(axisScale, crossScale), vec2(crossScale, axisScale), uVertical);
    p = screen / stretch;
  }
  float axis = mix(p.x, p.y, uVertical) + uPosition;
  float rawIndex = floor(axis / uStep + 0.5);
  if (uInfinite < 0.5 && (rawIndex < 0.0 || rawIndex >= uCount)) { gl_FragColor = vec4(0.0); return; }
  float index = mod(mod(rawIndex, uCount) + uCount, uCount);
  vec2 local = p;
  if (uVertical > 0.5) local.y = axis - rawIndex*uStep;
  else local.x = axis - rawIndex*uStep;
  vec2 halfTile = uTile * 0.5;
  float r = min(uRadius, min(halfTile.x, halfTile.y));
  vec2 q = abs(local) - halfTile + r;
  float distance = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  float mask = 1.0 - smoothstep(-0.8, 0.8, distance);
  if (mask <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec2 uv = local / uTile + 0.5;
  vec2 cell = vec2(mod(index, uGrid.x), floor(index/uGrid.x));
  vec2 shift = normalize(local + vec2(0.001)) * abs(uBend) * uAberration * 0.009;
  vec4 sampled = imageColor(uv, cell);
  vec3 color = sampled.rgb;
  color.r = imageColor(uv + shift, cell).r;
  color.b = imageColor(uv - shift, cell).b;
  float edge = abs(mix(screen.x, screen.y, uVertical)) / (extent*0.5);
  float fade = uFade > 0.0 ? 1.0-smoothstep(1.0-uFade*2.0, 1.0, edge) : 1.0;
  color *= 1.0 - uShade * edge*edge;
  float visible = clamp((uLimit - abs(rawIndex-uPosition/uStep)) / 0.4, 0.0, 1.0);
  gl_FragColor = vec4(color, sampled.a*mask*fade*visible);
}
`;
