const $ = s => document.querySelector(s);
let state, selected = null, rendered = '', observedTasks = null;
const statusText = {running:'LÄUFT', completed:'FERTIG', failed:'FEHLGESCHLAGEN', stopped:'GESTOPPT'};
function el(tag, className, text) { const e = document.createElement(tag); if (className) e.className=className; if (text !== undefined) e.textContent=text; return e; }
async function refresh(force = false) {
  try {
    const r = await fetch('/api/state'); state = await r.json();
    if (window.Notification && Notification.permission==='granted') for(const notice of taskNotices(observedTasks,state.tasks)) new Notification('OpenGlassUI',{body:`${notice.agentName}: ${notice.text}`});
    observedTasks=new Map(state.tasks.map(task=>[task.id,{status:task.status,decision:task.pendingDecision?.id}]));
    if (!$('#agent').options.length) for (const a of state.agents) { const o=el('option','',a.name); o.value=a.id; $('#agent').append(o); }
    const projectSelect=$('#project'); const projectValue=projectSelect.value;
    if (JSON.stringify([...projectSelect.options].map(o=>[o.value,o.textContent]))!==JSON.stringify(state.projects.map(p=>[p.id,p.name]))) { projectSelect.replaceChildren(); for(const project of state.projects){const option=el('option','',project.name);option.value=project.id;projectSelect.append(option);} if([...projectSelect.options].some(o=>o.value===projectValue))projectSelect.value=projectValue; }
    const projectList=$('#projects-list');const listSignature=JSON.stringify(state.projects);if(projectList.dataset.signature!==listSignature && !projectList.contains(document.activeElement)){projectList.dataset.signature=listSignature;projectList.replaceChildren();for(const project of state.projects){const row=el('div','device-row');row.append(el('span','',project.name));if(project.id!=='default'){const remove=el('button','stop','Entfernen');remove.type='button';remove.onclick=async()=>{if(!confirm('Projekt aus OpenGlassUI entfernen? Die Dateien bleiben erhalten. Frühere Aufgaben können ohne erneute Einrichtung nicht fortgesetzt werden.'))return;const response=await fetch(`/api/projects/${project.id}/remove`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const result=await response.json();if(!response.ok)alert(result.error);await refresh(true);};row.append(remove);}projectList.append(row);}}
    window.renderUsageOverview($('#usage-overview'),state.tasks);
    $('#workspace').textContent=state.workspace; $('#count').textContent=state.tasks.length;
    const container=$('#tasks');
    if (!state.tasks.length) return;
    if (selected === null || (selected && !state.tasks.some(t=>t.id===selected))) selected=state.tasks[0].id;
    const signature=JSON.stringify([selected,state.tasks]);
    if (!force && signature===rendered) return;
    if (!force && container.contains(document.activeElement) && ['TEXTAREA','INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName) && !document.activeElement.dataset.task) return;
    rendered=signature;
    const openId=document.activeElement?.dataset?.task;
    container.replaceChildren();
    for (const task of state.tasks) {
      const card=el('article','task'); const button=el('button','task-head'); button.type='button'; button.dataset.task=task.id; button.setAttribute('aria-expanded', String(selected===task.id));
      const title=el('div',''); title.append(el('span','agent-label',task.agentName),el('strong','task-prompt',task.prompt));
      button.append(title,el('span','status '+task.status,task.pendingDecision?'ENTSCHEIDUNG':statusText[task.status] || task.status));
      button.onclick=()=>{selected=selected===task.id?'':task.id; refresh(true);}; card.append(button);
      if (selected===task.id) { const details=el('div','task-details'); if(task.events?.length)details.append(window.renderTaskEvents(task.events)); if(task.usage)details.append(el('pre','usage',window.formatUsage(task.usage))); if(task.pendingDecision)details.append(window.decisionUI(task,async (url,data)=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)alert(result.error);refresh(true);})); const out=el('pre','output',task.output || 'Warte auf Ausgabe …'); details.append(out); if(task.status==='running'){const stop=el('button','stop','Aufgabe stoppen'); stop.onclick=async()=>{await fetch(`/api/tasks/${task.id}/stop`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); refresh(true);};details.append(stop);} else if(task.sessionId && state.projects.some(p=>p.id===(task.projectId || 'default'))) {const form=el('form','follow'); const input=el('textarea'); input.placeholder='Folgeanweisung …'; input.required=true; const send=el('button','primary','Sitzung fortsetzen ↗'); send.type='submit'; form.append(input,send); form.onsubmit=async e=>{e.preventDefault(); const r=await fetch(`/api/tasks/${task.id}/resume`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:input.value})}); const result=await r.json(); if(!r.ok)alert(result.error);else refresh(true);}; details.append(form);} card.append(details); }
      container.append(card);
    }
    if(openId) container.querySelector(`[data-task="${CSS.escape(openId)}"]`)?.focus({preventScroll:true});
  } catch { $('.connection').textContent='VERBINDUNG UNTERBROCHEN'; }
}
$('#task-form').addEventListener('submit', async e=>{ e.preventDefault(); const button=e.currentTarget.querySelector('button'); button.disabled=true; try { const r=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agentId:$('#agent').value,projectId:$('#project').value,prompt:$('#prompt').value})}); const result=await r.json(); if(!r.ok) throw new Error(result.error); selected=result.id; $('#prompt').value=''; await refresh(true); } catch(err){alert(err.message);} finally {button.disabled=false;} });
refresh(); setInterval(refresh,2000);

