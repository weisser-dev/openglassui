const $=s=>document.querySelector(s); let token=localStorage.getItem('openglass-token')||'',state,selected='',observed=null,connected=false,rendered='';
const statusText={running:'Läuft',completed:'Fertig',failed:'Fehlgeschlagen',stopped:'Gestoppt',interrupted:'Unterbrochen'};
async function api(url, options={}) { options.headers={...options.headers,...(token?{Authorization:`Bearer ${token}`}:{})}; const r=await fetch(url,options); const data=await r.json(); if(!r.ok){const error=new Error(data.error);error.status=r.status;throw error;} return data; }
async function initialize(){
 const params=new URLSearchParams(location.hash.slice(1)), code=params.get('pair');
 if(code){ history.replaceState(null,'',location.pathname); let alreadyPaired=false;if(token){try{await api('/api/state');alreadyPaired=true;}catch{}}if(!alreadyPaired){try { const result=await api('/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})}); token=result.token;localStorage.setItem('openglass-token',token); } catch(e){$('#message').textContent=e.message;return;}} }
 if(!token){try{await api('/api/state');}catch{$('#message').textContent='Bitte zuerst auf deinem Rechner einen Kopplungscode erzeugen.';return;}} connected=true; await refresh(); watchEvents();
}
function node(tag,text){const e=document.createElement(tag);e.textContent=text;return e;}
async function refresh(force=false){try{state=await api('/api/state');
 const next=new Map(state.tasks.map(t=>[t.id,{status:t.status,decision:t.pendingDecision?.id}]));
 const notice=wearableNotice(observed,state.tasks),noticeElement=$('#notice');if(notice){noticeElement.textContent=notice.text;noticeElement.dataset.decision=notice.decision?notice.taskId:'';noticeElement.hidden=false;}else if(noticeElement.dataset.decision){noticeElement.hidden=true;noticeElement.dataset.decision='';}observed=next;$('#connection').textContent='VERBUNDEN';$('#message').hidden=true;$('#main').hidden=false;
 const project=$('#project'), projectValue=project.value; if(JSON.stringify([...project.options].map(o=>[o.value,o.textContent]))!==JSON.stringify(state.projects.map(p=>[p.id,p.name]))){project.replaceChildren();for(const p of state.projects){const o=node('option',p.name);o.value=p.id;project.append(o);}if([...project.options].some(o=>o.value===projectValue))project.value=projectValue;}
 if(!$('#agent').options.length)for(const a of state.agents){const o=node('option',a.name);o.value=a.id;$('#agent').append(o);}
 window.renderUsageOverview($('#usage-overview'),state.tasks);
 const list=$('#tasks'),active=document.activeElement,hadFocus=list.contains(active),activeTask=active?.closest('article')?.dataset.task,activeWasOutput=active?.tagName==='PRE',scrollTop=activeWasOutput?active.scrollTop:0;
 const signature=JSON.stringify([selected,state.tasks]);if(!force && signature===rendered)return;
 if(!force && hadFocus && !active.dataset.task && !activeWasOutput)return;
 rendered=signature;list.replaceChildren();
 for(const task of state.tasks){const article=node('article',''),b=node('button',`${task.agentName} · ${task.pendingDecision?'Entscheidung erforderlich':(statusText[task.status] || task.status)}\n${task.prompt}`);article.dataset.task=task.id;b.dataset.task=task.id;b.setAttribute('aria-expanded',String(selected===task.id));b.onclick=()=>{selected=selected===task.id?'':task.id;refresh(true)};article.append(b);
 if(selected===task.id){if(task.events?.length)article.append(window.renderTaskEvents(task.events));if(task.usage){const usage=node('p',window.formatUsage(task.usage));usage.className='usage';article.append(usage);}if(task.pendingDecision)article.append(window.decisionUI(task,post));const output=node('pre',task.output||'Warte auf Ausgabe …');output.tabIndex=0;output.setAttribute('aria-label','Ausgabe; mit Pfeiltasten scrollen');article.append(output); if(task.status==='running'){const stop=node('button','Aufgabe stoppen');stop.onclick=()=>post(`/api/tasks/${task.id}/stop`,{});article.append(stop);}else if(task.sessionId && state.projects.some(p=>p.id===(task.projectId || 'default'))){const input=document.createElement('textarea');input.placeholder='Folgeanweisung eingeben oder diktieren';input.id=`follow-${task.id}`;const send=node('button','Sitzung fortsetzen');send.onclick=()=>post(`/api/tasks/${task.id}/resume`,{prompt:input.value});article.append(input,send);}}list.append(article);}
 if(hadFocus && activeTask){const card=list.querySelector(`article[data-task=\"${CSS.escape(activeTask)}\"]`);const target=activeWasOutput?card?.querySelector('pre[tabindex]'):card?.querySelector('button[data-task]');target?.focus({preventScroll:true});if(target && activeWasOutput)target.scrollTop=scrollTop;}
 }catch(e){$('#connection').textContent='NICHT VERBUNDEN';$('#message').hidden=false;$('#message').textContent=e.status?e.message:'Verbindung unterbrochen. Prüfe, ob OpenGlassUI und der Tunnel laufen. Bei Tailscale: Verbindung und Zugriff im Tailnet prüfen.';}}
async function watchChanges(){while(connected){try{const since=state?.revision ?? 0;const result=await api(`/api/changes?since=${since}`);if(result.revision!==since)await refresh();}catch(error){if(error.status===401){connected=false;$('#connection').textContent='NICHT VERBUNDEN';$('#message').hidden=false;$('#message').textContent='Verbindung widerrufen oder Anmeldung abgelaufen. Bitte erneut koppeln.';return;}await new Promise(resolve=>setTimeout(resolve,5000));await refresh();}}}
function watchEvents(){
 if(!('WebSocket' in window)){watchChanges();return;}
 let socket,opened=false,firstRevision=true,refreshTimer;
 try{socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/events`);}catch{watchChanges();return;}
 socket.onopen=()=>{opened=true;socket.send(JSON.stringify({token}));};
 socket.onmessage=event=>{try{const eventData=JSON.parse(event.data);const needsRefresh=firstRevision || eventData.revision!==state?.revision;firstRevision=false;if(needsRefresh && !refreshTimer)refreshTimer=setTimeout(()=>{refreshTimer=null;refresh();},250);}catch{}};
 socket.onclose=event=>{if(refreshTimer)clearTimeout(refreshTimer);$('#connection').textContent='NICHT VERBUNDEN';$('#message').hidden=false;if(event.code===1008){connected=false;$('#message').textContent='Verbindung widerrufen oder Anmeldung abgelaufen. Bitte erneut koppeln.';return;}$('#message').textContent='Verbindung unterbrochen. Prüfe OpenGlassUI und den Tunnel. Bei Tailscale: Tailnet-Verbindung prüfen.';if(!opened){watchChanges();return;}setTimeout(()=>{if(connected)watchEvents();},5000);};
 socket.onerror=()=>{};
}
const pendingActions=new Set();
async function post(url,data){if(pendingActions.has(url))return false;pendingActions.add(url);const errorElement=$('#action-error');errorElement.hidden=true;try{await api(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});await refresh(true);return true;}catch(e){errorElement.textContent=e.message;errorElement.hidden=false;return false;}finally{pendingActions.delete(url);}}
$('#push-enable').onclick=async()=>{try{if(!token)throw new Error('Bitte zuerst ein Gerät koppeln.');$('#push-status').textContent='Benachrichtigungen werden eingerichtet …';await enableBackgroundPush(api);$('#push-status').textContent='Hintergrundhinweise aktiviert. Die Zustellung auf diesem Gerät ist noch nicht geprüft.';}catch(error){$('#push-status').textContent=error.message;}};
$('#push-disable').onclick=async()=>{try{await disableBackgroundPush(api);$('#push-status').textContent='Hintergrundhinweise ausgeschaltet.';}catch(error){$('#push-status').textContent=error.message;}};
$('#start').onclick=()=>post('/api/tasks',{agentId:$('#agent').value,projectId:$('#project').value,prompt:$('#prompt').value});
$('#notice').onclick=async()=>{const id=$('#notice').dataset.decision;if(!id)return;selected=id;await refresh(true);$(`#tasks article[data-task="${CSS.escape(id)}"] button[data-task]`)?.focus();};
document.addEventListener('keydown',e=>{
 const active=document.activeElement;
 if((e.key==='Escape' || e.key==='Backspace') && !['INPUT','TEXTAREA','SELECT'].includes(active.tagName)){if(selected){selected='';refresh(true);e.preventDefault();}return;}
 if(e.key==='Enter' && active.matches('input[type=radio]')){active.checked=true;active.dispatchEvent(new Event('change',{bubbles:true}));e.preventDefault();return;}
 if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(e.key) || ['TEXTAREA','INPUT','SELECT'].includes(active.tagName))return;
 if(active.tagName==='PRE' && ['ArrowDown','ArrowUp'].includes(e.key)){const canScroll=e.key==='ArrowDown'?active.scrollTop+active.clientHeight<active.scrollHeight-1:active.scrollTop>0;if(canScroll){active.scrollBy({top:e.key==='ArrowDown'?100:-100});e.preventDefault();return;}}
 const items=[...document.querySelectorAll('select,textarea,button,input,pre[tabindex],a[href]')].filter(x=>x.offsetParent!==null && !x.disabled && x.type!=='hidden');
 const index=items.indexOf(active);if(index<0){items[0]?.focus();if(items.length)e.preventDefault();return;}
 const target=spatialTarget(active.getBoundingClientRect(),items.map(x=>x.getBoundingClientRect()),e.key);
 if(target>=0){items[target].focus();e.preventDefault();}
});
async function registerVoice(){const context=document.modelContext;if(!context?.registerTool)return;for(const def of createWearableTools(api,()=>$('#project').value))try{await context.registerTool(def);}catch(error){console.warn('WebMCP:',error.message);}}

window.openGlassApi=api; registerVoice(); initialize();
// Apply updates deferred while a wearer was choosing an answer or typing.
$('#tasks').addEventListener('focusout',()=>setTimeout(()=>refresh(),0));
