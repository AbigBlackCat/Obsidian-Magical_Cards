import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const root = new URL('../', import.meta.url);
const mock = fileURLToPath(new URL('obsidian-mock.ts', import.meta.url));
const result = await build({ entryPoints: [fileURLToPath(new URL('mobile-browser.tsx', import.meta.url))], bundle: true, platform: 'browser', format: 'esm', write: false, alias: { obsidian: mock }, define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{
  name: 'browser-memory-vault', setup(builder) {
    builder.onLoad({ filter: /obsidian-mock\.ts$/ }, async () => ({ loader: 'ts', contents: (await readFile(mock, 'utf8')).replace("import { posix } from 'node:path';", "const posix = { dirname: (path:string) => path.split('/').slice(0,-1).join('/'), join: (...parts:string[]) => parts.filter(Boolean).join('/') };").replace("Buffer.from(contents).toString('base64')", "btoa(Array.from(new Uint8Array(contents),byte=>String.fromCharCode(byte)).join(''))") }));
  },
}] });
const sheets = (await Promise.all(['base-styles.css','layouts.css','ui.css','horizontal-menu.css','settings-classification.css'].map(file => readFile(new URL(file, root), 'utf8')))).join('\n');
const html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Magical Cards Mobile Acceptance</title><link rel="stylesheet" href="/styles.css"><style>body{margin:0;background:#fff;font-family:system-ui;--font-text:system-ui;--text-normal:#202124;--text-muted:#65696f;--background-primary:#fff;--background-secondary:#eee;--interactive-accent:#8765b5}main>header{padding:12px}main>header label{display:block;margin:8px 0}</style><body class="is-mobile"><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>';
createServer((request,response) => {
  const asset = request.url === '/fixture.js' ? ['text/javascript', result.outputFiles[0].contents] : request.url === '/styles.css' ? ['text/css', sheets] : request.url === '/' ? ['text/html', html] : null;
  if (!asset) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', asset[0] + '; charset=utf-8'); response.end(asset[1]);
}).listen(4320, '127.0.0.1', () => process.stdout.write('Mobile acceptance: http://127.0.0.1:4320\n'));
