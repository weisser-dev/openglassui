import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

test('lokale Aufgaben starten und unberechtigte Anfragen ablehnen', async () => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'openglass-test-'));
 const port=String(20000+Math.floor(Math.random()*20000));
 const base=`http://127.0.0.1:${port}`;
 await writeFile(path.join(dir,'config.json'),JSON.stringify({workspace:dir,agents:[{id:'mock',name:'Test',command:process.execPath,args:['-e',"process.stdin.on('data', x => process.stdout.write('Antwort: '+x))"],input:'stdin'}]}));
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:port,OPENGLASS_CONFIG:path.join(dir,'config.json'),OPENGLASS_DATA_DIR:path.join(dir,'data')},stdio:'ignore'});
 try {
  let ready=false; for(let i=0;i<50;i++){try{await fetch(base+'/api/state');ready=true;break;}catch{await delay(50);}} assert.ok(ready);
  const bad=await fetch(base+'/api/tasks',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify({agentId:'mock',prompt:'Hallo'})}); assert.equal(bad.status,403);
  const response=await fetch(base+'/api/tasks',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({agentId:'mock',prompt:'Hallo'})}); assert.equal(response.status,201);
  let task; for(let i=0;i<50;i++){task=(await (await fetch(base+'/api/state')).json()).tasks[0];if(task.status!=='running')break;await delay(50);} assert.equal(task.status,'completed'); assert.match(task.output,/Antwort: Hallo/);
  const remoteHeaders={'X-Forwarded-For':'203.0.113.10'};
  assert.equal((await fetch(base+'/api/state',{headers:remoteHeaders})).status,401);
  const pairResponse=await fetch(base+'/api/pairing',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({url:'https://example.com'})});
  assert.equal(pairResponse.status,200); const pair=await pairResponse.json(); assert.match(pair.deepLink,/^fb-viewapp:/);
  const code=new URLSearchParams(new URL(pair.url).hash.slice(1)).get('pair');
  const exchange=()=>fetch(base+'/api/pair',{method:'POST',headers:{...remoteHeaders,'Content-Type':'application/json'},body:JSON.stringify({code})});
  const exchanged=await exchange();assert.equal(exchanged.status,200);const {token}=await exchanged.json();assert.equal((await exchange()).status,401);
  assert.equal((await fetch(base+'/api/state',{headers:{...remoteHeaders,Authorization:`Bearer ${token}`}})).status,200);
  assert.equal((await fetch(base+'/api/pairing',{method:'POST',headers:{...remoteHeaders,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'})).status,403);
  await fetch(base+'/api/revoke',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{}'});
  assert.equal((await fetch(base+'/api/state',{headers:{...remoteHeaders,Authorization:`Bearer ${token}`}})).status,401);
 } finally {server.kill(); await rm(dir,{recursive:true,force:true});}
});
