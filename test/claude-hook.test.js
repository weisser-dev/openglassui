import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {once} from 'node:events';
import os from 'node:os';import path from 'node:path';

test('external Claude permission is forwarded to a paired device and answered once',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'og-hook-')),port=22000+Math.floor(Math.random()*16000),base=`http://127.0.0.1:${port}`,gateway=`http://127.0.0.1:${port+1}`,session='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000002';
 await mkdir(path.join(dir,'data'));await writeFile(path.join(dir,'config.json'),JSON.stringify({workspace:dir,agents:[{id:'claude',name:'Claude',command:'claude',args:[],input:'stdin'}]}));await writeFile(path.join(dir,'data','tasks.json'),JSON.stringify([{id,agentId:'claude',agentName:'Claude',prompt:'Importierte Sitzung',status:'completed',output:'',sessionId:session,projectId:'default',createdAt:new Date().toISOString()}]));
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),OPENGLASS_CONFIG:path.join(dir,'config.json'),OPENGLASS_DATA_DIR:path.join(dir,'data')},stdio:'ignore'});const post=(url,body,headers={})=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 try{let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/state')).ok){ready=true;break;}}catch{}await delay(25);}assert.ok(ready);
 const pairing=await(await post(base+'/api/pairing',{url:'https://example.com'},{Origin:base})).json();const code=new URLSearchParams(new URL(pairing.url).hash.slice(1)).get('pair');const token=(await(await post(gateway+'/api/pair',{code})).json()).token;
 const pending=post(base+'/api/hooks/claude/permission',{hook_event_name:'PermissionRequest',session_id:session,tool_name:'Bash',tool_input:{command:'echo test'}},{Origin:base});let task;for(let i=0;i<100;i++){task=(await(await fetch(gateway+'/api/state',{headers:{Authorization:`Bearer ${token}`}})).json()).tasks.find(t=>t.id===id);if(task?.pendingDecision)break;await delay(25);}assert.equal(task.pendingDecision.toolName,'Bash');
 const chosen=await post(gateway+`/api/tasks/${id}/decision`,{decisionId:task.pendingDecision.id,type:'allow'},{Authorization:`Bearer ${token}`});assert.equal(chosen.status,200);assert.equal((await(await pending).json()).type,'allow');assert.equal((await post(gateway+`/api/tasks/${id}/decision`,{decisionId:task.pendingDecision.id,type:'allow'},{Authorization:`Bearer ${token}`})).status,409);
 }finally{if(child.exitCode===null&&child.signalCode===null){const done=once(child,'exit');child.kill('SIGTERM');await done;}await rm(dir,{recursive:true,force:true});}
});

test('Claude hook setup preserves existing settings and is idempotent',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'og-hook-settings-'));const file=path.join(dir,'settings.json');
 try{const original={model:'sonnet',hooks:{PermissionRequest:[{matcher:'Read',hooks:[{type:'command',command:'existing'}]}]}};await writeFile(file,JSON.stringify(original));const {enableClaudePermissionHook}=await import('../claude-hook-setup.js');await enableClaudePermissionHook({configDir:dir,node:'/path/node'});await enableClaudePermissionHook({configDir:dir,node:'/path/node'});const result=JSON.parse(await (await import('node:fs/promises')).readFile(file,'utf8'));assert.equal(result.model,'sonnet');assert.equal(result.hooks.PermissionRequest.length,2);assert.equal(result.hooks.PermissionRequest[0].hooks[0].command,'existing');assert.match(result.hooks.PermissionRequest[1].hooks[0].command,/claude-permission-hook\.js/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
