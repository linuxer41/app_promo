// Captura una página real con Electron al tamaño exacto del vídeo.
//
//   node scripts/shoot.cjs --url=https://ejemplo.com --out=screens/web.png
//   node scripts/shoot.cjs --url=... --click='button.pagar' --wait=3000
//
// --width/--height son los píxeles del PNG y --css el ancho en px CSS que debe
// ver la página: con 1080x1920 y css 540 la web se pinta como en un móvil y el
// zoom (1080/540 = 2) rellena el cuadro sin recortar nada.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function arg(name, def) {
  const pre = '--' + name;
  for (const a of args) if (a.startsWith(pre + '=')) return a.slice(pre.length + 1);
  const i = args.indexOf(pre);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const url = arg('url', '');
const out = path.resolve(arg('out', 'shot.png'));
const width = Number(arg('width', '1080'));
const height = Number(arg('height', '1920'));
const css = Number(arg('css', '540'));
const wait = Number(arg('wait', '2600'));
const clickSel = arg('click', '');
const clickText = arg('clickText', '');
const fillSel = arg('fill', '');
const fillText = arg('text', '');
const dump = arg('dump', '');
const scrollY = Number(arg('scroll', '0'));

if (!url) { console.error('✖ falta --url'); process.exit(1); }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Escribir en un input controlado por el framework (Svelte/React escuchan el
// evento input, no el cambio de .value por JS normal).
const FILL = `(function(){var el=document.querySelector(${JSON.stringify(fillSel)});
  if(!el)return 'no encontrado';
  var set=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value').set;
  set.call(el, ${JSON.stringify(fillText)});
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  return 'ok';})()`;

app.whenReady().then(async () => {
  // La ventana debe estar visible: con show:false Chromium congela el timeline de
  // las animaciones y las transiciones CSS se quedan en su valor inicial, así que
  // los cuadros de control saldrían vacíos aunque en la grabación real vayan bien.
  const visible = arg('show', '1') !== '0';
  const win = new BrowserWindow({
    width, height, show: visible, useContentSize: true, frame: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  win.setContentSize(width, height);
  try { win.setPosition(0, 0); } catch (e) {}
  await win.loadURL(url);
  await win.webContents.setZoomFactor(width / css);
  await sleep(wait);
  if (dump) {
    const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML');
    fs.writeFileSync(path.resolve(dump), html);
    console.log('✔ DOM en', path.resolve(dump));
  }
  if (fillSel) {
    const r = await win.webContents.executeJavaScript(FILL);
    if (r !== 'ok') console.error('✖ al rellenar:', r);
    await sleep(500);
  }
  if (clickSel) {
    const ok = await win.webContents.executeJavaScript(
      `(function(){var el=document.querySelector(${JSON.stringify(clickSel)});` +
      `if(!el)return false;el.click();return true;})()`);
    if (!ok) console.error('✖ no existe el selector a pulsar:', clickSel);
    await sleep(wait);
  }
  if (clickText) {
    const ok = await win.webContents.executeJavaScript(
      `(function(){var ns=[].slice.call(document.querySelectorAll('button,a,[role=button]'));` +
      `var el=ns.filter(function(n){return (n.textContent||'').trim().toLowerCase()===${JSON.stringify(clickText.toLowerCase())};})[0];` +
      `if(!el)return false;el.click();return true;})()`);
    if (!ok) console.error('✖ no hay botón con el texto:', clickText);
    await sleep(wait);
  }
  if (scrollY) {
    await win.webContents.executeJavaScript(`window.scrollTo(0, ${scrollY})`);
    await sleep(700);
  }
  const img = await win.webContents.capturePage();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, img.toPNG());
  const s = img.getSize();
  console.log(`✔ ${out} (${s.width}x${s.height})`);
  app.quit();
});
