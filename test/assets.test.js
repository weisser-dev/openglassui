import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('wearable and dashboard scripts exist, parse, and load dependencies first',async()=>{
 for(const page of ['index.html','glass.html','simulator.html']){
  const html=await readFile(new URL(`../public/${page}`,import.meta.url),'utf8');
  const assets=[...html.matchAll(/(?:src|href)="\/(?!\/)([^"?#]+)"/g)].map(match=>match[1]);
  for(const asset of assets){const text=await readFile(new URL(`../public/${asset}`,import.meta.url),'utf8');if(asset.endsWith('.js'))new vm.Script(text,{filename:asset});}
  if(page==='glass.html'){for(const dependency of ['theme.js','i18n.js','glass-i18n.js','usage.js','notifications.js','spatial.js','webmcp.js','events.js','push-client.js','wearable-audio.js','wearable-navigation.js','recent-chats.js'])assert.ok(assets.indexOf(dependency)>=0 && assets.indexOf(dependency)<assets.indexOf('glass.js'),`${dependency} must load before glass.js`);}
 }
});
