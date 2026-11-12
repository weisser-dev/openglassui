import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAutostart } from '../autostart.js';

test('macOS login item can be enabled and disabled without overwriting unrelated files', async t => {
  const home = await mkdtemp(path.join(tmpdir(), 'openglass-autostart-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const item = createAutostart({ platform:'darwin', home, node:'/node & test', server:'/app/server.js', config:'/config', dataDir:'/data', envPath:'/bin' });
  const file = path.join(home, 'Library/LaunchAgents/dev.weisser.openglassui.plist');
  assert.equal((await item.status()).enabled, false);
  assert.equal((await item.set(true)).enabled, true);
  const content = await readFile(file, 'utf8');
  assert.match(content, /\/node &amp; test/);
  assert.match(content, /<key>RunAtLoad<\/key><true\/>/);
  assert.equal((await item.set(false)).enabled, false);
  await mkdir(path.dirname(file), { recursive:true });
  await writeFile(file, 'unmanaged');
  await assert.rejects(item.set(true), /unmanaged/);
  await assert.rejects(item.set(false), /unmanaged/);
  assert.equal(await readFile(file, 'utf8'), 'unmanaged');
});

test('login item clearly reports unsupported platforms', async () => {
  const item = createAutostart({ platform:'linux', server:'/server', config:'/config', dataDir:'/data' });
  assert.equal((await item.status()).supported, false);
  await assert.rejects(item.set(true), /macOS only/);
});
