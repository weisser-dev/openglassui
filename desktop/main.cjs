const { app, BrowserWindow, Menu, Tray, dialog, nativeImage, session, shell, utilityProcess } = require('electron');
const { autoUpdater } = require('electron-updater');
const { join, delimiter } = require('node:path');
const { homedir } = require('node:os');
const { accessSync } = require('node:fs');
const metadata = require('../package.json');

const releases = 'https://github.com/weisser-dev/openglassui/releases';
const port = Number(process.env.PORT || 4173);
const origin = `http://127.0.0.1:${port}`;
let companion, window, tray;
let ready = false;
let quitting = false;
let allowQuit = false;
let includeWindow = !process.argv.includes('--background');
let updateCheckPending = false;
let installReady = false;

function dashboard() {
  includeWindow = true;
  if (!ready || quitting) return;
  if (!window) {
    window = new BrowserWindow({
      title: 'OpenGlassUI',
      width: 1150,
      height: 825,
      minWidth: 360,
      minHeight: 420,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    });
    window.on('closed', () => { window = null; });
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (new URL(url).origin === origin) void window?.loadURL(url);
      else if (/^https:\/\//i.test(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });
    window.webContents.on('will-navigate', (event, url) => {
      if (new URL(url).origin === origin) return;
      event.preventDefault();
      if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    });
    void window.loadURL(origin).catch(() => {
      if (!quitting) dialog.showErrorBox('OpenGlassUI', 'The local dashboard could not be opened.');
    });
  }
  window.show();
  window.focus();
}

function companionPath() {
  const directories = [];
  if (process.platform === 'darwin') {
    const home = homedir();
    directories.push('/opt/homebrew/bin', '/usr/local/bin', join(home, '.local/bin'),
      join(home, '.cargo/bin'), join(home, 'Library/pnpm'),
      ...[
        '/Applications/Codex.app/Contents/Resources/bin',
        '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin',
        '/Applications/Kiro CLI.app/Contents/MacOS'
      ].filter(path => { try { accessSync(path); return true; } catch { return false; } }));
  }
  if (process.platform === 'win32') {
    if (process.env.APPDATA) directories.push(join(process.env.APPDATA, 'npm'));
    if (process.env.ProgramFiles) directories.push(join(process.env.ProgramFiles, 'Tailscale'));
  }
  return [...new Set([...(process.env.PATH || '').split(delimiter), ...directories].filter(Boolean))].join(delimiter);
}

function startupError(message) {
  if (quitting) return;
  console.error(`OpenGlassUI could not start: ${message}`);
  dialog.showErrorBox('OpenGlassUI could not start', message);
  app.quit();
}

function startCompanion() {
  const startupTimer = setTimeout(() => startupError('The local companion did not start in time.'), 15000);
  companion = utilityProcess.fork(join(__dirname, 'companion.cjs'), [], {
    cwd: homedir(),
    env: { ...process.env, PATH: companionPath() }
  });
  companion.on('message', ({ type, message }) => {
    if (type === 'ready' && !quitting) {
      clearTimeout(startupTimer);
      ready = true;
      if (includeWindow) dashboard();
    } else if (type === 'error') {
      clearTimeout(startupTimer);
      startupError(message);
    }
  });
  companion.on('exit', () => {
    clearTimeout(startupTimer);
    companion = null;
    ready = false;
    if (quitting) return;
    startupError('The local companion stopped. Open OpenGlassUI again to restart it.');
  });
}

async function quitDesktop(install = false) {
  if (quitting) return;
  quitting = true;
  if (companion) {
    const child = companion;
    await new Promise(resolve => {
      const timer = setTimeout(() => { child.kill(); resolve(); }, 4000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      child.postMessage({ type: 'shutdown' });
    });
  }
  allowQuit = true;
  if (install) autoUpdater.quitAndInstall(false, true);
  else app.quit();
}

async function offerInstall() {
  const { response } = await dialog.showMessageBox({
    type: 'question', title: 'OpenGlassUI Update', message: 'Update downloaded',
    detail: 'Installing restarts the companion and interrupts any OpenGlassUI tasks currently running.',
    buttons: ['Later', 'Restart and install'], defaultId: 0, cancelId: 0
  });
  if (response === 1) await quitDesktop(true);
}

async function checkUpdates() {
  if (!app.isPackaged) {
    await shell.openExternal(releases);
    return;
  }
  if (installReady) return offerInstall();
  if (updateCheckPending) return;
  updateCheckPending = true;
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result?.isUpdateAvailable) {
      await dialog.showMessageBox({ type: 'info', message: 'OpenGlassUI is up to date.' });
    } else if (!metadata.desktopSigned) {
      const { response } = await dialog.showMessageBox({
        type: 'info', message: `OpenGlassUI ${result.updateInfo.version} is available.`,
        detail: 'Download the installer for your device from GitHub Releases.',
        buttons: ['Later', 'Open releases']
      });
      if (response === 1) await shell.openExternal(releases);
    } else {
      const { response } = await dialog.showMessageBox({
        type: 'info', message: `OpenGlassUI ${result.updateInfo.version} is available.`,
        buttons: ['Later', 'Download update']
      });
      if (response === 1) await autoUpdater.downloadUpdate();
    }
  } catch {
    const { response } = await dialog.showMessageBox({
      type: 'info', message: 'Could not check for an OpenGlassUI update.',
      buttons: ['Close', 'Open releases']
    });
    if (response === 1) await shell.openExternal(releases);
  } finally {
    updateCheckPending = false;
  }
}

function openTray() {
  const icon = nativeImage.createFromPath(join(__dirname, 'icon.png')).resize({ width: 22 });
  tray = new Tray(icon);
  tray.setToolTip('OpenGlassUI');
  tray.on('click', dashboard);
  const loginOptions = { args: ['--background'] };
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Dashboard', click: dashboard },
    {
      label: 'Start at login', type: 'checkbox',
      visible: app.isPackaged,
      checked: app.isPackaged && app.getLoginItemSettings(loginOptions).openAtLogin,
      click: item => app.setLoginItemSettings({ ...loginOptions, openAtLogin: item.checked })
    },
    { label: 'Check for Updates…', click: () => void checkUpdates() },
    { type: 'separator' },
    { label: 'Quit OpenGlassUI', click: () => app.quit() }
  ]));
}

function run() {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on('error', () => {});
  autoUpdater.on('update-downloaded', () => {
    if (!metadata.desktopSigned) return;
    installReady = true;
    void offerInstall();
  });
  openTray();
  startCompanion();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', dashboard);
  app.on('activate', () => { if (ready) dashboard(); });
  process.on('SIGTERM', () => app.quit());
  app.on('window-all-closed', () => {});
  app.on('before-quit', event => {
    if (allowQuit) return;
    event.preventDefault();
    void quitDesktop();
  });
  void app.whenReady().then(run).catch(error => startupError(error.message));
}
