@echo off
setlocal enabledelayedexpansion
set "OLLAMA_ORIGINS=*"
cd /d "%~dp0"

set "NODE=node"
if exist "%~dp0\node_portable\node.exe" set "NODE=%~dp0\node_portable\node.exe"
for /d %%d in ("%~dp0\node_portable\*") do if exist "%%d\node.exe" set "NODE=%%d\node.exe"
if "%NODE%"=="node" (
  where node >nul 2>&1 || exit /b 1
)

set "OLLAMA=ollama"
if exist "%~dp0\ollama_portable\ollama.exe" set "OLLAMA=%~dp0\ollama_portable\ollama.exe"
for /d %%d in ("%~dp0\ollama_portable\*") do if exist "%%d\ollama.exe" set "OLLAMA=%%d\ollama.exe"

:: Si IngenIA ya esta corriendo en 5173, solo abrir el navegador
where curl >nul 2>&1 && curl -s --max-time 3 http://localhost:5173/ | findstr /C:"IngenIA" >nul 2>&1
if !ERRORLEVEL! equ 0 (
  echo [i] IngenIA ya esta corriendo en http://localhost:5173
  start http://localhost:5173
  exit /b 0
)

:: Verificar que el puerto 5173 no este ocupado por otro programa
powershell -NoP -C "if(Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue){exit 1}else{exit 0}" >nul 2>&1
if !ERRORLEVEL! equ 1 (
  echo.
  echo [!] ATENCION: el puerto 5173 esta ocupado por otro programa.
  echo    IngenIA no podra abrirse en ese puerto.
  set "RESP="
  set /p "RESP=  Continuar de todos modos? [s/N]: "
  if /i not "!RESP!"=="S" exit /b 1
)

:: Asegurar que Ollama este corriendo (si esta dentro de la app)
where curl >nul 2>&1 && curl -s http://localhost:11434/api/tags >nul 2>&1
if !ERRORLEVEL! neq 0 powershell -NoP -C "try{iwr -Uri 'http://localhost:11434/api/tags' -UseB -Time 2|Out-Null;exit 0}catch{exit 1}" >nul 2>&1
if !ERRORLEVEL! neq 0 (
  if exist "!OLLAMA!" (
    echo [i] Iniciando Ollama...
    start /b "" "!OLLAMA!" serve
    timeout /t 5 /nobreak >nul
  )
)

echo [i] Iniciando servidor...
start /b "" "!NODE!" server.mjs
timeout /t 3 /nobreak >nul
start http://localhost:5173