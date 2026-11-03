// Lado Electron de capture-mockups: abre cada mockup al tamaño exacto y
// guarda la captura en screns/. Ejecutar vía scripts/capture-mockups.mjs.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { mkdirSync, writeFileSync } = require('fs');
const { pathToFileURL } = require('url');

const args = process.argv.slice(2);
function arg(name, def) {
  const pre = '--' + name;
  for (const a of args) if (a.startsWith(pre + '=')) return a.slice(pre.length + 1);
  const i = args.indexOf(pre);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

// mockup -> salida y viewport exacto de la captura que reemplaza
const TARGETS = {
  'mobile-home':        { out: 'mobile_1.png',  w: 1080, h: 2424 },
  'mobile-new-invoice': { out: 'mobile_2.png',  w: 1080, h: 2424 },
  'tablet-reports':     { out: 'tablet.jpeg',   w: 1599, h: 999,  jpeg: true },
  'pc-dashboard':       { out: 'pc_screen.png', w: 1917, h: 1077 }
};

const MOCKUP_DIR = path.join(__dirname, '..', 'mockups');
const OUT_DIR = path.join(__dirname, '..', 'screns');

app.on('window-all-closed', () => {});   // la app debe seguir viva entre capturas

app.whenReady().then(async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  const only = arg('only', '').split(',').map(s => s.trim()).filter(Boolean);
  for (const [name, t] of Object.entries(TARGETS)) {
    if (only.length && !only.includes(name)) continue;
    const win = new BrowserWindow({
      width: t.w, height: t.h, useContentSize: true,
      show: false
    });
    win.webContents.setZoomFactor(1);
    win.setContentSize(t.w, t.h);
    console.log('>>', name);
    const url = pathToFileURL(path.join(MOCKUP_DIR, name + '.html')).href;
    for (let attempt = 0; ; attempt++) {
      try {
        await Promise.race([
          win.loadURL(url),
          new Promise((_, rej) => setTimeout(() => rej(new Error('loadURL timeout')), 12000))
        ]);
        break;
      } catch (e) {
        console.log('   reintento', name, attempt, e.message);
        if (attempt >= 4) throw e;
        await new Promise(r => setTimeout(r, 400));
      }
    }
    console.log('   cargado', name);
    await new Promise(r => setTimeout(r, 700));
    const image = await Promise.race([
      win.webContents.capturePage(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('capturePage timeout ' + name)), 15000))
    ]);
    const buf = t.jpeg ? image.toJPEG(92) : image.toPNG();
    writeFileSync(path.join(OUT_DIR, t.out), buf);
    console.log('OK', t.out, image.getSize().width + 'x' + image.getSize().height);
    win.destroy();
    await new Promise(r => setTimeout(r, 500));   // respiro entre ventanas, si no capturePage cuelga
  }
  app.quit();
});
