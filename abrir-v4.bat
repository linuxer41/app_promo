@echo off
rem Abre el anuncio v4 (2D, sin WebGL). El servidor local solo hace falta para
rem poder descargar el PNG 4K (las imagenes file:// bloquean el export).
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo No se encontro Python. Instala Python o abre esta carpeta con otro servidor local.
  echo Alternativa: npx serve .
  pause
  exit /b 1
)
start "" "http://localhost:8001/v4.html"
python -m http.server 8001
