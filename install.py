#!/usr/bin/env python3
"""
Instalador universal de IngenIA
Descarga Node.js portable si es necesario, compila la app y genera accesos directos.
Funciona en Linux y Windows sin dependencias externas (usa solo la stdlib).
"""

import json
import os
import platform
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import zipfile
from pathlib import Path

REPO_URL = "https://github.com/josemanueb/IngenIA"
NODE_VERSION = "20.18.1"
INSTALL_DIR_LINUX = Path.home() / ".local" / "share" / "ingenia"
INSTALL_DIR_WINDOWS = Path(os.environ.get("LOCALAPPDATA", "")) / "IngenIA"

NODE_MIRRORS = {
    "linux": f"https://nodejs.org/dist/v{NODE_VERSION}/node-v{NODE_VERSION}-linux-x64.tar.xz",
    "windows": f"https://nodejs.org/dist/v{NODE_VERSION}/node-v{NODE_VERSION}-win-x64.zip",
}

OLLAMA_MIRRORS = {
    "linux": "https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64.tgz",
    "windows": "https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip",
}


def detect_os():
    system = platform.system().lower()
    if system == "linux":
        return "linux"
    elif system == "windows" or sys.platform == "win32":
        return "windows"
    else:
        raise RuntimeError(f"Sistema operativo no soportado: {system}")


