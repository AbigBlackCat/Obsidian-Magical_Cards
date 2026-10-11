import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
await build({entryPoints:[path.join(root,'src/preview.tsx')],bundle:true,platform:'browser',format:'esm',target:'es2022',outfile:path.join(root,'dist/preview.js'),loader:{'.svg':'text'},define:{'process.env.NODE_ENV':'"development"'}});
const sheets=(await Promise.all(['base-styles.css','layouts.css','ui.css'].map(file=>readFile(path.join(root,file),'utf8')))).join('\n');
createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1:4319'),relative=url.pathname==='/'?'preview.html':decodeURIComponent(url.pathname.slice(1));if(relative==='styles.css'){res.writeHead(200,{'Content-Type':'text/css'});res.end(sheets);return;}const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const ext=path.extname(file),mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'}[ext]??'application/octet-stream';const body=await readFile(file);res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}}).listen(4319,'127.0.0.1',()=>process.stdout.write('Magical Cards previews: http://127.0.0.1:4319\n'));
