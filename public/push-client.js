// Optional Web Push. The user must explicitly opt in on a paired device.
function pushSupported(env=window){return Boolean(env.isSecureContext && env.Notification && env.PushManager && env.navigator?.serviceWorker);}
async function enableBackgroundPush(api,env=window){
 if(!pushSupported(env))throw new Error('Dieses Gerät unterstützt Web-Push nicht oder hat ihn nicht freigeschaltet.');
 const permission=await env.Notification.requestPermission();
 if(permission!=='granted')throw new Error('Benachrichtigungen wurden nicht freigegeben.');
 const key=await api('/api/push/key');
 const registration=await env.navigator.serviceWorker.register('/sw.js');
 // Wait for activation; the worker never caches sensitive application data.
 let timer;try{await Promise.race([env.navigator.serviceWorker.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Der Benachrichtigungsdienst konnte nicht gestartet werden.')),8000);})]);}finally{clearTimeout(timer);}
 let subscription=await registration.pushManager.getSubscription();
 const base64=key.publicKey.replace(/-/g,'+').replace(/_/g,'/');
 const keyBytes=Uint8Array.from(env.atob(base64+'='.repeat((4-base64.length%4)%4)),character=>character.charCodeAt(0));
 if(subscription?.options?.applicationServerKey){const current=new Uint8Array(subscription.options.applicationServerKey);if(current.length!==keyBytes.length || current.some((value,index)=>value!==keyBytes[index])){await subscription.unsubscribe();subscription=null;}}
 if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes});
 await api('/api/push/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:subscription.toJSON()})});
}
async function disableBackgroundPush(api,env=window){
 if(!env.navigator?.serviceWorker)return;
 // Remove server-side delivery first, even if local unsubscribe later fails.
 await api('/api/push/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 const registration=await env.navigator.serviceWorker.getRegistration('/sw.js');
 const subscription=await registration?.pushManager.getSubscription();if(subscription)await subscription.unsubscribe();
}
