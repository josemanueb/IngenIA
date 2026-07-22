# IngenIA

> Chat y comparador de modelos locales con Ollama

Interfaz web ligera para interactuar con modelos de lenguaje locales (`qwen2.5:7b`, `llama3.2`, `mistral:7b`, etc.) sin depender de la nube. Compatible con Linux y Windows.

---

## Características

- **Chat en tiempo real** con streaming de respuestas e indicador de escritura
- **Comparar modelos** lado a lado con el mismo prompt
- **Adjuntar archivos** de texto e imágenes (para modelos visión)
- **Entrada por voz** (Web Speech API, español) + TTS en ES/EN
- **Regenerar** respuesta de la IA
- **Exportar** conversación a Markdown (descarga / copiar)
- **Historial persistente** — los chats se guardan automáticamente en localStorage
- **Selector de modelos** en primer uso con 30+ modelos populares y descarga progreso
- **Parámetros** Temperature, Top K/P, Context Window, Repeat Penalty, Max Tokens
- **6 temas** oscuros: Medianoche, Océano, Bosque, Atardecer, Púrpura, Dracula
- **Búsqueda** de modelos instalados
- **Auto-update** via GitHub Releases (en app Electron)
- **Electron opcional** — `npm start` abre app nativa

---

## Instalación

### Requisitos

- [Ollama](https://ollama.com) instalado y corriendo (`ollama serve`)
- Opcional: [Node.js](https://nodejs.org) >= 18

### Método 1: Instalador universal (recomendado)

```bash
# Descarga el ZIP desde GitHub Releases o clona el repo
git clone https://github.com/josemanueb/IngenIA.git
cd IngenIA

# Linux
python3 install.py

# Windows
python install.py
```

El instalador descarga Node.js portable si no está en PATH, compila la app y crea accesos directos automáticamente.

### Método 2: Instaladores nativos

#### Linux

```bash
git clone https://github.com/josemanueb/IngenIA.git
cd IngenIA
chmod +x install.sh
./install.sh     # requiere Node.js >= 18 en PATH
```

#### Windows

```bat
git clone https://github.com/josemanueb/IngenIA.git
cd IngenIA
install.bat      # requiere Node.js >= 18 en PATH
```

### Método 3: Paquetes precompilados (próximamente)

Descarga desde [GitHub Releases](https://github.com/josemanueb/IngenIA/releases):

- **Linux x64**: `IngenIA-1.1.0.AppImage`
- **Windows x64**: `IngenIA Setup 1.1.0.exe`

### Método 4: Desarrollo

```bash
git clone https://github.com/josemanueb/IngenIA.git
cd IngenIA
npm install
npm run dev       # http://localhost:5173
```

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo Vite (hot reload) |
| `npm run build` | Build producción → `dist/` |
| `npm run serve` | Servidor Node.js producción (sirve `dist/` + proxy `/api` → Ollama) |
| `npm start` | App nativa con Electron |
| `npm run dist:linux` | Empaqueta AppImage/deb |
| `npm run dist:win` | Empaqueta .exe (NSIS) |
| `npm run dist:mac` | Empaqueta .dmg |

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
│   │   ├── SettingsModal.jsx   # Parámetros con sliders
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
├── install.py                   # Instalador universal (Python)
├── install.sh / install.bat     # Instaladores nativos
├── start.sh                     # Launcher Linux
├── server.mjs                   # Servidor Node.js producción
└── vite.config.js               # Proxy /api → Ollama (dev)
```

---

## Temas

- Medianoche, Océano, Bosque, Atardecer, Púrpura, Dracula

---

## Licencia

MIT
