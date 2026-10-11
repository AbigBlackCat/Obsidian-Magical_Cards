import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {createRequire} from 'node:module';

export const REACT_VERSION='19.3.0';
const sourceHash='8a8147c1cebdb19d82fd11bdb76391be9b20d00edf67cc8e8b30f44e850ce693';
const creators=/\b(ownerDocument|hoistableRoot)\.createElement\("script"\)/g;
const message='Magical Cards does not load executable script resources.';

/** Keep the license notices in the installation files, without a fourth release asset. */
export async function installationLicenseBanner(){
  const resolve=createRequire(import.meta.url).resolve;
  const [author,...reactLicenses]=await Promise.all([
    readFile(new URL('../LICENSE',import.meta.url),'utf8'),
    ...['react','react-dom','scheduler'].map(name=>readFile(join(dirname(resolve(`${name}/package.json`)),'LICENSE'),'utf8')),
  ]);
  if(reactLicenses.some(license=>license!==reactLicenses[0]))throw new Error('React library license notices changed; review before combining them.');
  const notice=`Magical Cards author code license (only code the author has the right to license):\n${author.trim()}\n\nReact, React DOM and Scheduler license:\n${reactLicenses[0].trim()}\n\nSample cover images and previews are excluded from the code MIT license. Their rights belong to the respective rights holders; no new image redistribution or commercial-use rights are granted. Coverflow source arrived without an attached license; this notice does not grant new rights to it. Sources and third-party notices: https://github.com/AbigBlackCat/Obsidian-Magical_Cards/blob/main/THIRD_PARTY.md and examples/SOURCES.md.`;
  if(notice.includes('*/'))throw new Error('License notice cannot safely fit in the installation banner.');
  return `/*!\n${notice}\n*/`;
}

export function adaptReactRenderer(source,version){
  if(version!==REACT_VERSION)throw new Error(`React DOM ${version} requires a new script-resource policy review; expected ${REACT_VERSION}.`);
  const count=[...source.matchAll(creators)].length;
  if(count!==3)throw new Error(`React DOM script creation count changed: expected 3, got ${count}.`);
  if(createHash('sha256').update(source).digest('hex')!==sourceHash)throw new Error('React DOM production renderer source changed; review the script-resource policy before building.');
  // Remove executable resource loading; retain React's separate inert-script protection.
  return source.replace(creators,'rejectExecutableScriptResource()')+`\nfunction rejectExecutableScriptResource(){throw new Error(${JSON.stringify(message)});}\n`;
}

export function reactScriptPolicy(){
  let matched=0;
  return {name:'magical-cards-script-policy',setup(builder){
    builder.onStart(()=>{matched=0;});
    builder.onLoad({filter:/react-dom[\\/]cjs[\\/]react-dom-client\.production\.js$/},async({path})=>{
      const [source,metadata]=await Promise.all([readFile(path,'utf8'),readFile(join(dirname(path),'../package.json'),'utf8')]);
      matched++;
      return {contents:adaptReactRenderer(source,JSON.parse(metadata).version),loader:'js'};
    });
    builder.onEnd(result=>{if(!result.errors.length&&matched!==1)return {errors:[{text:`Expected exactly one reviewed React DOM production renderer, got ${matched}.`}]};});
  }};
}
