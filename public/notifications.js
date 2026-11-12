// Show currently pending decisions on startup; later, report only new transitions.
function taskNotices(previous, tasks) {
 const notices=[];
 for (const task of tasks) {
  const prior=previous?.get(task.id); let text='';
  if (task.pendingDecision && prior?.decision!==task.pendingDecision.id) text='Decision required';
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
 const completed=new Map(), dismissed=new Map();
 return {
  update(previous,tasks){
   const ids=new Set(tasks.map(task=>task.id));
   for(const id of completed.keys())if(!ids.has(id))completed.delete(id);
   for(const id of dismissed.keys())if(!ids.has(id))dismissed.delete(id);
   for(const task of tasks){
    if(dismissed.get(task.id)!==task.pendingDecision?.id)dismissed.delete(task.id);
    const prior=previous?.get(task.id);
    if(prior?.status==='running' && task.status!=='running')completed.set(task.id,task.status==='completed'?'Task completed':task.status==='failed'?'Task failed':'Task stopped');
   }
  },
  current(tasks){
   const task=tasks.find(item=>item.pendingDecision && dismissed.get(item.id)!==item.pendingDecision.id) || tasks.find(item=>completed.has(item.id));
   if(!task)return null;
   const decision=Boolean(task.pendingDecision && dismissed.get(task.id)!==task.pendingDecision.id);
   const status=decision?'Decision required':completed.get(task.id);
   const project=task.projectName || 'Project',title=(task.prompt || 'Untitled task').replace(/\s+/g,' ').trim().slice(0,100);
   return {taskId:task.id,decision,decisionId:decision?task.pendingDecision.id:null,text:`${task.agentName} · ${project} · ${status}\n${title}`};
  },
  dismiss(notice){if(!notice)return;if(notice.decision)dismissed.set(notice.taskId,notice.decisionId);else completed.delete(notice.taskId);}
 };
}
