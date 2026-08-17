@echo off
setlocal enabledelayedexpansion

set "NODE_VERSION=20.18.1"
set "INSTALL_DIR=%LOCALAPPDATA%\IngenIA"
set "SCRIPT_DIR=%~dp0"
set "PORTABLE_DIR=%INSTALL_DIR%\node_portable"
set "OLLAMA_DIR=%INSTALL_DIR%\ollama_portable"
set "TRIES=3"

echo.
echo ============================================
echo     Instalador de IngenIA
echo ============================================
echo.

:: Clean previous installation but KEEP the portable runtimes
:: (node_portable / ollama_portable) to avoid re-downloading them
if exist "!INSTALL_DIR!" (
    for %%d in ("!INSTALL_DIR!\*") do (
        if /i not "%%~nxd"=="node_portable" if /i not "%%~nxd"=="ollama_portable" (
            if exist "%%d\" (rd /s /q "%%d") else (del /q "%%d")
        )
    )
)

:: -- Node.js --
where node >nul 2>&1
if !ERRORLEVEL! equ 0 (
    where npm >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        for /f "tokens=1" %%v in ('node -v') do echo [OK] Node.js %%v en PATH
        goto :have_node
    )
)

echo [!] Node.js/npm no encontrado en PATH.
echo Descargando Node.js !NODE_VERSION! portable...
echo.

set "NODE_EXE="
for /d %%d in ("!PORTABLE_DIR!\*") do (
    if exist "%%d\node.exe" set "NODE_EXE=%%d\node.exe"
)
if "!NODE_EXE!"=="" if exist "!PORTABLE_DIR!\node.exe" set "NODE_EXE=!PORTABLE_DIR!\node.exe"

if not "!NODE_EXE!"=="" goto :have_node_exe

if not exist "!PORTABLE_DIR!" mkdir "!PORTABLE_DIR!"
set "NODE_URL=https://nodejs.org/dist/v!NODE_VERSION!/node-v!NODE_VERSION!-win-x64.zip"
set "NODE_SUMS=https://nodejs.org/dist/v!NODE_VERSION!/SHASUMS256.txt"
set "ARCHIVE=%TEMP%\node-portable.zip"
set /a TRY=0

:node_download
set /a TRY+=1
echo.
echo Descargando Node.js !NODE_VERSION! ^(intento !TRY!/!TRIES!^)...
del "!ARCHIVE!" 2>nul
powershell -NoP -Command "& {[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '!NODE_URL!' -OutFile '!ARCHIVE!' -TimeoutSec 120}"
if !ERRORLEVEL! neq 0 goto :node_fail

:: Verificar SHA256 contra SHASUMS256.txt
powershell -NoP -Command "& {$ErrorActionPreference='Stop'; try{$s=(Invoke-WebRequest -UseBasicParsing -Uri '!NODE_SUMS!' -TimeoutSec 30).Content; $l=$s -split '\r?\n' | Where-Object { $_ -match 'node-v!NODE_VERSION!-win-x64\.zip' } | Select-Object -First 1; if(-not $l){Write-Host '   [x] No se encontro el checksum'; exit 1}; $e=($l -split '\s+')[0]; $a=(Get-FileHash -Algorithm SHA256 -Path '!ARCHIVE!').Hash.ToLower(); if($e -ne $a){Write-Host '   [x] Checksum incorrecto (descarga corrupta)'; exit 1}; Write-Host '   [OK] Checksum verificado'; exit 0}catch{Write-Host '   [x] Error verificando: '+$_.Exception.Message; exit 1}}"
if !ERRORLEVEL! neq 0 goto :node_fail

echo Extrayendo...
powershell -NoP -Command "& {Add-Type -AssemblyName System.IO.Compression.FileSystem; try{[System.IO.Compression.ZipFile]::ExtractToDirectory('!ARCHIVE!','!PORTABLE_DIR!'); exit 0}catch{Write-Host '   [x] Error extrayendo: '+$_.Exception.Message; exit 1}}"
if !ERRORLEVEL! neq 0 goto :node_fail
del "!ARCHIVE!" 2>nul

