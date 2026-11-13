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

test('wearable notices identify tasks and stay dismissed after opening',()=>{
 const manager=context.createWearableNotices();
 const tasks=[{id:'a',agentName:'Codex',projectName:'Example',prompt:'Check the tests',status:'completed'}];
 manager.update(new Map([['a',{status:'running'}]]),tasks);
 let notice=manager.current(tasks);assert.match(notice.text,/Codex · Example · Task completed/);assert.match(notice.text,/Check the tests/);
 manager.dismiss(notice);manager.update(new Map([['a',{status:'completed'}]]),tasks);assert.equal(manager.current(tasks),null);
 tasks[0].pendingDecision={id:'d1'};manager.update(null,tasks);notice=manager.current(tasks);assert.equal(notice.decision,true);manager.dismiss(notice);manager.update(null,tasks);assert.equal(manager.current(tasks),null);
 tasks[0].pendingDecision={id:'d2'};manager.update(null,tasks);assert.equal(manager.current(tasks).decisionId,'d2');
});
test('opening one notification leaves another completion available',()=>{
 const manager=context.createWearableNotices();const tasks=['a','b'].map(id=>({id,agentName:'Agent',prompt:id,status:'completed'}));
 manager.update(new Map(tasks.map(task=>[task.id,{status:'running'}])),tasks);
 const first=manager.current(tasks);manager.dismiss(first);assert.notEqual(manager.current(tasks).taskId,first.taskId);
});
test('new external text activity produces a notice only after a change',()=>{
 const task={id:'a',agentName:'Claude',status:'completed',snapshotSync:{changedAt:'later'}};
 assert.equal(notices(new Map([['a',{status:'completed',snapshot:'before'}]]),[task])[0].text,'New activity');
 assert.equal(notices(new Map([['a',{status:'completed',snapshot:'later'}]]),[task]).length,0);
});
