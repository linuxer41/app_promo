// Graba la presentación 3D de Mis Facturas en Termux, en tiempo real.
//
// Abre Chromium con ventana (no headless) dentro de Xvfb, con WebGL por
// Mesa/llvmpipe, y graba la pantalla X11 con ffmpeg. Así se usa el modelo GLB
// real sin leer píxeles de WebGL (lo que rompía el proceso GPU en headless).
//
//   node record3d.mjs                         -> reel 1080x1920 de 30 s con música
//   node record3d.mjs --duration=8 --no-music -> prueba rápida
//   node record3d.mjs --name=prueba3d
//
// Requiere: node, ffmpeg, chromium, xorg-server-xvfb y mesa.
import { spawn } from 'node:child_process';
import { accessSync, constants, existsSync } from 'node:fs';
import { mkdtemp, mkdir, rename, rm, unlink } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = 'misfacturas';
const OUT_DIR = join(HERE, 'video-out');
const MUSIC_DEFAULT = join(HERE, 'audio', 'Moving-Up_009_128k.mp3');
const W = 1080;
const H = 1920;

function arg(name, def) {
  const pre = '--' + name;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(pre + '=')) return a.slice(pre.length + 1);
  }
  return def;
}
const hasFlag = (name) => process.argv.slice(2).includes('--' + name);
const num = (name, def) => {
  const v = Number(arg(name, def));
  return Number.isFinite(v) ? v : def;
};

const page = arg('page', 'present-3d.html');
const outName = arg('name', APP);
const fps = Math.max(10, Math.min(60, Math.round(num('fps', 30))));
const duration = Math.max(2, Math.min(90, num('duration', 30)));
const crf = String(Math.max(0, Math.min(51, Math.round(num('crf', 18)))));
const preset = arg('preset', 'veryfast');
const withMusic = !hasFlag('no-music') && arg('music', null) !== 'off';
const music = resolve(HERE, arg('music', MUSIC_DEFAULT));
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg';
const XVFB = process.env.XVFB_BIN || 'Xvfb';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function which(cmd) {
  if (!cmd) return null;
  if (cmd.includes('/')) return existsSync(cmd) ? cmd : null;
  for (const dir of (process.env.PATH || '').split(':')) {
    if (!dir) continue;
    const p = join(dir, cmd);
    try { accessSync(p, constants.X_OK); return p; } catch (err) {}
  }
  return null;
}

function findChromium() {
  const names = [process.env.CHROMIUM_BIN, 'chromium', 'chromium-browser',
    'google-chrome-stable', 'google-chrome', 'chrome'].filter(Boolean);
  for (const n of names) {
    const p = which(n);
    if (p) return p;
  }
  return null;
}

async function freePort() {
  return new Promise((ok, fail) => {
    const s = createNetServer();
    s.once('error', fail);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => ok(p));
    });
  });
}

async function waitJson(url, timeoutMs) {
  const until = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      last = 'HTTP ' + r.status;
    } catch (err) {
      last = err.message;
    }
    await sleep(150);
  }
  throw new Error('No respondió ' + url + ' (' + last + ')');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.closed = false;
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (err) { return; }
      if (!msg.id) return;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    });
    ws.addEventListener('close', () => {
      this.closed = true;
      for (const p of this.pending.values()) p.reject(new Error('CDP cerrado'));
      this.pending.clear();
    });
  }

  send(method, params = {}, sessionId) {
    if (this.closed) return Promise.reject(new Error('CDP cerrado'));
    const id = ++this.id;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(msg));
    });
  }

  close() {
    try { this.ws.close(); } catch (err) {}
  }
}

function connect(url) {
  return new Promise((ok, fail) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => ok(new CDP(ws)), { once: true });
    ws.addEventListener('error', () => fail(new Error('No pude conectar al CDP de Chromium')), { once: true });
  });
}

function runFfmpeg(args) {
  return new Promise((ok, fail) => {
    const p = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); if (err.length > 12000) err = err.slice(-12000); });
    p.on('error', fail);
    p.on('close', (code) => code === 0 ? ok() : fail(new Error('ffmpeg salió con ' + code + '\n' + err)));
  });
}

