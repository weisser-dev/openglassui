import http from 'node:http';
import { readFile, realpath, mkdir, writeFile, rename, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { WebSocketServer, WebSocket } from 'ws';
import { listAgentSessions, readAgentSession, runClaude, runCodex, discoverAgentProjects, listGlobalSessions, listCodexModels } from './sessions.js';
import { runKiro, listKiroSessions, readKiroSession, listAllKiroSessions, listOpenCodeSessions, readOpenCodeSession, listAllOpenCodeSessions } from './kiro.js';
import { createTunnelManager } from './tunnel.js';
import { createAcpClient } from './agent-client.js';
import { createCloudflaredInstaller } from './tunnel-installer.js';
import { createPushService } from './push.js';
import { formatSession } from './session-format.js';
import { readProjectRepository } from './project-metadata.js';
import { startConversationTurn, appendAssistantText, appendTranscriptText } from './conversation.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(process.env.OPENGLASS_CONFIG || path.join(root, 'config.json'));
let config;
try { config = JSON.parse(await readFile(configPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; config = JSON.parse(await readFile(path.join(root, 'config.example.json'), 'utf8')); }
const workspace = await realpath(path.resolve(path.dirname(configPath), config.workspace || '.'));
const agents = config.agents || [];
const dataDir = path.resolve(process.env.OPENGLASS_DATA_DIR || path.join(root, '.openglass'));
await mkdir(dataDir, { recursive:true, mode:0o700 });
const customAgentsPath=path.join(dataDir,'acp-agents.json');let customAgents=[];try{customAgents=JSON.parse(await readFile(customAgentsPath,'utf8'));if(!Array.isArray(customAgents))throw new Error('Invalid ACP agent list.');}catch(error){if(error.code!=='ENOENT')throw error;}
for(const entry of customAgents)if(entry?.type==='acp'&&!agents.some(agent=>agent.id===entry.id))agents.push(entry);
const isGenericAcp=agent=>agent?.type==='acp'&&!['kiro','opencode','codex','claude'].includes(agent.id);
let customAgentsQueue=Promise.resolve();function addCustomAgent(entry){customAgentsQueue=customAgentsQueue.catch(()=>{}).then(async()=>{const next=[...customAgents,entry],tmp=customAgentsPath+'.tmp';await writeFile(tmp,JSON.stringify(next),{mode:0o600});await rename(tmp,customAgentsPath);customAgents=next;agents.push(entry);changed();});return customAgentsQueue;}
const storePath = path.join(dataDir, 'tasks.json');
const projectsPath = path.join(dataDir, 'projects.json');
const setupPath = path.join(dataDir, 'setup.json');
let setupState={agent:'codex',agents:['codex'],projectId:'default',provider:'cloudflare',complete:false,autoStartTunnel:false};
let setupSelectionSaved=false;
try{const saved=JSON.parse(await readFile(setupPath,'utf8'));setupState={...setupState,...saved};setupSelectionSaved=Array.isArray(saved.agents)&&saved.agents.length>0;}catch(error){if(error.code!=='ENOENT')throw error;}
let setupQueue=Promise.resolve();
function saveSetup(){const snapshot=JSON.stringify(setupState);setupQueue=setupQueue.catch(()=>{}).then(async()=>{const temp=`${setupPath}.tmp`;await writeFile(temp,snapshot,{mode:0o600});await rename(temp,setupPath);});return setupQueue;}
async function executableAvailable(command){if(typeof command!=='string'||!command)return false;const dirs=path.isAbsolute(command)?['']:(process.env.PATH||'').split(path.delimiter);const extensions=process.platform==='win32'?(process.env.PATHEXT||'.EXE;.CMD;.BAT').split(';'):[''];for(const dir of dirs)for(const ext of extensions){try{await access(path.isAbsolute(command)?command:path.join(dir,command+ext),fsConstants.X_OK);return true;}catch{}}return false;}
let savedProjects = [];
try { savedProjects = JSON.parse(await readFile(projectsPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const projects = new Map([['default', {id:'default', name:path.basename(workspace) || workspace, path:workspace}], ...savedProjects.map(p => [p.id,p])]);
function projectById(id = 'default') { const project=projects.get(id); if(!project) throw new Error('Projekt nicht gefunden.'); return project; }
let projectsQueue=Promise.resolve();
function saveProjects() {const snapshot=JSON.stringify([...projects.values()].filter(p=>p.id!=='default'));projectsQueue=projectsQueue.catch(()=>{}).then(async()=>{const temporary=`${projectsPath}.tmp`;await writeFile(temporary,snapshot,{mode:0o600});await rename(temporary,projectsPath);});return projectsQueue;}

let stored = [];
try { stored = JSON.parse(await readFile(storePath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const tasks = new Map(stored.map(t => { const {pendingDecision,...rest}=t; return [t.id, {...rest, status: t.status === 'running' ? 'interrupted' : t.status}]; }));
const devicesPath=path.join(dataDir,'devices.json');
let savedDevices=[];try{savedDevices=JSON.parse(await readFile(devicesPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const devices=new Map(savedDevices.map(device=>[device.id,device]));
const hashToken=token=>createHash('sha256').update(token).digest('hex');
let devicesQueue=Promise.resolve();
function saveDevices(){const snapshot=JSON.stringify([...devices.values()]);devicesQueue=devicesQueue.catch(()=>{}).then(async()=>{const tmp=`${devicesPath}.tmp`;await writeFile(tmp,snapshot,{mode:0o600});await rename(tmp,devicesPath);});return devicesQueue;}
const push=await createPushService({dataDir,devices,saveDevices});
function notifyPush(kind){void push.notify(kind).catch(()=>{});}
const pairings = new Map(), decisions = new Map();
let revision=0; const watchers=new Set(), sockets=new Set();
function changed(){revision++;for(const notify of [...watchers])notify();for(const socket of [...sockets]){if(!socket.isLocal && !authorizedToken(socket.token)) {socket.close(1008,'Zugriff widerrufen');sockets.delete(socket);continue;}if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({revision}));}}
const port = Number(process.env.PORT || 4173), gatewayPort=Number(process.env.OPENGLASS_GATEWAY_PORT || port+1), host = '127.0.0.1';
if(!Number.isInteger(port) || !Number.isInteger(gatewayPort) || port<1 || gatewayPort<1 || port>65535 || gatewayPort>65535 || port===gatewayPort) throw new Error('Ungültiger lokaler oder Gateway-Port.');
const tunnel=createTunnelManager({port:gatewayPort});const tunnelInstaller=createCloudflaredInstaller();
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json; charset=utf-8' };
function json(res, status, data) { res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer' }); res.end(JSON.stringify(data)); }
function exposed(task) { const { process, ...data } = task; return data; }
let saveQueue = Promise.resolve();
function save() { changed(); const snapshot = JSON.stringify([...tasks.values()].map(exposed)); saveQueue = saveQueue.then(async () => { const temp = `${storePath}.tmp`; await writeFile(temp, snapshot, { mode:0o600 }); await rename(temp, storePath); }).catch(e => console.error('Speichern fehlgeschlagen:', e.message)); }
function assertCurrentAccess(req){if(!local(req) && !authorized(req)){const error=new Error('Zugriff widerrufen.');error.status=401;throw error;}}
async function body(req) { let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 16384) throw new Error('Eingabe zu lang'); } if(new URL(req.url,'http://localhost').pathname!=='/api/pair')assertCurrentAccess(req);return JSON.parse(raw || '{}'); }
function local(req) { return req.socket.localPort===port && [`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host) && !req.headers['x-forwarded-for'] && !req.headers['cf-connecting-ip'] && !req.headers.forwarded; }
function localOrigin(req) { return req.headers.origin === `http://127.0.0.1:${port}` || req.headers.origin === `http://localhost:${port}`; }
function deviceForToken(token) {if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;const hash=hashToken(token);return [...devices.values()].find(device=>device.tokenHash===hash) || null;}
function authorizedToken(token) {return Boolean(deviceForToken(token));}
function requestDevice(req){const header=req.headers.authorization || '';return header.startsWith('Bearer ')?deviceForToken(header.slice(7)):null;}
function authorized(req) { const header=req.headers.authorization || '';return header.startsWith('Bearer ') && authorizedToken(header.slice(7)); }
// Multiple agent requests can arrive concurrently. Never auto-approve or silently
// discard the later ones; present them one at a time, in arrival order.
function queueDecision(task,decision,signal){
 return new Promise(resolve=>{
  if(signal?.aborted){resolve({type:'deny'});return;}
  const queue=decisions.get(task.id) || [];
  const entry={decision,settle:null};
  const abort=()=>entry.settle({type:'deny'});
  entry.settle=answer=>{const index=queue.indexOf(entry);if(index<0)return;queue.splice(index,1);signal?.removeEventListener('abort',abort);if(queue.length){decisions.set(task.id,queue);task.pendingDecision=queue[0].decision;if(index===0 && task.status==='running')notifyPush('decision');}else{decisions.delete(task.id);delete task.pendingDecision;}save();resolve(answer);};
  queue.push(entry);decisions.set(task.id,queue);task.pendingDecision=queue[0].decision;signal?.addEventListener('abort',abort,{once:true});save();if(queue.length===1 && task.status==='running')notifyPush('decision');
 });
}
function cancelDecisions(task){while(decisions.get(task.id)?.length)decisions.get(task.id)[0].settle({type:'deny'});}
// The tool identifier belongs to one agent session; update the same card as
// ACP progress arrives. Avoid persisting command arguments or other raw payloads.
function updateTaskEvent(task,event){
 if(typeof event.id!=='string'||!event.id||event.id.length>200)return;
 const events=task.events ||= [];let item=events.find(entry=>entry.id===event.id);
 if(!item){item={id:event.id,title:'Werkzeug',status:'pending',createdAt:new Date().toISOString()};events.push(item);if(events.length>50)events.shift();}
 if(typeof event.title==='string' && event.title.trim())item.title=event.title.slice(0,160);
 if(typeof event.status==='string' && event.status.trim())item.status=event.status.slice(0,40);
 changed();
}
function publicTaskInput(input) { return typeof input.prompt === 'string' && input.prompt.trim() && input.prompt.length <= 8000; }
function run(agent, prompt, oldTask, project = projectById(oldTask?.projectId), model) {
  const workspace = project.path;
  const args = oldTask && !['kiro','opencode'].includes(agent.id) && !isGenericAcp(agent) ? agent.resumeArgs?.map(a => a === '{sessionId}' ? oldTask.sessionId : a) : agent.args;
  if ((!Array.isArray(args) || !args.every(a => typeof a === 'string') || agent.input !== 'stdin' || typeof agent.command !== 'string')) throw new Error('Dieser Agent unterstützt die Aktion nicht oder ist ungültig konfiguriert.');
  const task = oldTask || { id:randomUUID(), agentId:agent.id, agentName:agent.name, prompt:prompt.trim(), status:'running', output:'', createdAt:new Date().toISOString(), sessionId:null, projectId:project.id, projectName:project.name };
  startConversationTurn(task,prompt.trim());task.status = 'running'; task.lastMessageAt=new Date().toISOString(); task.trackedMessages=(task.trackedMessages || 0)+1; if (oldTask) task.output += `\n\n> ${prompt.trim()}\n`;
  tasks.set(task.id, task); save();
  if (['kiro','opencode'].includes(agent.id) || isGenericAcp(agent)) {
    const launch=isGenericAcp(agent)?options=>createAcpClient(agent).run(options):runKiro;const handle=launch({command:agent.command,args:agent.acpArgs || (isGenericAcp(agent)?agent.args:agent.id==='opencode'?['acp']:['acp','--agent-engine','v3']),agentName:agent.name,workspace,prompt,model,sessionId:oldTask?.sessionId,
      onModels(option){task.models=option.models;if(typeof option.current==='string')task.model=option.current;save();},onSession(id){task.sessionId=id;save();},onText(text){if(text)task.lastMessageAt=new Date().toISOString();appendAssistantText(task,text);task.output=(task.output+text).slice(-100000);changed();},onEvent(event){updateTaskEvent(task,event);},onUsage(usage){task.usage={...(task.usage || {}),provider:'kiro',[usage.kind==='context_usage'?'context':'turn']:usage};save();},
      onDecision(decision){return queueDecision(task,decision);},
      onDone(error){if(error){appendTranscriptText(task,error.message);task.output+=`\n${error.message}`;if(task.status!=='stopped')task.status='failed';}else if(task.status!=='stopped')task.status='completed';delete task.process;cancelDecisions(task);save();if(task.status==='completed'||task.status==='failed')notifyPush(task.status);}});
    task.process=handle;return task;
  }
  if (agent.id === 'codex') {
    const handle=runCodex({prompt,workspace,sessionId:oldTask?.sessionId,command:agent.command,model,
      onSession(id,actualModel){task.sessionId=id;if(actualModel)task.model=actualModel;save();},onModel(actualModel){task.model=actualModel;save();},onText(text){if(text)task.lastMessageAt=new Date().toISOString();appendAssistantText(task,text);task.output=(task.output+text).slice(-100000);changed();},onEvent(event){updateTaskEvent(task,event);},onUsage(usage){task.usage=usage;save();},
      onDecision(decision){return queueDecision(task,decision);},
      onDone(error){if(error){appendTranscriptText(task,error.message);task.output+=`\n${error.message}`;if(task.status!=='stopped')task.status='failed';}else if(task.status!=='stopped')task.status='completed';delete task.process;cancelDecisions(task);save();if(task.status==='completed'||task.status==='failed')notifyPush(task.status);}});
    task.process=handle;return task;
  }
  if (agent.id === 'claude') {
    const handle = runClaude({prompt, workspace, sessionId:oldTask?.sessionId,model,
      onModels(models){task.models=Array.isArray(models)?models.filter(item=>typeof item.value==='string').map(item=>({id:item.value,name:item.displayName||item.value})):[];save();},onMessage(message) { if(message.session_id) task.sessionId=message.session_id; if(message.type==='system'&&message.subtype==='init'&&message.model)task.model=message.model; if(message.type==='assistant') { const text=(message.message?.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n'); if(text){task.lastMessageAt=new Date().toISOString();appendAssistantText(task,text+'\n');task.output=(task.output+text+'\n').slice(-100000);} } if(message.type==='result') { if(message.usage || message.total_cost_usd!==undefined) task.usage={provider:'claude',usage:message.usage,costUsd:message.total_cost_usd}; if(message.is_error) task.status='failed'; } changed(); },
      onDecision(decision,signal) { return queueDecision(task,decision,signal); },
      onDone(error) { if(error) {appendTranscriptText(task,error.message);task.output+=`\n${error.message}`; if(task.status!=='stopped')task.status='failed';} else if(task.status!=='failed'&&task.status!=='stopped')task.status='completed'; delete task.process; cancelDecisions(task); save(); if(task.status==='completed'||task.status==='failed')notifyPush(task.status); }
    }); task.process=handle; return task;
  }
  const child = spawn(agent.command, args, { cwd:workspace, shell:false, stdio:['pipe','pipe','pipe'] }); task.process = child;
  let pending = '';
  const append = chunk => { if(chunk.length)task.lastMessageAt=new Date().toISOString();const text=chunk.toString();appendTranscriptText(task,text);task.output = (task.output + text).slice(-100000); changed(); };
  child.stdout.on('data', chunk => { const str = chunk.toString(); append(str); pending += str; const lines = pending.split('\n'); pending = lines.pop(); for (const line of lines) { try { const event = JSON.parse(line); if (agent.id === 'codex' && event.type === 'thread.started' && /^[0-9a-f-]{36}$/i.test(event.thread_id || '')) task.sessionId = event.thread_id; if (agent.id === 'claude' && /^[0-9a-f-]{36}$/i.test(event.session_id || '')) task.sessionId = event.session_id; } catch {} } });
  child.stderr.on('data', append); child.stdin.on('error', () => {});
  child.on('error', err => { append(`\n${err.message}`); task.status = 'failed'; save(); });
  child.on('close', code => { if (task.status !== 'stopped' && task.status !== 'failed') task.status = code === 0 ? 'completed' : 'failed'; delete task.process; save(); if(task.status==='completed'||task.status==='failed')notifyPush(task.status); });
  child.stdin.end(prompt.trim() + '\n');
  return task;
}
const handler = async (req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`);
    const isLocal = local(req);
    if (url.pathname === '/api/pair' && req.method === 'POST') {
      if (req.headers['content-type'] !== 'application/json') return json(res,403,{error:'Zugriff verweigert.'});
      const input = await body(req); const entry = pairings.get(input.code); pairings.delete(input.code);
      if (!entry || entry < Date.now()) return json(res,401,{error:'Kopplungscode ungültig oder abgelaufen.'});
      const token = randomBytes(32).toString('base64url');const device={id:randomUUID(),name:'Brille',createdAt:new Date().toISOString(),tokenHash:hashToken(token)};devices.set(device.id,device);try{await saveDevices();}catch(error){devices.delete(device.id);throw error;}return json(res,200,{token});
    }
    if (url.pathname.startsWith('/api/')) {
      if (!isLocal && !authorized(req)) return json(res,401,{error:'Bitte zuerst koppeln.'});
      if (req.method === 'GET' && url.pathname === '/api/sessions') { const agent=url.searchParams.get('agent'); const cfg=agents.find(a=>a.id===agent); const project=projectById(url.searchParams.get('projectId') || 'default'); if(!cfg || (!['claude','codex','kiro','opencode'].includes(agent)&&!isGenericAcp(cfg))) return json(res,400,{error:'Agent nicht unterstützt.'}); const sessions=await (isGenericAcp(cfg)?createAcpClient(cfg).listSessions(project.path):agent==='kiro'?listKiroSessions(project.path,cfg.command):agent==='opencode'?listOpenCodeSessions(project.path,cfg.command):listAgentSessions(agent,project.path,cfg.command));assertCurrentAccess(req);return json(res,200,{sessions}); }
      const sessionMatch=url.pathname.match(/^\/api\/sessions\/([a-z0-9_-]+)\/([a-z0-9_-]+)$/i);
      if (req.method === 'GET' && sessionMatch) { const cfg=agents.find(a=>a.id===sessionMatch[1]); if(!cfg || (!['codex','claude','kiro','opencode'].includes(cfg.id)&&!isGenericAcp(cfg)))return json(res,404,{error:'Agent not configured or does not support session browsing.'}); const project=projectById(url.searchParams.get('projectId') || 'default'); const session=await (isGenericAcp(cfg)?createAcpClient(cfg).readSession(project.path,sessionMatch[2]):sessionMatch[1]==='kiro'?readKiroSession(project.path,sessionMatch[2],cfg.command):sessionMatch[1]==='opencode'?readOpenCodeSession(project.path,sessionMatch[2],cfg.command):readAgentSession(sessionMatch[1],sessionMatch[2],project.path,cfg.command));assertCurrentAccess(req);return json(res,200,{session,text:formatSession(session,sessionMatch[1])}); }
      if (req.method === 'GET' && url.pathname === '/api/models') {const agent=agents.find(a=>a.id===url.searchParams.get('agent'));if(agent&&(agent.id==='claude'||['kiro','opencode'].includes(agent.id)||isGenericAcp(agent))){const task=tasks.get(url.searchParams.get('task'));return json(res,200,{models:task?.agentId===agent.id?task.models||[]:[],supported:Boolean(task?.agentId===agent.id&&task.models?.length)});}if(!agent || agent.id!=='codex')return json(res,200,{models:[],supported:false});const models=await listCodexModels(agent.command);assertCurrentAccess(req);return json(res,200,{models,supported:true});}
      if (req.method === 'GET' && url.pathname === '/api/push/status') { const device=requestDevice(req);if(!device)return json(res,403,{error:'Only paired devices can check background alerts.'});return json(res,200,{enabled:Boolean(device.push)}); }
      if (req.method === 'GET' && url.pathname === '/api/push/key') { if(!requestDevice(req))return json(res,403,{error:'Nur gekoppelte Geräte können Push aktivieren.'});return json(res,200,{publicKey:push.publicKey}); }
      if (req.method === 'GET' && url.pathname === '/api/devices') { if(!isLocal)return json(res,403,{error:'Nur lokal verfügbar.'});return json(res,200,{devices:[...devices.values()].map(({id,name,createdAt,push,pushDelivery})=>({id,name,createdAt,pushEnabled:Boolean(push),pushDelivery:pushDelivery || null}))}); }
      if (req.method === 'GET' && url.pathname === '/api/tunnel/install-status') {if(!isLocal)return json(res,403,{error:'Available locally only.'});return json(res,200,{...tunnelInstaller.status(),platform:process.platform,brewAvailable:await executableAvailable('brew'),installed:await executableAvailable('cloudflared')});}
      if (req.method === 'GET' && url.pathname === '/api/tunnel') { if(!isLocal)return json(res,403,{error:'Nur lokal verfügbar.'}); return json(res,200,tunnel.status()); }
      if (req.method === 'GET' && url.pathname === '/api/setup') {if(!isLocal)return json(res,403,{error:'Available locally only.'});const available=await Promise.all(agents.map(async agent=>({id:agent.id,name:agent.name,type:agent.type||'agent',installed:await executableAvailable(agent.command)})));return json(res,200,{setup:setupState,agents:available,projects:[...projects.values()].map(({id,name,path})=>({id,name,path})),tunnel:tunnel.status()});}
      if (req.method === 'GET' && url.pathname === '/api/changes') {
        const since=Number(url.searchParams.get('since')); if(!Number.isSafeInteger(since) || since<0) return json(res,400,{error:'Ungültige Revision.'});
        if(since!==revision) return json(res,200,{revision});
        let timer; const finish=()=>{clearTimeout(timer);watchers.delete(finish);if(!res.writableEnded && !res.destroyed)json(res,200,{revision});};
        watchers.add(finish); timer=setTimeout(finish,25000); res.on('close',()=>{clearTimeout(timer);watchers.delete(finish);}); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/state') return json(res,200,{revision,workspace,projects:[...projects.values()].map(({id,name})=>({id,name})),agents:agents.filter(a=>!setupSelectionSaved || setupState.agents.includes(a.id)).map(({id,name})=>({id,name})),tasks:[...tasks.values()].map(exposed).reverse()});
      if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json' || (isLocal && !localOrigin(req))) return json(res,403,{error:'Zugriff verweigert.'});
      if(url.pathname==='/api/setup'){if(!isLocal)return json(res,403,{error:'Available locally only.'});const input=await body(req),selected=input.agents ?? [input.agent];if(!Array.isArray(selected)||!selected.length||new Set(selected).size!==selected.length||selected.some(id=>!agents.some(a=>a.id===id))||!selected.includes(input.agent)||!projects.has(input.projectId)||!['cloudflare','ngrok','tailscale'].includes(input.provider)||typeof input.complete!=='boolean'||(input.autoStartTunnel!==undefined&&typeof input.autoStartTunnel!=='boolean'))return json(res,400,{error:'Invalid setup selection.'});setupState={agent:input.agent,agents:selected,projectId:input.projectId,provider:input.provider,complete:input.complete,autoStartTunnel:input.autoStartTunnel??setupState.autoStartTunnel??false};await saveSetup();setupSelectionSaved=true;changed();return json(res,200,{setup:setupState});}
      if(url.pathname==='/api/push/subscription' || url.pathname==='/api/push/unsubscribe'){
        const device=requestDevice(req);if(!device)return json(res,403,{error:'Nur gekoppelte Geräte können Push konfigurieren.'});
        if(url.pathname==='/api/push/unsubscribe')await push.unsubscribe(device);else{const input=await body(req);await push.subscribe(device,input.subscription);}return json(res,200,{ok:true});
      }
      const deviceMatch=url.pathname.match(/^\/api\/devices\/([a-f0-9-]+)\/(revoke|rename)$/);
      if(deviceMatch){if(!isLocal)return json(res,403,{error:'Nur lokal verfügbar.'});const device=devices.get(deviceMatch[1]);if(!device)return json(res,404,{error:'Gerät nicht gefunden.'});if(deviceMatch[2]==='revoke')devices.delete(device.id);else{const input=await body(req);if(typeof input.name!=='string'||!input.name.trim()||input.name.length>80)return json(res,400,{error:'Bitte einen gültigen Namen angeben.'});device.name=input.name.trim();}await saveDevices();changed();return json(res,200,{ok:true});}
      if (url.pathname === '/api/tunnel/install-cloudflared') {if(!isLocal)return json(res,403,{error:'Available locally only.'});await body(req);if(!await executableAvailable('brew'))return json(res,400,{error:'Homebrew is not available in PATH. Install it first or use the provider instructions.'});if(await executableAvailable('cloudflared'))return json(res,200,{status:'completed',error:null});return json(res,200,tunnelInstaller.start());}
      if (url.pathname === '/api/tunnel/start') { if(!isLocal)return json(res,403,{error:'Nur lokal verfügbar.'}); const input=await body(req);return json(res,200,tunnel.start(input.provider)); }
      if (url.pathname === '/api/tunnel/stop') { if(!isLocal)return json(res,403,{error:'Nur lokal verfügbar.'});return json(res,200,tunnel.stop()); }
      if(url.pathname==='/api/agents/acp'){
        if(!isLocal)return json(res,403,{error:'Available locally only.'});const input=await body(req);
        if(typeof input.name!=='string'||!input.name.trim()||input.name.length>80||typeof input.command!=='string'||!input.command.trim()||input.command.length>500||!Array.isArray(input.args)||input.args.length>30||!input.args.every(arg=>typeof arg==='string'&&arg.length<=500))return json(res,400,{error:'Enter a valid name, executable and argument array.'});
        const entry={id:'acp-'+randomUUID(),name:input.name.trim(),type:'acp',command:input.command.trim(),args:input.args,input:'stdin'};await addCustomAgent(entry);return json(res,201,{id:entry.id,name:entry.name,type:entry.type});
      }
      if (url.pathname === '/api/sessions/discover') {
        if(!isLocal)return json(res,403,{error:'Nur lokal verfügbar.'});const input=await body(req),cfg=agents.find(a=>a.id===input.agent);
        if(!cfg || (!['codex','claude','kiro','opencode'].includes(input.agent)&&!isGenericAcp(cfg)))return json(res,400,{error:'Agent nicht unterstützt.'});
        const sessions=await (isGenericAcp(cfg)?createAcpClient(cfg).discoverSessions(workspace):input.agent==='kiro'?listAllKiroSessions(workspace,cfg.command):input.agent==='opencode'?listAllOpenCodeSessions(workspace,cfg.command):listGlobalSessions(input.agent,cfg.command));const visible=[],repositoryCache=new Map();
        for(const session of sessions){try{if(typeof session.cwd!=='string'||!path.isAbsolute(session.cwd))continue;const cwd=await realpath(session.cwd);const stat=await import('node:fs/promises').then(fs=>fs.stat(cwd));if(!stat.isDirectory())continue;if(!repositoryCache.has(cwd))repositoryCache.set(cwd,await readProjectRepository(cwd));visible.push({...session,cwd,repository:repositoryCache.get(cwd),projectId:[...projects.values()].find(p=>p.path===cwd)?.id || null});}catch{}}
        return json(res,200,{sessions:visible});
      }
      if (url.pathname === '/api/projects/discover') {
        if(!isLocal)return json(res,403,{error:'Nur lokal verfügbar.'});await body(req);
        const result=await discoverAgentProjects({command:agents.find(a=>a.id==='codex')?.command || 'codex'});const found=new Map();
        for(const candidate of result.projects){try{if(!path.isAbsolute(candidate.path))continue;const resolved=await realpath(candidate.path);const stat=await import('node:fs/promises').then(fs=>fs.stat(resolved));if(!stat.isDirectory() || [...projects.values()].some(p=>p.path===resolved))continue;const item=found.get(resolved) || {path:resolved,name:path.basename(resolved),sources:[],sessions:0};item.sessions+=candidate.sessions;item.sources=[...new Set([...item.sources,...candidate.sources])];found.set(resolved,item);}catch{}}
        return json(res,200,{projects:[...found.values()],unavailable:result.unavailable});
      }
      const projectMatch=url.pathname.match(/^\/api\/projects\/([a-f0-9-]+)\/(remove|rename)$/);
      if(projectMatch){if(!isLocal)return json(res,403,{error:'Projekte können nur lokal konfiguriert werden.'});const project=projects.get(projectMatch[1]);if(!project)return json(res,404,{error:'Projekt nicht gefunden.'});if(projectMatch[2]==='remove'){if([...tasks.values()].some(task=>task.projectId===project.id && task.status==='running'))return json(res,409,{error:'Dieses Projekt hat noch laufende Aufgaben.'});projects.delete(project.id);}else{const input=await body(req);if(typeof input.name!=='string'||!input.name.trim()||input.name.length>100)return json(res,400,{error:'Bitte einen gültigen Namen angeben.'});project.name=input.name.trim();}await saveProjects();changed();return json(res,200,{ok:true});}
      if (url.pathname === '/api/projects') {
        if (!isLocal) return json(res,403,{error:'Projekte können nur lokal konfiguriert werden.'});
        const input=await body(req); if(typeof input.path!=='string' || !path.isAbsolute(input.path) || typeof input.name!=='string' || !input.name.trim() || input.name.length>100) return json(res,400,{error:'Bitte Namen und absoluten Projektpfad angeben.'});
        const resolved=await realpath(input.path); const info=await import('node:fs/promises').then(fs=>fs.stat(resolved)); if(!info.isDirectory()) return json(res,400,{error:'Projektpfad ist kein Verzeichnis.'});
        if([...projects.values()].some(p=>p.path===resolved)) return json(res,409,{error:'Dieses Projekt ist bereits eingerichtet.'});
        const project={id:randomUUID(),name:input.name.trim(),path:resolved}; projects.set(project.id,project); await saveProjects(); changed(); return json(res,201,{id:project.id,name:project.name});
      }
      if (url.pathname === '/api/pairing') {
        if (!isLocal) return json(res,403,{error:'Nur lokal verfügbar.'});
        const input=await body(req); let base; try { base=new URL(input.url); } catch { return json(res,400,{error:'Bitte eine öffentliche HTTPS-Adresse angeben.'}); }
        if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname!=='/') return json(res,400,{error:'Bitte eine öffentliche HTTPS-Adresse ohne Pfad oder Zugangsdaten angeben.'});
        const code=randomBytes(24).toString('base64url'); pairings.clear(); pairings.set(code,Date.now()+5*60*1000);
        const link=new URL('/glass.html',base); link.hash=`pair=${code}`;
        const deepLink=`fb-viewapp://web_app_deep_link?appName=${encodeURIComponent('OpenGlassUI')}&appUrl=${encodeURIComponent(link.href)}`;
        return json(res,200,{url:link.href,deepLink,qr:await QRCode.toDataURL(deepLink,{errorCorrectionLevel:'H',margin:4,width:512}),expiresIn:300});
      }
      if (url.pathname === '/api/revoke') { if (!isLocal) return json(res,403,{error:'Nur lokal verfügbar.'}); devices.clear(); pairings.clear(); await saveDevices(); changed(); return json(res,200,{ok:true}); }
      if (url.pathname === '/api/sessions/open') {
        const input=await body(req), cfg=agents.find(a=>a.id===input.agent); if(!cfg || (!['codex','claude','kiro','opencode'].includes(input.agent)&&!isGenericAcp(cfg)))return json(res,400,{error:'Agent nicht unterstützt.'});
        const project=projectById(input.projectId || 'default'); const data=await (isGenericAcp(cfg)?createAcpClient(cfg).readSession(project.path,input.id):input.agent==='kiro'?readKiroSession(project.path,input.id,cfg.command):input.agent==='opencode'?readOpenCodeSession(project.path,input.id,cfg.command):readAgentSession(input.agent,input.id,project.path,cfg.command));assertCurrentAccess(req);
        const task={id:randomUUID(),agentId:input.agent,agentName:cfg.name,prompt:'Importierte Sitzung',status:'completed',output:formatSession(data,input.agent),createdAt:new Date().toISOString(),sessionId:input.id,projectId:project.id,projectName:project.name};
        tasks.set(task.id,task);save();return json(res,201,exposed(task));
      }
      if (url.pathname === '/api/tasks') {
        const input=await body(req), agent=agents.find(a=>a.id===input.agentId);
        if (!agent || !publicTaskInput(input)) return json(res,400,{error:'Bitte Agent und gültige Aufgabe auswählen.'});
        if(input.model!==undefined&&(!['codex','claude'].includes(agent.id)||typeof input.model!=='string'||!/^[-a-zA-Z0-9_.:]{1,120}$/.test(input.model)))return json(res,400,{error:'Invalid or unsupported model.'});const project=projectById(input.projectId || 'default'); return json(res,201,exposed(run(agent,input.prompt,null,project,input.model)));
      }
      const decisionMatch=url.pathname.match(/^\/api\/tasks\/([a-f0-9-]+)\/decision$/);
      if (decisionMatch) {
        const input=await body(req);const task=tasks.get(decisionMatch[1]), resolve=decisions.get(decisionMatch[1])?.[0]?.settle, pending=task?.pendingDecision;
        if (!resolve || !pending || input.decisionId!==pending.id) return json(res,409,{error:'Entscheidung nicht mehr offen.'});
        if (pending.kind==='kiro_permission' && input.type==='choice') { const option=pending.input.options.find(o=>o.optionId===input.optionId); if(!option) return json(res,400,{error:'Ungültige Auswahl.'}); resolve({optionId:option.optionId}); return json(res,200,{ok:true}); }
        if (pending.kind==='approval' && ['allow','deny'].includes(input.type)) {resolve({type:input.type}); return json(res,200,{ok:true});}
        if (pending.kind==='question' && input.type==='answer' && input.answers && typeof input.answers==='object') {
          const questions=pending.input?.questions; if(!Array.isArray(questions) || !questions.every(q=>typeof input.answers[q.question]==='string' && input.answers[q.question].length>0 && input.answers[q.question].length<=2000)) return json(res,400,{error:'Bitte alle Fragen beantworten.'});
          const answers=Object.fromEntries(questions.map(q=>[q.question,input.answers[q.question]])); resolve({type:'answer',answers}); return json(res,200,{ok:true});
        }
        if (input.type==='deny') {resolve({type:'deny'});return json(res,200,{ok:true});}
        return json(res,400,{error:'Ungültige Antwort.'});
      }
      const match=url.pathname.match(/^\/api\/tasks\/([a-f0-9-]+)\/(stop|resume)$/);
      if (match) {
        const task=tasks.get(match[1]); if (!task) return json(res,404,{error:'Aufgabe nicht gefunden.'});
        if (match[2] === 'stop') { if (task.status !== 'running' || !task.process) return json(res,409,{error:'Aufgabe läuft nicht.'}); task.status='stopped'; cancelDecisions(task); task.process.kill('SIGTERM'); save(); return json(res,200,exposed(task)); }
        const input=await body(req), agent=agents.find(a=>a.id===task.agentId);
        if (task.process) return json(res,409,{error:'Der vorherige Agent wird noch beendet. Bitte gleich erneut versuchen.'});
        if (task.status === 'running' || !task.sessionId || !(agent?.resumeArgs || ['kiro','opencode'].includes(agent?.id) || isGenericAcp(agent)) || !publicTaskInput(input)) return json(res,400,{error:'Diese Sitzung kann nicht fortgesetzt werden.'});
        if(input.model!==undefined){const validId=typeof input.model==='string'&&input.model.length>0&&input.model.length<=200;const knownAcp=(['kiro','opencode'].includes(agent.id)||isGenericAcp(agent))&&task.models?.some(item=>item.id===input.model);if(!validId||(!['codex','claude'].includes(agent.id)&&!knownAcp))return json(res,400,{error:'Invalid or unsupported model.'});}return json(res,200,exposed(run(agent,input.prompt,task,undefined,input.model)));
      }
      return json(res,404,{error:'Nicht gefunden.'});
    }
    if (req.method !== 'GET') return json(res,405,{error:'Nicht unterstützt.'});
    const filename=url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!['index.html','app.js','style.css','glass.html','glass.js','glass.css','sessions-ui.js','decisions.js','simulator.html','simulator.css','usage.js','notifications.js','spatial.js','webmcp.js','events.js','push-client.js','wearable-audio.js','wearable-navigation.js','recent-chats.js','glass-i18n.js','theme.js','sw.js','favicon.svg','setup-glasses.png','setup.js','i18n.js','.well-known/meta-wearables-manifest.json','icons/app-icon.svg'].includes(filename)) return json(res,404,{error:'Nicht gefunden.'});
    const data=await readFile(path.join(root,'public',filename));
    res.writeHead(200,{'Content-Type':types[path.extname(filename)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'"}); res.end(data);
  } catch (error) { json(res,error.status || 400,{error:error.message}); }
};
const server=http.createServer(handler), gateway=http.createServer(handler);
const eventServer=new WebSocketServer({noServer:true,maxPayload:4096});
for(const listener of [server,gateway])listener.on('upgrade',(req,socket,head)=>{
  if(req.url!=='/api/events' || eventServer.clients.size>=100){socket.destroy();return;}
  eventServer.handleUpgrade(req,socket,head,ws=>{
    ws.isLocal=local(req) && localOrigin(req);let authenticated=false;const deadline=setTimeout(()=>ws.close(1008,'Authentifizierung erforderlich'),5000);
    ws.on('error',()=>{});ws.on('close',()=>{clearTimeout(deadline);sockets.delete(ws);});
    ws.on('message',raw=>{if(authenticated)return;let data;try{data=JSON.parse(raw.toString())}catch{ws.close(1008,'Ungültige Anmeldung');return;}
      if(!data || typeof data!=='object' || Array.isArray(data)){ws.close(1008,'Ungültige Anmeldung');return;}
      if(!ws.isLocal && !authorizedToken(data.token)){ws.close(1008,'Zugriff verweigert');return;}authenticated=true;ws.token=data.token;clearTimeout(deadline);sockets.add(ws);ws.send(JSON.stringify({revision}));
    });
  });
});
const heartbeat=setInterval(()=>{for(const ws of sockets)if(ws.readyState===WebSocket.OPEN)ws.ping();},30000);heartbeat.unref();
server.listen(port,host,()=>console.log(`OpenGlassUI läuft lokal: http://${host}:${port}\nProjekt: ${workspace}`));
gateway.listen(gatewayPort,host,()=>{console.log(`Tunnel-Gateway: http://${host}:${gatewayPort}`);if(setupState.complete&&setupState.autoStartTunnel===true){try{tunnel.start(setupState.provider);}catch(error){console.error('Automatic tunnel start failed:',error.message);}}});

let shuttingDown=false;
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{if(shuttingDown)return;shuttingDown=true;tunnel.stop();for(const task of tasks.values()){if(task.status==='running' && task.process){task.status='stopped';cancelDecisions(task);if(task.process.forceKill)task.process.forceKill();else task.process.kill();}}save();for(const ws of sockets)ws.close();gateway.close();server.close(()=>{void Promise.allSettled([saveQueue,devicesQueue,projectsQueue,setupQueue]).then(()=>process.exit(0));});setTimeout(()=>process.exit(1),1500).unref();});
