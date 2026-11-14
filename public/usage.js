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
 const cache=new Map(),known=new Map(),pending=new Set(),retryAfter=new Map(),storageKey='openglass-session-titles-v1';try{const saved=JSON.parse(window.localStorage?.getItem(storageKey)||'[]');if(Array.isArray(saved))for(const entry of saved.slice(-500))if(Array.isArray(entry)&&typeof entry[0]==='string'&&typeof entry[1]==='string')known.set(entry[0],entry[1]);}catch{}const persist=()=>{try{window.localStorage?.setItem(storageKey,JSON.stringify([...known.entries()].slice(-500)));}catch{}};
 function key(task){return `${task.agentId}\u0000${task.projectId||'default'}`;}
 function enrich(tasks){
  for(const task of tasks){if(task.prompt!=='Importierte Sitzung'||!task.sessionId||task.title)continue;const group=key(task),direct=known.get(`${group}\u0000${task.sessionId}`),names=cache.get(group);if(direct)task.title=direct;if(names){const title=names.get(task.sessionId);if(title)task.title=title;continue;}if(pending.has(group)||Date.now()<(retryAfter.get(group)||0))continue;
   pending.add(group);const path=`/api/sessions?agent=${encodeURIComponent(task.agentId)}&projectId=${encodeURIComponent(task.projectId||'default')}`;
   Promise.resolve().then(()=>api(path)).then(data=>{const entries=(data.sessions||[]).filter(item=>typeof item.id==='string'&&typeof item.title==='string'&&item.title.trim()).map(item=>[item.id,item.title.trim().slice(0,200)]);cache.set(group,new Map(entries));for(const [id,title] of entries)known.set(`${group}\u0000${id}`,title);persist();onUpdate();}).catch(()=>{retryAfter.set(group,Date.now()+30000);}).finally(()=>pending.delete(group));
  }
 }
 return {enrich,remember(agentId,projectId,sessionId,title){if(typeof title!=='string'||!title.trim())return;const group=`${agentId}\u0000${projectId||'default'}`;known.set(`${group}\u0000${sessionId}`,title.trim().slice(0,200));persist();}};
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
// Claude records slash commands in XML-like message envelopes. Treat the body as text.
window.parseWearableCommand=function(text){
 const value=String(text||'').trim();if(!/^<command-(?:message|name|args)>/i.test(value))return null;
 const read=name=>value.match(new RegExp(`<command-${name}>([\\s\\S]*?)<\\/command-${name}>`,'i'))?.[1]?.trim()||'';
 const raw=read('name')||read('message');if(!/^\/?[a-z0-9][a-z0-9_:.\/-]{0,79}$/i.test(raw))return null;
 const name=raw.startsWith('/')?raw:`/${raw}`;
 const body=value.replace(/<command-(?:message|name)>[\s\S]*?<\/command-(?:message|name)>/gi,'').replace(/<\/?command-args>/gi,'').trim();
 return {name,body};
};
window.isWearableInterruption=function(text){return /^\s*\[Request interrupted by user(?: for tool use)?\]\s*$/i.test(String(text||''));};