async function startXvfb() {
  for (let n = 99; n >= 90; n--) {
    const display = ':' + n;
    const xvfb = spawn(XVFB, [display, '-screen', '0', W + 'x' + H + 'x24', '-nolisten', 'tcp'],
      { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    xvfb.stderr.on('data', (d) => { err += d.toString(); });
    await sleep(900);
    if (xvfb.exitCode === null) return { xvfb, display };
    await sleep(150);
    if (err) console.log('  (Xvfb ' + display + ': ' + err.trim().split('\n')[0] + ')');
  }
  throw new Error('No pude arrancar Xvfb. Instala: pkg install -y xorg-server-xvfb');
}

async function main() {
  const chromium = findChromium();
  const ffmpeg = which(FFMPEG);
  const xvfbBin = which(XVFB);
  if (!chromium) {
    console.error('✖ No encontré Chromium.\n  pkg install -y x11-repo && pkg install -y chromium');
    process.exit(1);
  }
  if (!ffmpeg) {
    console.error('✖ No encontré ffmpeg. pkg install -y ffmpeg');
    process.exit(1);
  }
  if (!xvfbBin) {
    console.error('✖ No encontré Xvfb. pkg install -y xorg-server-xvfb');
    process.exit(1);
  }
  if (withMusic && !existsSync(music)) {
    console.error('✖ No existe la música:', music, '\n  Usa --no-music o --music=/ruta/pista.mp3');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  let userDir;
  try { userDir = await mkdtemp(join(tmpdir(), 'misfacturas-3d-')); }
  catch (err) { userDir = await mkdtemp(join(HERE, '.chrome-3d-')); }

  const srv = await startStaticServer({ root: HERE, port: 0 });
  const port = await freePort();
  const { xvfb, display } = await startXvfb();

  const url = srv.url + page + '?record=1&vdur=' + duration;
  const chromeArgs = [
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--disable-gpu-watchdog',
    '--disable-dev-shm-usage',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=gl',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--noerrdialogs',
    '--disable-infobars',
    '--disable-sync',
    '--disable-extensions',
    '--mute-audio',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--force-device-scale-factor=1',
    '--window-position=0,0',
    '--window-size=' + W + ',' + H,
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + userDir,
    '--app=' + url
  ];
  if (process.env.CHROMIUM_FLAGS) {
    chromeArgs.unshift(...process.env.CHROMIUM_FLAGS.split(/\s+/).filter(Boolean));
  }

  console.log('▶ Xvfb', display, '· Chromium con ventana ·', W + 'x' + H, '·', duration + ' s');
  console.log('▶ WebGL por Mesa/llvmpipe (sin leer píxeles de WebGL)');

  const chrome = spawn(chromium, chromeArgs, {
    env: {
      ...process.env,
      DISPLAY: display,
      LIBGL_ALWAYS_SOFTWARE: '1',
      GALLIUM_DRIVER: 'llvmpipe'
    },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let chromeErr = '';
  chrome.stderr.on('data', (d) => { chromeErr += d.toString(); if (chromeErr.length > 12000) chromeErr = chromeErr.slice(-12000); });

  let cdp = null;
  let ff = null;
  try {
    let target = null;
    const untilList = Date.now() + 30000;
    while (Date.now() < untilList) {
      try {
        const list = await waitJson('http://127.0.0.1:' + port + '/json/list', 1500);
        const pages = (list || []).filter((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        target = pages.find((t) => (t.url || '').indexOf(url) === 0) ||
                 pages.find((t) => (t.url || '').indexOf(page) >= 0) ||
                 pages[0] || null;
        if (target) break;
      } catch (err) {}
      if (chrome.exitCode !== null) break;
      await sleep(250);
    }
    if (!target) throw new Error('Chromium no abrió la página.\n' + (chromeErr || ''));
    cdp = await connect(target.webSocketDebuggerUrl);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('▶ Cargando', url);
    const untilReady = Date.now() + 90000;
    let ready = false;
    while (Date.now() < untilReady) {
      const r = await cdp.send('Runtime.evaluate', {
        expression: '({ready:window.PROMO_READY===true, error:window.PROMO_ERROR||null})',
        returnByValue: true
      }).catch(() => null);
      if (r && r.result && r.result.value) {
        if (r.result.value.error) throw new Error('La página 3D falló: ' + r.result.value.error);
        if (r.result.value.ready) { ready = true; break; }
      }
      if (chrome.exitCode !== null) break;
      await sleep(200);
    }
    if (!ready) throw new Error('La página 3D no terminó de cargar (modelo/capturas).\n' + (chromeErr || ''));

    const mp4 = join(OUT_DIR, outName + '-3d-reel-' + W + 'x' + H + '.mp4');
    const tmpMp4 = mp4.replace(/\.mp4$/, '.video.mp4');
    if (existsSync(tmpMp4)) await unlink(tmpMp4).catch(() => {});

    ff = spawn(ffmpeg, [
      '-y', '-loglevel', 'error',
      '-thread_queue_size', '1024',
      '-f', 'x11grab',
      '-draw_mouse', '0',
      '-framerate', String(fps),
      '-video_size', W + 'x' + H,
      '-i', display + '.0+0,0',
      '-t', String(duration),
      '-c:v', 'libx264', '-preset', preset, '-crf', crf,
      '-pix_fmt', 'yuv420p', '-r', String(fps), '-an',
      '-movflags', '+faststart', tmpMp4
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let ffErr = '';
    ff.stderr.on('data', (d) => { ffErr += d.toString(); if (ffErr.length > 12000) ffErr = ffErr.slice(-12000); });
    const ffClosed = new Promise((ok, fail) => {
      ff.on('error', fail);
      ff.on('close', (code) => code === 0 ? ok() : fail(new Error('ffmpeg salió con ' + code + '\n' + ffErr)));
    });

    const begin = await cdp.send('Runtime.evaluate', {
      expression: 'typeof window.beginRecording === "function" && (window.beginRecording(), true)',
      returnByValue: true
    });
    if (begin.exceptionDetails || !begin.result || begin.result.value !== true) {
      throw new Error('No pude arrancar la grabación en la página 3D (¿pestaña equivocada?)');
    }
    console.log('● Grabando en tiempo real…');
    await ffClosed;
    ff = null;
    try {
      const lg = await cdp.send('Runtime.evaluate', { expression: 'window.__LOG', returnByValue: true });
      const arr = lg && lg.result && lg.result.value;
      if (arr) console.log('LOG ' + JSON.stringify(arr));
    } catch (e) {}

    const finalMp4 = mp4;
    if (withMusic) {
      console.log('♪ Añadiendo música…');
      const withAudio = mp4.replace(/\.mp4$/, '.audio.mp4');
      if (existsSync(withAudio)) await unlink(withAudio).catch(() => {});
      const fadeOut = Math.max(0.2, duration - 1.4).toFixed(2);
      const af = 'loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.6,afade=t=out:st=' +
        fadeOut + ':d=1.2';
      await runFfmpeg([
        '-y', '-loglevel', 'error',
        '-i', tmpMp4, '-i', music,
        '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
        '-af', af, '-shortest', '-movflags', '+faststart', withAudio
      ]);
      await rename(withAudio, finalMp4);
      await unlink(tmpMp4).catch(() => {});
    } else {
      await rename(tmpMp4, finalMp4);
    }

    console.log('✔ ' + finalMp4);
    console.log('Listo. El vídeo está en ' + OUT_DIR + '/');
  } finally {
    if (ff) { try { ff.kill('SIGKILL'); } catch (err) {} }
    if (cdp) cdp.close();
    if (chrome.exitCode === null) { try { chrome.kill('SIGKILL'); } catch (err) {} }
    if (xvfb.exitCode === null) { try { xvfb.kill('SIGKILL'); } catch (err) {} }
    srv.server.close();
    await rm(userDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((err) => {
  console.error('\n✖ ' + err.message);
  process.exit(1);
});
