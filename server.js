import http from 'node:http';
import { readFile, realpath, mkdir, writeFile, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const root = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(process.env.OPENGLASS_CONFIG || path.join(root, 'config.json'));
let config;
try { config = JSON.parse(await readFile(configPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; config = JSON.parse(await readFile(path.join(root, 'config.example.json'), 'utf8')); }
const workspace = await realpath(path.resolve(path.dirname(configPath), config.workspace || '.'));
const agents = config.agents || [];
const dataDir = path.resolve(process.env.OPENGLASS_DATA_DIR || path.join(root, '.openglass'));
await mkdir(dataDir, { recursive:true, mode:0o700 });
const storePath = path.join(dataDir, 'tasks.json');
let stored = [];
try { stored = JSON.parse(await readFile(storePath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const tasks = new Map(stored.map(t => [t.id, {...t, status: t.status === 'running' ? 'interrupted' : t.status}]));
const pairings = new Map(), tokens = new Set();
const port = Number(process.env.PORT || 4173), host = '127.0.0.1';
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8' };
function json(res, status, data) { res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer' }); res.end(JSON.stringify(data)); }
function exposed(task) { const { process, ...data } = task; return data; }
let saveQueue = Promise.resolve();
function save() { const snapshot = JSON.stringify([...tasks.values()].map(exposed)); saveQueue = saveQueue.then(async () => { const temp = `${storePath}.tmp`; await writeFile(temp, snapshot, { mode:0o600 }); await rename(temp, storePath); }).catch(e => console.error('Speichern fehlgeschlagen:', e.message)); }
async function body(req) { let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 16384) throw new Error('Eingabe zu lang'); } return JSON.parse(raw || '{}'); }
function local(req) { return [`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host) && !req.headers['x-forwarded-for'] && !req.headers['cf-connecting-ip'] && !req.headers.forwarded; }
function localOrigin(req) { return req.headers.origin === `http://127.0.0.1:${port}` || req.headers.origin === `http://localhost:${port}`; }
function authorized(req) { const token = (req.headers.authorization || '').replace(/^Bearer /, ''); return tokens.has(token); }
function publicTaskInput(input) { return typeof input.prompt === 'string' && input.prompt.trim() && input.prompt.length <= 8000; }
function run(agent, prompt, oldTask) {
  const args = oldTask ? agent.resumeArgs?.map(a => a === '{sessionId}' ? oldTask.sessionId : a) : agent.args;
  if (!Array.isArray(args) || !args.every(a => typeof a === 'string') || agent.input !== 'stdin' || typeof agent.command !== 'string') throw new Error('Dieser Agent unterstützt die Aktion nicht oder ist ungültig konfiguriert.');
  const task = oldTask || { id:randomUUID(), agentId:agent.id, agentName:agent.name, prompt:prompt.trim(), status:'running', output:'', createdAt:new Date().toISOString(), sessionId:null };
  task.status = 'running'; if (oldTask) task.output += `\n\n> ${prompt.trim()}\n`;
  tasks.set(task.id, task); save();
  const child = spawn(agent.command, args, { cwd:workspace, shell:false, stdio:['pipe','pipe','pipe'] }); task.process = child;
  let pending = '';
  const append = chunk => { task.output = (task.output + chunk.toString()).slice(-100000); };
  child.stdout.on('data', chunk => { const str = chunk.toString(); append(str); pending += str; const lines = pending.split('\n'); pending = lines.pop(); for (const line of lines) { try { const event = JSON.parse(line); if (agent.id === 'codex' && event.type === 'thread.started' && /^[0-9a-f-]{36}$/i.test(event.thread_id || '')) task.sessionId = event.thread_id; if (agent.id === 'claude' && /^[0-9a-f-]{36}$/i.test(event.session_id || '')) task.sessionId = event.session_id; } catch {} } });
  child.stderr.on('data', append); child.stdin.on('error', () => {});
  child.on('error', err => { append(`\n${err.message}`); task.status = 'failed'; save(); });
  child.on('close', code => { if (task.status !== 'stopped' && task.status !== 'failed') task.status = code === 0 ? 'completed' : 'failed'; delete task.process; save(); });
  child.stdin.end(prompt.trim() + '\n');
  return task;
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`);
    const isLocal = local(req);
    if (url.pathname === '/api/pair' && req.method === 'POST') {
      if (req.headers['content-type'] !== 'application/json') return json(res,403,{error:'Zugriff verweigert.'});
      const input = await body(req); const entry = pairings.get(input.code); pairings.delete(input.code);
      if (!entry || entry < Date.now()) return json(res,401,{error:'Kopplungscode ungültig oder abgelaufen.'});
      const token = randomBytes(32).toString('base64url'); tokens.add(token); return json(res,200,{token});
    }
    if (url.pathname.startsWith('/api/')) {
      if (!isLocal && !authorized(req)) return json(res,401,{error:'Bitte zuerst koppeln.'});
      if (req.method === 'GET' && url.pathname === '/api/state') return json(res,200,{workspace,agents:agents.map(({id,name})=>({id,name})),tasks:[...tasks.values()].map(exposed).reverse()});
      if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json' || (isLocal && !localOrigin(req))) return json(res,403,{error:'Zugriff verweigert.'});
      if (url.pathname === '/api/pairing') {
        if (!isLocal) return json(res,403,{error:'Nur lokal verfügbar.'});
        const input=await body(req); let base; try { base=new URL(input.url); } catch { return json(res,400,{error:'Bitte eine öffentliche HTTPS-Adresse angeben.'}); }
        if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) return json(res,400,{error:'Bitte eine öffentliche HTTPS-Adresse ohne Zugangsdaten angeben.'});
        const code=randomBytes(24).toString('base64url'); pairings.clear(); pairings.set(code,Date.now()+5*60*1000);
        const link=new URL('/glass.html',base); link.hash=`pair=${code}`;
        const deepLink=`fb-viewapp://web_app_deep_link?appName=${encodeURIComponent('OpenGlassUI')}&appUrl=${encodeURIComponent(link.href)}`;
        return json(res,200,{url:link.href,deepLink,qr:await QRCode.toDataURL(deepLink),expiresIn:300});
      }
      if (url.pathname === '/api/revoke') { if (!isLocal) return json(res,403,{error:'Nur lokal verfügbar.'}); tokens.clear(); pairings.clear(); return json(res,200,{ok:true}); }
      if (url.pathname === '/api/tasks') {
        const input=await body(req), agent=agents.find(a=>a.id===input.agentId);
        if (!agent || !publicTaskInput(input)) return json(res,400,{error:'Bitte Agent und gültige Aufgabe auswählen.'});
        return json(res,201,exposed(run(agent,input.prompt)));
      }
      const match=url.pathname.match(/^\/api\/tasks\/([a-f0-9-]+)\/(stop|resume)$/);
      if (match) {
        const task=tasks.get(match[1]); if (!task) return json(res,404,{error:'Aufgabe nicht gefunden.'});
        if (match[2] === 'stop') { if (task.status !== 'running' || !task.process) return json(res,409,{error:'Aufgabe läuft nicht.'}); task.status='stopped'; task.process.kill('SIGTERM'); save(); return json(res,200,exposed(task)); }
        const input=await body(req), agent=agents.find(a=>a.id===task.agentId);
        if (task.status === 'running' || !task.sessionId || !agent?.resumeArgs || !publicTaskInput(input)) return json(res,400,{error:'Diese Sitzung kann nicht fortgesetzt werden.'});
        return json(res,200,exposed(run(agent,input.prompt,task)));
      }
      return json(res,404,{error:'Nicht gefunden.'});
    }
    if (req.method !== 'GET') return json(res,405,{error:'Nicht unterstützt.'});
    const filename=url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!['index.html','app.js','style.css','glass.html','glass.js','glass.css'].includes(filename)) return json(res,404,{error:'Nicht gefunden.'});
    const data=await readFile(path.join(root,'public',filename));
    res.writeHead(200,{'Content-Type':types[path.extname(filename)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"}); res.end(data);
  } catch (error) { json(res,400,{error:error.message}); }
});
server.listen(port,host,()=>console.log(`OpenGlassUI läuft lokal: http://${host}:${port}\nProjekt: ${workspace}`));
