const { readFile, writeFile, mkdir } = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

async function start() {
  const dataDir = path.resolve(process.env.OPENGLASS_DATA_DIR || path.join(os.homedir(), '.openglassui'));
  const configPath = path.resolve(process.env.OPENGLASS_CONFIG || path.join(dataDir, 'config.json'));
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  if (!process.env.OPENGLASS_CONFIG) {
    const config = JSON.parse(await readFile(path.join(__dirname, '..', 'config.example.json'), 'utf8'));
    config.workspace = os.homedir();
    try {
      await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  Object.assign(process.env, { OPENGLASS_CONFIG: configPath, OPENGLASS_DATA_DIR: dataDir });
  const { pathToFileURL } = require('node:url');
  const runningFromArchive = __dirname.endsWith(path.join('app.asar', 'desktop'));
  const runtime = runningFromArchive ? path.join(__dirname, '..') + '.unpacked' : path.join(__dirname, '..');
  await import(pathToFileURL(path.join(runtime, 'server.js')).href);
}

start().catch(error => {
  process.parentPort.postMessage({ type: 'error', message: error.message });
  process.exit(1);
});
