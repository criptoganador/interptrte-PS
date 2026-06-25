const path = require('path');
const { app, BrowserWindow, session, shell, nativeImage } = require('electron');

const isDev = !app.isPackaged;
// Usa localhost, Vite puede estar enlazado a IPv6 (::1) por defecto
const DEV_URL = 'http://localhost:5173';

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

  const loadApp = () => {
    if (isDev) {
      win.loadURL(DEV_URL);
    } else {
      win.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }
  };

  loadApp();

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Electron: fallo al cargar', validatedURL, errorCode, errorDescription);
    // Si estamos en desarrollo y falla al conectar, reintenta cada 2 segundos
    if (isDev && errorCode === -102) { // -102 es ERR_CONNECTION_REFUSED
      console.log('Reintentando conectar al servidor local en 2 segundos...');
      setTimeout(loadApp, 2000);
    }
  });

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[renderer] ${message} (${sourceId}:${line})`);
  });

  win.once('ready-to-show', () => {
    win.show();
  });
}

function setupPermissionHandlers() {
  // Manejador para la comprobación de permisos
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    console.log('Electron: permission check', { permission, origin: requestingOrigin });
    return true;
  });

  // Manejador para las solicitudes de permisos (ej. getUserMedia)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    console.log('Electron: permission request', { permission, url: details.requestingUrl });
    callback(true);
  });

  // Manejador para el acceso a dispositivos (Micrófono, Cámara) - Requerido en Electron nuevo
  session.defaultSession.setDevicePermissionHandler((details) => {
    console.log('Electron: device permission request', details.deviceType);
    return true;
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

app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors,AudioServiceOutOfProcess');
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
