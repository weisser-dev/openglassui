import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';

// Kiro ACP uses newline-delimited JSON-RPC. One process owns one turn; no prompt
// is automatically retried after an interrupted transport.
export function runKiro({command='kiro-cli', args=['acp','--agent-engine','v3'], workspace, prompt, sessionId, onSession, onText, onUsage, onDecision, onDone}) {
 const child=spawn(command,args,{cwd:workspace,stdio:['pipe','pipe','pipe'],shell:false});
 const lines=createInterface({input:child.stdout}); const pending=new Map(); let sequence=0, activeSession=sessionId, replaying=Boolean(sessionId), finished=false, stderr='';
 const send=payload=>{ if(!child.stdin.destroyed) child.stdin.write(JSON.stringify({jsonrpc:'2.0',...payload})+'\n'); };
 const call=(method,params)=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});send({id,method,params});});
 function finish(error){if(finished)return;finished=true;for(const {reject} of pending.values())reject(error||new Error('Verbindung beendet'));pending.clear();child.kill();onDone(error);}
 child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-2000)});
 child.on('error',finish);child.on('close',code=>{if(!finished)finish(new Error(`Kiro-Verbindung beendet (${code}). ${stderr}`));});
 lines.on('line',async line=>{let message;try{message=JSON.parse(line)}catch{return;}
  if(message.id!==undefined && !message.method){const wait=pending.get(message.id);if(wait){pending.delete(message.id);message.error?wait.reject(new Error(message.error.message)):wait.resolve(message.result);}return;}
  if(message.id!==undefined && message.method){
   if(message.method!=='session/request_permission'){send({id:message.id,error:{code:-32601,message:'Not supported'}});return;}
   const options=(message.params.options || []).filter(option=>['allow_once','reject_once'].includes(option.kind));
   if(!options.length){send({id:message.id,result:{outcome:{outcome:'cancelled'}}});return;}
   const decision={id:randomUUID(),kind:'kiro_permission',toolName:'Kiro',input:{toolCall:message.params.toolCall,options}};
   try { const answer=await onDecision(decision); const chosen=options.find(option=>option.optionId===answer?.optionId);send({id:message.id,result:{outcome:chosen?{outcome:'selected',optionId:chosen.optionId}:{outcome:'cancelled'}}}); }
   catch {send({id:message.id,result:{outcome:{outcome:'cancelled'}}});} return;
  }
  if(message.method==='session/update' || message.method==='session/notification'){
   const params=message.params || {}; if(activeSession && params.sessionId && params.sessionId!==activeSession)return;
   const update=params.update || {}; const type=update.sessionUpdate || update.type;
   if(!replaying && ['agent_message_chunk','AgentMessageChunk'].includes(type)){const text=update.content?.text;if(typeof text==='string')onText(text);}
   if(!replaying && ['tool_call','tool_call_update','ToolCall','ToolCallUpdate'].includes(type)){const title=update.title || update.kind || 'Tool';onText(`\n[${title}${update.status?`: ${update.status}`:''}]\n`);}
   const meta=update._meta?.kiro; if(meta?.kind==='context_usage' || meta?.kind==='turn_completion')onUsage(meta);
  }
 });
 (async()=>{try{
   const initialized=await call('initialize',{protocolVersion:1,clientCapabilities:{},clientInfo:{name:'openglassui',version:'0.1.0'}});
   if(sessionId && !initialized.agentCapabilities?.loadSession)throw new Error('Diese Kiro-Version unterstützt das Wiederaufnehmen über ACP nicht.');
   const opened=await call(sessionId?'session/load':'session/new',{...(sessionId?{sessionId}:{}),cwd:workspace,mcpServers:[]});
   replaying=false;activeSession=sessionId || opened.sessionId; if(!activeSession)throw new Error('Kiro hat keine Sitzungs-ID zurückgegeben.');onSession(activeSession);
   const result=await call('session/prompt',{sessionId:activeSession,prompt:[{type:'text',text:prompt}]});
   if(result?.stopReason && !['end_turn','EndTurn'].includes(result.stopReason))throw new Error(`Kiro: ${result.stopReason}`);
   finish(null);
  }catch(error){finish(error);}})();
 return {kill(){if(activeSession)send({method:'session/cancel',params:{sessionId:activeSession}});finish(new Error('Gestoppt.'));}};
}

async function kiroRead(command, workspace, action) {
 const child=spawn(command,['acp','--agent-engine','v3'],{cwd:workspace,stdio:['pipe','pipe','pipe'],shell:false});
 const lines=createInterface({input:child.stdout});let seq=0;const pending=new Map(), replay=[];
 function send(value){if(!child.stdin.destroyed)child.stdin.write(JSON.stringify({jsonrpc:'2.0',...value})+'\n');}
 function call(method,params){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});send({id,method,params});});}
 child.on('error',error=>{for(const item of pending.values())item.reject(error);pending.clear()});
 child.on('close',()=>{for(const item of pending.values())item.reject(new Error('Kiro-Verbindung beendet.'));pending.clear()});
 lines.on('line',line=>{let msg;try{msg=JSON.parse(line)}catch{return;}if(msg.id!==undefined&&!msg.method){const item=pending.get(msg.id);if(item){pending.delete(msg.id);msg.error?item.reject(new Error(msg.error.message)):item.resolve(msg.result);}return;}
  if(msg.id!==undefined&&msg.method){send({id:msg.id,error:{code:-32601,message:'Not supported in read-only session browser'}});return;}
  if(msg.method==='session/update'){const u=msg.params?.update;if(u?.sessionUpdate==='agent_message_chunk' || u?.sessionUpdate==='user_message_chunk'){if(typeof u.content?.text==='string')replay.push({type:u.sessionUpdate==='user_message_chunk'?'user':'assistant',message:{content:u.content.text}});}}
 });
 const timer=setTimeout(()=>child.kill(),15000);
 try{const init=await call('initialize',{protocolVersion:1,clientCapabilities:{},clientInfo:{name:'openglassui',version:'0.1.0'}});if(!init.agentCapabilities?.sessionCapabilities?.list)throw new Error('Diese Kiro-Version unterstützt die Sitzungsliste nicht.');
  const list=await call('session/list',{cwd:workspace});const sessions=(list.sessions||[]).filter(s=>s.cwd===workspace);
  if(!action)return sessions.map(s=>({id:s.sessionId,agent:'kiro',title:s.title || 'Kiro-Sitzung',updatedAt:s.updatedAt}));
  if(!sessions.some(s=>s.sessionId===action))throw new Error('Sitzung nicht im konfigurierten Projekt gefunden.');
  if(!init.agentCapabilities.loadSession)throw new Error('Diese Kiro-Version unterstützt das Öffnen nicht.');
  await call('session/load',{sessionId:action,cwd:workspace,mcpServers:[]});return replay;
 }finally{clearTimeout(timer);child.kill();}
}
export const listKiroSessions=(workspace,command='kiro-cli')=>kiroRead(command,workspace);
export const readKiroSession=(workspace,id,command='kiro-cli')=>kiroRead(command,workspace,id);
