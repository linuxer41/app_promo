@echo off
rem Abre el servidor local con las dos promos (Resto y FactuGest).
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo No se encontro Python. Instala Python o abre esta carpeta con otro servidor local.
  echo Alternativa: npx serve .
  pause
  exit /b 1
)
start "" "http://localhost:8000/resto/v2.html"
start "" "http://localhost:8000/facturgest/v2.html"
python serve.py
