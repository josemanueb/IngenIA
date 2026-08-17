#!/bin/bash
set -euo pipefail

INSTALL_DIR="$HOME/.local/share/ingenia"
DESKTOP_DIR="${XDG_DESKTOP_DIR:-$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
note()  { echo -e "     $1"; }

echo ""
echo "  ╔═══════════════════════════════════╗"
echo "  ║     Desinstalando IngenIA         ║"
echo "  ╚═══════════════════════════════════╝"
echo ""

# 1) Detener procesos de la aplicación
if pgrep -f "server.mjs" >/dev/null 2>&1; then
  pkill -f "server.mjs" 2>/dev/null || true
  sleep 1
  info "Servidor de IngenIA detenido"
else
  note "No había servidor de IngenIA corriendo"
fi

if pgrep -f "ollama serve" >/dev/null 2>&1; then
  pkill -f "ollama serve" 2>/dev/null || true
  info "Ollama detenido"
fi
pkill -f "ollama-proxy.py" 2>/dev/null || true

# 2) Servicios systemd de usuario de IngenIA
found_service=false
for unit in ingenia-ollama.service ingenia-ollama-proxy.service; do
  if [ -f "$HOME/.config/systemd/user/$unit" ] || systemctl --user list-unit-files --no-legend 2>/dev/null | grep -q "^$unit"; then
    systemctl --user stop "$unit" 2>/dev/null || true
    systemctl --user disable "$unit" 2>/dev/null || true
    rm -f "$HOME/.config/systemd/user/$unit"
    found_service=true
    info "Servicio systemd eliminado: $unit"
  fi
done
systemctl --user daemon-reload 2>/dev/null || true
if [ "$found_service" = false ]; then note "No había servicios systemd de IngenIA"; fi

# 3) Directorio de instalación
if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  info "Directorio de instalación eliminado ($INSTALL_DIR)"
else
  note "No se encontró $INSTALL_DIR"
fi

# 4) Accesos directos
if [ -f "$DESKTOP_DIR/IngenIA.desktop" ]; then
  rm -f "$DESKTOP_DIR/IngenIA.desktop"
  info "Acceso directo del Escritorio eliminado"
fi
if [ -f "$HOME/.local/share/applications/IngenIA.desktop" ]; then
  rm -f "$HOME/.local/share/applications/IngenIA.desktop"
  info "Acceso directo del menú de aplicaciones eliminado"
fi

# 5) Ollama a nivel de usuario instalado por IngenIA
cleaned=false
if [ -f "$HOME/.local/bin/ollama" ]; then
  rm -f "$HOME/.local/bin/ollama"
  info "Ollama de usuario eliminado (~/.local/bin/ollama)"
  cleaned=true
fi
if [ -d "$HOME/.local/lib/ollama" ]; then
  rm -rf "$HOME/.local/lib/ollama"
  info "Runtime de Ollama eliminado (~/.local/lib/ollama)"
  cleaned=true
fi
if [ -f "$HOME/.local/bin/ollama-proxy.py" ]; then
  rm -f "$HOME/.local/bin/ollama-proxy.py"
  info "Proxy de Ollama eliminado (~/.local/bin/ollama-proxy.py)"
  cleaned=true
fi
if [ "$cleaned" = false ]; then note "No había Ollama a nivel de usuario"; fi

# 6) Archivos temporales
rm -f /tmp/ingenia-vite.log /tmp/ingenia-server.log /tmp/node-portable.tar.xz /tmp/ollama.tar.zst 2>/dev/null || true
rm -rf /tmp/ingenia-node-portable /tmp/ingenia-ollama-portable 2>/dev/null || true
info "Archivos temporales eliminados"

# 7) Datos y modelos de Ollama (con confirmación)
if [ -d "$HOME/.ollama" ] || [ -d "$HOME/.config/ollama" ]; then
  echo ""
  warn "Se encontraron datos de Ollama:"
  [ -d "$HOME/.ollama" ] && note "Modelos y blobs: $HOME/.ollama ($(du -sh "$HOME/.ollama" 2>/dev/null | cut -f1))"
  [ -d "$HOME/.config/ollama" ] && note "Configuración: $HOME/.config/ollama"
  echo ""
  resp=""
  read -r -p "  ¿Eliminar también todos los datos y modelos de Ollama? [s/N]: " resp || resp=""
  case "${resp,,}" in
    s|y|si|yes)
      rm -rf "$HOME/.ollama" "$HOME/.config/ollama"
      info "Datos y modelos de Ollama eliminados"
      ;;
    *)
      note "Datos de Ollama conservados"
      ;;
  esac
fi

# 8) Ollama instalado a nivel de sistema (requiere sudo)
if [ -f /usr/local/bin/ollama ]; then
  echo ""
  warn "Se detectó ollama instalado a nivel de sistema:"
  note "/usr/local/bin/ollama"
  resp=""
  read -r -p "  ¿Eliminarlo también? (requiere sudo) [s/N]: " resp || resp=""
  case "${resp,,}" in
    s|y|si|yes)
      if sudo rm -f /usr/local/bin/ollama 2>/dev/null; then
        info "Ollama de sistema eliminado"
      else
        warn "No se pudo eliminar (se requiere sudo). Ejecutá: sudo rm /usr/local/bin/ollama"
      fi
      ;;
    *)
      note "Ollama de sistema conservado"
      ;;
  esac
fi

echo ""
echo "  ╔═══════════════════════════════════╗"
echo "  ║   Desinstalación completada ✓     ║"
echo "  ╚═══════════════════════════════════╝"
echo ""
note "Node.js y demás herramientas compartidas del sistema no se tocaron."
echo ""