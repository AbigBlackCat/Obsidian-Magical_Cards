import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {MAX_MAIN_BYTES} from '../esbuild.mjs';
import {installationLicenseBanner} from './react-script-policy.mjs';

export const RELEASE_FILES=['main.js','manifest.json','styles.css'];
const project=new URL('../',import.meta.url);
export async function checkRelease(tag){
  const [manifest,metadata,versions]=await Promise.all(['manifest.json','package.json','versions.json'].map(async file=>JSON.parse(await readFile(new URL(file,project),'utf8'))));
  if(manifest.version!==metadata.version||versions[manifest.version]!==manifest.minAppVersion)throw new Error('Manifest, package and versions.json disagree.');
  if(tag!==undefined&&tag!==manifest.version)throw new Error(`Release tag ${tag} does not match manifest ${manifest.version}.`);
  if(manifest.isDesktopOnly!==false)throw new Error('Magical Cards must declare mobile support.');
  const hashes={};
  for(const name of RELEASE_FILES){
    const bytes=await readFile(new URL(name,project));if(!bytes.length)throw new Error(`Empty release file: ${name}`);
    if(name==='main.js'){
      if(!bytes.toString('utf8').startsWith(await installationLicenseBanner()))throw new Error('Release is missing its bundled license notices.');
      if(bytes.length>=MAX_MAIN_BYTES)throw new Error(`main.js must be below ${MAX_MAIN_BYTES} bytes.`);
      if(/createElement\(\s*(["'])script\1\s*\)/.test(bytes.toString('utf8')))throw new Error('Release contains executable script creation.');
    }
    hashes[name]=createHash('sha256').update(bytes).digest('hex');
  }
  return hashes;
}
if(process.argv[1]===fileURLToPath(import.meta.url))process.stdout.write(`${JSON.stringify(await checkRelease(process.argv[2]),null,2)}\n`);
