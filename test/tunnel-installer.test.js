import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createCloudflaredInstaller} from '../tunnel-installer.js';
test('installer runs only the fixed cloudflared Homebrew formula after explicit start',()=>{
 let child,calls=0;const installer=createCloudflaredInstaller({platform:'darwin',spawnProcess:(command,args,options)=>{calls++;assert.equal(command,'brew');assert.deepEqual(args,['install','cloudflared']);assert.equal(options.shell,false);child=new EventEmitter();return child;}});
 assert.equal(calls,0);assert.equal(installer.status().status,'idle');assert.equal(installer.start().status,'installing');assert.throws(()=>installer.start(),/already running/);child.emit('close',0);assert.equal(installer.status().status,'completed');
 const unsupported=createCloudflaredInstaller({platform:'linux',spawnProcess:()=>{throw Error('must not run')}});assert.throws(()=>unsupported.start(),/macOS/);
});
test('installer reports failures without exposing process output',()=>{
 let child;const installer=createCloudflaredInstaller({platform:'darwin',spawnProcess:()=>child=new EventEmitter()});installer.start();child.emit('error',new Error('private'));assert.equal(installer.status().status,'failed');assert.doesNotMatch(installer.status().error,/private/);
});
