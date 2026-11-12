import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, mkdir, chmod } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import {createECDH,randomBytes} from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import http from 'node:http';

test('lokale Aufgaben starten und unberechtigte Anfragen ablehnen', async () => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'openglass-test-'));
 const port=String(20000+Math.floor(Math.random()*20000));
 const base=`http://127.0.0.1:${port}`;
 await mkdir(path.join(dir,'second'));
 await Promise.all(['third','fourth'].map(name=>mkdir(path.join(dir,name))));
 await writeFile(path.join(dir,'config.json'),JSON.stringify({workspace:dir,agents:[{id:'mock',name:'Test',command:process.execPath,args:['-e',"process.stdin.on('data', x => process.stdout.write('Antwort: '+x+' cwd:'+process.cwd()))"],input:'stdin'},{id:'mock2',name:'Test 2',command:process.execPath,args:[],input:'stdin'}]}));
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:port,OPENGLASS_CONFIG:path.join(dir,'config.json'),OPENGLASS_DATA_DIR:path.join(dir,'data')},stdio:'ignore'});
 try {
  let ready=false; for(let i=0;i<50;i++){try{await fetch(base+'/api/state');ready=true;break;}catch{await delay(50);}} assert.ok(ready);
  const setup=await (await fetch(base+'/api/setup')).json();assert.equal(setup.setup.complete,false);assert.equal(setup.agents[0].installed,true);
  const savedSetup=await fetch(base+'/api/setup',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({agent:'mock',agents:['mock','mock2'],projectId:'default',provider:'tailscale',complete:true,token:'must-not-persist'})});assert.equal(savedSetup.status,200);const setupFile=await readFile(path.join(dir,'data','setup.json'),'utf8');assert.equal(JSON.parse(setupFile).provider,'tailscale');assert.deepEqual(JSON.parse(setupFile).agents,['mock','mock2']);assert.doesNotMatch(setupFile,/must-not-persist/);
  assert.equal((await fetch(`http://127.0.0.1:${Number(port)+1}/api/setup`)).status,401);
  const bad=await fetch(base+'/api/tasks',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify({agentId:'mock',prompt:'Hallo'})}); assert.equal(bad.status,403);
  const response=await fetch(base+'/api/tasks',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({agentId:'mock',prompt:'Hallo'})}); assert.equal(response.status,201);
  let task; for(let i=0;i<50;i++){task=(await (await fetch(base+'/api/state')).json()).tasks[0];if(task.status!=='running')break;await delay(50);} assert.equal(task.status,'completed'); assert.match(task.output,/Antwort: Hallo/);
  const added=await fetch(base+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({name:'Zweites Projekt',path:path.join(dir,'second')})});assert.equal(added.status,201);const project=await added.json();
  const state=await (await fetch(base+'/api/state')).json(); assert.equal(state.projects.find(p=>p.id===project.id).name,'Zweites Projekt');
  const concurrent=await Promise.all(['third','fourth'].map(name=>fetch(base+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({name,path:path.join(dir,name)})})));assert.deepEqual(concurrent.map(r=>r.status),[201,201]);const savedProjects=JSON.parse(await readFile(path.join(dir,'data','projects.json'),'utf8'));assert.deepEqual(savedProjects.map(p=>p.name).sort(),['Zweites Projekt','fourth','third']);
  const secondTask=await (await fetch(base+'/api/tasks',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({agentId:'mock',projectId:project.id,prompt:'Zweites Projekt'})})).json();
  let secondResult;for(let i=0;i<50;i++){secondResult=(await (await fetch(base+'/api/state')).json()).tasks.find(t=>t.id===secondTask.id);if(secondResult?.status!=='running')break;await delay(50);}assert.equal(secondResult.status,'completed');assert.match(secondResult.output,/cwd:.*second/);assert.equal(secondResult.projectId,project.id);
  const invalid=await fetch(base+'/api/tasks',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({agentId:'mock',projectId:'unknown',prompt:'Hallo'})});assert.equal(invalid.status,400);
  const change=await fetch(base+'/api/changes?since=0');assert.equal(change.status,200);assert.ok((await change.json()).revision>0);
  const gateway=`http://127.0.0.1:${Number(port)+1}`;
  assert.equal((await fetch(gateway+'/api/state')).status,401);
  assert.equal((await fetch(gateway+'/api/tunnel')).status,401);
  const remoteHeaders={'X-Forwarded-For':'203.0.113.10'};
  assert.equal((await fetch(base+'/api/state',{headers:remoteHeaders})).status,401);
  assert.equal((await fetch(base+'/api/pairing',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({url:'https://example.com/prefix'})})).status,400);
  const pairResponse=await fetch(base+'/api/pairing',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({url:'https://example.com'})});
  assert.equal(pairResponse.status,200); const pair=await pairResponse.json(); assert.match(pair.deepLink,/^fb-viewapp:/);
  const code=new URLSearchParams(new URL(pair.url).hash.slice(1)).get('pair');
  const exchange=()=>fetch(base+'/api/pair',{method:'POST',headers:{...remoteHeaders,'Content-Type':'application/json'},body:JSON.stringify({code})});
  const exchanged=await exchange();assert.equal(exchanged.status,200);const {token}=await exchanged.json();assert.equal((await exchange()).status,401);
  assert.equal((await fetch(base+'/api/state',{headers:{...remoteHeaders,Authorization:`Bearer ${token}`}})).status,200);
  assert.equal((await fetch(gateway+'/api/state',{headers:{Authorization:`Bearer ${token}`}})).status,200);
  assert.equal((await fetch(gateway+'/api/projects',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Origin:base},body:JSON.stringify({name:'Bad',path:dir})})).status,403);
  assert.equal((await fetch(gateway+'/api/push/key')).status,401);
  const pushKey=await fetch(gateway+'/api/push/key',{headers:{Authorization:`Bearer ${token}`}});assert.equal(pushKey.status,200);assert.ok((await pushKey.json()).publicKey);
  const ecdh=createECDH('prime256v1');ecdh.generateKeys();const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/fixture',keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
  const pushPost=(url,data)=>fetch(gateway+url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await pushPost('/api/push/subscription',{subscription:{...subscription,endpoint:'https://127.0.0.1/private'}})).status,400);
  assert.equal((await pushPost('/api/push/subscription',{subscription})).status,200);
  const visibleDevices=await (await fetch(base+'/api/devices')).json();assert.equal(visibleDevices.devices[0].pushEnabled,true);assert.equal(JSON.stringify(visibleDevices).includes(subscription.endpoint),false);
  assert.equal((await pushPost('/api/push/unsubscribe',{})).status,200);
  const invalidSocket=new WebSocket(`ws://127.0.0.1:${Number(port)+1}/api/events`);const invalidClosed=new Promise(resolve=>{invalidSocket.once('open',()=>invalidSocket.send('null'));invalidSocket.once('close',resolve);});assert.equal(await invalidClosed,1008);assert.equal((await fetch(base+'/api/state')).status,200);
  const socket=new WebSocket(`ws://127.0.0.1:${Number(port)+1}/api/events`);
  const initialEvent=new Promise((resolve,reject)=>{socket.once('open',()=>socket.send(JSON.stringify({token})));socket.once('message',data=>resolve(JSON.parse(data)));socket.once('error',reject);});
  assert.ok(Number.isSafeInteger((await initialEvent).revision));
  const closed=new Promise(resolve=>socket.once('close',code=>resolve(code)));
  const deviceList=await (await fetch(base+'/api/devices')).json();assert.equal(deviceList.devices.length,1);assert.equal('tokenHash' in deviceList.devices[0],false);
  const deviceFile=await readFile(path.join(dir,'data','devices.json'),'utf8');assert.equal(deviceFile.includes(token),false);
  assert.equal((await fetch(gateway+'/api/devices',{headers:{Authorization:`Bearer ${token}`}})).status,403);
  await fetch(base+`/api/devices/${deviceList.devices[0].id}/revoke`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{}'});
  assert.equal(await closed,1008);
  assert.equal((await fetch(gateway+'/api/state',{headers:{Authorization:`Bearer ${token}`}})).status,401);
  const secondPair=await (await fetch(base+'/api/pairing',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({url:'https://example.com'})})).json();const code2=new URLSearchParams(new URL(secondPair.url).hash.slice(1)).get('pair');const token2=(await (await fetch(gateway+'/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code2})})).json()).token;
  assert.equal((await fetch(base+'/api/projects',{method:'POST',headers:{...remoteHeaders,Authorization:`Bearer ${token2}`,'Content-Type':'application/json'},body:JSON.stringify({name:'Bad',path:dir})})).status,403);
  assert.equal((await fetch(base+'/api/pairing',{method:'POST',headers:{...remoteHeaders,Authorization:`Bearer ${token2}`,'Content-Type':'application/json'},body:'{}'})).status,403);
  let slow;const slowResult=new Promise((resolve,reject)=>{slow=http.request(gateway+'/api/tasks',{method:'POST',headers:{Authorization:`Bearer ${token2}`,'Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});slow.on('error',reject);slow.write('{"agentId":"mock",');});await delay(50);
  await fetch(base+'/api/revoke',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{}'});
  slow.end('"prompt":"must not run"}');assert.equal(await slowResult,401);assert.equal((await (await fetch(base+'/api/state')).json()).tasks.some(t=>t.prompt==='must not run'),false);
  assert.equal((await fetch(base+'/api/state',{headers:{...remoteHeaders,Authorization:`Bearer ${token2}`}})).status,401);
 } finally {server.kill(); await rm(dir,{recursive:true,force:true});}
});

test('shutdown persists the stopped status of a running task',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'openglass-shutdown-'));const port=String(20000+Math.floor(Math.random()*20000));const base=`http://127.0.0.1:${port}`;
 await writeFile(path.join(dir,'config.json'),JSON.stringify({workspace:dir,agents:[{id:'mock',name:'Test',command:process.execPath,args:['-e','setInterval(()=>{},1000)'],input:'stdin'}]}));
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:port,OPENGLASS_CONFIG:path.join(dir,'config.json'),OPENGLASS_DATA_DIR:path.join(dir,'data')},stdio:'ignore'});
 try{let ready=false;for(let i=0;i<50;i++){try{await fetch(base+'/api/state');ready=true;break;}catch{await delay(50);}}assert.ok(ready);
  const response=await fetch(base+'/api/tasks',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({agentId:'mock',prompt:'Test'})});assert.equal(response.status,201);const task=await response.json();assert.equal(task.status,'running');
  const exited=once(server,'exit');server.kill('SIGTERM');const [code]=await exited;assert.equal(code,0);const saved=JSON.parse(await readFile(path.join(dir,'data','tasks.json'),'utf8'));assert.equal(saved.find(t=>t.id===task.id).status,'stopped');
 }finally{if(server.exitCode===null)server.kill();await rm(dir,{recursive:true,force:true});}
});

