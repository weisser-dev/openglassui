import * as webpush from 'web-push';
import { readFile, writeFile } from 'node:fs/promises';
import { createECDH, timingSafeEqual } from 'node:crypto';
import path from 'node:path';

// Only known browser-vendor push services are accepted. Never fetch a URL
// supplied by a client outside this list, even if the client is paired.
export function validatePushSubscription(subscription) {
 if(!subscription || typeof subscription!=='object' || typeof subscription.endpoint!=='string' || subscription.endpoint.length>2048)throw new Error('Ungültiges Push-Abonnement.');
 let endpoint;try{endpoint=new URL(subscription.endpoint);}catch{throw new Error('Ungültiger Push-Endpunkt.');}
 const host=endpoint.hostname.toLowerCase();const allowed=host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host==='web.push.apple.com'||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com');
 if(endpoint.protocol!=='https:'||!allowed||endpoint.username||endpoint.password||endpoint.port&&endpoint.port!=='443'||endpoint.hash)throw new Error('Push-Anbieter wird nicht unterstützt.');
 const keys=subscription.keys;
 const decode=(value,size)=>typeof value==='string'&&/^[A-Za-z0-9_-]+={0,2}$/.test(value)&&Buffer.from(value,'base64url').length===size;
 if(!keys||!decode(keys.p256dh,65)||!decode(keys.auth,16)||Buffer.from(keys.p256dh,'base64url')[0]!==4)throw new Error('Ungültige Push-Schlüssel.');
 return {endpoint:endpoint.href,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}

export async function createPushService({dataDir,devices,saveDevices,transport=webpush}) {
 const keyPath=path.join(dataDir,'push-keys.json');let keys;
 try{keys=JSON.parse(await readFile(keyPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;keys=transport.generateVAPIDKeys();await writeFile(keyPath,JSON.stringify(keys),{mode:0o600,flag:'wx'});}
 try{if(typeof keys.publicKey!=='string'||typeof keys.privateKey!=='string')throw new Error();const publicKey=Buffer.from(keys.publicKey,'base64url'),privateKey=Buffer.from(keys.privateKey,'base64url');if(publicKey.length!==65||privateKey.length!==32)throw new Error();const ecdh=createECDH('prime256v1');ecdh.setPrivateKey(privateKey);if(!timingSafeEqual(publicKey,ecdh.getPublicKey()))throw new Error();}catch{throw new Error('Ungültige lokale Push-Konfiguration.');}
 const vapidDetails={subject:'https://github.com/weisser-dev/openglassui',publicKey:keys.publicKey,privateKey:keys.privateKey};
 return {
  publicKey:keys.publicKey,
  async subscribe(device,raw){const previous=device.push,previousDelivery=device.pushDelivery;device.push=validatePushSubscription(raw);delete device.pushDelivery;try{await saveDevices();}catch(error){device.push=previous;device.pushDelivery=previousDelivery;throw error;}},
  async unsubscribe(device){const previous=device.push,previousDelivery=device.pushDelivery;delete device.push;delete device.pushDelivery;try{await saveDevices();}catch(error){device.push=previous;device.pushDelivery=previousDelivery;throw error;}},
  async notify(kind){
   if(!['decision','completed','failed'].includes(kind))return;
   // Deliberately omit prompts, project names, paths, and agent output.
   const payload=JSON.stringify({kind});let changed=false;
   await Promise.all([...devices.values()].filter(device=>device.push).map(async device=>{const subscription=device.push;let status='accepted';try{const safeSubscription=validatePushSubscription(subscription);await transport.sendNotification(safeSubscription,payload,{vapidDetails,TTL:60,timeout:8000});}catch(error){status=(error.statusCode===404||error.statusCode===410)?'expired':'failed';}if(device.push===subscription && devices.get(device.id)===device){device.pushDelivery={status,at:new Date().toISOString()};if(status==='expired')delete device.push;changed=true;}}));
   if(changed)await saveDevices();
  }
 };
}
