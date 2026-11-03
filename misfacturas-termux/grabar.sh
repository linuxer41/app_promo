#!/data/data/com.termux/files/usr/bin/bash
# Graba el vídeo de Mis Facturas con Termux (Chromium headless + ffmpeg).
#
#   bash grabar.sh                    -> reel 1080x1920 de 30 s con música
#   bash grabar.sh --duration=20      -> más corto
#   bash grabar.sh --frames=60        -> prueba rápida sin música
#   bash grabar.sh --no-music
set -euo pipefail
cd "$(dirname "$0")"

faltan=""
command -v node >/dev/null 2>&1 || faltan="$faltan nodejs"
command -v ffmpeg >/dev/null 2>&1 || faltan="$faltan ffmpeg"
if [ -z "${CHROMIUM_BIN:-}" ] && ! command -v chromium >/dev/null 2>&1 \
   && ! command -v chromium-browser >/dev/null 2>&1; then
  faltan="$faltan chromium"
fi

if [ -n "$faltan" ]; then
  echo "✖ Faltan programas:$faltan"
  echo "  Instálalos con: bash instalar.sh"
  exit 1
fi

exec node render.mjs "$@"
