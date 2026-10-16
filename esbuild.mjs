import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {reactScriptPolicy,installationLicenseBanner} from './scripts/react-script-policy.mjs';
const project=fileURLToPath(new URL('./',import.meta.url));
export const MAX_MAIN_BYTES=5_000_000;
export async function buildCards({write=true}={}){
  const result=await build({absWorkingDir:project,entryPoints:['src/main.tsx'],bundle:true,platform:'browser',external:['obsidian'],metafile:true,format:'cjs',target:'es2022',outfile:'main.js',minify:true,define:{'process.env.NODE_ENV':'"production"'},banner:{js:await installationLicenseBanner()},plugins:[reactScriptPolicy()],write:false,logLevel:'silent'});
  for(const output of Object.values(result.metafile.outputs))for(const dependency of output.imports)if(dependency.external&&dependency.path!=='obsidian')throw new Error(`Mobile bundle cannot import ${dependency.path}.`);
  const main=result.outputFiles[0].contents;
  if(main.byteLength>=MAX_MAIN_BYTES)throw new Error(`main.js is ${main.byteLength} bytes; must be below ${MAX_MAIN_BYTES}.`);
  if(/createElement\(\s*(["'])script\1\s*\)/.test(result.outputFiles[0].text))throw new Error('Production bundle still creates executable script resources.');
  const sheets=await Promise.all(['base-styles.css','layouts.css','ui.css','horizontal-menu.css','settings-classification.css'].map(file=>readFile(new URL(file,import.meta.url),'utf8')));
  const styles=Buffer.from(sheets.join('\n'));
  if(write)await Promise.all([writeFile(new URL('main.js',import.meta.url),main),writeFile(new URL('styles.css',import.meta.url),styles)]);
  return {main,styles};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const {main}=await buildCards();process.stdout.write(`Magical Cards production bundle: ${main.byteLength} bytes.\n`);
}
