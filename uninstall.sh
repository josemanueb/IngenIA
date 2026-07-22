#!/bin/bash

INSTALL_DIR="$HOME/.local/share/ingenia"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

echo ""
echo "  ╔═══════════════════════════════════╗"
echo "  ║     Desinstalando IngenIA         ║"
echo "  ╚═══════════════════════════════════╝"
echo ""

# Detener procesos
if pkill -f "node server.mjs" 2>/dev/null; then
  info "Servidor detenido"
else
  echo "  [!] No habia servidor corriendo"
fi

# Eliminar archivos
if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  info "Archivos eliminados de $INSTALL_DIR"
else
  echo "  [!] No se encontraron archivos en $INSTALL_DIR"
fi

# Eliminar accesos directos
if [ -f "$HOME/Desktop/IngenIA.desktop" ]; then
  rm -f "$HOME/Desktop/IngenIA.desktop"
  info "Acceso directo eliminado del Escritorio"
fi

if [ -f "$HOME/.local/share/applications/IngenIA.desktop" ]; then
  rm -f "$HOME/.local/share/applications/IngenIA.desktop"
  info "Acceso directo eliminado del menu de aplicaciones"
fi

rm -f /tmp/ingenia-vite.log 2>/dev/null

echo ""
echo "  ╔═══════════════════════════════════╗"
echo "  ║     Desinstalacion completada     ║"
echo "  ╚═══════════════════════════════════╝"
echo ""
echo "  Los modelos de Ollama no fueron eliminados."
echo "  Si deseas eliminarlos: ollama rm nombre_del_modelo"
echo ""
