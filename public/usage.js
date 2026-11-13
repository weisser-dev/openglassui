window.formatUsage=function(data){
 const rows=['Usage / context']; const number=value=>Number.isFinite(value)?new Intl.NumberFormat('en-US').format(value):null;
 if(data.provider==='codex'){const total=data.tokenUsage?.total || {},windowSize=data.tokenUsage?.modelContextWindow;if(Object.values(total).some(Number.isFinite))rows.push('Codex: reported total');for(const [label,value] of [['Input',total.inputTokens],['Output',total.outputTokens],['Total',total.totalTokens],['Context window',windowSize]])if(number(value)!==null)rows.push(`${label}: ${number(value)} Tokens`);}
 else if(data.provider==='claude'){if(data.usage || Number.isFinite(data.costUsd))rows.push('Claude: last reported run');for(const [label,value] of [['Input',data.usage?.input_tokens],['Output',data.usage?.output_tokens]])if(number(value)!==null)rows.push(`${label}: ${number(value)} Tokens`);if(Number.isFinite(data.costUsd))rows.push(`Reported cost: $${data.costUsd.toFixed(4)}`);}
 else if(data.provider==='kiro'){if(Number.isFinite(data.context?.usagePercentage))rows.push(`Last reported context: ${data.context.usagePercentage.toFixed(1)} %`);if(Array.isArray(data.turn?.promptTurnSummaries))for(const item of data.turn.promptTurnSummaries){if(number(item.usage)!==null && typeof item.unit==='string'){const unit=item.usage===1?item.unit:(typeof item.unitPlural==='string'?item.unitPlural:item.unit);rows.push(`Last turn: ${number(item.usage)} ${unit}`);}}}
 if(rows.length===1)rows.push('No detailed usage reported by the agent.');return rows.join('\n');
};

window.summarizeLocalActivity=function(tasks){return {tasks:tasks.length,messages:tasks.reduce((sum,task)=>sum+(Number.isSafeInteger(task.trackedMessages)&&task.trackedMessages>0?task.trackedMessages:0),0),pending:tasks.filter(task=>task.pendingDecision).length};};
window.renderUsageOverview=function(container,tasks){const items=tasks.filter(task=>task.usage).slice(0,10),activity=window.summarizeLocalActivity(tasks);const signature=JSON.stringify([activity,items.map(task=>[task.id,task.agentName,task.projectName,task.usage])]);if(container.dataset.signature===signature)return;container.dataset.signature=signature;container.replaceChildren();const summary=document.createElement('p');summary.textContent=`Local tasks: ${activity.tasks} · Tracked messages: ${activity.messages} · Pending decisions: ${activity.pending}`;container.append(summary);const note=document.createElement('p');note.className='hint';note.textContent='Messages count only prompts sent through OpenGlassUI since tracking was added. Imported sessions are snapshots; their status may not reflect external activity. Agent permissions and MCP usage are not comprehensively reported.';container.append(note);const chart=document.createElement('div');chart.className='activity-chart';const labels=[['running','Running'],['completed','Completed'],['failed','Failed'],['stopped','Stopped'],['interrupted','Interrupted']];const tr=window.openGlassI18n?.t||((x)=>x);for(const [status,label] of labels){const count=tasks.filter(task=>task.status===status).length;if(!count)continue;const row=document.createElement('div');row.className='activity-chart-row';const caption=document.createElement('span');caption.textContent=tr(label);const bar=document.createElement('progress');bar.max=tasks.length||1;bar.value=count;bar.setAttribute('aria-label',`${tr(label)}: ${count}`);const value=document.createElement('strong');value.textContent=String(count);row.append(caption,bar,value);chart.append(row);}if(tasks.length){const title=document.createElement('h3');title.textContent=tr('Task status');container.append(title,chart);}if(!items.length){const empty=document.createElement('p');empty.textContent='No usage data reported yet.';container.append(empty);return;}for(const task of items){const row=document.createElement('article'),title=document.createElement('strong'),details=document.createElement('pre');title.textContent=`${task.agentName} · ${task.projectName || 'Default project'}`;details.textContent=window.formatUsage(task.usage);row.append(title,details);container.append(row);}};

