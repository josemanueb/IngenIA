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

:: ── Node.js ──
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
set "PATH=!PORTABLE_DIR!;!PATH!"
for /f "tokens=1" %%v in ('"!NODE_EXE!" -v') do echo [OK] Node.js %%v

:have_node
if not exist "!INSTALL_DIR!" mkdir "!INSTALL_DIR!"

:: ── Ollama ──
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

:: Copy portables to install dir
if exist "!PORTABLE_DIR!" (
    xcopy /s /e /y /q "!PORTABLE_DIR!" "!INSTALL_DIR!\node_portable\" >nul
)
if exist "!OLLAMA_DIR!" (
    xcopy /s /e /y /q "!OLLAMA_DIR!" "!INSTALL_DIR!\ollama_portable\" >nul
)

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
if exist "!INSTALL_DIR!" rmdir /s /q "!INSTALL_DIR!"
mkdir "!INSTALL_DIR!" 2>nul

xcopy /s /e /y /q "!SCRIPT_DIR!dist" "!INSTALL_DIR!\dist\" >nul
xcopy /s /e /y /q "!SCRIPT_DIR!public" "!INSTALL_DIR!\public\" >nul
copy /y "!SCRIPT_DIR!package.json" "!INSTALL_DIR!\" >nul
copy /y "!SCRIPT_DIR!server.mjs" "!INSTALL_DIR!\" >nul

if exist "!SCRIPT_DIR!\node_portable" (
    xcopy /s /e /y /q "!SCRIPT_DIR!\node_portable" "!INSTALL_DIR!\node_portable\" >nul
)
if exist "!SCRIPT_DIR!\ollama_portable" (
    xcopy /s /e /y /q "!SCRIPT_DIR!\ollama_portable" "!INSTALL_DIR!\ollama_portable\" >nul
)

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

> "!INSTALL_DIR!\start.bat" echo @echo off
>> "!INSTALL_DIR!\start.bat" echo setlocal enabledelayedexpansion
>> "!INSTALL_DIR!\start.bat" echo set "OLLAMA_ORIGINS=*"
>> "!INSTALL_DIR!\start.bat" echo cd /d "%%~dp0"
>> "!INSTALL_DIR!\start.bat" echo.
>> "!INSTALL_DIR!\start.bat" echo :: Usar Node.js portable si existe
>> "!INSTALL_DIR!\start.bat" echo set "NODE=node"
>> "!INSTALL_DIR!\start.bat" echo if exist "%%~dp0\node_portable\node.exe" set "NODE=%%~dp0\node_portable\node.exe"
>> "!INSTALL_DIR!\start.bat" echo for /d %%%%d in ("%%~dp0\node_portable\*") do if exist "%%%%d\node.exe" set "NODE=%%%%d\node.exe"
>> "!INSTALL_DIR!\start.bat" echo if "^!NODE^!"=="node" (
>> "!INSTALL_DIR!\start.bat" echo   where node ^>nul 2^>^&1 || (
>> "!INSTALL_DIR!\start.bat" echo     echo [^!^] Node.js no encontrado
>> "!INSTALL_DIR!\start.bat" echo     pause
>> "!INSTALL_DIR!\start.bat" echo     exit /b 1
>> "!INSTALL_DIR!\start.bat" echo   ^)
>> "!INSTALL_DIR!\start.bat" echo ^)
>> "!INSTALL_DIR!\start.bat" echo.
>> "!INSTALL_DIR!\start.bat" echo :: Usar Ollama portable si existe
>> "!INSTALL_DIR!\start.bat" echo set "OLLAMA=ollama"
>> "!INSTALL_DIR!\start.bat" echo if exist "%%~dp0\ollama_portable\ollama.exe" set "OLLAMA=%%~dp0\ollama_portable\ollama.exe"
>> "!INSTALL_DIR!\start.bat" echo for /d %%%%d in ("%%~dp0\ollama_portable\*") do if exist "%%%%d\ollama.exe" set "OLLAMA=%%%%d\ollama.exe"
>> "!INSTALL_DIR!\start.bat" echo.
>> "!INSTALL_DIR!\start.bat" echo echo Verificando Ollama...
>> "!INSTALL_DIR!\start.bat" echo curl -s http://localhost:11434/api/tags ^>nul 2^>^&1
>> "!INSTALL_DIR!\start.bat" echo if %%ERRORLEVEL%% neq 0 (
>> "!INSTALL_DIR!\start.bat" echo if exist "^!OLLAMA^!" (
>> "!INSTALL_DIR!\start.bat" echo     echo Iniciando Ollama...
>> "!INSTALL_DIR!\start.bat" echo     start /b "" "^!OLLAMA^!" serve
>> "!INSTALL_DIR!\start.bat" echo     timeout /t 5 /nobreak ^>nul
>> "!INSTALL_DIR!\start.bat" echo   ^) else (
>> "!INSTALL_DIR!\start.bat" echo     echo [^!^] Ollama no encontrado
>> "!INSTALL_DIR!\start.bat" echo   ^)
>> "!INSTALL_DIR!\start.bat" echo ^)
>> "!INSTALL_DIR!\start.bat" echo.
>> "!INSTALL_DIR!\start.bat" echo echo Iniciando IngenIA...
>> "!INSTALL_DIR!\start.bat" echo start /b "" "^!NODE^!" server.mjs
>> "!INSTALL_DIR!\start.bat" echo timeout /t 3 /nobreak ^>nul
>> "!INSTALL_DIR!\start.bat" echo start http://localhost:5173
>> "!INSTALL_DIR!\start.bat" echo.
>> "!INSTALL_DIR!\start.bat" echo echo IngenIA abierto en http://localhost:5173
>> "!INSTALL_DIR!\start.bat" echo pause
echo [OK] start.bat creado

