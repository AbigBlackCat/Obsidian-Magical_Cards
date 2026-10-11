import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { validateWork } from '../src/domain';
import { entityFromFields } from '../src/persistence';
import { cardsSourceBlocks, parseCardsEmbed } from '../src/embed-source';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const vault=resolve(root,'examples/vault');
interface Cover {id:string;type:'book'|'film';title:string;cover:string;sha256:string;}
const covers=JSON.parse(await readFile(resolve(root,'examples/covers.json'),'utf8')) as Cover[];
const frontmatter=(text:string)=>parse(text.match(/^---\n([\s\S]*?)\n---\n/)![1]);
async function files(directory:string):Promise<string[]>{
  const entries=await readdir(directory,{withFileTypes:true});
  return (await Promise.all(entries.map(entry=>entry.isDirectory()?files(resolve(directory,entry.name)):Promise.resolve([resolve(directory,entry.name)])))).flat();
}

test('eight offline examples contain fresh demo identities and no personal summaries, source records or original paths',async()=>{
  assert.equal(covers.length,8);assert.equal(new Set(covers.map(cover=>cover.id)).size,8);
  assert.equal(covers.filter(cover=>cover.type==='book').length,5);assert.equal(covers.filter(cover=>cover.type==='film').length,3);
  const noteFiles=(await files(resolve(vault,'示例'))).filter(file=>file.endsWith('.md')&&!file.includes('/_数据/'));assert.equal(noteFiles.length,8);
  for(const cover of covers){
    assert.match(cover.id,/^demo-(?:book|film)-[a-z]+$/);
    const text=await readFile(resolve(vault,'示例',cover.type==='book'?'书籍':'观影',`${cover.id}.md`),'utf8'),fields=frontmatter(text);
    assert.equal(fields.bw_id,cover.id);assert.equal(fields.bw_title,cover.title);assert.equal(fields.bw_type,cover.type);
    assert.deepEqual(Object.keys(fields).sort(),['bw_id','bw_type','bw_title','bw_created','bw_updated','bw_cover','bw_data'].sort());
    assert.equal(fields.bw_cover,`示例/附件/${cover.cover}`);assert.equal(fields.bw_data.cover,fields.bw_cover);
    assert.equal(fields.bw_data.summary,'');assert.equal(fields.bw_data.rating,null);assert.equal(fields.bw_data.pinned,false);
    assert.equal(fields.bw_created,'2026-10-11T00:00:00.000Z');assert.equal(fields.bw_updated,fields.bw_created);
    assert.equal(text.split(/\n---\n/)[1].trim(),`# ${cover.title}`);
    if(cover.type==='book'){
      assert.equal(fields.bw_data.sourceId,'');assert.deepEqual(fields.bw_data.notes,[]);assert.equal(fields.bw_data.progress,0);
      for(const key of ['author','lastRead','deepLink'])assert.equal(fields.bw_data[key],'');
      assert.deepEqual(Object.keys(fields.bw_data).sort(),['sourceId','author','progress','lastRead','status','notes','deepLink','summary','rating','pinned','cover'].sort());
    }else{
      for(const key of ['director','year','date','link'])assert.equal(fields.bw_data[key],'');
      assert.deepEqual(Object.keys(fields.bw_data).sort(),['director','year','date','status','summary','rating','pinned','link','cover'].sort());
    }
    const entity=entityFromFields(fields,relative(vault,noteFiles.find(file=>file.endsWith(`${cover.id}.md`))!),text);assert.ok(entity);validateWork(entity);
    assert.equal(isAbsolute(fields.bw_cover),false);assert.equal(/\.\.|https?:|\/Users\/|\/home\//.test(fields.bw_cover),false);
  }
});

test('all eight bundled cover bytes match recorded SHA-256 fingerprints and the animated SVG loads offline',async()=>{
  const assets=await readdir(resolve(vault,'示例/附件'));assert.deepEqual(assets.sort(),covers.map(cover=>cover.cover).sort());
  for(const cover of covers){
    const bytes=await readFile(resolve(vault,'示例/附件',cover.cover));assert.match(cover.sha256,/^[a-f0-9]{64}$/);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),cover.sha256,cover.title);
    if(cover.cover.endsWith('.png'))assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    else if(cover.cover.endsWith('.jpg'))assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff');
    else{
      const svg=bytes.toString('utf8');assert.match(svg,/<svg\b/);assert.match(svg,/<animate\b/);
      assert.doesNotMatch(svg,/<script\b|\bon\w+\s*=|(?:href|src)\s*=\s*["']\s*(?:https?:|file:)|url\(\s*["']?\s*(?:https?:|file:)/i);
    }
  }
});

test('welcome example renders only reading and films and inherits the three-card cylindrical starter appearance',async()=>{
  const note=await readFile(resolve(vault,'Magical_Cards示例及用法说明.md'),'utf8');const definitions=cardsSourceBlocks(note).map(block=>parseCardsEmbed(block.source));
  assert.equal(definitions.length,1);
  const modules=definitions.flatMap(block=>block.modules);assert.equal(new Set(modules.map(module=>module.id)).size,modules.length);
  assert.deepEqual(modules.map(module=>module.collection),['book','film']);
  assert.ok(modules.every(module=>module.layout===undefined&&module.orientation===undefined));
  const settings=frontmatter(await readFile(resolve(vault,'示例/_数据/卡片配置.md'),'utf8')).bw_card_settings;
  for(const key of ['bookCardAppearance','filmCardAppearance'])assert.deepEqual(settings[key],{material:'paper',style:'cover',layout:'cylinder',ratio:'2:3',imageFit:'cover'});
  assert.equal(settings.threeCardView,true);
  assert.deepEqual(settings.customModules,[]);
  assert.doesNotMatch(note,/\/Users\/|\/home\/|认知笔记|bw_deleted_book_sources|bw_reading_days/);
});

test('public sources, tests and scripts resolve local imports entirely within the standalone project',async()=>{
  for(const directory of ['src','tests','scripts'])for(const file of await files(resolve(root,directory))){
    if(!/\.(?:ts|tsx|mjs)$/.test(file))continue;
    const text=await readFile(file,'utf8');assert.doesNotMatch(text,/\/Users\/|\/home\//,relative(root,file));
    for(const match of text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["'](\.[^"']+)["']/g)){
      const destination=relative(root,resolve(dirname(file),match[1]));assert.ok(!destination.startsWith('..')&&!isAbsolute(destination),`${relative(root,file)} imports outside standalone source: ${match[1]}`);
    }
  }
});
