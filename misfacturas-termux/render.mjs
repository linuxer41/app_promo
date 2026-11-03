// Graba la presentación de Mis Facturas con Chromium headless + ffmpeg, sin
// Electron ni MediaRecorder (funciona en Termux y en Windows/macOS/Linux).
//
// Chromium headless recibe un tiempo (renderAt(t)) por cada cuadro, se captura
// con CDP y los PNG se mandan en vivo a ffmpeg. Después se añade la música.
//
//   node render.mjs                       -> reel 1080x1920 de 30 s
//   node render.mjs --duration=20 --fps=30
//   node render.mjs --frames=60           -> prueba corta
//   node render.mjs --no-music
//
// Requiere node, ffmpeg y un Chromium: en Termux `pkg install chromium`; en
// Windows busca Chrome o Edge donde vienen instalados (o CHROMIUM_BIN).
import { spawn } from 'node:child_process';
import { accessSync, constants, existsSync } from 'node:fs';
import { mkdtemp, mkdir, rename, rm, unlink } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = 'misfacturas';
const OUT_DIR = join(HERE, 'video-out');
const MUSIC_DEFAULT = join(HERE, 'audio', 'Moving-Up_009_128k.mp3');

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

const page = arg('page', 'present.html');
const outName = arg('name', APP);
const fmt = arg('format', 'reel');
if (fmt !== 'reel') {
  console.error('✖ Esta presentación es vertical: usa --format=reel (1080x1920).');
  process.exit(1);
}
const W = 1080;
const H = 1920;
const fps = Math.max(5, Math.min(60, Math.round(num('fps', 30))));
const duration = Math.max(2, Math.min(90, num('duration', 30)));
const limitFrames = Math.max(0, Math.round(num('frames', 0)));
const frames = limitFrames || Math.round(duration * fps);
const crf = String(Math.max(0, Math.min(51, Math.round(num('crf', 18)))));
const preset = arg('preset', 'veryfast');
const usePng = hasFlag('png');
const jpegQuality = Math.max(50, Math.min(100, Math.round(num('quality', 92))));
const withMusic = !hasFlag('no-music') && arg('music', null) !== 'off';
const music = resolve(HERE, arg('music', MUSIC_DEFAULT));
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const IS_WIN = process.platform === 'win32';
// En Windows un nombre sin extensión rara vez es ejecutable: PATH trae .exe.
const EXE_SUFFIXES = IS_WIN ? ['', '.exe', '.cmd', '.bat'] : [''];

function isExecutable(p) {
  try {
    accessSync(p, constants.X_OK);
    return true;
  } catch (err) {
    return false;
  }
}

function which(cmd) {
  if (!cmd) return null;
  if (cmd.includes('/') || cmd.includes('\\')) {
    for (const suffix of EXE_SUFFIXES) {
      const p = cmd + suffix;
      if (existsSync(p) && isExecutable(p)) return p;
    }
    return null;
  }
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    if (!dir) continue;
    for (const suffix of EXE_SUFFIXES) {
      const p = join(dir, cmd + suffix);
      if (existsSync(p) && isExecutable(p)) return p;
    }
  }
  return null;
}

// Rutas habituales donde Chrome y Edge se instalan solos en Windows.
const WINDOWS_CHROMIUM = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  join(process.env.LOCALAPPDATA || '', 'Microsoft/Edge/Application/msedge.exe')
];

function findChromium() {
  const names = [process.env.CHROMIUM_BIN, 'chromium', 'chromium-browser',
    'google-chrome-stable', 'google-chrome', 'chrome'].filter(Boolean);
  for (const n of names) {
    const p = which(n);
    if (p) return p;
  }
  for (const p of WINDOWS_CHROMIUM) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

function findFfmpeg() {
  return which(FFMPEG);
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

function writeFrame(stream, buf) {
  return new Promise((ok, fail) => {
    if (stream.destroyed) { fail(new Error('ffmpeg cerró su entrada')); return; }
    const done = () => { stream.off('error', onErr); ok(); };
    const onErr = (err) => { stream.off('drain', done); fail(err); };
    if (stream.write(buf)) { ok(); return; }
    stream.once('drain', done);
    stream.once('error', onErr);
  });
}

function runFfmpeg(args) {
  return new Promise((ok, fail) => {
    const p = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); if (err.length > 8000) err = err.slice(-8000); });
    p.on('error', fail);
    p.on('close', (code) => code === 0 ? ok() : fail(new Error('ffmpeg salió con ' + code + '\n' + err)));
  });
}

