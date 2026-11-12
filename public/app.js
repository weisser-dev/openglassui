const $ = s => document.querySelector(s);
let state, selected = null, rendered = '';
const statusText = {running:'LÄUFT', completed:'FERTIG', failed:'FEHLGESCHLAGEN', stopped:'GESTOPPT'};
function el(tag, className, text) { const e = document.createElement(tag); if (className) e.className=className; if (text !== undefined) e.textContent=text; return e; }
async function refresh(force = false) {
  try {
    const r = await fetch('/api/state'); state = await r.json();
    if (!$('#agent').options.length) for (const a of state.agents) { const o=el('option','',a.name); o.value=a.id; $('#agent').append(o); }
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
      button.append(title,el('span','status '+task.status,statusText[task.status] || task.status));
      button.onclick=()=>{selected=selected===task.id?'':task.id; refresh(true);}; card.append(button);
      if (selected===task.id) { const details=el('div','task-details'); if(task.pendingDecision)details.append(window.decisionUI(task,async (url,data)=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)alert(result.error);refresh(true);})); const out=el('pre','output',task.output || 'Warte auf Ausgabe …'); details.append(out); if(task.status==='running'){const stop=el('button','stop','Aufgabe stoppen'); stop.onclick=async()=>{await fetch(`/api/tasks/${task.id}/stop`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); refresh(true);};details.append(stop);} else if(task.sessionId) {const form=el('form','follow'); const input=el('textarea'); input.placeholder='Folgeanweisung …'; input.required=true; const send=el('button','primary','Sitzung fortsetzen ↗'); send.type='submit'; form.append(input,send); form.onsubmit=async e=>{e.preventDefault(); const r=await fetch(`/api/tasks/${task.id}/resume`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:input.value})}); const result=await r.json(); if(!r.ok)alert(result.error);else refresh(true);}; details.append(form);} card.append(details); }
      container.append(card);
    }
    if(openId) container.querySelector(`[data-task="${CSS.escape(openId)}"]`)?.focus({preventScroll:true});
  } catch { $('.connection').textContent='VERBINDUNG UNTERBROCHEN'; }
}
$('#task-form').addEventListener('submit', async e=>{ e.preventDefault(); const button=e.currentTarget.querySelector('button'); button.disabled=true; try { const r=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agentId:$('#agent').value,prompt:$('#prompt').value})}); const result=await r.json(); if(!r.ok) throw new Error(result.error); selected=result.id; $('#prompt').value=''; await refresh(true); } catch(err){alert(err.message);} finally {button.disabled=false;} });
refresh(); setInterval(refresh,2000);

$('#pair-form').addEventListener('submit', async e => { e.preventDefault(); try { const r=await fetch('/api/pairing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:$('#public-url').value})}); const data=await r.json(); if(!r.ok) throw new Error(data.error); $('#pair-qr').src=data.qr; $('#pair-link').href=data.deepLink; $('#pair-result').hidden=false; } catch(error) { alert(error.message); } });
$('#revoke').onclick=async()=>{ await fetch('/api/revoke',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); $('#pair-result').hidden=true; alert('Alle Brillenverbindungen wurden getrennt.'); };