$('#pair-form').addEventListener('submit', async e => { e.preventDefault(); try { const r=await fetch('/api/pairing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:$('#public-url').value})}); const data=await r.json(); if(!r.ok) throw new Error(data.error); $('#pair-qr').src=data.qr; $('#pair-link').href=data.deepLink; $('#pair-result').hidden=false; } catch(error) { alert(error.message); } });
$('#revoke').onclick=async()=>{ await fetch('/api/revoke',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); $('#pair-result').hidden=true; await loadDevices(); };

$('#project-form').addEventListener('submit',async e=>{e.preventDefault();try{const response=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#project-name').value,path:$('#project-path').value})});const result=await response.json();if(!response.ok)throw new Error(result.error);$('#project-name').value='';$('#project-path').value='';await refresh(true);$('#project').value=result.id;}catch(error){alert(error.message);}});

async function tunnelStatus(){try{const response=await fetch('/api/tunnel');const data=await response.json();if(!response.ok)throw new Error(data.error);$('#tunnel-status').textContent=data.status==='running'?'Tunnel aktiv: '+data.url:data.status==='starting'?'Tunnel wird gestartet …':data.status==='failed'?data.error:'Kein Tunnel über OpenGlassUI gestartet.';if(data.url)$('#public-url').value=data.url;}catch(error){$('#tunnel-status').textContent=error.message;}}
$('#tunnel-start').onclick=async()=>{try{const response=await fetch('/api/tunnel/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:$('#tunnel-provider').value})});const data=await response.json();if(!response.ok)throw new Error(data.error);await tunnelStatus();}catch(error){$('#tunnel-status').textContent=error.message;}};
$('#tunnel-stop').onclick=async()=>{await fetch('/api/tunnel/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});await tunnelStatus();};
tunnelStatus();setInterval(tunnelStatus,3000);

$('#desktop-notifications').onclick=async()=>{if(!('Notification' in window)){alert('Desktop-Benachrichtigungen werden in diesem Browser nicht unterstützt.');return;}const permission=await Notification.requestPermission();$('#desktop-notifications').textContent=permission==='granted'?'Desktop-Hinweise aktiviert':'Desktop-Hinweise nicht aktiviert';};

let deviceSignature='';
async function loadDevices(){try{const data=await (await fetch('/api/devices')).json();const list=$('#devices-list');const signature=JSON.stringify(data.devices);if(signature===deviceSignature)return;deviceSignature=signature;list.replaceChildren();if(!data.devices.length)list.textContent='Noch keine Geräte gekoppelt.';for(const device of data.devices){const row=el('div','device-row');const name=el('input','');name.value=device.name;name.maxLength=80;name.setAttribute('aria-label','Gerätename');const rename=el('button','stop','Umbenennen');rename.type='button';rename.onclick=async()=>{await fetch(`/api/devices/${device.id}/rename`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.value})});deviceSignature='';loadDevices();};row.append(name,rename,el('span','',new Date(device.createdAt).toLocaleDateString()));const revoke=el('button','stop','Trennen');revoke.type='button';revoke.onclick=async()=>{await fetch(`/api/devices/${device.id}/revoke`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});loadDevices();};row.append(revoke);list.append(row);}}catch{$('#devices-list').textContent='Geräte konnten nicht geladen werden.';}}
loadDevices();setInterval(loadDevices,15000);
