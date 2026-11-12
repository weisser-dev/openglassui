import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { listSessions, getSessionMessages, query } from '@anthropic-ai/claude-agent-sdk';

// Each read-only request owns its app-server connection. It does not attach to or alter running turns.
async function codexRequest(method, params, command='codex') {
 const child=spawn(command,['app-server'],{stdio:['pipe','pipe','pipe']});
 let stderr=''; child.stderr.on('data',x=>{stderr=(stderr+x).slice(-2000)});
 const lines=createInterface({input:child.stdout});
 let id=0; const pending=new Map();
 lines.on('line',line=>{let msg;try{msg=JSON.parse(line)}catch{return} if(msg.id!==undefined && !msg.method && pending.has(msg.id)){const p=pending.get(msg.id); pending.delete(msg.id); msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);}});
 child.on('error',e=>{for(const p of pending.values())p.reject(e);pending.clear()});
 child.on('close',()=>{for(const p of pending.values())p.reject(new Error(`Codex app-server beendet. ${stderr}`));pending.clear()});
 const call=(name,p)=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});child.stdin.write(JSON.stringify({id:n,method:name,params:p})+'\n');});
 const timeout=setTimeout(()=>child.kill(),15000);
 try {await call('initialize',{clientInfo:{name:'openglassui',title:'OpenGlassUI',version:'0.1.0'},capabilities:{}});child.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\n');
  if(method!=='thread/list')return await call(method,params);
  const data=[],ids=new Set(),cursors=new Set();let cursor;
  do{const page=await call(method,{...params,...(cursor!==undefined?{cursor}:{})});if(!Array.isArray(page?.data))throw new Error('Codex hat eine ungültige Sitzungsliste zurückgegeben.');for(const item of page.data){if(item && typeof item.id==='string' && !ids.has(item.id)){ids.add(item.id);data.push(item);}}cursor=page.nextCursor;if(cursor!=null){if(typeof cursor!=='string'||cursors.has(cursor)||cursors.size>=1000)throw new Error('Codex hat eine ungültige Seitennavigation zurückgegeben.');cursors.add(cursor);}}while(cursor!=null);
  return {data};}
 finally {clearTimeout(timeout);child.kill();}
}
export async function listAgentSessions(agent, workspace, command='codex') {
 if(agent==='claude') return (await listSessions({dir:workspace,includeWorktrees:false})).filter(s=>!s.cwd || s.cwd===workspace).map(s=>({id:s.sessionId,agent,title:s.customTitle||s.summary||s.firstPrompt||'Claude-Sitzung',updatedAt:s.lastModified}));
 if(agent==='codex') {const result=await codexRequest('thread/list',{cwd:workspace,limit:50,sortKey:'updated_at'},command);return result.data.map(s=>({id:s.id,agent,title:s.name||s.preview||'Codex-Sitzung',updatedAt:s.updatedAt}));}
 throw new Error('Nicht unterstützter Agent.');
}
// Discovery is local and read-only. The caller chooses which paths to register.
export async function discoverAgentProjects({command='codex',claudeList=listSessions,codexList=()=>codexRequest('thread/list',{limit:50,sortKey:'updated_at'},command)}={}) {
 const results=await Promise.allSettled([claudeList({includeWorktrees:true}),codexList()]);const entries=new Map(),errors=[];
 for(let index=0;index<results.length;index++){const provider=index?'codex':'claude',result=results[index];if(result.status==='rejected'){errors.push(provider);continue;}const items=index?result.value?.data:result.value;if(!Array.isArray(items)){errors.push(provider);continue;}for(const item of items){if(typeof item?.cwd!=='string' || !item.cwd)continue;const entry=entries.get(item.cwd) || {path:item.cwd,sources:[],sessions:0};if(!entry.sources.includes(provider))entry.sources.push(provider);entry.sessions++;entries.set(item.cwd,entry);}}
 return {projects:[...entries.values()],unavailable:errors};
}
export async function listGlobalSessions(agent,command='codex') {
 if(agent==='claude')return (await listSessions({includeWorktrees:true})).map(s=>({id:s.sessionId,agent,cwd:s.cwd,title:s.customTitle||s.summary||s.firstPrompt||'Claude-Sitzung',updatedAt:s.lastModified}));
 if(agent==='codex')return (await codexRequest('thread/list',{limit:50,sortKey:'updated_at'},command)).data.map(s=>({id:s.id,agent,cwd:s.cwd,title:s.name||s.preview||'Codex-Sitzung',updatedAt:s.updatedAt}));
 throw new Error('Nicht unterstützter Agent.');
}
export async function readAgentSession(agent,id,workspace,command='codex') {
 if(!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Ungültige Sitzungs-ID.');
 const sessions=await listAgentSessions(agent,workspace,command);if(!sessions.some(s=>s.id===id))throw new Error('Sitzung nicht im konfigurierten Projekt gefunden.');
 if(agent==='claude')return await getSessionMessages(id,{dir:workspace,limit:100});
 return (await codexRequest('thread/read',{threadId:id,includeTurns:true},command)).thread;
}
export function runClaude({prompt,workspace,sessionId,onMessage,onDecision,onDone,queryImpl=query}) {
 const abort=new AbortController();
 const process=queryImpl({prompt,options:{cwd:workspace,...(sessionId?{resume:sessionId}:{}),settingSources:['user','project','local'],systemPrompt:{type:'preset',preset:'claude_code',append:'Wenn du eine inhaltliche Entscheidung des Nutzers brauchst, nutze AskUserQuestion und schlage anhand der Aufgabe und bisherigen Ergebnisse kurze, konkrete Auswahlmöglichkeiten vor. Erfinde keine Freigaben und triff keine Entscheidung für den Nutzer.'},abortController:abort,permissionMode:'default',canUseTool:async (toolName,input,extra)=>{
   const answer=await onDecision({id:extra.toolUseID,toolName,input,description:extra.description||'',kind:toolName==='AskUserQuestion'?'question':'approval'},extra.signal);
   if(answer?.type==='allow') return {behavior:'allow',updatedInput:input};
   if(answer?.type==='answer' && toolName==='AskUserQuestion') return {behavior:'allow',updatedInput:{...input,answers:answer.answers}};
   return {behavior:'deny',message:'Vom Nutzer abgelehnt oder abgebrochen.'};
 }}});
 (async()=>{try{for await(const message of process)onMessage(message);onDone(null);}catch(error){onDone(error);}})();
 return {kill(){abort.abort();process.close();}};
}

export function runCodex({prompt,workspace,sessionId,command='codex',onSession,onText,onUsage=()=>{},onEvent=()=>{},onDecision,onDone}) {
 const child=spawn(command,['app-server','--enable','default_mode_request_user_input'],{stdio:['pipe','pipe','pipe']});
 const lines=createInterface({input:child.stdout});let seq=0,finished=false,threadId,turnId,stderr='';const pending=new Map();
 function finish(err){if(finished)return;finished=true;for(const p of pending.values())p.reject(err||new Error('Sitzung beendet.'));pending.clear();child.kill();onDone(err);}
 function send(value){if(!child.stdin.destroyed)child.stdin.write(JSON.stringify(value)+'\n');}
 function call(method,params){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});send({id,method,params});});}
 child.stderr.on('data',x=>{stderr=(stderr+x).slice(-3000)});
 child.on('error',finish);child.on('close',code=>{if(!finished)finish(new Error(`Codex-App-Server beendet (${code}). ${stderr}`));});
 lines.on('line',async line=>{let msg;try{msg=JSON.parse(line)}catch{return}
  if(msg.id!==undefined&&!msg.method){const p=pending.get(msg.id);if(p){pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);}return;}
  if(msg.id!==undefined&&msg.method){
   const question=msg.method==='item/tool/requestUserInput';const approval=['item/commandExecution/requestApproval','item/fileChange/requestApproval'].includes(msg.method);
   if(!question&&!approval){send({id:msg.id,error:{code:-32601,message:'Nicht unterstützte Anfrage'}});return;}
   const decision={id:String(msg.id),kind:question?'question':'approval',toolName:msg.method,description:msg.params.reason||'',input:question?{questions:msg.params.questions}:msg.params};
   try{const answer=await onDecision(decision);if(question){const answers={};for(const q of msg.params.questions||[])answers[q.id]={answers:answer?.type==='answer'?[answer.answers[q.question]]:[]};send({id:msg.id,result:{answers}});}else send({id:msg.id,result:{decision:answer?.type==='allow'?'accept':'decline'}});}catch{send({id:msg.id,error:{code:-32603,message:'Entscheidung abgebrochen'}});}return;
  }
  if((msg.method==='item/started'||msg.method==='item/completed') && msg.params?.threadId===threadId){
   const item=msg.params.item;const titles={commandExecution:'Befehl',fileChange:'Dateiänderung',mcpToolCall:'MCP-Werkzeug',dynamicToolCall:'Werkzeug',webSearch:'Websuche'};
   if(item && typeof item.id==='string' && Object.hasOwn(titles,item.type))onEvent({id:item.id,title:titles[item.type],status:typeof item.status==='string'?item.status:(msg.method==='item/started'?'inProgress':'completed')});
  }
  if(msg.method==='thread/tokenUsage/updated')onUsage({provider:'codex',tokenUsage:msg.params.tokenUsage});
  if(msg.method==='item/agentMessage/delta')onText(msg.params.delta||'');
  if(msg.method==='item/commandExecution/outputDelta')onText(msg.params.delta||'');
  if(msg.method==='turn/completed'&&msg.params.threadId===threadId){const turn=msg.params.turn;finish(turn.status==='completed'?null:new Error(turn.error?.message||`Codex: ${turn.status}`));}
 });
 (async()=>{try{await call('initialize',{clientInfo:{name:'openglassui',title:'OpenGlassUI',version:'0.1.0'},capabilities:{experimentalApi:true}});send({method:'initialized',params:{}});const guidance='Wenn du eine inhaltliche Entscheidung des Nutzers brauchst, frage mit request_user_input und schlage anhand der Aufgabe und bisherigen Ergebnisse kurze, konkrete Auswahlmöglichkeiten vor. Triff die Entscheidung nicht selbst.';const params=sessionId?{threadId:sessionId,cwd:workspace,approvalPolicy:'on-request'}:{cwd:workspace,approvalPolicy:'on-request',developerInstructions:guidance};const started=await call(sessionId?'thread/resume':'thread/start',params);threadId=started.thread.id;onSession(threadId);const startedTurn=await call('turn/start',{threadId,input:[{type:'text',text:prompt,text_elements:[]}]});turnId=startedTurn.turn.id;}catch(e){finish(e);}})();
 return {kill(){if(finished)return;if(threadId&&turnId){const deadline=setTimeout(()=>finish(new Error('Gestoppt.')),1000);deadline.unref();call('turn/interrupt',{threadId,turnId}).catch(()=>{}).finally(()=>{clearTimeout(deadline);finish(new Error('Gestoppt.'));});}else finish(new Error('Gestoppt.'));},forceKill(){finish(new Error('Gestoppt.'));}};
}
