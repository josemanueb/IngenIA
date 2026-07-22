#!/usr/bin/env python3
"""
Script para publicar un release de IngenIA en GitHub.
Requiere un token de GitHub con permisos de escritura en el repo.
Uso: python3 publish_release.py VERSION
"""

import sys
import urllib.request
import urllib.error
import json
import pathlib

REPO = "josemanueb/IngenIA"
PACKAGES = {
    "linux": pathlib.Path("/tmp/ingenia-linux-x64.tar.gz"),
    "windows": pathlib.Path("/tmp/ingenia-windows-x64.zip"),
}


def github_request(url, data=None, token=None):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "Ingenia-Release-Script"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data:
        headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers, method="POST")
    else:
        req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise RuntimeError(f"GitHub API error {e.code}: {body}")


def create_release(token, version, tag_name):
    url = f"https://api.github.com/repos/{REPO}/releases"
    payload = {
        "tag_name": tag_name,
        "name": f"IngenIA {version}",
        "body": "Instaladores y paquetes precompilados para Linux y Windows.",
        "draft": False,
        "prerelease": False,
    }
    return github_request(url, payload, token)


def upload_asset(token, release_id, file_path, label):
    url = f"https://api.github.com/repos/{REPO}/releases/{release_id}/assets?name={file_path.name}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/octet-stream",
    }
    with open(file_path, "rb") as f:
        data = f.read()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise RuntimeError(f"Upload error {e.code}: {body}")


def main():
    if len(sys.argv) < 2:
        print("Uso: python3 publish_release.py VERSION [TOKEN]")
        print("Ejemplo: python3 publish_release.py 1.0.2 ghp_...")
        sys.exit(1)

    version = sys.argv[1].lstrip("v")
    token = sys.argv[2] if len(sys.argv) > 2 else None
    if not token:
        token = input("Ingresa tu token de GitHub: ").strip()

    tag_name = f"v{version}"
    print(f"Creando release {tag_name} en {REPO}...")
    release = create_release(token, version, tag_name)
    release_id = release["id"]
    print(f"Release creado: {release['html_url']}")

    for os_name, path in PACKAGES.items():
        if not path.exists():
            print(f"[!] Paquete no encontrado: {path}")
            continue
        print(f"Subiendo {path.name} ({path.stat().st_size} bytes)...")
        asset = upload_asset(token, release_id, path, os_name)
        print(f"  -> {asset['browser_download_url']}")

    print("\nRelease publicado correctamente.")


if __name__ == "__main__":
    main()
