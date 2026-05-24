const path = require('path');
const { app, BrowserWindow, session, shell, nativeImage, dialog } = require('electron');

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

  win.once('ready-to-show', () => {
    win.show();
  });
}

app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
app.setAppUserModelId('com.interptrte.ps');

app.whenReady().then(() => {
  session.defaultSession.setPermissionCheckHandler((webContents) => {
    const currentUrl = webContents.getURL();
    return currentUrl.startsWith(RENDER_URL);
  });

  session.defaultSession.setPermissionRequestHandler(async (webContents, permission, callback) => {
    const currentUrl = webContents.getURL();
    const permisosMedia = ['media', 'audioCapture', 'videoCapture', 'camera', 'microphone'];

    if (!currentUrl.startsWith(RENDER_URL) || !permisosMedia.includes(permission)) {
      console.log('Permission denied for', permission, 'on', currentUrl);
      callback(false);
      return;
    }

    const permisoNombre = permission === 'microphone'
      ? 'micrófono'
      : permission === 'camera'
      ? 'cámara'
      : 'micrófono y cámara';

    const respuesta = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Permitir', 'Denegar'],
      defaultId: 0,
      cancelId: 1,
      title: 'Permiso de dispositivo',
      message: `La aplicación quiere usar tu ${permisoNombre}.`,
      detail: `URL: ${currentUrl}`,
    });

    const permitido = respuesta.response === 0;
    console.log('Permission', permitido ? 'allowed' : 'denied', 'for', permission, 'on', currentUrl);
    callback(permitido);
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