async function main() {
  const chromium = findChromium();
  const ffmpeg = findFfmpeg();
  if (!chromium) {
    console.error('✖ No encontré un navegador Chromium.\n' +
      '  Termux:   pkg install -y x11-repo && pkg install -y chromium\n' +
      '  Windows:  ten Chrome o Edge instalados, o define\n' +
      '            set CHROMIUM_BIN=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    process.exit(1);
  }
  if (!ffmpeg) {
    console.error('✖ No encontré ffmpeg.\n' +
      '  Termux:   pkg install -y ffmpeg\n' +
      '  Windows:  instalalo (winget install ffmpeg) o define FFMPEG_BIN=C:\\ruta\\ffmpeg.exe');
    process.exit(1);
  }
  if (withMusic && !existsSync(music)) {
    console.error('✖ No existe la música:', music, '\n  Usa --no-music o --music=/ruta/pista.mp3');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  let userDir;
  try { userDir = await mkdtemp(join(tmpdir(), 'misfacturas-chrome-')); }
  catch (err) { userDir = await mkdtemp(join(HERE, '.chrome-')); }

  const srv = await startStaticServer({ root: HERE, port: 0 });
  const port = await freePort();
  const chromeArgs = [
    // El modo headless antiguo ya no existe en los Chrome de escritorio; en
    // Termux el chromium empaquetado sigue aceptando '--headless' a secas.
    IS_WIN ? '--headless=new' : '--headless',
    '--no-sandbox',
    ...(process.env.DISABLE_GPU === '0' ? [] : ['--disable-gpu']),
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--mute-audio',
    '--enable-unsafe-swiftshader',
    '--disable-extensions',
    '--force-device-scale-factor=1',
    '--window-size=' + W + ',' + H,
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + userDir,
    'about:blank'
  ];
  if (process.env.CHROMIUM_FLAGS) chromeArgs.unshift(...process.env.CHROMIUM_FLAGS.split(/\s+/).filter(Boolean));

  console.log('▶ Chromium:', chromium);
  console.log('▶ ' + frames + ' cuadros · ' + fps + ' fps · ' + W + 'x' + H);

  const chrome = spawn(chromium, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeErr = '';
  chrome.stderr.on('data', (d) => { chromeErr += d.toString(); if (chromeErr.length > 8000) chromeErr = chromeErr.slice(-8000); });
  let cdp = null;
  let ff = null;

  try {
    const version = await waitJson('http://127.0.0.1:' + port + '/json/version', 30000)
      .catch(async (err) => {
        throw new Error(err.message + (chromeErr ? '\nChromium dijo:\n' + chromeErr : ''));
      });
    cdp = await connect(version.webSocketDebuggerUrl);

    const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const session = attached.sessionId;

    await cdp.send('Page.enable', {}, session);
    await cdp.send('Runtime.enable', {}, session);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: W, height: H, deviceScaleFactor: 1, mobile: false
    }, session);

    const url = srv.url + page + '?render=1&vdur=' + duration;
    console.log('▶ Cargando', url);
    await cdp.send('Page.navigate', { url }, session);

    const until = Date.now() + 45000;
    let ready = false;
    while (Date.now() < until) {
      const r = await cdp.send('Runtime.evaluate', {
        expression: 'window.PROMO_READY === true', returnByValue: true
      }, session).catch(() => null);
      if (r && r.result && r.result.value === true) { ready = true; break; }
      if (chrome.exitCode !== null) break;
      await sleep(150);
    }
    if (!ready) {
      throw new Error('La página no terminó de cargar (fuentes/capturas).\n' + (chromeErr || ''));
    }

    const mp4 = join(OUT_DIR, outName + '-' + fmt + '-' + W + 'x' + H + '.mp4');
    const tmpMp4 = mp4.replace(/\.mp4$/, '.video.mp4');
    if (existsSync(tmpMp4)) await unlink(tmpMp4).catch(() => {});

    ff = spawn(ffmpeg, [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', usePng ? 'png' : 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', preset, '-crf', crf,
      '-pix_fmt', 'yuv420p', '-r', String(fps), '-an',
      '-movflags', '+faststart', tmpMp4
    ], { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = '';
    ff.stderr.on('data', (d) => { ffErr += d.toString(); if (ffErr.length > 8000) ffErr = ffErr.slice(-8000); });
    const ffClosed = new Promise((ok, fail) => {
      ff.on('error', fail);
      ff.on('close', (code) => code === 0 ? ok() : fail(new Error('ffmpeg salió con ' + code + '\n' + ffErr)));
    });

    const started = Date.now();
    for (let i = 0; i < frames; i++) {
      const t = i / fps;
      await cdp.send('Runtime.evaluate', {
        expression: 'window.renderAt(' + t.toFixed(5) + ')'
      }, session);
      const shot = await cdp.send('Page.captureScreenshot', {
        format: usePng ? 'png' : 'jpeg',
        quality: usePng ? undefined : jpegQuality,
        fromSurface: true,
        captureBeyondViewport: false
      }, session);
      await writeFrame(ff.stdin, Buffer.from(shot.data, 'base64'));
      if (i % fps === 0 || i === frames - 1) {
        const pct = Math.round((i + 1) / frames * 100);
        process.stdout.write('\r  cuadro ' + (i + 1) + '/' + frames + ' · ' + pct + '%');
      }
    }
    process.stdout.write('\n');
    ff.stdin.end();
    await ffClosed;
    ff = null;

    const videoDuration = frames / fps;
    const finalMp4 = mp4;
    if (withMusic) {
      console.log('♪ Añadiendo música…');
      const withAudio = mp4.replace(/\.mp4$/, '.audio.mp4');
      if (existsSync(withAudio)) await unlink(withAudio).catch(() => {});
      const fadeOut = Math.max(0.2, videoDuration - 1.4).toFixed(2);
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

    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log('✔ ' + finalMp4 + '  (' + secs + ' s)');
    console.log('Listo. El vídeo está en ' + OUT_DIR + '/');
  } finally {
    if (ff) { try { ff.stdin.end(); } catch (err) {} try { ff.kill('SIGKILL'); } catch (err) {} }
    if (cdp) cdp.close();
    if (chrome.exitCode === null) { try { chrome.kill('SIGKILL'); } catch (err) {} }
    srv.server.close();
    await rm(userDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((err) => {
  console.error('\n✖ ' + err.message);
  process.exit(1);
});
