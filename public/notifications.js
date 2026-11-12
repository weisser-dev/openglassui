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
