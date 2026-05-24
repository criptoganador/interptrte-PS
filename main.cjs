const path = require('path');
const { app, BrowserWindow, session, shell, nativeImage } = require('electron');

const RENDER_URL = 'https://interptrte-ps.onrender.com';

function createWindow() {
  const iconPath = path.join(app.getAppPath(), 'public', 'favicon.svg');
  const icon = nativeImage.createFromPath(iconPath);

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 720,
    title: 'InterPtrte PS',
    icon: icon.isEmpty() ? undefined : icon,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  win.loadURL(RENDER_URL);
  win.setMenuBarVisibility(false);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Electron: fallo al cargar URL', validatedURL, errorCode, errorDescription);
  });

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[renderer] ${message} (${sourceId}:${line})`);
  });

  win.once('ready-to-show', () => {
    win.show();
  });
}

function setupPermissionHandlers() {
  const allowedPermissions = new Set([
    'media',
    'camera',
    'microphone',
    'audioCapture',
    'videoCapture',
    'fullscreen',
    'notifications',
  ]);

  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const allowed = allowedPermissions.has(permission);
    console.log('Electron: permission check', { permission, origin: requestingOrigin, allowed });
    return allowed;
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const allowed = allowedPermissions.has(permission);
    console.log('Electron: permission request', { permission, url: details.requestingUrl, allowed });
    callback(allowed);
  });
}

function setupSecurityHeaders() {
  const contentSecurityPolicy = [
    "default-src 'self' https: data: blob:;",
    "script-src 'self' https: 'unsafe-inline' 'unsafe-eval';",
    "style-src 'self' https: 'unsafe-inline';",
    "img-src 'self' data: https: blob:;",
    "connect-src 'self' https: http://localhost:3001 wss:;",
    "font-src 'self' https: data:;",
    "media-src 'self' https: data: blob:;",
    "frame-src 'self' https:;"
  ].join(' ');

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['*://interptrte-ps.onrender.com/*'], types: ['mainFrame'] },
    (details, callback) => {
      const responseHeaders = details.responseHeaders || {};

      // Eliminar cualquier CSP previa para forzar la nuestra.
      Object.keys(responseHeaders).forEach((headerName) => {
        const lower = headerName.toLowerCase();
        if (lower === 'content-security-policy' || lower === 'content-security-policy-report-only') {
          delete responseHeaders[headerName];
        }
      });

      responseHeaders['Content-Security-Policy'] = [contentSecurityPolicy];
      callback({ responseHeaders });
    }
  );
}

app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
app.setAppUserModelId('com.interptrte.ps');

app.whenReady().then(() => {
  setupPermissionHandlers();
  setupSecurityHeaders();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
