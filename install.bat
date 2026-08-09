@echo off
setlocal enabledelayedexpansion

set "NODE_VERSION=20.18.1"
set "INSTALL_DIR=%LOCALAPPDATA%\IngenIA"
set "SCRIPT_DIR=%~dp0"
set "PORTABLE_DIR=%INSTALL_DIR%\node_portable"
set "OLLAMA_DIR=%INSTALL_DIR%\ollama_portable"

echo.
echo ============================================
echo     Instalador de IngenIA
echo ============================================
echo.

:: Clean previous installation BEFORE downloading portables,
:: otherwise the portables would be deleted along with the app
if exist "!INSTALL_DIR!" rmdir /s /q "!INSTALL_DIR!"

:: -- Node.js --
where node >nul 2>&1
if !ERRORLEVEL! equ 0 (
    for /f "tokens=1" %%v in ('node -v') do echo [OK] Node.js %%v en PATH
    goto :have_node
)

echo [!] Node.js no encontrado en PATH.
echo Descargando Node.js !NODE_VERSION! portable...
echo.

if not exist "!PORTABLE_DIR!" mkdir "!PORTABLE_DIR!"
set "NODE_URL=https://nodejs.org/dist/v!NODE_VERSION!/node-v!NODE_VERSION!-win-x64.zip"
set "ARCHIVE=%TEMP%\node-portable.zip"

powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '!NODE_URL!' -OutFile '!ARCHIVE!'}"
if !ERRORLEVEL! neq 0 (
    echo [!] Error al descargar Node.js
    echo    Descargalo manualmente desde:
    echo    https://nodejs.org/dist/v!NODE_VERSION!/node-v!NODE_VERSION!-win-x64.zip
    pause
    exit /b 1
)

echo Extrayendo...
powershell -Command "& {Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('!ARCHIVE!', '!PORTABLE_DIR!')}"
del "!ARCHIVE!" 2>nul

set "NODE_EXE="
for /d %%d in ("!PORTABLE_DIR!\*") do (
    if exist "%%d\node.exe" set "NODE_EXE=%%d\node.exe"
)
if "!NODE_EXE!"=="" set "NODE_EXE=!PORTABLE_DIR!\node.exe"

if not exist "!NODE_EXE!" (
    echo [!] Error: no se encontro node.exe
    pause
    exit /b 1
)

echo [OK] Node.js portable descargado
for %%d in ("!NODE_EXE!") do set "NODE_DIR=%%~dpd"
set "NODE_DIR=!NODE_DIR:~0,-1!"
set "PATH=!NODE_DIR!;!PATH!"
for /f "tokens=1" %%v in ('"!NODE_EXE!" -v') do echo [OK] Node.js %%v

:have_node
if not exist "!INSTALL_DIR!" mkdir "!INSTALL_DIR!"

:: -- Ollama --
where ollama >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo [OK] Ollama detectado en PATH
    goto :have_ollama
)

echo [!] Ollama no encontrado en PATH.
echo Descargando Ollama portable...
echo.

if not exist "!OLLAMA_DIR!" mkdir "!OLLAMA_DIR!"
set "OLLAMA_URL=https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip"
set "OLLAMA_ARCHIVE=%TEMP%\ollama-portable.zip"

powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '!OLLAMA_URL!' -OutFile '!OLLAMA_ARCHIVE!'}"
if !ERRORLEVEL! neq 0 (
    echo [!] Error al descargar Ollama
    echo    Descargalo manualmente desde:
    echo    https://ollama.com/download/OllamaSetup.exe
    pause
    exit /b 1
)

echo Extrayendo...
powershell -Command "& {Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('!OLLAMA_ARCHIVE!', '!OLLAMA_DIR!')}"
del "!OLLAMA_ARCHIVE!" 2>nul

