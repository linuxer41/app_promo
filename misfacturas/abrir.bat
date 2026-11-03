@echo off
rem Abre la presentacion de Mis Facturas (requiere servidor local).
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo No se encontro Python. Instala Python o abre esta carpeta con otro servidor local.
  echo Alternativa: npx serve .
  pause
  exit /b 1
)
start "" "http://localhost:8000/misfacturas/present.html"
python serve.py
