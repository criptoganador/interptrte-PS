import path from 'path';
import { app, BrowserWindow, session, shell, nativeImage } from 'electron';

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
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media' || permission === 'camera' || permission === 'microphone') {
      return true;
    }
    if (permission === 'fullscreen' || permission === 'notifications' || permission === 'midiSysex') {
      return true;
    }
    return false;
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'camera' || permission === 'microphone') {
      callback(true);
      return;
    }

    if (permission === 'fullscreen' || permission === 'notifications' || permission === 'midiSysex') {
      callback(true);
      return;
    }

    callback(false);
  });

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
