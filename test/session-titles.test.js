import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const window={};const context=vm.createContext({window,Intl,Date,Map,Set,Promise});vm.runInContext(await readFile(new URL('../public/usage.js',import.meta.url),'utf8'),context);
test('existing imported sessions are named from their provider without losing origin marker',async()=>{
 let calls=0,updated;const done=new Promise(resolve=>updated=resolve);const resolver=window.createSessionTitleResolver(async()=>{calls++;return {sessions:[{id:'a',title:'Provider session'}]};},updated);
 const tasks=[{agentId:'claude',projectId:'p',sessionId:'a',prompt:'Importierte Sitzung'},{agentId:'claude',projectId:'p',sessionId:'a',prompt:'Importierte Sitzung'}];resolver.enrich(tasks);await done;resolver.enrich(tasks);assert.equal(calls,1);assert.equal(tasks[0].title,'Provider session');assert.equal(tasks[0].prompt,'Importierte Sitzung');assert.equal(window.taskDisplayTitle(tasks[0]),'Provider session');
});
test('internal system reminders are removed from displayed imported transcripts',()=>{assert.equal(window.cleanImportedTranscript('A\n<system-reminder>secret internal instructions</system-reminder>\nB'),'A\n\nB');});
test('duplicate session entries are grouped without deleting histories and retain pending decisions',()=>{
 const list=[{id:'old',agentId:'claude',sessionId:'s',createdAt:'2026-01-01'},{id:'new',agentId:'claude',sessionId:'s',createdAt:'2026-01-02'},{id:'pending',agentId:'claude',sessionId:'s',createdAt:'2025-01-01',pendingDecision:{id:'p'}},{id:'other',agentId:'codex',sessionId:'s'},{id:'local',agentId:'claude'}];
 const result=Array.from(window.uniqueSessionTasks(list));assert.deepEqual(result.map(x=>x.id),['pending','other','local']);assert.equal(list.length,5);
});
test('provider history becomes separate chat bubbles while tool and reminder contents stay hidden',()=>{
 const value=window.formatProviderSession([{type:'user',message:{content:'Hello <system-reminder>internal</system-reminder>'}},{type:'assistant',message:{content:[{type:'tool_use',input:'secret'},{type:'text',text:'Hello back'}]}}]);
 assert.deepEqual(JSON.parse(JSON.stringify(value)),[{role:'user',text:'Hello'},{role:'assistant',text:'Hello back'}]);
});
test('cached session titles appear immediately after a reload',async()=>{
 const saved=new Map();window.localStorage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};
 try{let done;const first=window.createSessionTitleResolver(async()=>({sessions:[{id:'a',title:'Cached title'}]}),()=>done());const task={agentId:'claude',projectId:'p',sessionId:'a',prompt:'Importierte Sitzung'};const loaded=new Promise(resolve=>done=resolve);first.enrich([task]);await loaded;const next={...task};delete next.title;const second=window.createSessionTitleResolver(async()=>({sessions:[]}));second.enrich([next]);assert.equal(next.title,'Cached title');}finally{delete window.localStorage;}
});
