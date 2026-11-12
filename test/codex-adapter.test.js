import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {runCodex,listAgentSessions,readAgentSession} from '../sessions.js';

test('Codex-Adapter zeigt Rückfrage und gibt nur ausgewählte Einzelfreigabe weiter',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'og-codex-'));const file=path.join(dir,'codex');const id='12345678-1234-1234-1234-123456789abc';
 const script=`#!${process.execPath}
 const readline=require('node:readline');const send=x=>console.log(JSON.stringify(x));let thread='${id}';
 readline.createInterface({input:process.stdin}).on('line',s=>{const m=JSON.parse(s);
 if(m.method==='initialize')send({id:m.id,result:{}});
 if(m.method==='thread/start'||m.method==='thread/resume')send({id:m.id,result:{thread:{id:thread}}});
 if(m.method==='thread/list')send({id:m.id,result:{data:[{id:thread,name:'Test'}]}});
 if(m.method==='thread/read')send({id:m.id,result:{thread:{id:thread,turns:[]}}});
 if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'turn'}}});send({id:99,method:'item/commandExecution/requestApproval',params:{threadId:thread,command:'npm test'}})}
 if(m.id===99&&m.result){send({method:'item/agentMessage/delta',params:{delta:m.result.decision}});send({method:'turn/completed',params:{threadId:thread,turn:{status:'completed'}}})}
 });`;
 await writeFile(file,script);await chmod(file,0o755);
 try{
  const sessions=await listAgentSessions('codex',dir,file);assert.equal(sessions[0].id,id);
  assert.equal((await readAgentSession('codex',id,dir,file)).id,id);
  let output='',seen;
  await new Promise((resolve,reject)=>runCodex({workspace:dir,command:file,prompt:'Teste',onSession:s=>assert.equal(s,id),onText:t=>output+=t,onDecision:async d=>{seen=d;return {type:'allow'}},onDone:e=>e?reject(e):resolve()}));
  assert.equal(seen.kind,'approval');assert.equal(seen.input.command,'npm test');assert.equal(output,'accept');
 }finally{await rm(dir,{recursive:true,force:true});}
});
