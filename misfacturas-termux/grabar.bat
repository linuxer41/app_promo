@echo off
rem Graba el reel de Mis Facturas (1080x1920) con Chrome o Edge headless + ffmpeg.
rem
rem   grabar.bat                    -> 30 s con musica
rem   grabar.bat --duration=20
rem   grabar.bat --frames=60        -> prueba rapida
rem   grabar.bat --no-music
rem
rem Requiere node, ffmpeg y Chrome o Edge. Con CHROMIUM_BIN o FFMPEG_BIN puedes
rem apuntar tu mismo a la ruta del ejecutable.
cd /d "%~dp0"
where node >/dev/null 2>nul
if errorlevel 1 (
  echo X Falta node. Instalalo de nodejs.org
  pause
  exit /b 1
)
node render.mjs %*
if errorlevel 1 pause
