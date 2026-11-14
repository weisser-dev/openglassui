import { createConnection } from 'node:net';
import { randomUUID } from 'node:crypto';
import { lstat, readdir, readFile, mkdir, chmod, rename, rm, mkdtemp } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const maxFrame = 16 * 1024 * 1024;
const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(message, status = 409) {
  return Object.assign(new Error(message), { status });
}

async function isPrivateSocket(location) {
  const directory = await lstat(resolve(location, '..'));
  const socket = await lstat(location);
  const uid = process.getuid();
  return directory.isDirectory() && socket.isSocket() &&
    directory.uid === uid && socket.uid === uid &&
    (directory.mode & 0o077) === 0 && (socket.mode & 0o077) === 0;
}

async function codexSocket() {
  const uid = process.getuid();
  const home = process.env.CODEX_HOME || join(homedir(), '.codex');
  const candidates = [join(home, 'ipc', 'ipc.sock'), join(tmpdir(), 'codex-ipc', `ipc-${uid}.sock`)];
  for (const candidate of candidates) {
    if (await isPrivateSocket(candidate).catch(() => false)) return candidate;
  }
  throw failure('Open Codex Desktop on the companion computer and select this chat.');
}

// Desktop's local window router uses 32-bit little-endian lengths followed by JSON.
function connectCodex(location) {
  const socket = createConnection(location);
  const pending = new Map();
  let buffer = Buffer.alloc(0);
  let clientId = '';
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    socket.destroy();
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(failure('Codex Desktop did not confirm delivery. Check the chat before trying again.', 504));
    }
    pending.clear();
  }
  function write(value) {
    const json = Buffer.from(JSON.stringify(value));
    const frame = Buffer.allocUnsafe(json.length + 4);
    frame.writeUInt32LE(json.length, 0);
    json.copy(frame, 4);
    socket.write(frame);
  }
  socket.on('error', close);
  socket.on('close', close);
  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE(0);
      if (!length || length > maxFrame) return close();
      if (buffer.length < length + 4) return;
      let message;
      try { message = JSON.parse(buffer.subarray(4, length + 4).toString()); }
      catch { return close(); }
      buffer = buffer.subarray(length + 4);
      if (message?.type === 'client-discovery-request') {
        write({ type: 'client-discovery-response', requestId: message.requestId, response: { canHandle: false } });
      }
      if (message?.type !== 'response') continue;
      const request = pending.get(message.requestId);
      if (!request) continue;
      pending.delete(message.requestId);
      clearTimeout(request.timer);
      if (message.method === 'initialize' && message.resultType === 'success') clientId = message.result?.clientId;
      request.resolve(message);
    }
  });
  return {
    close,
    request(method, params, { targetClientId, version = 1, timeoutMs = 3500 } = {}) {
      if (closed) throw failure('Codex Desktop disconnected.');
      return new Promise((resolve, reject) => {
        const requestId = randomUUID();
        const timer = setTimeout(close, timeoutMs + 500);
        pending.set(requestId, { resolve, reject, timer });
        write({ type: 'request', requestId, sourceClientId: clientId, version, method, params, targetClientId, timeoutMs });
      });
    }
  };
}

export async function sendToCodexDesktop({ sessionId, workspace, prompt, mode, authorize, location }) {
  const relay = connectCodex(location || await codexSocket());
  try {
    const initial = await relay.request('initialize', { clientType: 'openglassui' });
    if (initial.resultType !== 'success' || typeof initial.result?.clientId !== 'string') {
      throw failure('This Codex Desktop version could not connect to OpenGlassUI.');
    }
    const owner = await relay.request('thread-owner-discovery', { hostId: 'local', conversationId: sessionId });
    const targetClientId = owner.handledByClientId;
    if (owner.resultType !== 'success' || !targetClientId) throw failure('Select this chat in Codex Desktop and try again.');

    const input = [{ type: 'text', text: prompt, text_elements: [] }];
    const clientUserMessageId = randomUUID();
    const restoreMessage = {
      id: clientUserMessageId, text: prompt, cwd: workspace, createdAt: Date.now(),
      context: { prompt, workspaceRoots: [workspace], addedFiles: [], fileAttachments: [], imageAttachments: [], ideContext: null }
    };
    authorize();
    const result = mode === 'steer'
      ? await relay.request('thread-follower-steer-turn', {
        conversationId: sessionId, input, clientUserMessageId, restoreMessage, attachments: []
      }, { targetClientId, timeoutMs: 15000 })
      : await relay.request('thread-follower-start-turn', {
        conversationId: sessionId,
        turnStart: {
          request: { threadId: sessionId, input, clientUserMessageId },
          context: { inheritThreadSettings: true, restoreMessage }
        }
      }, { targetClientId, version: 2, timeoutMs: 20000 });
    if (result.resultType !== 'success') {
      if (result.error === 'no-client-found') throw failure('Select this chat in Codex Desktop and try again.');
      if (result.error === 'timeout') {
        throw failure('Codex Desktop did not confirm delivery. Check the chat before trying again.', 504);
      }
      throw failure(mode === 'steer'
        ? 'Codex Desktop could not steer the active turn. Check the chat for an active turn or pending decision.'
        : 'Codex Desktop did not accept the message. If the chat is working, use Steer active turn.');
    }
  } finally {
    relay.close();
  }
}

