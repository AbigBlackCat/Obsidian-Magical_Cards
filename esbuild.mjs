import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
await build({entryPoints:['src/main.tsx'],bundle:true,external:['obsidian','electron','node:*'],format:'cjs',target:'es2022',outfile:'main.js',minify:true,logLevel:'info'});
const sheets=await Promise.all(['base-styles.css','layouts.css','ui.css'].map(async file=>{try{return await readFile(file,'utf8');}catch(error){if(error.code==='ENOENT')return '';throw error;}}));
await writeFile('styles.css',sheets.join('\n'));
