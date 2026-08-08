@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================
echo     Desinstalador de IngenIA
echo ============================================
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\IngenIA"

echo Eliminando archivos de instalacion...
if exist "!INSTALL_DIR!" (
    rmdir /s /q "!INSTALL_DIR!"
    echo [OK] Archivos eliminados
) else (
    echo [i] No se encontraron archivos de instalacion
)

echo Eliminando acceso directo del Escritorio...
for /f "usebackq delims=" %%d in (`powershell -NoP -C "[Environment]::GetFolderPath('Desktop')"`) do set "DESKTOP=%%d"
if exist "!DESKTOP!\IngenIA.lnk" (
    del "!DESKTOP!\IngenIA.lnk"
    echo [OK] Acceso directo eliminado
) else (
    echo [i] No se encontro acceso directo
)

echo.
echo ============================================
echo     DESINSTALACION COMPLETADA
echo ============================================
echo.
echo Los modelos de Ollama no fueron eliminados.
echo Si deseas eliminarlos, usa: ollama rm nombre_del_modelo
echo.
pause
