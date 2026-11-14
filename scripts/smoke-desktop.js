import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

const dir = await mkdtemp(join(tmpdir(), 'openglass-desktop-'));
const isWindows = process.platform === 'win32';
const launch = isWindows
  ? join('dist', 'win-unpacked', 'OpenGlassUI.exe')
  : join('dist', process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'OpenGlassUI.app', 'Contents', 'MacOS', 'OpenGlassUI');
const config = join(dir, 'config.json');
const origin = 'http://127.0.0.1:36953';
const endpoint = pathname => fetch(origin + pathname, { signal: AbortSignal.timeout(2000) });
await writeFile(config, JSON.stringify({
  workspace: dir,
  agents: [{
    id: 'fixture', name: 'Fixture', command: process.execPath, input: 'stdin',
    args: ['-e', 'process.stdin.pipe(process.stdout)']
  }]
}));
const app = spawn(launch, ['--background'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: '36953', OPENGLASS_GATEWAY_PORT: '36954', OPENGLASS_CONFIG: config, OPENGLASS_DATA_DIR: dir }
});
const exit = once(app, 'exit');
try {
  let state;
  for (let attempt = 0; attempt < 80 && app.exitCode === null; attempt++) {
    try {
      const response = await endpoint('/api/state');
      if (response.ok) { state = await response.json(); break; }
    } catch { /* Wait for both listeners to start. */ }
    await delay(250);
  }
  assert.equal(state?.agents[0]?.id, 'fixture', 'Packaged companion failed to load');
  assert.match(await (await endpoint('/')).text(), /<title>OpenGlassUI<\/title>/);
  const submitted = await fetch(origin + '/api/tasks', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Packaged companion smoke test', agentId: 'fixture' }),
    signal: AbortSignal.timeout(3000)
  });
  assert.equal(submitted.status, 201);
  for (let attempt = 0; attempt < 30; attempt++) {
    state = await (await endpoint('/api/state')).json();
    if (state.tasks[0]?.status !== 'running') break;
    await delay(100);
  }
  assert.equal(state.tasks[0]?.status, 'completed');
  assert.match(state.tasks[0].output, /Packaged companion smoke test/);
  console.log('Packaged dashboard loaded and the companion executed a test task.');
} finally {
  if (app.exitCode === null && app.signalCode === null) {
    if (isWindows) {
      const taskkill = spawn('taskkill.exe', ['/PID', String(app.pid), '/T', '/F'], { stdio: 'ignore' });
      await once(taskkill, 'exit');
    } else {
      app.kill('SIGTERM');
      try { await once(app, 'exit', { signal: AbortSignal.timeout(7000) }); }
      catch { app.kill('SIGKILL'); }
    }
    await exit;
  }
  await rm(dir, { recursive: true, force: true, maxRetries: 4 });
}
