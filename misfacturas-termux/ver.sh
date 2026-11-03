#!/data/data/com.termux/files/usr/bin/bash
# Abre la vista previa en el navegador de Android.
#
#   bash ver.sh              -> http://127.0.0.1:8080/
#   bash ver.sh --port=9000
#   bash ver.sh --no-open
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "✖ Falta nodejs. Instálalo con: pkg install -y nodejs"
  exit 1
fi

exec node serve.mjs "$@"
