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

where curl >nul 2>&1 && curl -s http://localhost:11434/api/tags >nul 2>&1
if !ERRORLEVEL! neq 0 powershell -NoP -C "try{iwr -Uri 'http://localhost:11434/api/tags' -UseB -Time 2|Out-Null;exit 0}catch{exit 1}" >nul 2>&1
if !ERRORLEVEL! neq 0 (
  if exist "!OLLAMA!" (
    start /b "" "!OLLAMA!" serve
    timeout /t 5 /nobreak >nul
  )
)

start /b "" "!NODE!" server.mjs
timeout /t 3 /nobreak >nul
start http://localhost:5173
