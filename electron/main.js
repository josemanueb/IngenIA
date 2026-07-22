const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

const isDev = !app.isPackaged

let updateInterval = null

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
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  return win
}

function setupAutoUpdater(win) {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'josemanueb',
    repo: 'IngenIA',
  })

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
    })
  })

  autoUpdater.on('update-not-available', () => {
    win.webContents.send('update-not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    win.webContents.send('update-download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('update-downloaded')
  })

  autoUpdater.on('error', (err) => {
    win.webContents.send('update-error', err.message)
  })

  ipcMain.on('check-for-updates', () => {
    autoUpdater.checkForUpdates()
  })

  ipcMain.on('download-update', () => {
    autoUpdater.downloadUpdate()
  })

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  if (updateInterval) clearInterval(updateInterval)
  updateInterval = setInterval(() => {
    autoUpdater.checkForUpdates()
  }, 3600000)

  autoUpdater.checkForUpdates()
}

app.whenReady().then(() => {
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
