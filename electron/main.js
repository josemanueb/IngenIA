const { app, BrowserWindow, ipcMain, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs/promises')
const { pathToFileURL } = require('url')
const { autoUpdater } = require('electron-updater')

const isDev = !app.isPackaged
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const APP_SCHEME = 'app'

// Debe registrarse antes de que Electron este listo para que el esquema
// tenga privileges de origen estandar (necesario para que fetch() con rutas
// relativas como /api/tags funcione bajo este esquema).
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
])

let updateInterval = null
let ipcRegistered = false

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function getDistDir() {
  return path.join(__dirname, '..', 'dist')
}

// Sirve los archivos estaticos de dist/ bajo app://
async function serveStatic(requestUrl) {
  const distDir = getDistDir()
  const { pathname } = new URL(requestUrl)
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '')
  let filePath = path.resolve(distDir, relative === '' ? 'index.html' : relative)

  // Guardia anti path-traversal
  const resolvedDist = path.resolve(distDir)
  if (filePath !== resolvedDist && !filePath.startsWith(resolvedDist + path.sep)) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const data = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' },
    })
  } catch (err) {
    // SPA fallback: cualquier ruta desconocida devuelve index.html
    if (err.code === 'ENOENT' || err.code === 'EISDIR') {
      try {
        const html = await fs.readFile(path.join(distDir, 'index.html'))
        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': MIME['.html'] },
        })
      } catch {
        return new Response('Not found', { status: 404 })
      }
    }
    return new Response('Internal server error', { status: 500 })
  }
}

// Proxy app://.../api/* -> OLLAMA_URL/api/* preservando streaming
async function proxyToOllama(request) {
  const { pathname, search } = new URL(request.url)
  const target = `${OLLAMA_URL}${pathname}${search}`

  const method = request.method.toUpperCase()
  const headers = {}
  for (const [key, value] of request.headers.entries()) {
    // Host y Origin locales sobran; content-length lo recalcula undici.
    const lower = key.toLowerCase()
    if (lower === 'host' || lower === 'origin' || lower === 'content-length') continue
    headers[key] = value
  }

  // El cuerpo de la peticion siempre es JSON pequeno, asi que se puede
  // bufferizar. Lo que debe sobrevivir en streaming es la RESPUESTA
  // (p.ej. /api/chat y /api/pull), y eso se conserva con resp.body.
  let body
  if (method !== 'GET' && method !== 'HEAD') {
    body = Buffer.from(await request.arrayBuffer())
  }

  const upstream = await net.fetch(target, { method, headers, body })

  const outHeaders = {}
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    // undici ya decodifica content-encoding; reenviarlo romperia el stream
    if (lower === 'content-encoding' || lower === 'content-length' || lower === 'transfer-encoding') return
    outHeaders[key] = value
  })

  if (upstream.status === 502 || upstream.status === 503) {
    return new Response(
      JSON.stringify({ error: 'No se pudo conectar con Ollama. Asegurate de que "ollama serve" este corriendo.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(upstream.body, { status: upstream.status, headers: outHeaders })
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/tts') {
      return new Response(
        JSON.stringify({ ok: false, error: 'TTS del sistema no disponible en la app Electron' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    if (pathname.startsWith('/api/')) {
      try {
        return await proxyToOllama(request)
      } catch (err) {
        return new Response(
          JSON.stringify({ error: `Error de proxy hacia Ollama: ${err.message}` }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }
    return serveStatic(request.url)
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'IngenIA',
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    // app://app/index.html -> origen real, por lo que fetch('/api/...') resuelve
    //Relative al esquema y lo intercepta registerAppProtocol().
    win.loadURL(`${APP_SCHEME}://app/index.html`)
  }

  return win
}

function setupIpcHandlers() {
  // Guard contra listeners duplicados: setupAutoUpdater puede invocarse mas de
  // una vez (p.ej. en el evento activate de macOS) y cada llamada añadiria otro
  // listener por canal, disparando checkForUpdates() N veces.
  if (ipcRegistered) return
  ipcRegistered = true

  ipcMain.on('check-for-updates', () => autoUpdater.checkForUpdates())
  ipcMain.on('download-update', () => autoUpdater.downloadUpdate())
  ipcMain.on('install-update', () => autoUpdater.quitAndInstall())
}

function setupAutoUpdater(win) {
  setupIpcHandlers()

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'josemanueb',
    repo: 'IngenIA',
  })

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // autoUpdater es un singleton: sus listeners tambien se acumulan, asi que se
  // limpian antes de volver a registrarlos.
  autoUpdater.removeAllListeners('update-available')
  autoUpdater.removeAllListeners('update-not-available')
  autoUpdater.removeAllListeners('download-progress')
  autoUpdater.removeAllListeners('update-downloaded')
  autoUpdater.removeAllListeners('error')

  const send = (channel, payload) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }

  autoUpdater.on('update-available', (info) => {
    send('update-available', { version: info.version, releaseDate: info.releaseDate })
  })
  autoUpdater.on('update-not-available', () => send('update-not-available'))
  autoUpdater.on('download-progress', (progress) => {
    send('update-download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
    })
  })
  autoUpdater.on('update-downloaded', () => send('update-downloaded'))
  autoUpdater.on('error', (err) => send('update-error', err.message))

  if (updateInterval) clearInterval(updateInterval)
  updateInterval = setInterval(() => {
    autoUpdater.checkForUpdates()
  }, 3600000)

  autoUpdater.checkForUpdates()
}

app.whenReady().then(() => {
  if (!isDev) {
    registerAppProtocol()
    setupIpcHandlers()
  }
  const win = createWindow()
  if (!isDev) {
    setupAutoUpdater(win)
  }
})

app.on('window-all-closed', () => {
  if (updateInterval) clearInterval(updateInterval)
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const win = createWindow()
    if (!isDev) setupAutoUpdater(win)
  }
})
