// Servidor local para ver la presentación en el navegador de Android.
//
//   node serve.mjs              -> http://127.0.0.1:8080/ y abre el navegador
//   node serve.mjs --port=9000  -> otro puerto
//   node serve.mjs --no-open    -> sin abrir el navegador
import { spawn } from 'node:child_process';
import { startStaticServer } from './server.mjs';

function arg(name, def) {
  const pre = '--' + name;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(pre + '=')) return a.slice(pre.length + 1);
  }
  return def;
}
const noOpen = process.argv.includes('--no-open');
const host = arg('host', '127.0.0.1');
const port = Number(arg('port', '8080'));

const srv = await startStaticServer({ host, port });
console.log('Mis Facturas · presentación');
console.log('  ' + srv.url);
console.log('  Ctrl+C para salir');

if (!noOpen) {
  const cmd = process.env.TERMUX_OPEN || 'termux-open-url';
  try {
    const child = spawn(cmd, [srv.url], { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch (err) {
    // sin termux-open-url: abre la URL a mano
  }
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    srv.server.close(() => process.exit(0));
  });
}
