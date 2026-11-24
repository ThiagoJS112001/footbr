const { app, BrowserWindow, dialog, ipcMain, protocol } = require('electron');
const { randomUUID } = require('node:crypto');
const { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const appUrl = 'footbr://game/';
protocol.registerSchemesAsPrivileged([{ scheme: 'footbr', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

if (require('electron-squirrel-startup') || !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let window;
  let server;
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => server?.close());

  app.whenReady().then(async () => {
    const { openDesktopServer } = require('./backend.cjs');
    const userData = app.getPath('userData');
    const saves = join(userData, 'saves');
    mkdirSync(saves, { recursive: true });
    const config = join(userData, '.env');
    if (existsSync(config)) process.loadEnvFile(config);
    const token = randomUUID();
    server = openDesktopServer(join(userData, 'footbr.sqlite'), join(app.getAppPath(), 'dist'), token);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    protocol.handle('footbr', async (request) => {
      const url = new URL(request.url);
      if (url.host !== 'game') return new Response(null, { status: 404 });
      const target = new URL(origin);
      target.pathname = url.pathname;
      target.search = url.search;
      const headers = { 'x-footbr-desktop': token };
      const contentType = request.headers.get('content-type');
      if (contentType) headers['content-type'] = contentType;
      return fetch(target, {
        method: request.method,
        headers,
        body: request.body ? Buffer.from(await request.arrayBuffer()) : undefined,
      });
    });

    window = new BrowserWindow({
      width: 1360,
      height: 900,
      minWidth: 780,
      minHeight: 560,
      autoHideMenuBar: true,
      webPreferences: { preload: join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => event.preventDefault());
    const registerSaveHandler = (channel, operation) => {
      ipcMain.on(channel, (event, slot, data) => {
        try {
          if (event.sender !== window.webContents || event.senderFrame?.url !== appUrl || ![0, 1, 2, 3].includes(slot)) throw new Error();
          event.returnValue = { ok: true, value: operation(join(saves, `slot-${slot}.save`), data) };
        } catch {
          event.returnValue = { ok: false };
        }
      });
    };
    registerSaveHandler('footbr:read-save', (file) => existsSync(file) ? readFileSync(file, 'utf8') : null);
    registerSaveHandler('footbr:write-save', (file, data) => {
      if (typeof data !== 'string' || data.length > 30_000_000) throw new Error();
      const temp = file + '.tmp';
      try {
        writeFileSync(temp, data, { encoding: 'utf8', flush: true });
        renameSync(temp, file);
      } finally {
        rmSync(temp, { force: true });
      }
    });
    await window.loadURL(appUrl);
  }).catch((error) => {
    dialog.showErrorBox('FootBR', `Não foi possível iniciar o jogo.\n${error.message}`);
    app.quit();
  });
}
