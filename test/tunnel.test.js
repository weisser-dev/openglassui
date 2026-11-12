import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createTunnelManager} from '../tunnel.js';

test('tunnel accepts only the expected provider URL and stops only its child',()=>{
 let process;const calls=[];const manager=createTunnelManager({port:4173,spawnProcess:(command,args)=>{calls.push([command,args]);process=new EventEmitter();process.stdout=new EventEmitter();process.stderr=new EventEmitter();process.kill=()=>{process.killed=true};return process;}});
 assert.equal(manager.start('cloudflare').status,'starting');assert.equal(calls[0][0],'cloudflared');process.stderr.emit('data','https://bad.example https://bad.trycloudflare.com.evil.example ');assert.equal(manager.status().url,null);process.stderr.emit('data',' https://test-example.trycloudflare.com ');assert.equal(manager.status().url,'https://test-example.trycloudflare.com');assert.throws(()=>manager.start('ngrok'));const old=process;manager.stop();assert.equal(old.killed,true);old.stderr.emit('data',' https://stale.trycloudflare.com ');assert.equal(manager.status().status,'stopped');manager.start('ngrok');old.stderr.emit('data',' https://stale.trycloudflare.com ');assert.equal(manager.status().provider,'ngrok');assert.equal(manager.status().url,null);manager.stop();
});
