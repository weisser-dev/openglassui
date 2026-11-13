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
function createWearableNotices() {
 const unread=new Map(), dismissed=new Map();
 const key=task=>task.sessionId?`${task.agentId}\u0000${task.sessionId}`:`task\u0000${task.id}`;
 return {
  update(previous,tasks){
   const valid=new Set(tasks.map(key)),seen=new Set();
   for(const id of unread.keys())if(!valid.has(id))unread.delete(id);
   for(const id of dismissed.keys())if(!valid.has(id))dismissed.delete(id);
   for(const task of tasks){
    const id=key(task),prior=previous?.get(task.id);
    if(dismissed.get(id)!==task.pendingDecision?.id)dismissed.delete(id);
    const activity=prior&&((task.snapshotSync?.changedAt&&prior.snapshot!==task.snapshotSync.changedAt)||(prior.status==='running'&&task.status!=='running'));
    if(activity&&!seen.has(id)){unread.set(id,(unread.get(id)||0)+1);seen.add(id);}
   }
  },
  current(tasks,translate=value=>value){
   const task=tasks.find(item=>item.pendingDecision&&dismissed.get(key(item))!==item.pendingDecision.id);if(!task)return null;
   const project=task.projectName||'Project',title=(task.title||(task.prompt==='Importierte Sitzung'?'Imported session':task.prompt)||'Untitled task').replace(/\s+/g,' ').trim().slice(0,100);
   return {taskId:task.id,decision:true,decisionId:task.pendingDecision.id,text:`${task.agentName} · ${project} · ${translate('Decision required')}\n${title}`};
  },
  count(task){return unread.get(key(task))||0;},
  open(task){if(!task)return;unread.delete(key(task));if(task.pendingDecision)dismissed.set(key(task),task.pendingDecision.id);},
  dismiss(notice,tasks=[]){if(!notice)return;const task=tasks.find(item=>item.id===notice.taskId);if(task)this.open(task);}
 };
}