// Local canvas animation; the actual QR image remains unchanged and scannable.
window.createPairingTree=function(content,translate=value=>value){
 const root=document.createElement('div');root.className='pairing-tree-widget';
 const art=document.createElement('button');art.type='button';art.className='pairing-tree-art';art.setAttribute('aria-label',translate('Click for QR code'));
 const label=document.createElement('span');label.className='pairing-tree-caption';label.textContent=translate('Click for QR code');art.append(label);
 const canvas=document.createElement('canvas');canvas.className='pairing-tree-canvas';canvas.width=320;canvas.height=250;canvas.setAttribute('aria-hidden','true');art.append(canvas);
 for(let i=0;i<10;i++){const leaf=document.createElement('i');leaf.className='pairing-tree-leaf';leaf.style.setProperty('--leaf-index',i);art.append(leaf);}
 const reveal=document.createElement('div');reveal.className='pairing-tree-reveal';reveal.hidden=true;reveal.append(content);
 const control=document.createElement('button');control.type='button';control.className='pairing-tree-control';control.setAttribute('aria-expanded','false');control.textContent=translate('Show tree');control.hidden=true;
 root.append(art,reveal,control);
 let ctx=null;try{ctx=canvas.getContext?.('2d');}catch{}let animation=0,phase=0,targets=[];
 function prepareTargets(){try{const image=content.tagName==='IMG'?content:content.querySelector?.('img.setup-qr');if(!image?.naturalWidth)return;const sample=document.createElement('canvas');sample.width=64;sample.height=64;const c=sample.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0,64,64);const data=c.getImageData(0,0,64,64).data,bg=[data[0],data[1],data[2]];const result=[];for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,d=Math.abs(data[i]-bg[0])+Math.abs(data[i+1]-bg[1])+Math.abs(data[i+2]-bg[2]);if(d>180)result.push({x:45+x*3.6,y:10+y*3.6});}if(result.length)targets=result;}catch{targets=[];}}
 const rand=n=>{const x=Math.sin(n*127.1+19.7)*43758.5453;return x-Math.floor(x);};
 // Isometric ground grid and individual blocks give the tree a visible 3D form.
 function ground(){if(!ctx)return;ctx.fillStyle='#101c15';ctx.beginPath();ctx.moveTo(25,188);ctx.lineTo(160,135);ctx.lineTo(295,188);ctx.lineTo(160,241);ctx.closePath();ctx.fill();ctx.strokeStyle='#3c67402e';ctx.lineWidth=.6;for(let i=0;i<=18;i++){let f=i/18;ctx.beginPath();ctx.moveTo(25+135*f,188-53*f);ctx.lineTo(160+135*f,241-53*f);ctx.moveTo(25+135*f,188+53*f);ctx.lineTo(160+135*f,135+53*f);ctx.stroke();}}
 const points=[];for(let i=0;i<1000;i++){const r=Math.sqrt(rand(i*3))*78,a=rand(i*3+1)*Math.PI*2,x=Math.cos(a)*r,z=Math.sin(a)*r*.58;const y=67+z*.22+rand(i*3+2)*18;points.push({x:160+x,y:y+z*.20,z,shade:rand(i+800)});}points.sort((a,b)=>a.z-b.z);
 function draw(progress){if(!ctx)return;ctx.clearRect(0,0,320,250);ground();if(progress<.7&&targets.length){ctx.fillStyle=`rgba(8,18,10,${(1-progress)*.7})`;for(let i=0;i<targets.length;i+=2){const q=targets[i],x=q.x-160,y=q.y-125;ctx.fillRect(160+(x-y)*.55,188+(x+y)*.22,2,2);}}if(progress>.45){ctx.fillStyle=`rgba(235,255,221,${Math.min(1,(progress-.45)*1.8)})`;ctx.fillRect(37,2,246,246);}ctx.globalAlpha=1-progress;ctx.fillStyle='#355932';ctx.fillRect(151,111,18,64);ctx.fillStyle='#638b4a';ctx.fillRect(151,111,9,64);ctx.globalAlpha=1;
  for(let i=0;i<points.length;i++){const p=points[i],target=targets.length?targets[Math.floor(i*targets.length/points.length)]:{x:34+(i%40)*6.35,y:10+Math.floor(i/40)*9.2},tx=target.x,ty=target.y,e=progress*progress*(3-2*progress),x=p.x+(tx-p.x)*e,y=p.y+(ty-p.y)*e,size=3.5+1.7*(1-progress);ctx.fillStyle=progress>.68?'#16321b':p.shade>.68?'#c5f78d':p.shade>.32?'#8bdc63':'#54a94b';ctx.fillRect(x,y,size,size+(1-progress)*3);if(progress<.8){ctx.fillStyle='#3d8846';ctx.fillRect(x+size*.7,y+size,size*.3,2*(1-progress));}}
 }
 const image=content.tagName==='IMG'?content:content.querySelector?.('img.setup-qr');image?.addEventListener?.('load',()=>{prepareTargets();draw(phase);});prepareTargets();draw(0);
 const setVisible=show=>{reveal.hidden=!show;art.hidden=show;control.hidden=!show;control.setAttribute('aria-expanded',String(show));};
 function transition(show){if(show)prepareTargets();if(animation&&window.cancelAnimationFrame)window.cancelAnimationFrame(animation);const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;if(!ctx||!window.requestAnimationFrame||reduced){setVisible(show);draw(show?1:0);return;}art.hidden=false;control.hidden=true;reveal.hidden=true;const from=phase,to=show?1:0;let start=null;label.hidden=true;
  const frame=now=>{if(start===null)start=now;const t=Math.min(1,(now-start)/1250);phase=from+(to-from)*t;draw(phase);if(t<1)animation=window.requestAnimationFrame(frame);else{animation=0;label.hidden=false;setVisible(show);}};animation=window.requestAnimationFrame(frame);
 }
 art.addEventListener('click',()=>transition(true));control.addEventListener('click',()=>transition(false));
 root.resetPairingTree=()=>{if(animation&&window.cancelAnimationFrame)window.cancelAnimationFrame(animation);animation=0;phase=0;label.hidden=false;setVisible(false);draw(0);};
 return root;
};
