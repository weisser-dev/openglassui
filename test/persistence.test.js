import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

test('paired devices persist as hashes across restart and can be revoked individually',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'og-persist-')), port=String(20000+Math.floor(Math.random()*20000)), base=`http://127.0.0.1:${port}`, gateway=`http://127.0.0.1:${Number(port)+1}`;
 await writeFile(path.join(dir,'config.json'),JSON.stringify({workspace:dir,agents:[]}));let child;
 const start=async()=>{child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:port,OPENGLASS_CONFIG:path.join(dir,'config.json'),OPENGLASS_DATA_DIR:path.join(dir,'data')},stdio:'ignore'});for(let i=0;i<80;i++){try{if((await fetch(base+'/api/state')).ok)return;}catch{}await delay(25);}throw Error('server failed to start');};
 const stop=()=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill('SIGTERM');});
 const localPost=(url,body)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});
 const pair=async()=>{const created=await (await localPost('/api/pairing',{url:'https://example.com'})).json();const code=new URLSearchParams(new URL(created.url).hash.slice(1)).get('pair');return (await (await fetch(gateway+'/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})})).json()).token;};
 try{await start();const first=await pair(),second=await pair();assert.notEqual(first,second);const file=await readFile(path.join(dir,'data','devices.json'),'utf8');assert.ok(!file.includes(first)&&!file.includes(second));await stop();await start();assert.equal((await fetch(gateway+'/api/state',{headers:{Authorization:`Bearer ${first}`}})).status,200);let devices=(await (await fetch(base+'/api/devices')).json()).devices;assert.equal(devices.length,2);assert.ok(devices[0].lastSeenAt);assert.equal(devices[1].lastSeenAt,null);await stop();await start();devices=(await (await fetch(base+'/api/devices')).json()).devices;assert.ok(devices[0].lastSeenAt);await localPost(`/api/devices/${devices[0].id}/revoke`,{});assert.equal((await fetch(gateway+'/api/state',{headers:{Authorization:`Bearer ${first}`}})).status,401);assert.equal((await fetch(gateway+'/api/state',{headers:{Authorization:`Bearer ${second}`}})).status,200);
 }finally{if(child)await stop();await rm(dir,{recursive:true,force:true});}
});
