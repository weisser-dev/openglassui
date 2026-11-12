import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';

// Kiro ACP uses newline-delimited JSON-RPC. One process owns one turn; no prompt
// is automatically retried after an interrupted transport.
export function runKiro({command='kiro-cli', args=['acp','--agent-engine','v3'], workspace, prompt, sessionId, onSession, onText, onUsage, onEvent=()=>{}, onDecision, onDone, agentName='Kiro',model,onModels=()=>{}}) {
 const child=spawn(command,args,{cwd:workspace,stdio:['pipe','pipe','pipe'],shell:false});
 const lines=createInterface({input:child.stdout}); const pending=new Map(); let sequence=0, activeSession=sessionId, replaying=Boolean(sessionId), finished=false, modelOption=null;
 function updateModels(options){const option=Array.isArray(options)?options.find(item=>item?.type==='select'&&(item.category==='model'||item.id==='model')):null;if(!option)return;const choices=(option.options||[]).flatMap(item=>Array.isArray(item.options)?item.options:[item]).filter(item=>typeof item?.value==='string'&&typeof item?.name==='string').map(item=>({id:item.value,name:item.name}));modelOption={id:option.id,current:option.currentValue,models:choices};onModels(modelOption);}
 const send=payload=>{ if(!child.stdin.destroyed) child.stdin.write(JSON.stringify({jsonrpc:'2.0',...payload})+'\n'); };
 const call=(method,params)=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});send({id,method,params});});
 function finish(error){if(finished)return;finished=true;for(const {reject} of pending.values())reject(error||new Error('Verbindung beendet'));pending.clear();child.kill();onDone(error);}
 // Drain diagnostic output without persisting potentially sensitive URLs or credentials.
 child.stderr.on('data',()=>{});
 child.on('error',finish);child.on('close',code=>{if(!finished)finish(new Error(`${agentName} connection ended (${code}). Check the agent login and CLI configuration.`));});
 lines.on('line',async line=>{let message;try{message=JSON.parse(line)}catch{return;}
  if(message.id!==undefined && !message.method){const wait=pending.get(message.id);if(wait){pending.delete(message.id);message.error?wait.reject(new Error(message.error.message)):wait.resolve(message.result);}return;}
  if(message.id!==undefined && message.method){
   if(message.method!=='session/request_permission'){send({id:message.id,error:{code:-32601,message:'Not supported'}});return;}
   if(!activeSession || message.params?.sessionId!==activeSession){send({id:message.id,result:{outcome:{outcome:'cancelled'}}});return;}
   const options=(Array.isArray(message.params.options)?message.params.options:[]).filter(option=>option && typeof option.optionId==='string' && ['allow_once','reject_once'].includes(option.kind));
   if(!options.length){send({id:message.id,result:{outcome:{outcome:'cancelled'}}});return;}
   const decision={id:randomUUID(),kind:'kiro_permission',toolName:agentName,input:{toolCall:message.params.toolCall,options}};
   try { const answer=await onDecision(decision); const chosen=options.find(option=>option.optionId===answer?.optionId);send({id:message.id,result:{outcome:chosen?{outcome:'selected',optionId:chosen.optionId}:{outcome:'cancelled'}}}); }
   catch {send({id:message.id,result:{outcome:{outcome:'cancelled'}}});} return;
  }
  if(message.method==='session/update' || message.method==='session/notification'){
   const params=message.params || {}; if(!activeSession || params.sessionId!==activeSession)return;
   const update=params.update || {}; const type=update.sessionUpdate || update.type;
   if(!replaying && ['agent_message_chunk','AgentMessageChunk'].includes(type)){const text=update.content?.text;if(typeof text==='string')onText(text);}
   if(!replaying && ['tool_call','tool_call_update','ToolCall','ToolCallUpdate'].includes(type) && typeof update.toolCallId==='string'){onEvent({id:update.toolCallId,title:typeof update.title==='string'?update.title:undefined,status:typeof update.status==='string'?update.status:undefined});}
   if(type==='config_option_update')updateModels(update.configOptions);const meta=update._meta?.kiro; if(meta?.kind==='context_usage' || meta?.kind==='turn_completion')onUsage(meta);
  }
 });
 (async()=>{try{
   const initialized=await call('initialize',{protocolVersion:1,clientCapabilities:{},clientInfo:{name:'openglassui',version:'0.1.0'}});
   if(sessionId && !initialized.agentCapabilities?.loadSession)throw new Error(`${agentName} does not support resuming over ACP.`);
   const opened=await call(sessionId?'session/load':'session/new',{...(sessionId?{sessionId}:{}),cwd:workspace,mcpServers:[]});
   replaying=false;activeSession=sessionId || opened.sessionId; if(!activeSession)throw new Error(`${agentName} did not return a session ID.`);onSession(activeSession);updateModels(opened.configOptions);
   if(model){if(!modelOption?.models.some(item=>item.id===model))throw new Error('The selected model is not currently advertised by this agent.');const changed=await call('session/set_config_option',{sessionId:activeSession,configId:modelOption.id,value:model});updateModels(changed.configOptions);if(modelOption?.current!==model)throw new Error('The agent did not confirm the selected model.');}
   const result=await call('session/prompt',{sessionId:activeSession,prompt:[{type:'text',text:prompt}]});
   if(result?.stopReason && !['end_turn','EndTurn'].includes(result.stopReason))throw new Error(`${agentName}: ${result.stopReason}`);
   finish(null);
  }catch(error){finish(error);}})();
 return {kill(){if(activeSession)send({method:'session/cancel',params:{sessionId:activeSession}});finish(new Error('Gestoppt.'));}};
}

