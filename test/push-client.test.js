import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({Uint8Array,setTimeout,clearTimeout});vm.runInContext(await readFile(new URL('../public/push-client.js',import.meta.url),'utf8'),context);
test('background push is opt-in, subscribes only after consent and can be disabled',async()=>{
 const calls=[];let unsubscribed=false;const key=Buffer.alloc(65,7).toString('base64url');const subscription={toJSON:()=>({endpoint:'https://fcm.googleapis.com/test',keys:{}}),unsubscribe:async()=>{unsubscribed=true;}};
 const registration={pushManager:{getSubscription:async()=>null,subscribe:async(options)=>{assert.equal(options.userVisibleOnly,true);assert.equal(options.applicationServerKey.length,65);return subscription;}}};
 const env={isSecureContext:true,Notification:{requestPermission:async()=>{calls.push('permission');return 'granted';}},PushManager:function(){},navigator:{serviceWorker:{register:async()=>registration,ready:Promise.resolve(registration),getRegistration:async()=>({pushManager:{getSubscription:async()=>subscription}})}},atob:value=>Buffer.from(value,'base64').toString('binary')};
 const api=async(url,options)=>{calls.push(url);return url==='/api/push/key'?{publicKey:key}:{ok:true};};
 await context.enableBackgroundPush(api,env);assert.deepEqual(calls.slice(0,3),['permission','/api/push/key','/api/push/subscription']);
 await context.disableBackgroundPush(api,env);assert.ok(unsubscribed);assert.equal(calls.at(-1),'/api/push/unsubscribe');
 env.Notification.requestPermission=async()=> 'denied';const before=calls.length;await assert.rejects(context.enableBackgroundPush(api,env),/not granted/);assert.equal(calls.length,before);
 assert.equal(context.pushSupported({}),false);
});
test('alert status combines device subscription with the paired server status',async()=>{
 const api=async()=>({enabled:true});
 const env={isSecureContext:true,Notification:{permission:'granted'},PushManager:function(){},navigator:{serviceWorker:{getRegistration:async()=>({pushManager:{getSubscription:async()=>({})}})}}};
 const status=await context.backgroundPushStatus(api,env);assert.equal(status.enabled,true);assert.equal(status.subscribed,true);assert.equal(status.permission,'granted');
 const calls=[];await context.disableBackgroundPush(async url=>calls.push(url),{});assert.deepEqual(calls,['/api/push/unsubscribe']);
});