test('restart marks running tasks interrupted and discards stale approvals',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'openglass-restart-'));const port=String(20000+Math.floor(Math.random()*20000));const base=`http://127.0.0.1:${port}`;
 await mkdir(path.join(dir,'data'));await writeFile(path.join(dir,'config.json'),JSON.stringify({workspace:dir,agents:[]}));await writeFile(path.join(dir,'data','tasks.json'),JSON.stringify([{id:'12345678-1234-1234-1234-123456789abc',status:'running',pendingDecision:{id:'old',kind:'approval'},output:'Previously saved'}]));
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:port,OPENGLASS_CONFIG:path.join(dir,'config.json'),OPENGLASS_DATA_DIR:path.join(dir,'data')},stdio:'ignore'});
 try{let state;for(let i=0;i<50;i++){try{state=await (await fetch(base+'/api/state')).json();break;}catch{await delay(50);}}assert.ok(state);assert.equal(state.tasks[0].status,'interrupted');assert.equal(state.tasks[0].pendingDecision,undefined);assert.equal(state.tasks[0].output,'Previously saved');
  const response=await fetch(base+'/api/tasks/12345678-1234-1234-1234-123456789abc/decision',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({decisionId:'old',type:'allow'})});assert.equal(response.status,409);
 }finally{const exited=once(server,'exit');server.kill();await exited;await rm(dir,{recursive:true,force:true});}
});

