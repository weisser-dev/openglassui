import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const window={};const context=vm.createContext({window,Intl,Date,Map,Set,Promise});vm.runInContext(await readFile(new URL('../public/usage.js',import.meta.url),'utf8'),context);
test('existing imported sessions are named from their provider without losing origin marker',async()=>{
 let calls=0,updated;const done=new Promise(resolve=>updated=resolve);const resolver=window.createSessionTitleResolver(async()=>{calls++;return {sessions:[{id:'a',title:'Provider session'}]};},updated);
 const tasks=[{agentId:'claude',projectId:'p',sessionId:'a',prompt:'Importierte Sitzung'},{agentId:'claude',projectId:'p',sessionId:'a',prompt:'Importierte Sitzung'}];resolver.enrich(tasks);await done;resolver.enrich(tasks);assert.equal(calls,1);assert.equal(tasks[0].title,'Provider session');assert.equal(tasks[0].prompt,'Importierte Sitzung');assert.equal(window.taskDisplayTitle(tasks[0]),'Provider session');
});
test('internal system reminders are removed from displayed imported transcripts',()=>{assert.equal(window.cleanImportedTranscript('A\n<system-reminder>secret internal instructions</system-reminder>\nB'),'A\n\nB');});
