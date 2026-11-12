// Show currently pending decisions on startup; later, report only new transitions.
function taskNotices(previous, tasks) {
 const notices=[];
 for (const task of tasks) {
  const prior=previous?.get(task.id); let text='';
  if (task.pendingDecision && prior?.decision!==task.pendingDecision.id) text='Entscheidung erforderlich';
  else if (prior?.status==='running' && task.status!=='running') text=task.status==='completed'?'Aufgabe abgeschlossen':task.status==='failed'?'Aufgabe fehlgeschlagen':'Aufgabe gestoppt';
  if (text) notices.push({taskId:task.id,agentName:task.agentName,text});
 }
 return notices;
}

// Decisions need attention even when an unrelated task completes later.
function wearableNotice(previous,tasks) {
 const pending=tasks.filter(task=>task.pendingDecision);
 if(pending.length)return {taskId:pending[0].id,text:`${pending[0].agentName}: Entscheidung erforderlich${pending.length>1?` (${pending.length} offen)`:''}`,decision:true};
 const notice=taskNotices(previous,tasks).at(-1);
 return notice?{taskId:notice.taskId,text:`${notice.agentName}: ${notice.text}`,decision:false}:null;
}
