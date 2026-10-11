import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {build,type Plugin} from 'esbuild';
import {parse} from 'yaml';

interface Policy {
  REACT_VERSION: string;
  adaptReactRenderer(source: string, version: string): string;
  reactScriptPolicy(): Plugin;
  installationLicenseBanner(): Promise<string>;
}
const policy=await import(new URL('../scripts/react-script-policy.mjs',import.meta.url).href) as Policy;
const production=join(dirname(createRequire(import.meta.url).resolve('react-dom/package.json')),'cjs/react-dom-client.production.js');
const source=await readFile(production,'utf8');

test('renderer policy fails closed on an unreviewed version, creator count, source or missing renderer',async()=>{
  assert.throws(()=>policy.adaptReactRenderer(source,'19.2.0'),/requires a new script-resource policy review/);
  assert.throws(()=>policy.adaptReactRenderer(source.replace('ownerDocument.createElement("script")','null'),policy.REACT_VERSION),/expected 3, got 2/);
  assert.throws(()=>policy.adaptReactRenderer(`${source}\nownerDocument.createElement("script");`,policy.REACT_VERSION),/expected 3, got 4/);
  assert.throws(()=>policy.adaptReactRenderer(`${source}\n`,policy.REACT_VERSION),/source changed/);
  await assert.rejects(build({stdin:{contents:'export const value=1;'},bundle:true,write:false,logLevel:'silent',plugins:[policy.reactScriptPolicy()]}),/Expected exactly one reviewed/);
  assert.ok(policy.adaptReactRenderer(source,policy.REACT_VERSION).includes('nextResource.innerHTML = "<script>\\x3c/script>";'),'React inert-script protection was removed');
});

async function resourceFixture(guarded: boolean){
  const result=await build({stdin:{contents:"export {preinit,preinitModule} from 'react-dom';import * as client from 'react-dom/client';export const acquireScript=client.__qaAcquireScript;",resolveDir:dirname(production),loader:'js'},bundle:true,format:'cjs',target:'es2022',minify:true,write:false,logLevel:'silent',define:{'process.env.NODE_ENV':'"production"'},plugins:[{
    name:'exercise-real-script-resources',setup(builder){builder.onLoad({filter:/react-dom-client\.production\.js$/},()=>({loader:'js',contents:(guarded?policy.adaptReactRenderer(source,policy.REACT_VERSION):source)+
      // This test-only entry exercises the async JSX resource branch without a browser or network.
      '\nexports.__qaAcquireScript=function(doc,src){return acquireResource(doc,{type:"script",instance:null,count:0,state:null},{src:src,async:true});};\n'}));}
  }]});
  const events:string[]=[];
  const document={querySelector:()=>null,createElement:(tag:string)=>{events.push(`create:${tag}`);return {setAttribute:()=>{},addEventListener:()=>{}};},head:{appendChild:()=>{events.push('append');}}};
  const module={exports:{}};
  runInNewContext(result.outputFiles[0].text,{module,exports:module.exports,document,console,setTimeout,clearTimeout});
  const api=module.exports as {preinit(url:string,options:{as:string}):void;preinitModule(url:string,options:{as:string}):void;acquireScript(document:unknown,url:string):void};
  return {events,calls:[()=>api.preinit('https://example.invalid/ordinary.js',{as:'script'}),()=>api.preinitModule('https://example.invalid/module.js',{as:'script'}),()=>api.acquireScript(document,'https://example.invalid/async-jsx.js')]};
}
test('preinit, preinitModule and async script resources all refuse execution before creating or inserting DOM',async()=>{
  const original=await resourceFixture(false);
  for(const call of original.calls)call();
  assert.equal(original.events.filter(item=>item==='create:script').length,3);
  assert.equal(original.events.filter(item=>item==='append').length,3);
  const guarded=await resourceFixture(true);
  for(const call of guarded.calls)assert.throws(call,/Magical Cards does not load executable script resources/);
  assert.deepEqual(guarded.events,[]);
});
test('actual production build has no executable script creation and stays below the release size budget',async()=>{
  const builder=await import(new URL('../esbuild.mjs',import.meta.url).href) as {MAX_MAIN_BYTES:number;buildCards(options:{write:boolean}):Promise<{main:Uint8Array}>};
  const {main}=await builder.buildCards({write:false}),text=Buffer.from(main).toString('utf8');
  assert.ok(main.byteLength<builder.MAX_MAIN_BYTES);
  assert.doesNotMatch(text,/createElement\(\s*(["'])script\1\s*\)/);
  assert.ok(text.includes('Magical Cards does not load executable script resources.'));
  const banner=await policy.installationLicenseBanner();
  assert.ok(text.startsWith(banner));assert.match(banner,/Copyright \(c\) 2026 AbigBlackCat/);assert.match(banner,/Copyright \(c\) Meta Platforms/);
  assert.equal((banner.match(/Permission is hereby granted/g)??[]).length,2);
  assert.match(banner,/Sample cover images and previews are excluded/);assert.match(banner,/Scheduler license/);
});
test('release workflow attests and publishes only installation files using pinned official actions',async()=>{
  const workflow=parse(await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8')) as {permissions:{contents:string};jobs:Record<string,{steps:Array<{uses?:string;name?:string;run?:string;with?:Record<string,unknown>}>}>};
  assert.equal(workflow.permissions.contents,'read');
  for(const job of Object.values(workflow.jobs))for(const step of job.steps)if(step.uses)assert.match(step.uses,/^actions\/(?:checkout|setup-node|attest)@[a-f0-9]{40}$/);
  const release=workflow.jobs.release.steps,attest=release.find(step=>step.name==='Attest the three installation files')!,publish=release.find(step=>step.name==='Publish only the three installation files')!;
  assert.deepEqual(String(attest.with?.['subject-path']).trim().split('\n').sort(),['main.js','manifest.json','styles.css']);
  assert.deepEqual(publish.run?.split(/\s+/).slice(4,7).sort(),['main.js','manifest.json','styles.css']);
  const checker=await import(new URL('../scripts/check-release.mjs',import.meta.url).href) as {RELEASE_FILES:string[];checkRelease(tag:string):Promise<unknown>};
  assert.deepEqual([...checker.RELEASE_FILES].sort(),['main.js','manifest.json','styles.css']);
  await assert.rejects(checker.checkRelease('0.0.0'),/does not match manifest/);
});
