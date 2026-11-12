import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import http from 'node:http';

test('paired device receives a Kiro decision, resolves it once and sees usage and completion',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'og-flow-'));
 const executable=path.join(dir,'mock-kiro');
 const script=`#!${process.execPath}
const readline=require('node:readline');const send=x=>console.log(JSON.stringify({jsonrpc:'2.0',...x}));let promptId;
readline.createInterface({input:process.stdin}).on('line',line=>{const msg=JSON.parse(line);
 if(msg.method==='initialize')send({id:msg.id,result:{agentCapabilities:{loadSession:true,sessionCapabilities:{list:{}}}}});
 if(msg.method==='session/new')send({id:msg.id,result:{sessionId:'sess_fixture'}});
 if(msg.method==='session/prompt'){promptId=msg.id;send({method:'session/update',params:{sessionId:'sess_fixture',update:{sessionUpdate:'tool_call',toolCallId:'tool-1',title:'Inspect project',status:'pending'}}});send({method:'session/update',params:{sessionId:'sess_fixture',update:{sessionUpdate:'tool_call_update',toolCallId:'tool-1',status:'completed'}}});send({method:'session/update',params:{sessionId:'sess_fixture',update:{sessionUpdate:'session_info_update',_meta:{kiro:{kind:'context_usage',usagePercentage:42}}}}});send({id:29,method:'session/request_permission',params:{sessionId:'sess_fixture',toolCall:{title:'Run checks'},options:[{optionId:'once',name:'Allow once',kind:'allow_once'},{optionId:'always',name:'Allow always',kind:'allow_always'},{optionId:'reject',name:'Reject',kind:'reject_once'}]}});send({id:30,method:'session/request_permission',params:{sessionId:'sess_fixture',toolCall:{title:'Second check'},options:[{optionId:'once2',name:'Allow once',kind:'allow_once'},{optionId:'reject2',name:'Reject',kind:'reject_once'}]}})}
 if(msg.id===29&&msg.result)global.first=msg.result.outcome.optionId;
 if(msg.id===30&&msg.result){const selected=global.first+','+msg.result.outcome.optionId;send({method:'session/update',params:{sessionId:'sess_fixture',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'Result: '+selected}}}});send({id:promptId,result:{stopReason:'end_turn'}})}
});`;
 await writeFile(executable,script);await chmod(executable,0o755);
 const port=24000+Math.floor(Math.random()*10000),base=`http://127.0.0.1:${port}`,gateway=`http://127.0.0.1:${port+1}`;
 await writeFile(path.join(dir,'config.json'),JSON.stringify({workspace:dir,agents:[{id:'kiro',name:'Kiro',command:executable,args:['placeholder'],input:'stdin'}]}));
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),OPENGLASS_CONFIG:path.join(dir,'config.json'),OPENGLASS_DATA_DIR:path.join(dir,'data')},stdio:'ignore'});
 let socket;
 const localPost=(url,body)=>fetch(base+url,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/state')).ok){ready=true;break;}}catch{}await delay(25);}assert.ok(ready,'server did not start');
  const pair=await (await localPost('/api/pairing',{url:'https://example.com'})).json();
  const code=new URLSearchParams(new URL(pair.url).hash.slice(1)).get('pair');
  const token=(await (await fetch(gateway+'/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})})).json()).token;
  assert.ok(token);
  socket=new WebSocket(`ws://127.0.0.1:${port+1}/api/events`);let revisions=0;socket.on('message',()=>revisions++);await once(socket,'open');socket.send(JSON.stringify({token}));
  const remote=(url,body)=>fetch(gateway+url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const started=await remote('/api/tasks',{agentId:'kiro',projectId:'default',prompt:'Fixture task'});assert.equal(started.status,201);const id=(await started.json()).id;
  let task;for(let i=0;i<100;i++){task=(await (await fetch(gateway+'/api/state',{headers:{Authorization:`Bearer ${token}`}})).json()).tasks.find(t=>t.id===id);if(task?.pendingDecision)break;await delay(25);}
  assert.equal(task.pendingDecision.kind,'kiro_permission');assert.equal(task.usage.context.usagePercentage,42);assert.equal(task.events.length,1);assert.equal(task.events[0].title,'Inspect project');assert.equal(task.events[0].status,'completed');
  assert.deepEqual(task.pendingDecision.input.options.map(o=>o.optionId),['once','reject']);
  const denied=await remote(`/api/tasks/${id}/decision`,{decisionId:task.pendingDecision.id,type:'choice',optionId:'always'});assert.equal(denied.status,400);
  let slow;const slowResult=new Promise((resolve,reject)=>{slow=http.request(`${gateway}/api/tasks/${id}/decision`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});slow.on('error',reject);slow.write('{"decisionId":"');});await delay(50);
  const chosen=await remote(`/api/tasks/${id}/decision`,{decisionId:task.pendingDecision.id,type:'choice',optionId:'once'});assert.equal(chosen.status,200);
  const firstId=task.pendingDecision.id;
  for(let i=0;i<100;i++){task=(await (await fetch(gateway+'/api/state',{headers:{Authorization:`Bearer ${token}`}})).json()).tasks.find(t=>t.id===id);if(task.pendingDecision && task.pendingDecision.id!==firstId)break;await delay(25);}
  assert.equal(task.pendingDecision.input.toolCall.title,'Second check');
  assert.equal((await remote(`/api/tasks/${id}/decision`,{decisionId:firstId,type:'choice',optionId:'once'})).status,409);
  slow.end(task.pendingDecision.id+'","type":"choice","optionId":"reject2"}');assert.equal(await slowResult,200);
  for(let i=0;i<100;i++){task=(await (await fetch(gateway+'/api/state',{headers:{Authorization:`Bearer ${token}`}})).json()).tasks.find(t=>t.id===id);if(task.status!=='running')break;await delay(25);}
  assert.equal(task.status,'completed');assert.match(task.output,/Result: once,reject2/);assert.ok(revisions>=2,'the paired device should receive change events');
  const repeated=await remote(`/api/tasks/${id}/decision`,{decisionId:'stale',type:'choice',optionId:'once'});assert.equal(repeated.status,409);
 }finally{socket?.terminate();if(child.exitCode===null && child.signalCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}await rm(dir,{recursive:true,force:true});}
});
