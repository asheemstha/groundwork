// Groundwork desktop app: runs the local server inside Electron and shows it in a native window.
const { app, BrowserWindow, Menu, dialog, nativeTheme, shell } = require('electron');
const path = require('path'), fs = require('fs'), net = require('net');

const ROOT = path.join(__dirname, '..');
// Running from source (npm run app) gets its own lock and uses the source folder's data, so it can run next to the installed app.
if (!app.isPackaged) app.setPath('userData', path.join(app.getPath('appData'), 'Groundwork Dev'));
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.setName('Groundwork');

const DATA = app.isPackaged ? path.join(app.getPath('userData'), 'data') : process.env.GW_DEV_DATA || path.join(ROOT, 'data');
fs.mkdirSync(DATA, { recursive: true });

// Main-process log, for troubleshooting: ~/Library/Application Support/Groundwork/main.log
const logFile = path.join(app.getPath('userData'), 'main.log');
const log = (...a) => fs.appendFile(logFile, `[${new Date().toISOString()}] ${a.join(' ')}\n`, () => {});
process.on('uncaughtException', e => log('uncaught', e.stack || e));

// A fixed port keeps the app's local storage stable between launches; fall back to any free port.
const freePort = pref => new Promise(resolve => {
  const s = net.createServer();
  s.once('error', () => { const t = net.createServer(); t.listen(0, '127.0.0.1', () => { const p = t.address().port; t.close(() => resolve(p)); }); });
  s.listen(pref, '127.0.0.1', () => s.close(() => resolve(pref)));
});

let win = null, port = 0, server = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 980, minHeight: 640, show: false,
    // The window buttons sit on the same line as the sidebar toggle and the page header (32px from the top).
    titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 20, y: 25 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#080807' : '#eae9e5',
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  const home = `http://127.0.0.1:${port}/`;
  win.loadURL(home);
  win.once('ready-to-show', () => win.show());
  // For testing only: GW_CAPTURE=/path/file.png saves the window's content once it has loaded.
  if (process.env.GW_CAPTURE) win.webContents.once('did-finish-load', () => setTimeout(async () => fs.writeFileSync(process.env.GW_CAPTURE, (await win.webContents.capturePage()).toPNG()), 2500));
  // Links to other sites (the client's pages, GitHub, docs) open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(home)) { e.preventDefault(); shell.openExternal(url); } });
  win.on('closed', () => { win = null; });
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
    { role: 'help', submenu: [
      { label: 'Groundwork on GitHub', click: () => shell.openExternal('https://github.com/asheemstha/groundwork') },
      { label: 'Show app data in Finder', click: () => shell.openPath(DATA) },
    ] },
  ]));
}

app.whenReady().then(async () => {
  try {
    port = await freePort(4478);
    Object.assign(process.env, { PORT: String(port), GW_DATA: DATA, GW_APP: '1' });
    global.gwDesktop = require('./updater')({ app, shell, repo: 'asheemstha/groundwork', log });
    server = require(path.join(ROOT, 'server.js'));
    await server.ready;
    log('server on', port, 'data', DATA, 'version', app.getVersion());
    buildMenu();
    createWindow();
  } catch (e) {
    log('boot failed', e.stack || e);
    dialog.showErrorBox('Groundwork couldn’t start', String(e.message || e));
    app.exit(1);
  }
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('activate', () => { if (!win && port) createWindow(); });
// Mac apps stay open when the window closes; a running plan keeps going in the background.
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

let quitting = false;
app.on('before-quit', e => {
  if (quitting || !server || !server.busy()) return;
  const r = dialog.showMessageBoxSync(win || undefined, {
    type: 'warning', buttons: ['Keep running', 'Quit anyway'], defaultId: 0, cancelId: 0,
    message: 'A scan or plan is still running', detail: 'Quitting stops it. Pages already planned are kept.',
  });
  if (r === 0) e.preventDefault(); else quitting = true;
});
