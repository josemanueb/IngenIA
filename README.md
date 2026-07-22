# IngenIA

> Chat y comparador de modelos locales con Ollama

Interfaz web ligera para interactuar con modelos de lenguaje locales sin depender de la nube. Compatible con **Linux** y **Windows**.

---

## Características

- **Chat en tiempo real** con streaming de respuestas e indicador de escritura
- **Comparar modelos** lado a lado con el mismo prompt
- **Adjuntar archivos** de texto e imágenes (para modelos visión)
- **Entrada por voz** (Web Speech API) + TTS en ES/EN
- **Regenerar** respuesta de la IA
- **Exportar** conversación a Markdown (descarga / copiar)
- **Historial persistente** — los chats se guardan automáticamente en localStorage
- **Selector de modelos** en primer uso con 30+ modelos populares y descarga con progreso
- **Parámetros** Temperature, Top K/P, Context Window, Repeat Penalty, Max Tokens
- **Tamaño de letra ajustable** (10px–24px) desde configuración
- **6 temas** oscuros: Medianoche, Océano, Bosque, Atardecer, Púrpura, Dracula
- **Búsqueda** de modelos instalados
- **Auto-update** via GitHub Releases (en app Electron)
- **Electron opcional** — app nativa sin navegador

---

## Instalación

### Requisitos

- [Ollama](https://ollama.com) instalado y corriendo (`ollama serve`)
- Opcional: [Node.js](https://nodejs.org) >= 18 (el instalador lo descarga portable si no está)

### Método 1: Instalador universal (recomendado)

```bash
git clone https://github.com/josemanueb/IngenIA.git
cd IngenIA

# Linux
./install.sh

# Windows (doble clic o cmd)
install.bat
```

El instalador:
- Descarga **Node.js portable** si no está en PATH (incluye `xz-utils` si falta)
- Descarga **Ollama portable** si no está instalado (incluye `zstd` si falta)
- Instala dependencias **TTS** (`espeak-ng`, `speech-dispatcher`) en Linux
- Compila la app y la copia a `~/.local/share/ingenia` (Linux) o `%LOCALAPPDATA%\IngenIA` (Windows)
- Crea acceso directo en el escritorio (sin ventana de terminal visible)

### Método 2: Desarrollo

```bash
git clone https://github.com/josemanueb/IngenIA.git
cd IngenIA
npm install
npm run dev       # http://localhost:5173
```

### Método 3: Paquetes precompilados

Descarga desde [GitHub Releases](https://github.com/josemanueb/IngenIA/releases):

- **Linux x64**: `IngenIA-1.1.0.AppImage`
- **Windows x64**: `IngenIA Setup 1.1.0.exe`

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo Vite (hot reload) |
| `npm run build` | Build producción → `dist/` |
| `npm run serve` | Servidor Node.js producción (sirve `dist/` + proxy `/api`) |
| `npm start` | App nativa con Electron |
| `npm run electron:dev` | Electron + Vite (Linux/macOS) |
| `npm run electron:dev:win` | Electron + Vite (Windows cmd) |
| `npm run dist:linux` | Empaqueta AppImage/deb |
| `npm run dist:win` | Empaqueta .exe (NSIS) |
| `npm run dist:mac` | Empaqueta .dmg |

---

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | URL del servidor Ollama |
| `INGENIA_PORT` | `5173` | Puerto del servidor web |
| `INGENIA_PORT` (server.mjs) | `5173` | Puerto del servidor de producción |

---

## Parámetros

| Parámetro | Rango | Descripción |
|-----------|-------|-------------|
| Temperature | 0 – 2 | Creatividad (bajo = preciso, alto = creativo) |
| Top K | 1 – 100 | Limita tokens posibles por paso |
| Top P | 0 – 1 | Muestreo por núcleo |
| Context Window | 512 – 32768 | Tamaño del contexto en tokens |
| Repeat Penalty | 1 – 2 | Penaliza repeticiones |
| Max Tokens | -1 – 4096 | Tokens máximos a generar (-1 = sin límite) |

---

## Solución de problemas

### TTS no funciona
```bash
# Linux: instalar voces
sudo apt install espeak-ng speech-dispatcher-espeak-ng speech-dispatcher -y

# Verificar voces disponibles en el navegador:
# Abrir IngenIA → click en 🇪🇸 ES (header) → si aparece 🔇, no hay voces
```

### Error "unknown model architecture"
```bash
# Re-descargar el modelo con la versión actual de Ollama
ollama pull nombre-del-modelo
```

### El servidor no responde
```bash
# Ver el log del instalador
cat ~/.local/share/ingenia/ingenia.log
```

---

## Estructura

```
ingenia/
├── electron/                    # App nativa Electron
│   ├── main.js                 # Ventana + auto-updater
│   └── preload.js              # IPC segura
├── src/
│   ├── components/
│   │   ├── ChatView.jsx        # Chat con voz, adjuntos, TTS, historial
│   │   ├── CompareView.jsx     # Comparación lado a lado
│   │   ├── ModelSelector.jsx   # Selector inicial de modelos
│   │   ├── SettingsModal.jsx   # Parámetros + tamaño de letra
│   │   ├── Sidebar.jsx         # Modelos, historial, temas, estado
│   │   └── ThemeSelector.jsx   # 6 temas
│   ├── services/
│   │   ├── ollama.js           # API streaming, pull, delete
│   │   ├── history.js          # Chats en localStorage
│   │   ├── ollamaLibrary.js    # 30+ modelos populares
│   │   └── updater.js          # GitHub releases check
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
├── install.sh / install.bat     # Instaladores nativos
├── install.py                   # Instalador universal (Python)
├── start.sh                     # Launcher Linux (sin terminal)
├── server.mjs                   # Servidor Node.js producción
└── vite.config.js               # Proxy /api → Ollama (dev)
```

---

## Temas

Medianoche, Océano, Bosque, Atardecer, Púrpura, Dracula

---

## Licencia

MIT
