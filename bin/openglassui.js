#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: openglassui\nStarts the local OpenGlassUI dashboard. Configuration is stored in ~/.openglassui.');
} else if (process.argv.length > 2) {
  console.error('Unknown option. Run openglassui --help for usage.');
  process.exitCode = 1;
} else {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dataDir = path.resolve(process.env.OPENGLASS_DATA_DIR || path.join(homedir(), '.openglassui'));
  const configPath = path.resolve(process.env.OPENGLASS_CONFIG || path.join(dataDir, 'config.json'));
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  if (!process.env.OPENGLASS_CONFIG) {
    const config = JSON.parse(await readFile(path.join(root, 'config.example.json'), 'utf8'));
    config.workspace = process.cwd();
    try { await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  process.env.OPENGLASS_CONFIG = configPath;
  process.env.OPENGLASS_DATA_DIR = dataDir;
  await import('../server.js');
}