test('a stopped Codex session cannot resume until its previous run settles',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'openglass-resume-'));const executable=path.join(dir,'codex');const port=String(20000+Math.floor(Math.random()*20000));const base=`http://127.0.0.1:${port}`;
 const script=`#!${process.execPath}
 const readline=require('node:readline');const send=x=>console.log(JSON.stringify(x));readline.createInterface({input:process.stdin}).on('line',s=>{const m=JSON.parse(s);if(m.method==='initialize')send({id:m.id,result:{}});if(m.method==='thread/list')send({id:m.id,result:{data:[{id:'12345678-1234-1234-1234-123456789abc',cwd:${JSON.stringify(dir)},name:'Fixture'}],nextCursor:null}});if(m.method==='thread/start'||m.method==='thread/resume')send({id:m.id,result:{thread:{id:'12345678-1234-1234-1234-123456789abc'}}});if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'turn'}}});send({method:'item/agentMessage/delta',params:{delta:'ready'}})}});`;
 await writeFile(executable,script);await chmod(executable,0o755);await writeFile(path.join(dir,'config.json'),JSON.stringify({workspace:dir,agents:[{id:'codex',name:'Codex',command:executable,args:[],resumeArgs:[],input:'stdin'}]}));
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:port,OPENGLASS_CONFIG:path.join(dir,'config.json'),OPENGLASS_DATA_DIR:path.join(dir,'data')},stdio:'ignore'});const post=(url,data)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(data)});
 try{let ready=false;for(let i=0;i<50;i++){try{await fetch(base+'/api/state');ready=true;break;}catch{await delay(50);}}assert.ok(ready);const discovery=await post('/api/sessions/discover',{agent:'codex'});assert.equal(discovery.status,200);assert.equal((await discovery.json()).sessions[0].projectId,'default');const task=await (await post('/api/tasks',{agentId:'codex',prompt:'Test'})).json();
  for(let i=0;i<50;i++){const state=await (await fetch(base+'/api/state')).json();if(state.tasks[0]?.output.includes('ready'))break;await delay(25);}
  assert.equal((await post(`/api/tasks/${task.id}/stop`,{})).status,200);assert.equal((await post(`/api/tasks/${task.id}/resume`,{prompt:'Continue'})).status,409);await delay(1100);assert.equal((await post(`/api/tasks/${task.id}/resume`,{prompt:'Continue'})).status,200);
 }finally{const exited=once(server,'exit');server.kill();await exited;await rm(dir,{recursive:true,force:true});}
});