set "NODE_EXE="
for /d %%d in ("!PORTABLE_DIR!\*") do (
    if exist "%%d\node.exe" set "NODE_EXE=%%d\node.exe"
)
if "!NODE_EXE!"=="" set "NODE_EXE=!PORTABLE_DIR!\node.exe"
goto :have_node_exe

:node_fail
if !TRY! lss !TRIES! (
    echo [!] Fallo en la descarga/verificacion, reintentando...
    timeout /t 3 /nobreak >nul
    goto :node_download
)
echo.
echo [ERROR] No se pudo descargar ni verificar Node.js tras !TRIES! intentos.
echo   Descargalo manualmente desde:
echo   !NODE_URL!
echo   y extrae el contenido en: !PORTABLE_DIR!
pause
exit /b 1

:have_node_exe
if not exist "!NODE_EXE!" (
    echo [!] Error: no se encontro node.exe
    pause
    exit /b 1
)

echo [OK] Node.js portable listo
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

set "OLLAMA_EXE="
for /d %%d in ("!OLLAMA_DIR!\*") do (
    if exist "%%d\ollama.exe" set "OLLAMA_EXE=%%d\ollama.exe"
)
if "!OLLAMA_EXE!"=="" if exist "!OLLAMA_DIR!\ollama.exe" set "OLLAMA_EXE=!OLLAMA_DIR!\ollama.exe"

if not "!OLLAMA_EXE!"=="" goto :have_ollama_exe

if not exist "!OLLAMA_DIR!" mkdir "!OLLAMA_DIR!"
set "OLLAMA_URL=https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip"
set "OLLAMA_ARCHIVE=%TEMP%\ollama-portable.zip"
set /a TRY=0

:ollama_download
set /a TRY+=1
echo.
echo Descargando Ollama ^(intento !TRY!/!TRIES!^)...
del "!OLLAMA_ARCHIVE!" 2>nul
powershell -NoP -Command "& {[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '!OLLAMA_URL!' -OutFile '!OLLAMA_ARCHIVE!' -TimeoutSec 180}"
if !ERRORLEVEL! neq 0 goto :ollama_fail

:: Verificar que el zip no este truncado/corrupto
powershell -NoP -Command "& {Add-Type -AssemblyName System.IO.Compression.FileSystem; try{$z=[System.IO.Compression.ZipFile]::OpenRead('!OLLAMA_ARCHIVE!'); $z.Dispose(); Write-Host '   [OK] Zip integro'; exit 0}catch{Write-Host '   [x] Zip corrupto (descarga incompleta)'; exit 1}}"
if !ERRORLEVEL! neq 0 goto :ollama_fail

echo Extrayendo...
powershell -NoP -Command "& {Add-Type -AssemblyName System.IO.Compression.FileSystem; try{[System.IO.Compression.ZipFile]::ExtractToDirectory('!OLLAMA_ARCHIVE!','!OLLAMA_DIR!'); exit 0}catch{Write-Host '   [x] Error extrayendo: '+$_.Exception.Message; exit 1}}"
if !ERRORLEVEL! neq 0 goto :ollama_fail
del "!OLLAMA_ARCHIVE!" 2>nul

set "OLLAMA_EXE="
for /d %%d in ("!OLLAMA_DIR!\*") do (
    if exist "%%d\ollama.exe" set "OLLAMA_EXE=%%d\ollama.exe"
)
if "!OLLAMA_EXE!"=="" set "OLLAMA_EXE=!OLLAMA_DIR!\ollama.exe"
goto :have_ollama_exe

:ollama_fail
if !TRY! lss !TRIES! (
    echo [!] Fallo en la descarga/verificacion, reintentando...
    timeout /t 3 /nobreak >nul
    goto :ollama_download
)
echo.
echo [ERROR] No se pudo descargar ni verificar Ollama tras !TRIES! intentos.
echo   Descargalo manualmente desde:
echo   https://ollama.com/download/OllamaSetup.exe
pause
exit /b 1

:have_ollama_exe
if not exist "!OLLAMA_EXE!" (
    echo [!] Error: no se encontro ollama.exe
    pause
    exit /b 1
)

echo [OK] Ollama portable listo
for %%d in ("!OLLAMA_EXE!") do set "OLLAMA_DIR=%%~dpd"
set "OLLAMA_DIR=!OLLAMA_DIR:~0,-1!"
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