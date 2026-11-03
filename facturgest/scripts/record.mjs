// Graba los vídeos del anuncio Resto con el recorder de Electron (ventana
// frameless a tamaño exacto + desktopCapturer) y los convierte a MP4 H.264.
//
//   node scripts/record.mjs                 -> feed, portrait, reel (30 s)
//   node scripts/record.mjs --fmt reel      -> solo reel
//   node scripts/record.mjs --duration 15
//
// Requiere el servidor local (python serve.py) en --url (por defecto :8000).
import { spawn } from 'child_process';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const require_ = createRequire(import.meta.url);

// Electron: variable de entorno > instalado en este proyecto > vendemas.
function findElectron() {
  if (process.env.ELECTRON_BIN && existsSync(process.env.ELECTRON_BIN)) return process.env.ELECTRON_BIN;
  try {
    const p = require_('electron');            // node_modules/electron devuelve la ruta al .exe
    if (typeof p === 'string' && existsSync(p)) return p;
  } catch (e) {}
  const vend = 'D:\\work\\vendemas\\page\\node_modules\\electron\\dist\\electron.exe';
  return existsSync(vend) ? vend : null;
}
const ELECTRON = findElectron();
const MAIN = join(here, '..', 'electron', 'recorder.cjs');
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg';
const OUT = join(here, '..', 'video-out');

function arg(name, def) {
  const pre = '--' + name;
  for (const a of process.argv) if (a.startsWith(pre + '=')) return a.slice(pre.length + 1);
  const i = process.argv.indexOf(pre); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const fmtArg = arg('fmt', '');
const duration = arg('duration', '30');
const app = arg('promo', 'resto');
const url = arg('base', 'http://localhost:8000/' + app);
const formats = fmtArg ? fmtArg.split(',').map(s => s.trim()).filter(Boolean) : ['feed', 'portrait', 'reel'];
const sizes = { feed: [1080, 1080], portrait: [1080, 1350], reel: [1080, 1920] };

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
if (!ELECTRON) { console.error('✖ No se encontró Electron. Ejecuta: npm i -D electron  (o define ELECTRON_BIN).'); process.exit(1); }

function run(cmd, args) {
  return new Promise((res, rej) => {
    const c = spawn(cmd, args, { stdio: 'inherit' });
    c.on('error', rej);
    c.on('close', code => code === 0 ? res() : rej(new Error(cmd + ' salió con ' + code)));
  });
}

for (const fmt of formats) {
  if (!sizes[fmt]) { console.error(`✖ formato desconocido: ${fmt}`); continue; }
  const [W, H] = sizes[fmt];
  const webm = join(OUT, `${app}-${fmt}-${W}x${H}.webm`);
  const mp4 = join(OUT, `${app}-${fmt}-${W}x${H}.mp4`);
  if (existsSync(webm)) unlinkSync(webm);
  console.log(`\n▶ Grabando ${fmt} (${duration}s)…`);
  await run(ELECTRON, [MAIN, `--fmt=${fmt}`, `--duration=${duration}`, `--base=${url}`, `--promo=${app}`]);
  // Windows puede tardar unos ms en liberar el archivo recién escrito
  for (let t = 0; t < 30 && !existsSync(webm); t++) await new Promise(r => setTimeout(r, 100));
  if (!existsSync(webm)) { console.error(`✖ ${fmt}: no se generó el vídeo`); continue; }
  console.log('  convirtiendo → mp4');
  await run(FFMPEG, ['-y', '-loglevel', 'error', '-i', webm,
    '-vf', `scale=${W}:${H}:flags=lanczos`, '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  console.log(`✔ ${mp4}`);
}
console.log('\nListo. Vídeos en video-out/');
