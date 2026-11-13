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

test('opening a chat clears its activity badge and dismisses its decision without approving it',()=>{
 const manager=context.createWearableNotices();const task={id:'a',agentName:'Codex',agentId:'codex',sessionId:'s',projectName:'Example',prompt:'Check the tests',status:'completed'};
 task.snapshotMessages=[{role:'assistant',text:'first'}];manager.update(null,[task]);task.snapshotMessages.push({role:'assistant',text:'second'});manager.update(null,[task]);assert.equal(manager.count(task),1);assert.equal(manager.current([task]),null);
 manager.open(task);assert.equal(manager.count(task),0);
 task.pendingDecision={id:'d1'};manager.update(null,[task]);let notice=manager.current([task]);assert.match(notice.text,/Decision required/);manager.open(task);manager.update(null,[task]);assert.equal(manager.current([task]),null);assert.equal(task.pendingDecision.id,'d1');
 task.pendingDecision={id:'d2'};manager.update(null,[task]);assert.equal(manager.current([task]).decisionId,'d2');
});
test('duplicate imports share one badge and opening one clears it',()=>{
 const manager=context.createWearableNotices();const tasks=['a','b'].map(id=>({id,agentId:'claude',sessionId:'s',status:'completed',snapshotSync:{changedAt:'new'}}));
 tasks.forEach(task=>task.snapshotMessages=[{role:'assistant',text:'old'}]);manager.update(null,tasks);tasks.forEach(task=>task.snapshotMessages=[{role:'assistant',text:'old'},{role:'assistant',text:'new'}]);manager.update(null,tasks);assert.equal(manager.count(tasks[0]),1);assert.equal(manager.count(tasks[1]),1);manager.open(tasks[1]);assert.equal(manager.count(tasks[0]),0);
});
test('new external text activity produces a notice only after a change',()=>{
 const task={id:'a',agentName:'Claude',status:'completed',snapshotSync:{changedAt:'later'}};
 assert.equal(notices(new Map([['a',{status:'completed',snapshot:'before'}]]),[task])[0].text,'New activity');
 assert.equal(notices(new Map([['a',{status:'completed',snapshot:'later'}]]),[task]).length,0);
});


test('unread messages survive a reload and clear when the chat opens',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const task={id:'a',agentId:'claude',sessionId:'s',snapshotMessages:[{role:'assistant',text:'old'}]};
 const first=context.createWearableNotices(storage);first.update(null,[task]);
 task.snapshotMessages.push({role:'assistant',text:'new'});const reloaded=context.createWearableNotices(storage);reloaded.update(null,[task]);assert.equal(reloaded.count(task),1);assert.ok(!JSON.stringify([...values]).includes('new'));
 reloaded.open(task);assert.equal(context.createWearableNotices(storage).count(task),0);
});
test('two views on the same origin share one unread count and read state',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const task={id:'a',agentId:'claude',sessionId:'s',snapshotMessages:[{role:'assistant',text:'first'}]};const a=context.createWearableNotices(storage),b=context.createWearableNotices(storage);a.update(null,[task]);b.update(null,[task]);task.snapshotMessages.push({role:'assistant',text:'second'});a.update(null,[task]);b.update(null,[task]);assert.equal(a.count(task),1);assert.equal(b.count(task),1);a.open(task);b.reload();assert.equal(b.count(task),0);
});
test('prepending older history does not count old messages as unread',()=>{
 const manager=context.createWearableNotices(),task={id:'a',snapshotMessages:[{role:'assistant',text:'last visible'}]};manager.update(null,[task]);task.snapshotMessages=[...Array.from({length:39},(_,i)=>({role:'assistant',text:`old ${i}`})),{role:'assistant',text:'last visible'}];manager.update(null,[task]);assert.equal(manager.count(task),0);task.snapshotMessages.push({role:'assistant',text:'new answer'});manager.update(null,[task]);assert.equal(manager.count(task),1);
});
