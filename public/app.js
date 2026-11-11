const $ = s => document.querySelector(s);
let state, selected = '';
const statusText = {running:'LÄUFT', completed:'FERTIG', failed:'FEHLGESCHLAGEN', stopped:'GESTOPPT'};
function el(tag, className, text) { const e = document.createElement(tag); if (className) e.className=className; if (text !== undefined) e.textContent=text; return e; }
async function refresh() {
  try {
    const r = await fetch('/api/state'); state = await r.json();
    if (!$('#agent').options.length) for (const a of state.agents) { const o=el('option','',a.name); o.value=a.id; $('#agent').append(o); }
    $('#workspace').textContent=state.workspace; $('#count').textContent=state.tasks.length;
    const container=$('#tasks');
    if (!state.tasks.length) return;
    if (!selected || !state.tasks.some(t=>t.id===selected)) selected=state.tasks[0].id;
    const openId=document.activeElement?.dataset?.task;
    container.replaceChildren();
    for (const task of state.tasks) {
      const card=el('article','task'); const button=el('button','task-head'); button.type='button'; button.dataset.task=task.id; button.setAttribute('aria-expanded', String(selected===task.id));
      const title=el('div',''); title.append(el('span','agent-label',task.agentName),el('strong','task-prompt',task.prompt));
      button.append(title,el('span','status '+task.status,statusText[task.status] || task.status));
      button.onclick=()=>{selected=selected===task.id?'':task.id; refresh();}; card.append(button);
      if (selected===task.id) { const details=el('div','task-details'); const out=el('pre','output',task.output || 'Warte auf Ausgabe …'); details.append(out); if(task.status==='running'){const stop=el('button','stop','Aufgabe stoppen'); stop.onclick=async()=>{await fetch(`/api/tasks/${task.id}/stop`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); refresh();};details.append(stop);} card.append(details); }
      container.append(card);
    }
    if(openId) container.querySelector(`[data-task="${CSS.escape(openId)}"]`)?.focus({preventScroll:true});
  } catch { $('.connection').textContent='VERBINDUNG UNTERBROCHEN'; }
}
$('#task-form').addEventListener('submit', async e=>{ e.preventDefault(); const button=e.currentTarget.querySelector('button'); button.disabled=true; try { const r=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agentId:$('#agent').value,prompt:$('#prompt').value})}); const result=await r.json(); if(!r.ok) throw new Error(result.error); selected=result.id; $('#prompt').value=''; await refresh(); } catch(err){alert(err.message);} finally {button.disabled=false;} });
refresh(); setInterval(refresh,2000);