// Session titles are looked up from each provider; imported snapshots retain their origin marker.
window.createSessionTitleResolver=function(api,onUpdate=()=>{}){
 const cache=new Map(),known=new Map(),pending=new Set(),retryAfter=new Map();
 function key(task){return `${task.agentId}\u0000${task.projectId||'default'}`;}
 function enrich(tasks){
  for(const task of tasks){if(task.prompt!=='Importierte Sitzung'||!task.sessionId||task.title)continue;const group=key(task),direct=known.get(`${group}\u0000${task.sessionId}`),names=cache.get(group);if(direct){task.title=direct;continue;}if(names){const title=names.get(task.sessionId);if(title)task.title=title;continue;}if(pending.has(group)||Date.now()<(retryAfter.get(group)||0))continue;
   pending.add(group);const path=`/api/sessions?agent=${encodeURIComponent(task.agentId)}&projectId=${encodeURIComponent(task.projectId||'default')}`;
   Promise.resolve().then(()=>api(path)).then(data=>{const entries=(data.sessions||[]).filter(item=>typeof item.id==='string'&&typeof item.title==='string'&&item.title.trim()).map(item=>[item.id,item.title.trim().slice(0,200)]);cache.set(group,new Map(entries));onUpdate();}).catch(()=>{retryAfter.set(group,Date.now()+30000);}).finally(()=>pending.delete(group));
  }
 }
 return {enrich,remember(agentId,projectId,sessionId,title){if(typeof title!=='string'||!title.trim())return;const group=`${agentId}\u0000${projectId||'default'}`;known.set(`${group}\u0000${sessionId}`,title.trim().slice(0,200));}};
};
window.cleanImportedTranscript=function(text){return String(text||'').replace(/<system-reminder\b[^>]*>[\s\S]*?<\/system-reminder>/gi,'').replace(/\n{3,}/g,'\n\n').trim();};
window.taskDisplayTitle=function(task,fallback='Imported session'){return task.title||(task.prompt&&task.prompt!=='Importierte Sitzung'?task.prompt:fallback);};
// Show one entry per provider session without deleting any stored task history.
window.uniqueSessionTasks=function(tasks){
 const result=[],indices=new Map();
 const rank=task=>task.pendingDecision?2:task.status==='running'?1:0;
 const time=task=>Date.parse(task.lastMessageAt||task.createdAt)||0;
 for(const task of tasks){if(!task.sessionId){result.push(task);continue;}const key=`${task.agentId}\u0000${task.sessionId}`;const index=indices.get(key);if(index===undefined){indices.set(key,result.length);result.push(task);continue;}const current=result[index];if(rank(task)>rank(current)||(rank(task)===rank(current)&&time(task)>time(current)))result[index]=task;}
 return result;
};
// Provider history contains tool events; only text messages are presented as chat bubbles.
window.formatProviderSession=function(session){
 const result=[];const add=(role,content)=>{let value=typeof content==='string'?content:Array.isArray(content)?content.filter(item=>item?.type==='text'&&typeof item.text==='string').map(item=>item.text).join('\n'):'';value=window.cleanImportedTranscript(value);if(value)result.push({role,text:value.slice(-100000)});};
 if(Array.isArray(session)){for(const item of session){if(item?.type==='user')add('user',item.message?.content);else if(item?.type==='assistant')add('assistant',item.message?.content);}}
 else if(Array.isArray(session?.turns)){for(const turn of session.turns)for(const item of turn.items||[]){if(item.type==='userMessage')add('user',item.content);else if(item.type==='agentMessage')add('assistant',item.text);}}
 return result.slice(-100);
};
