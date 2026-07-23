import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.INGENIA_PORT || 5173
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const isWin = process.platform === 'win32'

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

function getOllamaTarget() {
  const u = new URL(OLLAMA_URL)
  return { hostname: u.hostname, port: u.port || '11434' }
}

function proxyRequest(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const target = getOllamaTarget()
  const proxy = http.request({
    hostname: target.hostname,
    port: target.port,
    path: url.pathname + url.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${target.hostname}:${target.port}`,
    },
  }, (proxyRes) => {
    const headers = { ...proxyRes.headers }
    delete headers['content-encoding']
    delete headers['content-length']
    delete headers['transfer-encoding']
    res.writeHead(proxyRes.statusCode, headers)
    proxyRes.pipe(res)
  })

  proxy.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({ error: 'No se pudo conectar con Ollama. Asegurate de que ollama serve este corriendo.' }))
  })

  req.pipe(proxy)
}

function collectBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
  })
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function handleTts(req, res) {
  collectBody(req).then(body => {
    let text, lang
    try {
      const p = JSON.parse(body)
      text = p.text
      lang = p.lang || 'es'
    } catch {
      return sendJson(res, { ok: false, error: 'JSON invalido' }, 400)
    }
    if (!text) return sendJson(res, { ok: false, error: 'text requerido' }, 400)

    const langCode = lang.startsWith('en') ? 'en' : 'es'

    if (isWin) {
      sendJson(res, { ok: false, error: 'TTS del sistema no soportado en Windows, usa Chrome/Edge' })
      return
    }

    exec(`spd-say -l ${langCode} "${text.replace(/["\\]/g, '\\$&')}"`, (err) => {
      if (err) {
        exec(`espeak-ng -v ${langCode} "${text.replace(/["\\]/g, '\\$&')}" 2>/dev/null`, (err2) => {
          sendJson(res, { ok: !err2, error: err2 ? 'No hay spd-say ni espeak-ng' : null })
        })
      } else {
        sendJson(res, { ok: true })
      }
    })
  })
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.url === '/api/tts' && req.method === 'POST') {
      handleTts(req, res)
      return
    }

    proxyRequest(req, res)
    return
  }

  let filePath = path.join(__dirname, 'dist', req.url === '/' ? 'index.html' : req.url)

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(__dirname, 'dist', 'index.html'), (err2, data2) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' })
            res.end('Not found')
            return
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(data2)
        })
        return
      }
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Internal server error')
      return
    }
    const ext = path.extname(filePath)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(data)
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`IngenIA corriendo en http://localhost:${PORT}`)
  console.log(`Proxy Ollama -> ${OLLAMA_URL}`)
})
