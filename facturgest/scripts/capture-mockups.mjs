// Captura los mockups HTML de FactuGest a PNG/JPG con la resolución exacta
// que usan los modelos 3D de la promo.
//
//   node scripts/capture-mockups.mjs
//   node scripts/capture-mockups.mjs --only mobile-list,pc-dashboard
//   ELECTRON_BIN="C:\ruta\electron.exe" node scripts/capture-mockups.mjs
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const here = dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);

function findElectron() {
  if (process.env.ELECTRON_BIN && existsSync(process.env.ELECTRON_BIN)) return process.env.ELECTRON_BIN;
  try {
    const p = require_('electron');
    if (typeof p === 'string' && existsSync(p)) return p;
  } catch (e) {}
  const vend = 'D:\\work\\vendemas\\page\\node_modules\\electron\\dist\\electron.exe';
  return existsSync(vend) ? vend : null;
}

const ELECTRON = findElectron();
if (!ELECTRON) { console.error('✖ No se encontró Electron (usa ELECTRON_BIN).'); process.exit(1); }

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;   // si no, electron.exe arranca como node y no hay app

const child = spawn(ELECTRON, [join(here, 'capture-mockups-electron.cjs'), ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('close', code => process.exit(code ?? 1));
