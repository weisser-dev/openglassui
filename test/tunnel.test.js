import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createTunnelManager} from '../tunnel.js';

test('tunnel accepts only the expected provider URL and stops only its child',()=>{
 let process;const calls=[];const manager=createTunnelManager({port:4173,spawnProcess:(command,args)=>{calls.push([command,args]);process=new EventEmitter();process.stdout=new EventEmitter();process.stderr=new EventEmitter();process.kill=()=>{process.killed=true};return process;}});
 assert.equal(manager.start('cloudflare').status,'starting');assert.equal(calls[0][0],'cloudflared');process.stderr.emit('data','https://bad.example https://bad.trycloudflare.com.evil.example ');assert.equal(manager.status().url,null);process.stderr.emit('data',' https://test-example.trycloudflare.com ');assert.equal(manager.status().url,'https://test-example.trycloudflare.com');assert.throws(()=>manager.start('ngrok'));const old=process;manager.stop();assert.equal(old.killed,true);old.stderr.emit('data',' https://stale.trycloudflare.com ');assert.equal(manager.status().status,'stopped');manager.start('ngrok');old.stderr.emit('data',' https://stale.trycloudflare.com ');assert.equal(manager.status().provider,'ngrok');assert.equal(manager.status().url,null);manager.stop();
});

test('private Tailscale Serve cannot be started',()=>{const manager=createTunnelManager({port:4174});assert.throws(()=>manager.start('tailscale'),/Unknown tunnel provider/);});

test('macOS uses the Tailscale app executable instead of an orphaning shell wrapper',()=>{
 let child;const manager=createTunnelManager({port:4174,platform:'darwin',exists:()=>true,spawnProcess:(command)=>{assert.equal(command,'/Applications/Tailscale.app/Contents/MacOS/Tailscale');child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};return child;}});manager.start('tailscale-funnel');manager.stop();
});

test('Tailscale Funnel starts a public stable hostname for the gateway',()=>{
 let child;const manager=createTunnelManager({port:4174,platform:'linux',spawnProcess:(command,args)=>{assert.equal(command,'tailscale');assert.deepEqual(args,['funnel','http://127.0.0.1:4174']);child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};return child;}});
 manager.start('tailscale-funnel');child.stdout.emit('data','Available on the internet: https://desktop.tail123.ts.net\n');assert.equal(manager.status().url,'https://desktop.tail123.ts.net');assert.equal(manager.status().status,'running');manager.stop();
});
