function withTimeout(signal, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  if (signal) {
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      controller.abort()
    })
  }
  return controller.signal
}

export async function checkOllamaStatus() {
  try {
    const res = await fetch('/api/tags', { signal: withTimeout(null, 3000) })
    return res.ok
  } catch {
    return false
  }
}

export async function listModels() {
  const res = await fetch('/api/tags', { signal: withTimeout(null, 5000) })
  if (!res.ok) throw new Error('No se pudo conectar a Ollama')
  const data = await res.json()
  return data.models || []
}

export async function getModelInfo(modelName) {
  const res = await fetch('/api/show', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName }),
    signal: withTimeout(null, 5000),
  })
  if (!res.ok) throw new Error('No se pudo obtener info del modelo')
  return res.json()
}

export async function getRunningModels() {
  try {
    const res = await fetch('/api/ps', { signal: withTimeout(null, 3000) })
    if (!res.ok) return []
    const data = await res.json()
    return data.models || []
  } catch {
    return []
  }
}

export async function preloadModel(modelName) {
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, prompt: '' }),
      signal: withTimeout(null, 120000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function pullModel(modelName, onProgress) {
  const res = await fetch('/api/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName, stream: true }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Error al descargar modelo')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()

    for (const line of lines) {
      if (line.trim()) {
        try {
          const json = JSON.parse(line)
          if (onProgress) onProgress(json)
        } catch {}
      }
    }
  }

  if (buffer.trim()) {
    try {
      const json = JSON.parse(buffer)
      if (onProgress) onProgress(json)
    } catch {}
  }
}

export async function deleteModel(modelName) {
  const res = await fetch('/api/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName }),
  })
  return res.ok
}

function formatOllamaError(raw) {
  if (raw.includes('unknown model architecture') || raw.includes('mllama')) {
    return `El modelo no es compatible con esta versión de Ollama. Actualizá Ollama o re-descargá el modelo:\n  ollama pull ${raw.match(/model: '?(\S+)'?/)?.[1] || 'el modelo'}`
  }
  if (raw.includes('not found')) {
    return `Modelo no encontrado. Descargalo primero:\n  ollama pull ${raw.match(/"([^"]+)"/)?.[1] || 'nombre-del-modelo'}`
  }
  return raw
}

export async function chatStream(model, messages, onChunk, signal, options = {}) {
  const body = { model, messages, stream: true }

  const opts = {}
  if (options.temperature !== undefined) opts.temperature = Number(options.temperature)
  if (options.top_k !== undefined) opts.top_k = Number(options.top_k)
  if (options.top_p !== undefined) opts.top_p = Number(options.top_p)
  if (options.num_ctx !== undefined) opts.num_ctx = Number(options.num_ctx)
  if (options.repeat_penalty !== undefined) opts.repeat_penalty = Number(options.repeat_penalty)
  if (options.num_predict !== undefined) opts.num_predict = Number(options.num_predict)
  if (Object.keys(opts).length > 0) body.options = opts

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(formatOllamaError(err.error || 'Error en la respuesta de Ollama'))
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()

    for (const line of lines) {
      if (line.trim()) {
        try {
          const json = JSON.parse(line)
          if (json.message) {
            onChunk(json.message.content)
          }
        } catch {}
      }
    }
  }

  if (buffer.trim()) {
    try {
      const json = JSON.parse(buffer)
      if (json.message) {
        onChunk(json.message.content)
      }
    } catch {}
  }
}