async function findClaudeDesktopId(sessionId) {
  const root = join(homedir(), 'Library', 'Application Support', 'Claude', 'claude-code-sessions');
  const matches = new Set();
  const folders = { withFileTypes: true };
  for (const account of await readdir(root, folders).catch(() => [])) {
    if (!account.isDirectory()) continue;
    const accountDir = join(root, account.name);
    for (const org of await readdir(accountDir, folders).catch(() => [])) {
      if (!org.isDirectory()) continue;
      const directory = join(accountDir, org.name);
      for (const file of await readdir(directory, folders).catch(() => [])) {
        if (!file.isFile() || !/^local_[a-z0-9-]{1,64}\.json$/i.test(file.name)) continue;
        try {
          const entry = JSON.parse(await readFile(join(directory, file.name), 'utf8'));
          if (entry.cliSessionId === sessionId && !entry.isArchived && entry.sessionId === file.name.slice(0, -5)) {
            matches.add(entry.sessionId);
          }
        } catch { /* Desktop can be replacing its session metadata. */ }
      }
    }
  }
  if (matches.size !== 1) throw failure('This session could not be matched to a Claude Desktop chat.');
  return [...matches][0];
}

export function supportsDesktopSession(task) {
  return process.platform === 'darwin' && !task.process && task.prompt === 'Importierte Sitzung' &&
    sessionIdPattern.test(task.sessionId || '') && ['codex', 'claude'].includes(task.agentId);
}

export async function installClaudeDesktopHelper(dataDir) {
  if (process.platform !== 'darwin') throw new Error('Claude Desktop sending is available on macOS.');
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const destination = join(dataDir, 'claude-desktop-send');
  const temporary = await mkdtemp(join(dataDir, '.desktop-helper-'));
  try {
    const output = join(temporary, 'claude-desktop-send');
    const source = fileURLToPath(new URL('./bin/claude-desktop-send.swift', import.meta.url));
    await exec('/usr/bin/swiftc', ['-O', source, '-o', output], { timeout: 120000 });
    await chmod(output, 0o700);
    await rename(output, destination);
    return destination;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function sendToDesktop({ task, prompt, mode, workspace, dataDir, authorize }) {
  if (!supportsDesktopSession(task)) throw failure('Desktop sending is unavailable for this chat.');
  if (task.agentId === 'codex') return sendToCodexDesktop({ sessionId: task.sessionId, prompt, mode, workspace, authorize });

  const helper = join(dataDir, 'claude-desktop-send');
  try {
    await exec(helper, ['--check'], { timeout: 2500 });
  } catch {
    throw failure('Set up Claude Desktop sending and grant Accessibility access on the companion Mac.');
  }
  const desktopId = await findClaudeDesktopId(task.sessionId);
  authorize();
  await new Promise((resolve, reject) => {
    const child = execFile(helper, [desktopId], { timeout: 15000 }, (error, stdout) => {
      const result = stdout.trim();
      if (!error && result === 'sent') return resolve();
      if (result === 'draft') return reject(failure('The message is in the Claude Desktop composer. Check it on the Mac before trying again.'));
      if (result === 'unavailable') return reject(failure('Open this exact chat in Claude Desktop and leave its composer empty.'));
      reject(failure('Claude Desktop did not confirm delivery. Check the chat before trying again.', 504));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(prompt, 'utf8');
  });
}
