'use strict';

// Diagnostic
process.stderr.write('process.type: ' + process.type + '\n');
process.stderr.write('process.versions.electron: ' + process.versions.electron + '\n');
process.stderr.write('require.resolve electron: ');
try { process.stderr.write(require.resolve('electron') + '\n'); } catch(e) { process.stderr.write(e.code + '\n'); }

const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 560,
    height: 280,
    minWidth: 200,
    minHeight: 160,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the existing live_demo.html (one level up)
  win.loadFile(path.join(__dirname, '..', 'live_demo.html'));

  win.webContents.on('did-finish-load', () => {
    // Make body draggable, but not canvas/buttons
    win.webContents.insertCSS(`
      body {
        -webkit-app-region: drag;
        user-select: none;
      }
      canvas, #panels *, #ws-status {
        -webkit-app-region: no-drag;
      }
    `);
  });

  // Right-click context menu
  win.webContents.on('context-menu', () => {
    const pinned = win.isAlwaysOnTop();
    const menu = Menu.buildFromTemplate([
      {
        label: pinned ? '✓ Always on Top' : '  Always on Top',
        click: () => win.setAlwaysOnTop(!pinned),
      },
      { type: 'separator' },
      { label: 'DevTools', click: () => win.webContents.openDevTools({ mode: 'detach' }) },
      { type: 'separator' },
      { label: 'Close', click: () => app.quit() },
    ]);
    menu.popup({ window: win });
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => app.quit());
