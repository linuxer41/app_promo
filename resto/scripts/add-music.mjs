// Añade la música a los MP4 del anuncio: recorta la pista a la duración del
// vídeo, la normaliza a -14 LUFS (estándar de anuncios) y le pone fundido de
// entrada y salida. Reemplaza cada MP4 por la versión con audio.
//
//   node scripts/add-music.mjs
//   node scripts/add-music.mjs --music audio/otra.mp3
//   node scripts/add-music.mjs --fmt feed,reel
import { spawnSync } from 'child_process';
import { existsSync, renameSync, unlinkSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const OUT = join(root, 'video-out');
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg';

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def; }
const app = arg('promo', 'resto');
const music = resolve(root, arg('music', 'audio/Moving-Up_009_128k.mp3'));
const fmtArg = arg('fmt', '');
const fmts = fmtArg ? fmtArg.split(',').map(s => s.trim()).filter(Boolean) : ['feed', 'portrait', 'reel'];
const sizes = { feed: [1080, 1080], portrait: [1080, 1350], reel: [1080, 1920] };

if (!existsSync(music)) { console.error('✖ No existe la música:', music); process.exit(1); }

// fundido de entrada 0.6 s y de salida 1.2 s (el vídeo dura ~30 s)
const AF = 'loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.6,afade=t=out:st=28.6:d=1.2';

let fallos = 0;
for (const fmt of fmts) {
  if (!sizes[fmt]) { console.error('✖ formato desconocido:', fmt); continue; }
  const [W, H] = sizes[fmt];
  const mp4 = join(OUT, `${app}-${fmt}-${W}x${H}.mp4`);
  if (!existsSync(mp4)) { console.error('✖ falta el vídeo:', mp4); fallos++; continue; }
  const tmp = mp4.replace(/\.mp4$/, '.audio.mp4');
  console.log(`\n♪ Añadiendo música a ${fmt}…`);
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error',
    '-i', mp4, '-i', music,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-af', AF, '-shortest', '-movflags', '+faststart', tmp], { stdio: 'inherit' });
  if (r.status !== 0 || !existsSync(tmp)) { console.error('✖ ffmpeg falló en', fmt); fallos++; continue; }
  unlinkSync(mp4); renameSync(tmp, mp4);
  console.log(`✔ ${mp4}`);
}
console.log(fallos ? `\nTerminado con ${fallos} fallo(s).` : '\nListo. Vídeos con música en video-out/');