def download(url, dest):
    print(f"Descargando: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp, open(dest, "wb") as out:
        out.write(resp.read())
    size = os.path.getsize(dest) / (1024 * 1024)
    print(f"  {size:.1f} MB descargados")


def extract_node(archive_path, target_dir, os_type):
    target_dir.mkdir(parents=True, exist_ok=True)
    if os_type == "linux":
        with tarfile.open(archive_path, "r:xz") as tar:
            tar.extractall(target_dir)
        extracted = list(target_dir.iterdir())
        if len(extracted) == 1 and extracted[0].is_dir():
            return extracted[0]
        return target_dir
    else:
        with zipfile.ZipFile(archive_path, "r") as zf:
            zf.extractall(target_dir)
        extracted = list(target_dir.iterdir())
        if len(extracted) == 1 and extracted[0].is_dir():
            return extracted[0]
        return target_dir


def ensure_node(os_type, install_root):
    node_cmd = shutil.which("node")
    if node_cmd:
        try:
            ver = subprocess.check_output([node_cmd, "-v"], text=True).strip()
            print(f"Node.js {ver} detectado en PATH")
            return node_cmd
        except Exception:
            pass

    portable_dir = install_root / "node_portable"
    if os_type == "linux":
        node_bin = portable_dir / "bin" / "node"
        if not node_bin.exists():
            print("Node.js no encontrado en PATH. Descargando versión portable...")
            archive = install_root / "node_portable.tar.xz"
            url = NODE_MIRRORS["linux"]
            download(url, archive)
            extracted = extract_node(archive, portable_dir, "linux")
            node_bin = extracted / "bin" / "node"
            archive.unlink(missing_ok=True)
        if not node_bin.exists():
            raise RuntimeError(f"No se encontró node en {node_bin}")
        os.chmod(node_bin, 0o755)
        return str(node_bin)
    else:
        node_exe = portable_dir / "node.exe"
        if not node_exe.exists():
            print("Node.js no encontrado en PATH. Descargando versión portable...")
            archive = install_root / "node_portable.zip"
            url = NODE_MIRRORS["windows"]
            download(url, archive)
            extracted = extract_node(archive, portable_dir, "windows")
            node_exe = extracted / "node.exe"
            archive.unlink(missing_ok=True)
        if not node_exe.exists():
            raise RuntimeError(f"No se encontró node.exe en {node_exe}")
        return str(node_exe)


def ensure_ollama(os_type, install_root):
    if shutil.which("ollama"):
        print("Ollama detectado en PATH")
        return
    print("Ollama no encontrado. Descargando portable...")
    portable_dir = install_root / "ollama_portable"
    portable_dir.mkdir(parents=True, exist_ok=True)
    url = OLLAMA_MIRRORS[os_type]
    archive = install_root / "ollama_archive"
    if os_type == "windows":
        archive = archive.with_suffix(".zip")
    else:
        archive = archive.with_suffix(".tgz")
    download(url, archive)
    if os_type == "linux":
        with tarfile.open(archive, "r:gz") as tar:
            tar.extractall(portable_dir)
        ollama_bin = portable_dir / "ollama"
        if not ollama_bin.exists():
            found = list(portable_dir.rglob("ollama"))
            if found:
                shutil.move(str(found[0]), str(ollama_bin))
        os.chmod(ollama_bin, 0o755)
    else:
        with zipfile.ZipFile(archive, "r") as zf:
            zf.extractall(portable_dir)
        ollama_bin = portable_dir / "ollama.exe"
        if not ollama_bin.exists():
            found = list(portable_dir.rglob("ollama.exe"))
            if found:
                shutil.move(str(found[0]), str(ollama_bin))
    archive.unlink()
    
    # Verify binary is valid
    if not ollama_bin.exists():
        raise RuntimeError(f"No se encontró ollama binario en {ollama_bin}")
    if os_type == "linux":
        # Check ELF magic
        with open(ollama_bin, "rb") as f:
            if f.read(4) != b"\x7fELF":
                raise RuntimeError("Binario ollama descargado no es válido")
    
    env_path = os.environ.copy()
    env_path["PATH"] = str(portable_dir) + os.pathsep + env_path.get("PATH", "")
    subprocess.run([str(ollama_bin), "--version"], env=env_path)
    print("Ollama portable listo")


def ensure_tts_linux():
    if not shutil.which("espeak-ng") or not shutil.which("speech-dispatcher"):
        print("Instalando dependencias TTS...")
        if shutil.which("apt"):
            subprocess.run(["sudo", "apt", "install", "-y",
                "espeak-ng", "speech-dispatcher-espeak-ng", "speech-dispatcher"],
                check=False)
        else:
            print("Advertencia: no se pudo instalar TTS automáticamente")
    if shutil.which("speech-dispatcher"):
        subprocess.run(["speech-dispatcher", "--spawn"], check=False)


def get_npm_path(node_bin):
    p = Path(node_bin).parent
    if p.name == "bin":
        npm = p / "npm"
        if npm.exists():
            return str(npm)
        return str(p / "npm-cli.js")
    return str(p / "npm.cmd")


def run(cmd, cwd=None, check=True):
    print(f">>> {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=cwd, check=check, text=True)


def install_linux(install_dir, repo_dir):
    try:
        desktop_dir = Path(subprocess.check_output(["xdg-user-dir", "DESKTOP"], text=True).strip())
    except Exception:
        desktop_dir = Path.home() / "Desktop"
    desktop_dir.mkdir(parents=True, exist_ok=True)
    desktop_file = desktop_dir / "IngenIA.desktop"
    menu_file = Path.home() / ".local" / "share" / "applications" / "IngenIA.desktop"
    menu_file.parent.mkdir(parents=True, exist_ok=True)

    desktop_entry = f"""[Desktop Entry]
Type=Application
Name=IngenIA
Comment=Chat y compara modelos de Ollama
Exec={install_dir / 'start.sh'}
Icon={install_dir / 'public' / 'icon.png'}
Terminal=false
Categories=Development;AI;
StartupNotify=true
"""
    desktop_file.write_text(desktop_entry, encoding="utf-8")
    menu_file.write_text(desktop_entry, encoding="utf-8")
    os.chmod(desktop_file, 0o755)
    print(f"Acceso directo creado en: {desktop_file}")

    os.chmod(install_dir / "start.sh", 0o755)
    ensure_tts_linux()


def install_windows(install_dir):
    desktop_dir = Path(os.environ.get("USERPROFILE", "")) / "Desktop"
    desktop_dir.mkdir(parents=True, exist_ok=True)

    launch_vbs = install_dir / "launch.vbs"
    launch_vbs.write_text(
        'Set ws = CreateObject("WScript.Shell")\n'
        'ws.Run """" & ws.CurrentDirectory & "\\start.bat""", 0, False\n',
        encoding="utf-8",
    )

    shortcut = desktop_dir / "IngenIA.lnk"
    # Use PowerShell with proper path escaping
    install_dir_str = str(install_dir).replace('\\', '\\\\')
    launch_vbs_str = str(launch_vbs).replace('\\', '\\\\')
    ps = f"""
$ws = New-Object -ComObject WScript.Shell
$desk = [Environment]::GetFolderPath('Desktop')
$sc = $ws.CreateShortcut([System.IO.Path]::Combine($desk, 'IngenIA.lnk'))
$sc.TargetPath = '{launch_vbs_str}'
$sc.WorkingDirectory = '{install_dir_str}'
$sc.Description = 'IngenIA - Chat con Ollama'
$sc.IconLocation = '{install_dir_str}\\public\\icon.ico'
$sc.Save()
"""
    result = subprocess.run(["powershell", "-Command", ps], check=False, capture_output=True, text=True)
    if shortcut.exists():
        print(f"Acceso directo creado en: {shortcut}")
    else:
        print(f"No se pudo crear el acceso directo automáticamente: {result.stderr}")


def main():
    print("=" * 55)
    print("  Instalador universal de IngenIA")
    print("=" * 55)

    os_type = detect_os()
    print(f"Sistema detectado: {os_type}")

    install_root = INSTALL_DIR_LINUX if os_type == "linux" else INSTALL_DIR_WINDOWS
    install_root.mkdir(parents=True, exist_ok=True)

    repo_dir = Path(__file__).resolve().parent
    if not (repo_dir / "package.json").exists():
        print("Error: ejecuta este script desde la carpeta del proyecto IngenIA")
        sys.exit(1)

    node_bin = ensure_node(os_type, install_root)
    npm = get_npm_path(node_bin)
    node_dir = Path(node_bin).parent

    env = os.environ.copy()
    env["PATH"] = str(node_dir) + os.pathsep + env.get("PATH", "")

    print(f"\nNode.js: {node_bin}")
    print(f"npm: {npm}")

    ensure_ollama(os_type, install_root)

    print("\nInstalando dependencias...")
    run([npm, "install"], cwd=repo_dir, check=True)

    print("\nCompilando...")
    run([node_bin, str(repo_dir / "node_modules" / ".bin" / "vite"), "build"], cwd=repo_dir, check=True)

    dist = repo_dir / "dist"
    public = repo_dir / "public"
    if not dist.exists():
        print("Error: build falló, no se encontró carpeta dist/")
        sys.exit(1)

    print("\nCopiando archivos...")
    if install_root.exists():
        shutil.rmtree(install_root, ignore_errors=True)
    install_root.mkdir(parents=True, exist_ok=True)
    shutil.copytree(dist, install_root / "dist")
    shutil.copytree(public, install_root / "public")
    shutil.copy2(repo_dir / "package.json", install_root / "package.json")
    shutil.copy2(repo_dir / "server.mjs", install_root / "server.mjs")

    if os_type == "linux":
        start_src = repo_dir / "start.sh"
        start_dst = install_root / "start.sh"
        if start_src.exists():
            start_dst.write_text(start_src.read_text(encoding="utf-8"), encoding="utf-8")
            os.chmod(start_dst, 0o755)
        install_linux(install_root, repo_dir)
    else:
        start_dst = install_root / "start.bat"
        start_bat = f"""@echo off
setlocal enabledelayedexpansion
set OLLAMA_ORIGINS=*
cd /d "{install_root}"
set NODE={node_bin}
if exist "%~dp0\\node_portable\\node.exe" set NODE=%~dp0\\node_portable\\node.exe
for /d %%d in ("%~dp0\\node_portable\\*") do if exist "%%d\\node.exe" set NODE=%%d\\node.exe
if "%NODE%"=="node" (
  where node >nul 2>&1 || exit /b 1
)
where curl >nul 2>&1 && curl -s http://localhost:11434/api/tags >nul 2>&1
if !ERRORLEVEL! neq 0 powershell -NoP -C "try{{iwr -Uri 'http://localhost:11434/api/tags' -UseB -Time 2|Out-Null;exit 0}}catch{{exit 1}}" >nul 2>&1
if !ERRORLEVEL! neq 0 (
  if exist "{install_root}\\ollama_portable\\ollama.exe" start /b "" "{install_root}\\ollama_portable\\ollama.exe" serve
  if exist "ollama_portable\\ollama.exe" start /b "" "ollama_portable\\ollama.exe" serve
  timeout /t 5 /nobreak >nul
)
start /b "" "!NODE!" server.mjs
timeout /t 3 /nobreak >nul
start http://localhost:5173
"""
        start_dst.write_text(start_bat, encoding="utf-8")
        install_windows(install_root)

    print("\n" + "=" * 55)
    print("  Instalación completada")
    print("=" * 55)
    if os_type == "linux":
        print(f"  Ejecuta: {install_root / 'start.sh'}")
    else:
        print(f"  Ejecuta: {install_root / 'start.bat'}")
    print("  O desde el acceso directo creado en el Escritorio")
    print("=" * 55)


if __name__ == "__main__":
    main()
