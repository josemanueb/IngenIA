<# 
.SYNOPSIS
    Crea o repara el acceso directo de IngenIA en el Escritorio de Windows.
.DESCRIPTION
    Este script crea un acceso directo (.lnk) correcto para IngenIA.
    Se ejecuta directamente haciendo doble clic o desde PowerShell.
    Debe ejecutarse desde la carpeta de instalacion de IngenIA (donde esta launch.vbs).
#>

# Detectar carpeta de instalacion actual
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$installDir = $scriptDir

# Verificar que existan los archivos necesarios
$launchVbs = Join-Path $installDir "launch.vbs"
$iconPath = Join-Path $installDir "public\icon.ico"

if (-not (Test-Path $launchVbs)) {
    Write-Host "[!] ERROR: No se encuentra launch.vbs en $installDir" -ForegroundColor Red
    Write-Host "    Ejecuta este script desde la carpeta de instalacion de IngenIA" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}

if (-not (Test-Path $iconPath)) {
    Write-Host "[!] Advertencia: No se encuentra icon.ico, se usara icono por defecto" -ForegroundColor Yellow
    $iconPath = $null
}

# Carpeta del Escritorio
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "IngenIA.lnk"

Write-Host "Creando acceso directo en: $shortcutPath" -ForegroundColor Cyan
Write-Host "Objetivo: $launchVbs" -ForegroundColor Cyan

try {
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut($shortcutPath)
    $sc.TargetPath = $launchVbs
    $sc.WorkingDirectory = $installDir
    $sc.Description = "IngenIA - Chat con Ollama"
    if ($iconPath) { $sc.IconLocation = $iconPath }
    $sc.Save()

    if (Test-Path $shortcutPath) {
        Write-Host "[OK] Acceso directo creado correctamente en el Escritorio" -ForegroundColor Green
    } else {
        Write-Host "[!] El acceso directo no se creo correctamente" -ForegroundColor Red
    }
}
catch {
    Write-Host "[!] Error al crear acceso directo: $_" -ForegroundColor Red
}

Read-Host "Presiona Enter para salir"