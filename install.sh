#!/bin/bash
set -euo pipefail

INSTALL_DIR="$HOME/.local/share/ingenia"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_MIN="18"
NODE_VERSION="20.18.1"
PORTABLE_DIR="/tmp/ingenia-node-portable"
OLLAMA_PORTABLE_DIR="/tmp/ingenia-ollama-portable"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

detect_http_cmd() {
  if command -v curl &>/dev/null; then echo "curl"
  elif command -v wget &>/dev/null; then echo "wget"
  else echo ""; fi
}

http_download() {
  local url="$1" dest="$2"
  local cmd=$(detect_http_cmd)
  if [ "$cmd" = "curl" ]; then curl -# -L "$url" -o "$dest"
  elif [ "$cmd" = "wget" ]; then wget --show-progress -q -O "$dest" "$url"; fi
}

ensure_node() {
  if command -v node &>/dev/null; then
    local ver=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$ver" -ge "$NODE_MIN" ]; then
      info "Node.js $(node -v) detectado en PATH"
      return
    fi
    warn "Node.js $(node -v) es muy antiguo. Usaremos portable."
  else
    warn "Node.js no encontrado en PATH. Descargando portable..."
  fi

  mkdir -p "$PORTABLE_DIR"
  local node_bin_path="$PORTABLE_DIR/bin/node"

  if [ ! -f "$node_bin_path" ]; then
    local url="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz"
    local archive="/tmp/node-portable.tar.xz"
    echo "  Descargando Node.js ${NODE_VERSION}..."
    http_download "$url" "$archive"

    # Ensure xz-utils is available for extraction
    if ! command -v xz &>/dev/null; then
      echo "  xz-utils no encontrado. Instalando..."
      if command -v apt &>/dev/null; then
        sudo apt install -y xz-utils 2>/dev/null || true
      fi
    fi

    echo "  Extrayendo..."
    if ! tar -xJf "$archive" -C "$PORTABLE_DIR" --strip-components=1 2>/dev/null; then
      echo "  Error con xz, instalando xz-utils e intentando de nuevo..."
      sudo apt install -y xz-utils 2>/dev/null || true
      tar -xJf "$archive" -C "$PORTABLE_DIR" --strip-components=1
    fi
    rm -f "$archive"
  fi

  if [ ! -f "$node_bin_path" ]; then
    # Fallback: try downloading via apt
    warn "No se pudo extraer Node.js portable. Instalando via apt..."
    sudo apt install -y nodejs npm 2>/dev/null || error "No se pudo instalar Node.js. Instalalo manualmente desde https://nodejs.org"
    return
  fi

  chmod +x "$node_bin_path"
  export PATH="$PORTABLE_DIR/bin:$PATH"
  info "Node.js $(node -v) portable listo"
}

