import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createECDH,randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createPushService,validatePushSubscription} from '../push.js';

const key=createECDH('prime256v1');key.generateKeys();
const subscription=endpoint=>({endpoint,keys:{p256dh:key.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}});
test('web push only accepts known HTTPS providers and valid browser keys',()=>{
 assert.ok(validatePushSubscription(subscription('https://fcm.googleapis.com/fcm/send/example')));
 assert.ok(validatePushSubscription(subscription('https://web.push.apple.com/example')));
 for(const endpoint of ['http://fcm.googleapis.com/x','https://fcm.googleapis.com.evil.test/x','https://127.0.0.1/x','https://fcm.googleapis.com:8443/x','https://user@fcm.googleapis.com/x'])assert.throws(()=>validatePushSubscription(subscription(endpoint)));
 assert.throws(()=>validatePushSubscription({endpoint:'https://fcm.googleapis.com/x',keys:{p256dh:'bad',auth:'bad'}}));
});
test('push opt-in is persisted, sends only generic events and removes expired subscriptions',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'og-push-'));const device={id:'device'},devices=new Map([[device.id,device]]);const calls=[];let saves=0;
 const transport={generateVAPIDKeys:()=>({publicKey:key.getPublicKey().toString('base64url'),privateKey:key.getPrivateKey().toString('base64url')}),sendNotification:async(...args)=>{calls.push(args);}};
 try{const service=await createPushService({dataDir:dir,devices,saveDevices:async()=>{saves++},transport});assert.equal(service.publicKey,key.getPublicKey().toString('base64url'));assert.equal((await readFile(path.join(dir,'push-keys.json'),'utf8')).includes('privateKey'),true);
  await service.subscribe(device,subscription('https://fcm.googleapis.com/fcm/send/example'));await service.notify('decision');assert.equal(calls.length,1);assert.deepEqual(JSON.parse(calls[0][1]),{kind:'decision'});assert.equal(calls[0][2].TTL,60);assert.equal(calls[0][1].includes('project'),false);assert.equal(device.pushDelivery.status,'accepted');
  device.push=subscription('https://127.0.0.1/private');await service.notify('failed');assert.equal(calls.length,1);assert.equal(device.pushDelivery.status,'failed');await service.subscribe(device,subscription('https://fcm.googleapis.com/fcm/send/example'));

  await service.notify('unknown');assert.equal(calls.length,1);transport.sendNotification=async()=>{const error=new Error('gone');error.statusCode=410;throw error;};await service.notify('completed');assert.equal(device.push,undefined);assert.equal(device.pushDelivery.status,'expired');assert.ok(saves>=2);
 }finally{await rm(dir,{recursive:true,force:true});}
});
