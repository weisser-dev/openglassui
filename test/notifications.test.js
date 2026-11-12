import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/notifications.js',import.meta.url),'utf8');
const context=vm.createContext({});vm.runInContext(source,context);
const notices=(previous,tasks)=>JSON.parse(JSON.stringify(context.taskNotices(previous,tasks)));
test('notices report pending decisions and new terminal changes without replaying old completions',()=>{
 const running={id:'1',agentName:'Kiro',status:'running'};
 assert.deepEqual(notices(null,[running]),[]);
 assert.equal(notices(null,[{...running,pendingDecision:{id:'d0'}}])[0].text,'Entscheidung erforderlich');
 const previous=new Map([['1',{status:'running',decision:undefined}]]);
 assert.deepEqual(notices(previous,[{...running,pendingDecision:{id:'d1'}}]),[{taskId:'1',agentName:'Kiro',text:'Entscheidung erforderlich'}]);
 assert.deepEqual(notices(new Map([['1',{status:'running',decision:'d1'}]]),[{...running,pendingDecision:{id:'d1'}}]),[]);
 assert.deepEqual(notices(previous,[{...running,status:'completed'}]),[{taskId:'1',agentName:'Kiro',text:'Aufgabe abgeschlossen'}]);
 assert.equal(notices(previous,[{...running,status:'failed'}])[0].text,'Aufgabe fehlgeschlagen');
});
