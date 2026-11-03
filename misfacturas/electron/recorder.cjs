// Recorder de la presentación de Mis Facturas (Electron).
// Abre una ventana frameless al tamaño exacto del vídeo y la página se graba a sí
// misma con desktopCapturer + MediaRecorder: se capturan los píxeles reales del
// DOM, sin cuadros de diálogo.
//
//   electron electron/recorder.cjs --fmt=reel --duration=30
const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
function arg(name, def) {
  const pre = '--' + name;
  for (const a of args) if (a.startsWith(pre + '=')) return a.slice(pre.length + 1);
  const i = args.indexOf(pre);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const FMT = { feed: { w: 1080, h: 1080 }, portrait: { w: 1080, h: 1350 }, reel: { w: 1080, h: 1920 } };
const fmt = arg('fmt', 'reel');
const dims = FMT[fmt] || FMT.reel;
const duration = Math.max(2, Math.min(90, Number(arg('duration', '30'))));
const APP = 'misfacturas';
const PAGE = 'present.html';
const urlBase = arg('base', 'http://localhost:8000/' + APP);
const winTitle = `promo-rec ${fmt} ${process.pid}`;

const OUT_DIR = path.join(__dirname, '..', 'video-out');
const OUT_FILE = path.join(OUT_DIR, `${APP}-${fmt}-${dims.w}x${dims.h}.webm`);

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: dims.w, height: dims.h,
    useContentSize: true,
    frame: false,
    resizable: false,
    show: false,
    backgroundColor: '#0b0b0d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setMenuBarVisibility(false);
  win.setContentSize(dims.w, dims.h);
  try { win.setPosition(0, 0); } catch (e) {}
  const base = urlBase.replace(/\/$/, '');
  const url = `${base}/${PAGE}?fmt=${fmt}&autorec=1&vdur=${duration}&wintitle=${encodeURIComponent(winTitle)}`;
  win.loadURL(url);
  win.once('ready-to-show', () => win.show());
}

ipcMain.handle('promo:get-source', async () => {
  const [cw, ch] = win.getContentSize();
  const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: cw, height: ch } });
  const mine = sources.find(s => s.name === win.getTitle()) || sources.find(s => /promo-rec/i.test(s.name));
  return mine ? mine.id : null;
});

ipcMain.on('promo:save', (_e, name, dataB64) => {
  try { fs.mkdirSync(OUT_DIR, { recursive: true }); } catch (e) {}
  fs.writeFileSync(OUT_FILE, Buffer.from(dataB64, 'base64'));
  console.log('SAVED:', OUT_FILE);
  setTimeout(() => app.quit(), 250);
});

app.whenReady().then(() => {
  createWindow();
  // colchón amplio: sin él, una carga lenta mata la ventana antes de que termine
  // la grabación y el .webm nunca se escribe
  setTimeout(() => app.quit(), (duration + 90) * 1000);
});

app.on('window-all-closed', () => app.quit());
