import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(process.env.OPENGLASS_CONFIG || path.join(root, 'config.json'));
let config;
try { config = JSON.parse(await readFile(configPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; config = JSON.parse(await readFile(path.join(root, 'config.example.json'), 'utf8')); }
const workspace = await realpath(path.resolve(path.dirname(configPath), config.workspace || '.'));
const agents = config.agents || [];
const tasks = new Map();
const port = Number(process.env.PORT || 4173);
const host = '127.0.0.1';
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8' };
function json(res, status, data) { res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }); res.end(JSON.stringify(data)); }
function exposed(task) { const { process, ...data } = task; return data; }
async function body(req) { let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 16384) throw new Error('Eingabe zu lang'); } return JSON.parse(raw); }
function sameOrigin(req) { return req.headers.origin === `http://127.0.0.1:${port}` || req.headers.origin === `http://localhost:${port}`; }
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`);
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, { workspace, agents: agents.map(({id,name}) => ({id,name})), tasks: [...tasks.values()].map(exposed).reverse() });
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      if (!sameOrigin(req) || req.headers['content-type'] !== 'application/json') return json(res, 403, { error:'Zugriff verweigert.' });
      if (url.pathname === '/api/tasks') {
        const input = await body(req);
        const agent = agents.find(a => a.id === input.agentId);
        if (!agent || typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 8000) return json(res, 400, { error:'Bitte Agent und gültige Aufgabe auswählen.' });
        if (agent.input !== 'stdin' || typeof agent.command !== 'string' || !Array.isArray(agent.args) || !agent.args.every(a => typeof a === 'string')) return json(res, 400, { error:'Ungültige Agentenkonfiguration.' });
        const task = { id:randomUUID(), agentId:agent.id, agentName:agent.name, prompt:input.prompt.trim(), status:'running', output:'', createdAt:new Date().toISOString() };
        tasks.set(task.id, task);
        const child = spawn(agent.command, agent.args, { cwd:workspace, shell:false, stdio:['pipe','pipe','pipe'] }); task.process = child;
        const append = chunk => { task.output = (task.output + chunk.toString()).slice(-100000); };
        child.stdout.on('data', append); child.stderr.on('data', append); child.stdin.on('error', () => {});
        child.on('error', err => { append(`\n${err.message}`); task.status = 'failed'; });
        child.on('close', code => { if (task.status !== 'stopped' && task.status !== 'failed') task.status = code === 0 ? 'completed' : 'failed'; });
        child.stdin.end(task.prompt + '\n');
        return json(res, 201, exposed(task));
      }
      const match = url.pathname.match(/^\/api\/tasks\/([a-f0-9-]+)\/stop$/);
      if (match) { const task = tasks.get(match[1]); if (!task || task.status !== 'running') return json(res, 404, {error:'Laufende Aufgabe nicht gefunden.'}); task.status = 'stopped'; task.process.kill('SIGTERM'); return json(res, 200, exposed(task)); }
      return json(res, 404, {error:'Nicht gefunden.'});
    }
    if (req.method !== 'GET') return json(res, 405, {error:'Nicht unterstützt.'});
    const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!['index.html','app.js','style.css'].includes(filename)) return json(res, 404, {error:'Nicht gefunden.'});
    const data = await readFile(path.join(root, 'public', filename));
    res.writeHead(200, {'Content-Type':types[path.extname(filename)], 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"}); res.end(data);
  } catch (error) { json(res, 400, {error:error.message}); }
});
server.listen(port, host, () => console.log(`OpenGlassUI läuft lokal: http://${host}:${port}\nProjekt: ${workspace}`));
