import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,chmod,rm} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import os from 'node:os';
test('auto-start requires completed setup and explicit opt-in',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'og-auto-tunnel-')),data=path.join(dir,'data'),bin=path.join(dir,'bin');await mkdir(data);await mkdir(bin);
 const fake=path.join(bin,'cloudflared');await writeFile(fake,`#!${process.execPath}\nprocess.stderr.write('https://test-only.trycloudflare.com\\n');setInterval(()=>{},1000);`);await chmod(fake,0o755);
 const config=path.join(dir,'config.json');await writeFile(config,JSON.stringify({workspace:dir,agents:[]}));const port=String(22000+Math.floor(Math.random()*15000)),base=`http://127.0.0.1:${port}`;let child;
 async function start(complete,autoStartTunnel){await writeFile(path.join(data,'setup.json'),JSON.stringify({provider:'cloudflare',complete,autoStartTunnel}));child=spawn(process.execPath,['server.js'],{env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,PORT:port,OPENGLASS_CONFIG:config,OPENGLASS_DATA_DIR:data},stdio:'ignore'});for(let i=0;i<80;i++){try{const response=await fetch(base+'/api/tunnel');if(response.ok)return;}catch{}await delay(25);}throw Error('server failed to start');}
 async function stop(){if(!child||child.exitCode!==null)return;const done=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await done;}
 try{await start(true,false);await delay(150);assert.equal((await (await fetch(base+'/api/tunnel')).json()).status,'stopped');await stop();await start(true,true);let status;for(let i=0;i<400;i++){status=await (await fetch(base+'/api/tunnel')).json();if(status.status==='running')break;await delay(25);}assert.equal(status.url,'https://test-only.trycloudflare.com');await stop();await start(false,true);await delay(150);assert.equal((await (await fetch(base+'/api/tunnel')).json()).status,'stopped');}finally{await stop();await rm(dir,{recursive:true,force:true});}
});

test('legacy private Serve settings migrate without enabling a public tunnel',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'og-legacy-')),data=path.join(dir,'data');await mkdir(data);const config=path.join(dir,'config.json');await writeFile(config,JSON.stringify({workspace:dir,agents:[]}));await writeFile(path.join(data,'setup.json'),JSON.stringify({provider:'tailscale',complete:true,autoStartTunnel:true,publicUrl:'https://private.example'}));const port=String(22000+Math.floor(Math.random()*15000)),base=`http://127.0.0.1:${port}`;const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:port,OPENGLASS_CONFIG:config,OPENGLASS_DATA_DIR:data},stdio:'ignore'});
 try{let setup;for(let i=0;i<100;i++){try{const response=await fetch(base+'/api/setup');if(response.ok){setup=(await response.json()).setup;break;}}catch{}await delay(25);}assert.ok(setup);assert.equal(setup.provider,'external');assert.equal(setup.autoStartTunnel,false);assert.equal(setup.publicUrl,'https://private.example');assert.equal(setup.connectionMigration,'tailscale-serve-removed');assert.equal((await(await fetch(base+'/api/tunnel')).json()).status,'stopped');}finally{if(child.exitCode===null){const done=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await done;}await rm(dir,{recursive:true,force:true});}
});