set "OLLAMA_EXE="
for /d %%d in ("!OLLAMA_DIR!\*") do (
    if exist "%%d\ollama.exe" set "OLLAMA_EXE=%%d\ollama.exe"
)
if "!OLLAMA_EXE!"=="" set "OLLAMA_EXE=!OLLAMA_DIR!\ollama.exe"

if not exist "!OLLAMA_EXE!" (
    echo [!] Error: no se encontro ollama.exe
    pause
    exit /b 1
)

echo [OK] Ollama portable descargado
set "PATH=!OLLAMA_DIR!;!PATH!"

:have_ollama

echo.
echo ============================================
echo  Instalando dependencias y compilando
echo ============================================
echo.

cd /d "!SCRIPT_DIR!"
call npm install
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Fallo npm install
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas

call npm run build
if !ERRORLEVEL! neq 0 (
    echo [ERROR] Fallo al compilar
    pause
    exit /b 1
)
echo [OK] Compilacion completada

echo.
echo ============================================
echo  Instalando en !INSTALL_DIR!
echo ============================================
mkdir "!INSTALL_DIR!" 2>nul

xcopy /s /e /y /q "!SCRIPT_DIR!dist" "!INSTALL_DIR!\dist\" >nul
xcopy /s /e /y /q "!SCRIPT_DIR!public" "!INSTALL_DIR!\public\" >nul
copy /y "!SCRIPT_DIR!package.json" "!INSTALL_DIR!\" >nul
copy /y "!SCRIPT_DIR!server.mjs" "!INSTALL_DIR!\" >nul

if !ERRORLEVEL! neq 0 (
    echo [ERROR] Fallo al copiar archivos
    pause
    exit /b 1
)
echo [OK] Archivos copiados

echo.
echo ============================================
echo  Creando scripts...
echo ============================================

copy /y "!SCRIPT_DIR!start.bat" "!INSTALL_DIR!\start.bat" >nul
echo [OK] start.bat creado

copy /y "!SCRIPT_DIR!launch.vbs" "!INSTALL_DIR!\launch.vbs" >nul
echo [OK] launch.vbs creado

copy /y "!SCRIPT_DIR!fix_shortcut.ps1" "!INSTALL_DIR!\fix_shortcut.ps1" >nul
echo [OK] fix_shortcut.ps1 creado

copy /y "!SCRIPT_DIR!fix_shortcut.bat" "!INSTALL_DIR!\fix_shortcut.bat" >nul
echo [OK] fix_shortcut.bat creado

copy /y "!SCRIPT_DIR!uninstall.bat" "!INSTALL_DIR!\uninstall.bat" >nul
echo [OK] uninstall.bat creado

echo.
echo ============================================
echo  Creando acceso directo en el Escritorio...
echo ============================================
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $desk = [Environment]::GetFolderPath('Desktop'); $sc = $ws.CreateShortcut((Join-Path $desk 'IngenIA.lnk')); $sc.TargetPath = '%INSTALL_DIR:\=\\%\launch.vbs'; $sc.WorkingDirectory = '%INSTALL_DIR:\=\\%'; $sc.Description = 'IngenIA - Chat con Ollama'; $sc.IconLocation = '%INSTALL_DIR:\=\\%\public\icon.ico'; $sc.Save(); if (Test-Path (Join-Path $desk 'IngenIA.lnk')) { Write-Host '[OK] Acceso directo creado en el Escritorio' } else { Write-Host '[!] No se pudo crear el acceso directo'; Write-Host '    Ejecuta: ' + (Join-Path '%INSTALL_DIR:\=\\%' 'fix_shortcut.bat') }"

echo.
echo ============================================
echo     INSTALACION COMPLETADA
echo ============================================
echo.
echo  Para iniciar IngenIA:
echo    Haz doble clic en "IngenIA" en tu Escritorio
echo.
echo  Para desinstalar:
echo    Ejecuta: !INSTALL_DIR!\uninstall.bat
echo.
echo  Si el acceso directo no aparece, ejecuta:
echo    !INSTALL_DIR!\fix_shortcut.bat
echo.
pause
