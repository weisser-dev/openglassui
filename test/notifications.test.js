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
 assert.equal(notices(null,[{...running,pendingDecision:{id:'d0'}}])[0].text,'Decision required');
 const previous=new Map([['1',{status:'running',decision:undefined}]]);
 assert.deepEqual(notices(previous,[{...running,pendingDecision:{id:'d1'}}]),[{taskId:'1',agentName:'Kiro',text:'Decision required'}]);
 assert.deepEqual(notices(new Map([['1',{status:'running',decision:'d1'}]]),[{...running,pendingDecision:{id:'d1'}}]),[]);
 assert.deepEqual(notices(previous,[{...running,status:'completed'}]),[{taskId:'1',agentName:'Kiro',text:'Task completed'}]);
 assert.equal(notices(previous,[{...running,status:'failed'}])[0].text,'Task failed');
});

test('wearable notice prioritizes outstanding decisions over unrelated completions',()=>{
 const previous=new Map([['a',{status:'running',decision:'d'}],['b',{status:'running'}]]);
 const tasks=[{id:'a',agentName:'Claude',status:'running',pendingDecision:{id:'d'}},{id:'b',agentName:'Kiro',status:'completed'}];
 const notice=JSON.parse(JSON.stringify(context.wearableNotice(previous,tasks)));assert.equal(notice.taskId,'a');assert.equal(notice.decision,true);assert.match(notice.text,/Decision required/);
 tasks.push({id:'c',agentName:'Codex',status:'running',pendingDecision:{id:'e'}});assert.match(context.wearableNotice(previous,tasks).text,/2 pending/);
});
