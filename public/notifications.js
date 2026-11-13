// Show currently pending decisions on startup; later, report only new transitions.
function taskNotices(previous, tasks) {
 const notices=[];
 for (const task of tasks) {
  const prior=previous?.get(task.id); let text='';
  if (task.pendingDecision && prior?.decision!==task.pendingDecision.id) text='Decision required';
  else if (prior && task.snapshotSync?.changedAt && prior.snapshot!==task.snapshotSync.changedAt) text='New activity';
  else if (prior?.status==='running' && task.status!=='running') text=task.status==='completed'?'Task completed':task.status==='failed'?'Task failed':'Task stopped';
  if (text) notices.push({taskId:task.id,agentName:task.agentName,text});
 }
 return notices;
}

// Decisions need attention even when an unrelated task completes later.
function wearableNotice(previous,tasks) {
 const pending=tasks.filter(task=>task.pendingDecision);
 if(pending.length)return {taskId:pending[0].id,text:`${pending[0].agentName}: Decision required${pending.length>1?` (${pending.length} pending)`:''}`,decision:true};
 const notice=taskNotices(previous,tasks).at(-1);
 return notice?{taskId:notice.taskId,text:`${notice.agentName}: ${notice.text}`,decision:false}:null;
}

// Keep notices until opened, without treating an unresolved decision as approved.
function createWearableNotices(storage=null) {
 const dismissed=new Map(),key=task=>task.sessionId?`${task.agentId}\u0000${task.sessionId}`:`task\u0000${task.id}`;
 const storageKey='openglass-unread-v2';let saved={};
 try{const data=JSON.parse(storage?.getItem(storageKey)||'{}');if(data&&typeof data==='object'&&!Array.isArray(data))saved=data;}catch{}
 const records=new Map(Object.entries(saved));
 function reload(){if(!storage)return;try{const data=JSON.parse(storage.getItem(storageKey)||'{}');if(!data||typeof data!=='object'||Array.isArray(data))return;records.clear();for(const [id,value] of Object.entries(data))records.set(id,value);}catch{}}
 function persist(){try{storage?.setItem(storageKey,JSON.stringify(Object.fromEntries(records)));}catch{}}
 // Store short fingerprints only, never message contents or credentials.
 const fingerprint=text=>{let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return `${text.length}:${hash>>>0}`;};
 function messages(task){const rows=Array.isArray(task.messages)?task.messages:task.snapshotMessages;if(Array.isArray(rows))return rows.filter(row=>row?.role==='assistant'&&typeof row.text==='string'&&row.text.trim()).slice(-100).map(row=>fingerprint(row.text));return task.output?[fingerprint(task.output)]:[];}
 return {
  update(previous,tasks){
   reload();const valid=new Set(tasks.map(key)),seen=new Set();for(const id of records.keys())if(!valid.has(id))records.delete(id);for(const id of dismissed.keys())if(!valid.has(id))dismissed.delete(id);
   for(const task of tasks){const id=key(task);if(seen.has(id))continue;seen.add(id);if(dismissed.get(id)!==task.pendingDecision?.id)dismissed.delete(id);
    const current=messages(task),old=records.get(id);if(!old||!Array.isArray(old.messages)){records.set(id,{messages:current,unread:0});continue;}
    const before=old.messages;let count=Number.isSafeInteger(old.unread)&&old.unread>0?old.unread:0;
    if(current.length && JSON.stringify(current)!==JSON.stringify(before)){
     // Histories may be reloaded with more older messages. Only count entries
     // after a known last message; never treat prepended history as new.
     const last=before.at(-1),anchor=last?current.lastIndexOf(last):-1;
     if(anchor>=0){const added=current.length-anchor-1;if(added>0)count+=added;}
     else if(before.length&&count===0)count=1;
     else if(!before.length)count+=current.length;
    }
    records.set(id,{messages:current,unread:count});
   }
   persist();
  },
  current(tasks,translate=value=>value){const task=tasks.find(item=>item.pendingDecision&&dismissed.get(key(item))!==item.pendingDecision.id);if(!task)return null;const project=task.projectName||'Project',title=(task.title||(task.prompt==='Importierte Sitzung'?'Imported session':task.prompt)||'Untitled task').replace(/\s+/g,' ').trim().slice(0,100);return {taskId:task.id,decision:true,decisionId:task.pendingDecision.id,text:`${task.agentName} · ${project} · ${translate('Decision required')}\n${title}`};},
  count(task){return records.get(key(task))?.unread||0;},
  reload,
  open(task){if(!task)return;reload();const id=key(task);records.set(id,{messages:messages(task),unread:0});if(task.pendingDecision)dismissed.set(id,task.pendingDecision.id);persist();},
  dismiss(notice,tasks=[]){if(!notice)return;this.open(tasks.find(item=>item.id===notice.taskId));}
 };
}
