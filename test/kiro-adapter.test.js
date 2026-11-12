import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {runKiro,listKiroSessions,readKiroSession} from '../kiro.js';

test('Kiro ACP streams output, usage and forwards only the selected permission',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'og-kiro-'));const file=path.join(dir,'kiro');
 const script=`#!${process.execPath}
 const readline=require('node:readline');const send=x=>console.log(JSON.stringify({jsonrpc:'2.0',...x}));
 readline.createInterface({input:process.stdin}).on('line',s=>{const m=JSON.parse(s);
 if(m.method==='initialize')send({id:m.id,result:{agentCapabilities:{loadSession:true,sessionCapabilities:{list:{}}}}});
 if(m.method==='session/list')send({id:m.id,result:m.params.cursor?{sessions:[{sessionId:'session-test',cwd:'${dir}',title:'Fixture'},{sessionId:'foreign',cwd:'/other'}]}:{sessions:[{sessionId:'first',cwd:'${dir}',title:'First'}],nextCursor:'next-page'}});
 if(m.method==='session/load'){send({method:'session/update',params:{sessionId:'foreign-session',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'must not leak'}}}});send({method:'session/update',params:{sessionId:'session-test',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'His'}}}});send({method:'session/update',params:{sessionId:'session-test',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'tory'}}}});send({id:m.id,result:{}})}
 if(m.method==='session/new')send({id:m.id,result:{sessionId:'session-test'}});
 if(m.method==='session/prompt' && Array.isArray(m.params.prompt)){global.promptId=m.id;send({method:'session/update',params:{sessionId:'session-test',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'Hallo'}}}});send({method:'session/update',params:{sessionId:'session-test',update:{sessionUpdate:'session_info_update',_meta:{kiro:{kind:'context_usage',usagePercentage:12}}}}});send({id:99,method:'session/request_permission',params:{sessionId:'session-test',toolCall:{title:'Command'},options:[{optionId:'yes',name:'Allow once',kind:'allow_once'},{optionId:'always',name:'Allow always',kind:'allow_always'},{optionId:'no',name:'Reject',kind:'reject_once'}]}})}
 if(m.id===99&&m.result)send({id:global.promptId,result:{stopReason:m.result.outcome.optionId==='yes'?'end_turn':'refusal'}});
 });`;
 await writeFile(file,script);await chmod(file,0o755);
 try{let output='',usage,decision,session;
  await new Promise((resolve,reject)=>runKiro({command:file,workspace:dir,prompt:'Test',onSession:s=>session=s,onText:t=>output+=t,onUsage:u=>usage=u,onDecision:async d=>{decision=d;return {optionId:'yes'};},onDone:e=>e?reject(e):resolve()}));
  const sessions=await listKiroSessions(dir,file);assert.deepEqual(sessions.map(s=>s.id),['first','session-test']);const replay=await readKiroSession(dir,'session-test',file);assert.equal(replay.length,1);assert.equal(replay[0].message.content,'History');await assert.rejects(readKiroSession(dir,'wrong',file));
  assert.equal(session,'session-test');assert.equal(output,'Hallo');assert.equal(usage.usagePercentage,12);assert.deepEqual(decision.input.options.map(o=>o.optionId),['yes','no']);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Kiro rejects a repeated pagination cursor',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'og-kiro-pages-'));const file=path.join(dir,'kiro');
 const script=`#!${process.execPath}
 const readline=require('node:readline');readline.createInterface({input:process.stdin}).on('line',s=>{const m=JSON.parse(s);if(m.method==='initialize')console.log(JSON.stringify({id:m.id,result:{agentCapabilities:{sessionCapabilities:{list:{}}}}}));if(m.method==='session/list')console.log(JSON.stringify({id:m.id,result:{sessions:[],nextCursor:'loop'}}));});`;
 await writeFile(file,script);await chmod(file,0o755);
 try{await assert.rejects(listKiroSessions(dir,file),/Seitennavigation/);}finally{await rm(dir,{recursive:true,force:true});}
});
