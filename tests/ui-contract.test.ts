import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CardsSurface from '../src/CardsSurface';
import { WorkPropertiesManager } from '../src/WorkPropertiesSessions';
import { createWork } from '../src/domain';
import { DEFAULT_CARD_SETTINGS, type CardsAPI, type CardsSnapshot } from '../src/types';

function fixture() {
  const snapshot: CardsSnapshot = { entities: [{...createWork('book'), id:'demo-book', title:'示例作品'}], workOrder:null, settings: {...DEFAULT_CARD_SETTINGS, bookCardAppearance:{material:'paper',style:'cover',layout:'cylinder'}}, loading:false,error:'' };
  let saves=0;
  const api = { getSnapshot:()=>snapshot, subscribe:()=>()=>{}, coverUrl:(path:string)=>path, saveSettings:async()=>{saves++;} } as unknown as CardsAPI;
  const manager = new WorkPropertiesManager(api);
  return { snapshot, api, manager, saves:()=>saves };
}

test('same collection can render in two local layouts without copying entities or writing global settings', () => {
  const {snapshot,api,manager,saves}=fixture();
  const before=JSON.stringify(snapshot);
  const html=renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(CardsSurface,{api,manager,embed:{id:'one',modules:[{id:'one-books',collection:'book',layout:'album-rail'}]}}),
    React.createElement(CardsSurface,{api,manager,embed:{id:'two',modules:[{id:'two-books',collection:'book',layout:'coverflow-carousel'}]}}),
  ));
  assert.ok(html.includes('data-layout="album-rail"')); assert.ok(html.includes('data-layout="coverflow-carousel"'));
  assert.equal((html.match(/data-work-id="demo-book"/g)??[]).length,2);
  assert.equal(JSON.stringify(snapshot),before); assert.equal(saves(),0);
  manager.dispose();
});

test('missing collections and empty block modules render useful states without silently creating collections', () => {
  const {snapshot,api,manager,saves}=fixture();
  const missing=renderToStaticMarkup(React.createElement(CardsSurface,{api,manager,embed:{id:'missing',modules:[{id:'unknown',collection:'removed-module'}]}}));
  assert.ok(missing.includes('集合未找到')); assert.ok(missing.includes('removed-module'));
  const empty=renderToStaticMarkup(React.createElement(CardsSurface,{api,manager,embed:{id:'empty',modules:[]}}));
  assert.ok(empty.includes('当前代码块未指定卡片模块')); assert.equal(empty.includes('data-work-id='),false); assert.equal(snapshot.entities.length,1); assert.equal(snapshot.settings.customModules.length,0); assert.equal(saves(),0);
  manager.dispose();
});
