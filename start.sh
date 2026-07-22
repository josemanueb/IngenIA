#!/bin/bash
set -euo pipefail
export OLLAMA_ORIGINS="*"

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

if [ -f "$APP_DIR/node_portable/bin/node" ]; then
  NODE="$APP_DIR/node_portable/bin/node"
  export PATH="$APP_DIR/node_portable/bin:$PATH"
elif command -v node &>/dev/null; then
  NODE="node"
else
  echo "[!] Node.js no encontrado. Instalalo desde https://nodejs.org"
  exit 1
fi

if [ -f "$APP_DIR/ollama_portable/ollama" ]; then
  export PATH="$APP_DIR/ollama_portable:$PATH"
fi

check_ollama() {
  if command -v curl &>/dev/null; then
    curl -sf --max-time 2 http://localhost:11434/api/tags >/dev/null 2>&1
  elif command -v wget &>/dev/null; then
    wget -q --timeout=2 --spider http://localhost:11434/api/tags >/dev/null 2>&1
  else
    return 1
  fi
}

wait_for_url() {
  local url="$1" timeout="$2" waited=0
  while [ $waited -lt $timeout ]; do
    if command -v curl &>/dev/null; then
      curl -sf --max-time 2 "$url" >/dev/null 2>&1 && return 0
    elif command -v wget &>/dev/null; then
      wget -q --timeout=2 --spider "$url" >/dev/null 2>&1 && return 0
    fi
    sleep 2
    waited=$((waited + 2))
  done
  return 1
}

OLAMA_PID=""
if ! check_ollama; then
  if command -v ollama &>/dev/null; then
    echo "Iniciando Ollama..."
    ollama serve &
    OLAMA_PID=$!
    echo "Esperando a Ollama (hasta 120s)..."
    waited=0
    while [ $waited -lt 120 ]; do
      if check_ollama; then
        echo "Ollama listo (${waited}s)"
        break
      fi
      sleep 2
      waited=$((waited + 2))
      echo "  ...${waited}s"
    done
    if ! check_ollama; then
      echo "[!] Ollama no respondio tras 120s"
      echo "    Revisa ejecutando manualmente: ollama serve"
      exit 1
    fi
  else
    echo "Ollama no encontrado. Instalalo desde: https://ollama.com"
    exit 1
  fi
fi

echo "Iniciando IngenIA..."
"$NODE" server.mjs &
SERVER_PID=$!

echo "Esperando al servidor (hasta 30s)..."
wait_for_url "http://localhost:5173" 30 || {
  echo "[!] El servidor no respondio, revisa la consola"
}

if command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:5173 2>/dev/null || true
fi

echo ""
echo "IngenIA disponible en: http://localhost:5173"
echo "Ctrl+C para detener"
echo ""

cleanup() {
  kill $SERVER_PID 2>/dev/null || true
  [ -n "$OLAMA_PID" ] && kill "$OLAMA_PID" 2>/dev/null || true
}
trap cleanup EXIT

wait $SERVER_PID
