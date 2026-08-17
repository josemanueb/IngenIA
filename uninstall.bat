@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================
echo     Desinstalador de IngenIA
echo ============================================
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\IngenIA"

echo [1/6] Deteniendo procesos de IngenIA...
powershell -NoP -C "Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like '*IngenIA*' -or $_.CommandLine -match 'server\.mjs' -or $_.CommandLine -match 'IngenIA' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
echo [OK] Procesos detenidos

echo [2/6] Eliminando archivos de instalacion...
if exist "!INSTALL_DIR!" (
    rmdir /s /q "!INSTALL_DIR!"
    echo [OK] Eliminado !INSTALL_DIR!
) else (
    echo [i] No se encontro !INSTALL_DIR!
)

echo [3/6] Eliminando accesos directos...
for /f "usebackq delims=" %%d in (`powershell -NoP -C "[Environment]::GetFolderPath('Desktop')"`) do set "DESKTOP=%%d"
if exist "!DESKTOP!\IngenIA.lnk" (
    del /q "!DESKTOP!\IngenIA.lnk"
    echo [OK] Acceso directo del Escritorio eliminado
) else (
    echo [i] No se encontro acceso directo del Escritorio
)
set "STARTMENU_USER=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
if exist "!STARTMENU_USER!" for /r "!STARTMENU_USER!" %%f in (IngenIA*.lnk) do del /q "%%f" 2>nul
set "STARTMENU_ALL=%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs"
if exist "!STARTMENU_ALL!" for /r "!STARTMENU_ALL!" %%f in (IngenIA*.lnk) do del /q "%%f" 2>nul
echo [OK] Accesos directos del menu eliminados

echo [4/6] Eliminando archivos temporales...
del /q "%TEMP%\node-portable.zip" "%TEMP%\ollama-portable.zip" 2>nul
echo [OK] Temporales eliminados

echo [5/6] Verificando residuos...
if exist "!INSTALL_DIR!" (
    echo [!] Queda un residuo en !INSTALL_DIR!
) else (
    echo [OK] Sin residuos en !INSTALL_DIR!
)

echo.
echo ============================================
echo     Datos de Ollama
echo ============================================
if exist "%USERPROFILE%\.ollama" (
    echo Se encontraron datos y modelos de Ollama en:
    echo   %USERPROFILE%\.ollama
    set "RESP="
    set /p "RESP=  Eliminar tambien todos los modelos de Ollama? [s/N]: "
    if /i "!RESP!"=="S" (
        rmdir /s /q "%USERPROFILE%\.ollama"
        echo [OK] Datos de Ollama eliminados
    ) else (
        echo [i] Datos de Ollama conservados
    )
) else (
    echo [i] No hay datos de Ollama
)

echo.
echo ============================================
echo     DESINSTALACION COMPLETADA
echo ============================================
echo.
echo Si instalaste Ollama aparte (OllamaSetup.exe), desinstalalo desde
echo Panel de control ^> Programas para eliminar el servicio de Ollama.
echo.
pause