#!/data/data/com.termux/files/usr/bin/bash
# Instala lo necesario para grabar vídeo con Termux.
# Chromium vive en el repositorio x11, por eso primero se añade x11-repo.
set -euo pipefail

pkg install -y nodejs ffmpeg
pkg install -y x11-repo
pkg install -y chromium

echo
echo "✔ Listo. Prueba con: bash grabar.sh --frames=30 --no-music"
