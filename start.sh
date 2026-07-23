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
