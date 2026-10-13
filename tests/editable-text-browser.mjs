import {build} from 'esbuild';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';

const result = await build({entryPoints:[fileURLToPath(new URL('./editable-text-browser.tsx',import.meta.url))],bundle:true,platform:'browser',format:'esm',write:false,define:{'process.env.NODE_ENV':'"development"'}});
const html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Magical Cards 编辑测试</title><style>body{font:18px sans-serif;margin:48px}h2{padding:20px;border:1px solid #999}output{display:block;margin:24px}</style><div id="root"></div><script type="module" src="/fixture.js"></script></html>';
const server = createServer((request,response) => {
  if (request.url !== '/' && request.url !== '/fixture.js') { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type',request.url === '/fixture.js' ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  response.end(request.url === '/fixture.js' ? result.outputFiles[0].contents : html);
});
server.listen(0,'127.0.0.1',() => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing fixture address');
  process.stdout.write(`EditableText fixture: http://127.0.0.1:${address.port}\n`);
});