async function kiroRead(command, workspace, action, all=false, agent='kiro', argsOverride) {
 const args=argsOverride || (agent==='opencode'?['acp']:['acp','--agent-engine','v3']);
 const child=spawn(command,args,{cwd:workspace,stdio:['pipe','pipe','pipe'],shell:false});
 child.stderr.resume();
 const lines=createInterface({input:child.stdout});let seq=0,lastReplayType=null;const pending=new Map(), replay=[];
 function send(value){if(!child.stdin.destroyed)child.stdin.write(JSON.stringify({jsonrpc:'2.0',...value})+'\n');}
 function call(method,params){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});send({id,method,params});});}
 child.on('error',error=>{for(const item of pending.values())item.reject(error);pending.clear()});
 child.on('close',()=>{for(const item of pending.values())item.reject(new Error('Kiro-Verbindung beendet.'));pending.clear()});
 lines.on('line',line=>{let msg;try{msg=JSON.parse(line)}catch{return;}if(msg.id!==undefined&&!msg.method){const item=pending.get(msg.id);if(item){pending.delete(msg.id);msg.error?item.reject(new Error(msg.error.message)):item.resolve(msg.result);}return;}
  if(msg.id!==undefined&&msg.method){send({id:msg.id,error:{code:-32601,message:'Not supported in read-only session browser'}});return;}
  if(msg.method==='session/update' && action && msg.params?.sessionId===action){const u=msg.params?.update;if(u?.sessionUpdate==='agent_message_chunk' || u?.sessionUpdate==='user_message_chunk'){if(typeof u.content?.text==='string'){const type=u.sessionUpdate==='user_message_chunk'?'user':'assistant';if(type===lastReplayType)replay[replay.length-1].message.content+=u.content.text;else replay.push({type,message:{content:u.content.text}});lastReplayType=type;}}else if(u?.sessionUpdate==='tool_call' || u?.sessionUpdate==='tool_call_update')lastReplayType=null;}
 });
 const timer=setTimeout(()=>child.kill(),15000);
 try{const init=await call('initialize',{protocolVersion:1,clientCapabilities:{},clientInfo:{name:'openglassui',version:'0.1.0'}});if(!init.agentCapabilities?.sessionCapabilities?.list)throw new Error('Diese Kiro-Version unterstützt die Sitzungsliste nicht.');
  const sessions=[],cursors=new Set(),ids=new Set();let cursor;
  do {
   const list=await call('session/list',{...(all?{}:{cwd:workspace}),...(cursor!==undefined?{cursor}:{})});
   if(!Array.isArray(list?.sessions))throw new Error('Kiro hat eine ungültige Sitzungsliste zurückgegeben.');
   for(const session of list.sessions){if(session && (all || session.cwd===workspace) && typeof session.sessionId==='string' && !ids.has(session.sessionId)){ids.add(session.sessionId);sessions.push(session);}}
   cursor=list.nextCursor;
   if(cursor!=null){if(typeof cursor!=='string' || cursors.has(cursor) || cursors.size>=1000)throw new Error('Kiro hat eine ungültige Seitennavigation zurückgegeben.');cursors.add(cursor);}
  } while(cursor!=null);
  if(!action)return sessions.map(s=>({id:s.sessionId,agent,title:s.title || (agent==='kiro'?'Kiro session':'Agent session'),updatedAt:s.updatedAt,...(all?{cwd:s.cwd}:{})}));
  if(!sessions.some(s=>s.sessionId===action))throw new Error('Sitzung nicht im konfigurierten Projekt gefunden.');
  if(!init.agentCapabilities.loadSession)throw new Error('Diese Kiro-Version unterstützt das Öffnen nicht.');
  await call('session/load',{sessionId:action,cwd:workspace,mcpServers:[]});return replay;
 }finally{clearTimeout(timer);child.kill();}
}
export const listKiroSessions=(workspace,command='kiro-cli')=>kiroRead(command,workspace);
export const readKiroSession=(workspace,id,command='kiro-cli')=>kiroRead(command,workspace,id);
export const listAllKiroSessions=(workspace,command='kiro-cli')=>kiroRead(command,workspace,undefined,true);

export const listOpenCodeSessions=(workspace,command='opencode')=>kiroRead(command,workspace,undefined,false,'opencode');
export const readOpenCodeSession=(workspace,id,command='opencode')=>kiroRead(command,workspace,id,false,'opencode');
export const listAllOpenCodeSessions=(workspace,command='opencode')=>kiroRead(command,workspace,undefined,true,'opencode');

export const listGenericAcpSessions=(agent,workspace,all=false)=>kiroRead(agent.command,workspace,undefined,all,agent.id,agent.args);
export const readGenericAcpSession=(agent,workspace,id)=>kiroRead(agent.command,workspace,id,false,agent.id,agent.args);