> "!INSTALL_DIR!\uninstall.bat" echo @echo off
>> "!INSTALL_DIR!\uninstall.bat" echo setlocal enabledelayedexpansion
>> "!INSTALL_DIR!\uninstall.bat" echo echo.
>> "!INSTALL_DIR!\uninstall.bat" echo echo ============================================
>> "!INSTALL_DIR!\uninstall.bat" echo echo     Desinstalando IngenIA
>> "!INSTALL_DIR!\uninstall.bat" echo echo ============================================
>> "!INSTALL_DIR!\uninstall.bat" echo echo.
>> "!INSTALL_DIR!\uninstall.bat" echo set "INSTALL_DIR=%%LOCALAPPDATA%%\IngenIA"
>> "!INSTALL_DIR!\uninstall.bat" echo taskkill /fi "IMAGENAME eq node.exe" /fi "WINDOWTITLE eq IngenIA" ^>nul 2^>^&1
>> "!INSTALL_DIR!\uninstall.bat" echo timeout /t 2 /nobreak ^>nul
>> "!INSTALL_DIR!\uninstall.bat" echo if exist "%%INSTALL_DIR%%" (
>> "!INSTALL_DIR!\uninstall.bat" echo   rmdir /s /q "%%INSTALL_DIR%%"
>> "!INSTALL_DIR!\uninstall.bat" echo   echo [OK] Archivos eliminados
>> "!INSTALL_DIR!\uninstall.bat" echo ^) else (
>> "!INSTALL_DIR!\uninstall.bat" echo   echo [i] No se encontraron archivos
>> "!INSTALL_DIR!\uninstall.bat" echo ^)
>> "!INSTALL_DIR!\uninstall.bat" echo if exist "%%USERPROFILE%%\Desktop\IngenIA.lnk" (
>> "!INSTALL_DIR!\uninstall.bat" echo   del "%%USERPROFILE%%\Desktop\IngenIA.lnk"
>> "!INSTALL_DIR!\uninstall.bat" echo   echo [OK] Acceso directo eliminado
>> "!INSTALL_DIR!\uninstall.bat" echo ^)
>> "!INSTALL_DIR!\uninstall.bat" echo echo.
>> "!INSTALL_DIR!\uninstall.bat" echo echo Desinstalacion completada.
>> "!INSTALL_DIR!\uninstall.bat" echo echo Los modelos de Ollama no fueron eliminados.
>> "!INSTALL_DIR!\uninstall.bat" echo echo.
>> "!INSTALL_DIR!\uninstall.bat" echo pause
echo [OK] uninstall.bat creado

echo.
echo ============================================
echo  Creando acceso directo en el Escritorio...
echo ============================================
set "VBS=%TEMP%\ingenia_shortcut.vbs"
> "%VBS%" echo Set ws = CreateObject("WScript.Shell")
>> "%VBS%" echo Set sc = ws.CreateShortcut("%USERPROFILE%\Desktop\IngenIA.lnk")
>> "%VBS%" echo sc.TargetPath = "!INSTALL_DIR!\start.bat"
>> "%VBS%" echo sc.WorkingDirectory = "!INSTALL_DIR!"
>> "%VBS%" echo sc.Description = "IngenIA - Chat con Ollama"
>> "%VBS%" echo sc.Save()
cscript //nologo "%VBS%"
if !ERRORLEVEL! neq 0 (
    echo [!] No se pudo crear acceso directo
    echo    Crealo manualmente apuntando a: !INSTALL_DIR!\start.bat
) else (
    echo [OK] Acceso directo creado en el Escritorio
)
del "%VBS%" 2>nul

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
pause
