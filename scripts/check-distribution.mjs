import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const RELEASE_FILES=['main.js','manifest.json','styles.css'];
const requiredFiles=[
  'README.md','README_en.md','CHANGELOG.md','LICENSE','LICENSE-LEGACY-MIT','THIRD_PARTY.md',
  'manifest.json','versions.json','.github/workflows/ci.yml','scripts/check-distribution.mjs',
];
const demoBooks=['educated','mimetic','thinking'],demoFilms=['lost','odyssey','whitedeer'];
const exampleFiles=[
  'examples/SOURCES.md','examples/covers.json','examples/Magical_Cards示例及用法说明.md',
  'examples/vault/Magical_Cards示例及用法说明.md','examples/vault/示例/_数据/卡片配置.md',
  'examples/vault/.obsidian/app.json','examples/vault/.obsidian/community-plugins.json',
  'examples/vault/.obsidian/plugins/magical-cards/data.json',
  ...demoBooks.map(name=>`examples/vault/示例/书籍/demo-book-${name}.md`),
  ...demoFilms.map(name=>`examples/vault/示例/观影/demo-film-${name}.md`),
  ...demoBooks.map(name=>`examples/vault/示例/附件/demo-book-${name}.jpg`),
  ...demoFilms.map(name=>`examples/vault/示例/附件/demo-film-${name}.${name==='lost'?'svg':'png'}`),
];
const previews=['album-rail','coverflow-carousel','cylinder','dashboards','note-embed','scroll-bend-vertical','scroll-bend','settings-advanced','settings','showcase-back','showcase-dark','showcase-front','skewed-carousel'];
const allowedFiles=new Set([...requiredFiles,'.gitignore',...exampleFiles,...previews.map(name=>`previews/${name}.png`)]);
const allowedDirectories=new Set([...allowedFiles].flatMap(file=>file.split('/').slice(0,-1).map((_,index)=>file.split('/').slice(0,index+1).join('/'))));

function checkText(text,name){
  if(/\/(?:Users|home)\/[^\s/]+|[A-Z]:[\\/]Users[\\/]/i.test(text))throw new Error(`Personal absolute path in ${name}.`);
  if(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|Authorization\s*[:=]\s*["']?Bearer\s+[A-Za-z0-9._-]{12,}/i.test(text))throw new Error(`Possible credential in ${name}.`);
  if(/[#@]\s*sourceMappingURL\s*=/.test(text))throw new Error(`Source map reference in ${name}.`);
}

function checkManifest(manifest,versions,tag){
  if(manifest.id!=='magical-cards'||!/^\d+\.\d+\.\d+$/.test(manifest.version)||versions[manifest.version]!==manifest.minAppVersion)throw new Error('Manifest and versions.json disagree.');
  if(tag!==undefined&&tag!==manifest.version)throw new Error('Release tag does not match the public manifest.');
}

export async function checkDistribution(directory,{artifactsDir,tag}={}){
  const root=resolve(directory),files=[];
  async function walk(relative=''){
    for(const entry of await readdir(join(root,relative),{withFileTypes:true})){
      if(!relative&&entry.name==='.git')continue;
      const name=relative?`${relative}/${entry.name}`:entry.name;
      if(entry.isDirectory()){
        if(!allowedDirectories.has(name))throw new Error(`Non-distribution directory: ${name}.`);
        await walk(name);
      }else{
        if(!entry.isFile()||!allowedFiles.has(name))throw new Error(`Non-distribution file: ${name}.`);
        const bytes=await readFile(join(root,name));
        if(!/\.(?:png|jpe?g)$/i.test(name))checkText(bytes.toString('utf8'),name);
        if(name==='examples/vault/.obsidian/plugins/magical-cards/data.json'){
          const data=JSON.parse(bytes.toString('utf8'));
          if(data.rootFolder!=='示例'||data.installationOrigin!=='legacy'||Object.keys(data).sort().join(',')!=='installationOrigin,rootFolder')throw new Error('Only the public starter configuration may be distributed.');
        }
        if(/^examples\/vault\/示例\/(?:书籍|观影)\//.test(name)){
          const text=bytes.toString('utf8'),id=name.split('/').at(-1).replace(/\.md$/,'');
          const sourceId=text.match(/^\s*sourceId:([^\r\n]*)$/m)?.[1].trim();
          if(!text.includes(`bw_id: ${id}\n`)||(sourceId!==undefined&&!['','""',"''"].includes(sourceId)))throw new Error(`Non-demo work data in ${name}.`);
        }
        files.push(name);
      }
    }
  }
  await walk();
  for(const name of requiredFiles)if(!files.includes(name))throw new Error(`Missing distribution file: ${name}.`);
  const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
  const versions=JSON.parse(await readFile(join(root,'versions.json'),'utf8'));
  checkManifest(manifest,versions,tag);
  const hashes={};
  if(artifactsDir){
    const names=(await readdir(artifactsDir)).sort();
    if(names.join('\n')!==[...RELEASE_FILES].sort().join('\n'))throw new Error('Release must contain exactly main.js, manifest.json and styles.css.');
    for(const name of RELEASE_FILES){
      const bytes=await readFile(join(artifactsDir,name));
      if(!bytes.length)throw new Error(`Empty release file: ${name}.`);
      checkText(bytes.toString('utf8'),name);
      hashes[name]=createHash('sha256').update(bytes).digest('hex');
    }
    const artifactManifest=JSON.parse(await readFile(join(artifactsDir,'manifest.json'),'utf8'));
    checkManifest(artifactManifest,versions,tag);
    for(const field of ['id','version','minAppVersion'])if(artifactManifest[field]!==manifest[field])throw new Error('Release manifest does not match the public manifest.');
  }
  return {version:manifest.version,files:files.length,hashes};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [directory,artifactsDir,tag,...extra]=process.argv.slice(2);
  if(!directory||extra.length)throw new Error('Usage: node scripts/check-distribution.mjs <public-tree-dir> [release-files-dir] [tag]');
  process.stdout.write(`${JSON.stringify(await checkDistribution(directory,{artifactsDir,tag}),null,2)}\n`);
}