ensure_ollama() {
  if command -v ollama &>/dev/null; then
    info "Ollama $(ollama -v 2>/dev/null || echo 'detectado') en PATH"
    return
  fi

  warn "Ollama no encontrado en PATH. Descargando portable..."
  mkdir -p "$OLLAMA_PORTABLE_DIR"
  local ollama_bin="$OLLAMA_PORTABLE_DIR/ollama"

  if [ ! -f "$ollama_bin" ] || ! head -c 4 "$ollama_bin" 2>/dev/null | grep -q $'\x7f\x45\x4c\x46'; then
    rm -f "$ollama_bin"
    local success=0

    # Get the latest version tag
    local latest_tag=""
    set +e
    latest_tag=$(curl -s "https://api.github.com/repos/ollama/ollama/releases/latest" 2>/dev/null | grep '"tag_name"' | cut -d'"' -f4)
    set -e
    [ -z "$latest_tag" ] && latest_tag="v0.32.1"

    local zst_url="https://github.com/ollama/ollama/releases/download/${latest_tag}/ollama-linux-amd64.tar.zst"
    local zst_archive="/tmp/ollama.tar.zst"

    echo "  Descargando Ollama ${latest_tag}..."
    echo "  URL: $zst_url"
    set +e
    if [ "$HTTP_CMD" = "curl" ]; then
      curl -# -L -o "$zst_archive" "$zst_url" 2>&1
    else
      wget --show-progress -q -O "$zst_archive" "$zst_url"
    fi
    set -e

    if [ -f "$zst_archive" ]; then
      local zst_magic=$(head -c 4 "$zst_archive" | od -A n -t x1 | tr -d ' \n')
      if [ "$zst_magic" = "28b52ffd" ]; then
        echo "  Extrayendo..."
        mkdir -p "$OLLAMA_PORTABLE_DIR"

        # Ensure zstd is available
        if ! command -v zstd &>/dev/null; then
          echo "  zstd no encontrado. Instalando..."
          if command -v apt &>/dev/null; then
            sudo apt install -y zstd 2>/dev/null || true
          fi
        fi

        if command -v zstd &>/dev/null; then
          tar -I zstd -xf "$zst_archive" -C "$OLLAMA_PORTABLE_DIR" 2>/dev/null
        fi

        # If extraction failed or zstd not available, try using the binary directly
        if [ ! -f "$OLLAMA_PORTABLE_DIR/ollama" ] && [ ! -f "$OLLAMA_PORTABLE_DIR/bin/ollama" ]; then
          echo "  Extrayendo sin zstd (usando solo tar)..."
          zstd -d "$zst_archive" -o /tmp/ollama.tar 2>/dev/null && tar -xf /tmp/ollama.tar -C "$OLLAMA_PORTABLE_DIR" 2>/dev/null
          rm -f /tmp/ollama.tar 2>/dev/null || true
        fi
        rm -f "$zst_archive"

        # Find the ollama binary inside the extracted files
        local found=$(find "$OLLAMA_PORTABLE_DIR" -name "ollama" -type f 2>/dev/null | head -1)
        if [ -n "$found" ]; then
          mv "$found" "$ollama_bin" 2>/dev/null
          rm -rf "$OLLAMA_PORTABLE_DIR" 2>/dev/null
          mkdir -p "$OLLAMA_PORTABLE_DIR"
          mv "$ollama_bin" "$OLLAMA_PORTABLE_DIR/" 2>/dev/null
          ollama_bin="$OLLAMA_PORTABLE_DIR/ollama"
          if head -c 4 "$ollama_bin" | grep -q $'\x7f\x45\x4c\x46'; then
            success=1
          fi
        fi
      fi
    fi

    if [ "$success" -eq 0 ]; then
      echo ""
      echo "  Intentando instalacion via script oficial (requiere sudo)..."
      echo ""
      set +e
      if [ "$HTTP_CMD" = "curl" ]; then
        curl -fsSL https://ollama.com/install.sh | sh 2>&1
      fi
      if command -v ollama &>/dev/null; then
        success=1
      fi
      set -e
    fi

    if [ "$success" -eq 0 ]; then
      rm -f "$zst_archive" 2>/dev/null || true
      echo ""
      echo "  ─────────────────────────────────────────────"
      echo "  No se pudo instalar Ollama automaticamente."
      echo "  Instalalo manualmente desde:"
      echo "  https://ollama.com/download"
      echo ""
      echo "  Luego vuelve a ejecutar este instalador."
      echo "  ─────────────────────────────────────────────"
      error "Instalacion de Ollama fallida"
    fi
  fi

  chmod +x "$ollama_bin"
  export PATH="$OLLAMA_PORTABLE_DIR:$PATH"
  local ver=$(ollama -v 2>&1 || true)
  info "Ollama portable listo ($ver)"
}

echo ""
echo "  ╔═══════════════════════════════════╗"
echo "  ║      Instalador de IngenIA        ║"
echo "  ╚═══════════════════════════════════╝"
echo ""

HTTP_CMD=$(detect_http_cmd)
if [ -z "$HTTP_CMD" ]; then
  error "Se necesita curl o wget"
fi
info "Utilidad HTTP: $HTTP_CMD"

ensure_node

if ! command -v npm &>/dev/null; then
  error "npm no encontrado (portable defectuoso)"
