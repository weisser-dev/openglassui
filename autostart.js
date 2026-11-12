import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const label = 'dev.weisser.openglassui';
const marker = '<!-- OpenGlassUI managed login item -->';
const escapeXml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

// The login item is deliberately installed without starting a second copy now.
export function createAutostart({ platform = process.platform, home = homedir(), node = process.execPath, server, config, dataDir, envPath = process.env.PATH || '', port = process.env.PORT, gatewayPort = process.env.OPENGLASS_GATEWAY_PORT }) {
  const file = path.join(home, 'Library', 'LaunchAgents', `${label}.plist`);
  async function status() {
    if (platform !== 'darwin') return { supported: false, enabled: false };
    try {
      const contents = await readFile(file, 'utf8');
      return { supported: true, enabled: contents.includes(marker), conflict: !contents.includes(marker) };
    } catch (error) {
      if (error.code === 'ENOENT') return { supported: true, enabled: false };
      throw error;
    }
  }
  async function set(enabled) {
    if (platform !== 'darwin') throw new Error('Automatic login start is currently supported on macOS only.');
    const current = await status();
    if (current.conflict) throw new Error('An unmanaged login item already uses the OpenGlassUI name.');
    if (!enabled) {
      if (current.enabled) await unlink(file);
    } else {
      await mkdir(path.dirname(file), { recursive: true });
      const strings = [node, server].map(value => `<string>${escapeXml(value)}</string>`).join('');
      const environment = { OPENGLASS_CONFIG: config, OPENGLASS_DATA_DIR: dataDir, PATH: envPath, ...(port ? { PORT: port } : {}), ...(gatewayPort ? { OPENGLASS_GATEWAY_PORT: gatewayPort } : {}) };
      const env = Object.entries(environment).map(([key,value]) => `<key>${key}</key><string>${escapeXml(value)}</string>`).join('');
      const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n${marker}\n<plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${strings}</array><key>EnvironmentVariables</key><dict>${env}</dict><key>RunAtLoad</key><true/><key>WorkingDirectory</key><string>${escapeXml(home)}</string></dict></plist>\n`;
      await writeFile(file, plist, { mode: 0o600 });
    }
    return status();
  }
  return { status, set };
}
