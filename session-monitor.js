// Read imported external histories without resuming them or touching their approvals.
export function createSessionMonitor({tasks,readSnapshot,onUpdate,onActivity,intervalMs=10000,batchSize=5}) {
 let timer=null,busy=false,cursor=0;
 async function poll(){
  if(busy)return;busy=true;
  try{
   const groups=new Map();
   for(const task of tasks()){
    if(task.prompt!=='Importierte Sitzung'||Array.isArray(task.messages)||!task.sessionId||!['claude','codex'].includes(task.agentId))continue;
    const key=`${task.agentId}\u0000${task.sessionId}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(task);
   }
   const entries=[...groups.values()];if(!entries.length){cursor=0;return;}
   const batch=Array.from({length:Math.min(batchSize,entries.length)},(_,i)=>entries[(cursor+i)%entries.length]);cursor=(cursor+batch.length)%entries.length;
   for(const group of batch){
    const source=group[0];try{
     const snapshot=await readSnapshot(source);if(!snapshot||typeof snapshot.text!=='string'||!Array.isArray(snapshot.messages))throw new Error('Invalid snapshot');
     let changed=false,signal=false;
     for(const task of group){if(Array.isArray(task.messages)||task.prompt!=='Importierte Sitzung')continue;const different=task.output!==snapshot.text;changed||=different;signal||=different||task.snapshotSync?.status!=='watching';task.output=snapshot.text;task.snapshotMessages=snapshot.messages;const now=new Date().toISOString();task.snapshotSync={status:'watching',checkedAt:now,...((different||task.snapshotSync?.changedAt)?{changedAt:different?now:task.snapshotSync.changedAt}:{})};if(different)task.lastMessageAt=now;}
     if(signal)onUpdate(changed);if(changed)onActivity();
    }catch{let signal=false;for(const task of group)if(!Array.isArray(task.messages)){signal||=task.snapshotSync?.status!=='unavailable';task.snapshotSync={status:'unavailable',checkedAt:new Date().toISOString()};}if(signal)onUpdate(false);}
   }
  }finally{busy=false;}
 }
 return {poll,start(){if(timer)return;void poll();timer=setInterval(()=>void poll(),intervalMs);timer.unref?.();},stop(){if(timer)clearInterval(timer);timer=null;}};
}