fi
info "npm $(npm -v) detectado"

ensure_ollama

ensure_tts() {
  if [ "$(uname)" != "Linux" ]; then
    return
  fi
  if command -v espeak-ng &>/dev/null && command -v speech-dispatcher &>/dev/null; then
    info "TTS: espeak-ng + speech-dispatcher detectados"
  else
    warn "Instalando dependencias de voz (TTS)..."
    if command -v apt &>/dev/null; then
      sudo apt install -y espeak-ng speech-dispatcher-espeak-ng speech-dispatcher 2>/dev/null || true
    fi
  fi
  if command -v speech-dispatcher &>/dev/null; then
    speech-dispatcher --spawn 2>/dev/null || true
  fi
}
ensure_tts

echo ""
echo "Instalando dependencias..."
cd "$APP_DIR"
npm install
info "Dependencias instaladas"

echo ""
echo "Compilando..."
npm run build
info "Build completado"

mkdir -p "$INSTALL_DIR"

cp -r "$APP_DIR/dist" "$INSTALL_DIR/"
cp -r "$APP_DIR/public" "$INSTALL_DIR/"
cp "$APP_DIR/package.json" "$INSTALL_DIR/"
cp "$APP_DIR/server.mjs" "$INSTALL_DIR/"

if [ -d "$PORTABLE_DIR" ] && [ -f "$PORTABLE_DIR/bin/node" ]; then
  mkdir -p "$INSTALL_DIR/node_portable"
  cp -r "$PORTABLE_DIR"/* "$INSTALL_DIR/node_portable/"
  info "Node.js portable copiado a la instalacion"
elif [ -d "$PORTABLE_DIR" ]; then
  # If the structure is different, find node and copy manually
  local node_bin=$(find "$PORTABLE_DIR" -name "node" -type f 2>/dev/null | head -1)
  if [ -n "$node_bin" ]; then
    mkdir -p "$INSTALL_DIR/node_portable/bin"
    cp "$node_bin" "$INSTALL_DIR/node_portable/bin/"
    local node_dir=$(dirname "$node_bin")
    # Copy npm too if in same dir
    if [ -f "$node_dir/npm" ]; then
      cp "$node_dir/npm" "$INSTALL_DIR/node_portable/bin/"
      cp -r "$node_dir/../lib" "$INSTALL_DIR/node_portable/" 2>/dev/null || true
    fi
    info "Node.js portable copiado a la instalacion"
  fi
fi

if [ -d "$OLLAMA_PORTABLE_DIR" ] && [ -f "$OLLAMA_PORTABLE_DIR/ollama" ]; then
  mkdir -p "$INSTALL_DIR/ollama_portable"
  cp "$OLLAMA_PORTABLE_DIR/ollama" "$INSTALL_DIR/ollama_portable/"
  info "Ollama portable copiado a la instalacion"
fi

cat > "$INSTALL_DIR/start.sh" << 'STARTSCRIPT'
#!/bin/bash
LOG="$HOME/.local/share/ingenia/ingenia.log"

exec > "$LOG" 2>&1

export OLLAMA_ORIGINS="*"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

if [ -f "$APP_DIR/node_portable/bin/node" ]; then
  NODE="$APP_DIR/node_portable/bin/node"
  export PATH="$APP_DIR/node_portable/bin:$PATH"
elif command -v node &>/dev/null; then
  NODE="node"
else
  echo "Node.js no encontrado" >&2
  exit 1
fi

if [ -f "$APP_DIR/ollama_portable/ollama" ]; then
  export PATH="$APP_DIR/ollama_portable:$PATH"
fi

OLAMA_PID=""
SPEECH_PID=""

# Start speech-dispatcher for TTS (Chrome requires it running)
if command -v speech-dispatcher &>/dev/null; then
  speech-dispatcher --spawn 2>/dev/null || true
fi

check_ollama() {
  curl -sf --max-time 2 http://localhost:11434/api/tags >/dev/null 2>&1
}

wait_for_url() {
  local url="$1" timeout="$2"
  for i in $(seq 1 "$timeout"); do
    curl -sf --max-time 2 "$url" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

if ! check_ollama; then
  if command -v ollama &>/dev/null; then
    ollama serve &
    OLAMA_PID=$!
    waited=0
    while [ $waited -lt 120 ]; do
      if check_ollama; then break; fi
      sleep 2
      waited=$((waited + 2))
    done
    if ! check_ollama; then
      echo "Ollama no respondio tras 120s" >&2
      exit 1
    fi
  fi
fi

"$NODE" server.mjs &
SERVER_PID=$!

wait_for_url "http://localhost:5173" 30 || true

xdg-open http://localhost:5173 2>/dev/null || true

cleanup() {
  kill $SERVER_PID 2>/dev/null || true
  [ -n "$OLAMA_PID" ] && kill "$OLAMA_PID" 2>/dev/null || true
}
trap cleanup EXIT

wait $SERVER_PID
STARTSCRIPT
chmod +x "$INSTALL_DIR/start.sh"
info "Script de inicio creado"

DESKTOP_DIR="${XDG_DESKTOP_DIR:-$HOME/Desktop}"
mkdir -p "$DESKTOP_DIR"
DESKTOP_FILE="$DESKTOP_DIR/IngenIA.desktop"
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Type=Application
Name=IngenIA
Comment=Chat y compara modelos de Ollama
Exec=$INSTALL_DIR/start.sh
Icon=$INSTALL_DIR/public/icon.png
Terminal=false
Categories=Development;AI;
StartupNotify=true
EOF
chmod +x "$DESKTOP_FILE"
info "Acceso directo creado en el Escritorio"

MENU_FILE="$HOME/.local/share/applications/IngenIA.desktop"
mkdir -p "$HOME/.local/share/applications"
cp "$DESKTOP_FILE" "$MENU_FILE"
info "Acceso directo creado en el menu de aplicaciones"

cat > "$INSTALL_DIR/uninstall.sh" << 'UNINSTALL'
#!/bin/bash
set -euo pipefail
INSTALL_DIR="$HOME/.local/share/ingenia"

echo ""
echo "  ╔═══════════════════════════════════╗"
echo "  ║     Desinstalando IngenIA         ║"
echo "  ╚═══════════════════════════════════╝"
echo ""

if pgrep -f "node server.mjs" >/dev/null 2>&1; then
  pkill -f "node server.mjs" 2>/dev/null || true
  echo "  [✓] Servidor detenido"
fi

if pgrep -f "ollama serve" >/dev/null 2>&1; then
  pkill -f "ollama serve" 2>/dev/null || true
  echo "  [✓] Ollama detenido"
fi

if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  echo "  [✓] Archivos eliminados"
else
  echo "  [!] No se encontraron archivos en $INSTALL_DIR"
fi

if [ -f "$HOME/Desktop/IngenIA.desktop" ]; then
  rm -f "$HOME/Desktop/IngenIA.desktop"
  echo "  [✓] Acceso directo del Escritorio eliminado"
fi

if [ -f "$HOME/.local/share/applications/IngenIA.desktop" ]; then
  rm -f "$HOME/.local/share/applications/IngenIA.desktop"
  echo "  [✓] Acceso directo del menu eliminado"
fi

rm -f /tmp/ingenia-vite.log 2>/dev/null || true

echo ""
echo "  Desinstalacion completada."
echo "  Los modelos de Ollama no fueron eliminados."
echo "  Si deseas eliminarlos: ollama rm nombre_del_modelo"
echo ""
UNINSTALL
chmod +x "$INSTALL_DIR/uninstall.sh"
info "Script de desinstalacion creado"

echo ""
echo "  ╔═══════════════════════════════════╗"
echo "  ║     Instalacion completada ✓      ║"
echo "  ╚═══════════════════════════════════╝"
echo ""
echo "  Para iniciar:"
echo "    $INSTALL_DIR/start.sh"
echo "    O desde el acceso directo en el Escritorio"
echo ""
echo "  Para desinstalar:"
echo "    $INSTALL_DIR/uninstall.sh"
echo ""
