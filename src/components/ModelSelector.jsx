import { useState, useEffect } from 'react'
import { pullModel, listModels } from '../services/ollama'
import { getStaticModels, fetchLibraryModels } from '../services/ollamaLibrary'
import { playNotificationSound } from '../services/sound'

const getTypeColor = (type) => {
  switch (type) {
    case 'code': return '#10b981'
    case 'vision': return '#8b5cf6'
    default: return '#3b82f6'
  }
}

const getTypeIcon = (type) => {
  switch (type) {
    case 'code': return '{ }'
    case 'vision': return '👁'
    default: return '💬'
  }
}

export default function ModelSelector({ onComplete }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [availableModels, setAvailableModels] = useState(getStaticModels())
  const [selected, setSelected] = useState([])
  const [downloading, setDownloading] = useState(null)
  const [progress, setProgress] = useState({})
  const [error, setError] = useState(null)
  const [completed, setCompleted] = useState([])
  const [loadingLib, setLoadingLib] = useState(false)
  const [libError, setLibError] = useState(null)

  useEffect(() => {
    const filtered = getStaticModels().filter(m =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.desc.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setAvailableModels(filtered)
  }, [searchTerm])

  useEffect(() => {
    const checkInstalled = async () => {
      try {
        const installed = await listModels()
        const names = new Set(installed.map(m => m.name))
        setCompleted(prev => [...new Set([...prev, ...getStaticModels().filter(m => names.has(m.name)).map(m => m.name)])])
      } catch {}
    }
    checkInstalled()
  }, [])

  const handleFetchMore = async () => {
    setLoadingLib(true)
    setLibError(null)
    try {
      const models = await fetchLibraryModels(searchTerm)
      if (models && models.length > 0) {
        const existingNames = new Set(getStaticModels().map(m => m.name))
        const newModels = models.filter(m => !existingNames.has(m.name))
        if (newModels.length > 0) {
          const all = [...getStaticModels(), ...newModels]
          setAvailableModels(all)
        } else {
          setLibError('No se encontraron modelos nuevos')
        }
      } else {
        setLibError('No se pudieron cargar modelos adicionales')
      }
    } catch {
      setLibError('Error al conectar con la librería')
    }
    setLoadingLib(false)
  }

  const toggleModel = (name) => {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    )
  }

  const startDownload = async () => {
    if (selected.length === 0) return

    let allOk = true
    for (const modelName of selected) {
      if (completed.includes(modelName)) continue
      setDownloading(modelName)
      setError(null)

      try {
        await pullModel(modelName, (info) => {
          if (info.total) {
            const pct = Math.round((info.completed / info.total) * 100)
            setProgress(prev => ({ ...prev, [modelName]: pct }))
          } else if (info.status === 'success') {
            setProgress(prev => ({ ...prev, [modelName]: 100 }))
          }
        })
        setCompleted(prev => [...prev, modelName])
        playNotificationSound()
      } catch (err) {
        allOk = false
        setError(`Error descargando ${modelName}: ${err.message}`)
      }
    }

    setDownloading(null)
    if (allOk) onComplete()
  }

  return (
    <div className="model-selector-overlay">
      <div className="model-selector">
        <div className="model-selector-header">
          <img src="/logo.png" alt="IngenIA" className="model-selector-logo" />
          <h1>Bienvenido a IngenIA</h1>
          <p>Selecciona los modelos que quieres instalar. Puedes agregar más después con <code>ollama pull nombre</code></p>
        </div>

        <div className="model-selector-search">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Buscar modelos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="model-selector-grid">
          {availableModels.map(model => {
            const isSelected = selected.includes(model.name)
            const isDownloading = downloading === model.name
            const isCompleted = completed.includes(model.name)
            const pct = progress[model.name] || 0
            const isQueued = isSelected && !!downloading && !isCompleted && !isDownloading

            return (
              <button
                key={model.name}
                className={`model-selector-card ${isSelected ? 'selected' : ''} ${isCompleted ? 'completed' : ''} ${isDownloading ? 'downloading' : ''} ${isQueued ? 'queued' : ''}`}
                onClick={() => !downloading && !isCompleted && toggleModel(model.name)}
                disabled={!!downloading || isCompleted}
              >
                <div className="model-card-header">
                  <span className="model-card-badge" style={{ background: getTypeColor(model.type) }}>
                    {getTypeIcon(model.type)}
                  </span>
                  {model.recommended && <span className="model-card-rec">Recomendado</span>}
                  {isCompleted && <span className="model-card-done">✓</span>}
                </div>
                <div className="model-card-name">{model.name}</div>
                <div className="model-card-desc">{model.desc}</div>
                <div className="model-card-size">{model.size}</div>
                {isDownloading && (
                  <div className="model-card-progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="progress-text">{pct}%</span>
                  </div>
                )}
                {isQueued && (
                  <div className="model-card-progress queued">
                    <span className="progress-text">En cola...</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {availableModels.length === 0 && (
          <p className="no-models">No se encontraron modelos con ese nombre</p>
        )}

        <div className="model-selector-lib-actions">
          <button
            className="model-selector-lib-btn"
            onClick={handleFetchMore}
            disabled={loadingLib}
          >
            {loadingLib ? 'Cargando...' : '🌐 Buscar más modelos en Ollama Library'}
          </button>
          {libError && <p className="model-selector-lib-error">{libError}</p>}
        </div>

        {error && <div className="model-selector-error">{error}</div>}

        <div className="model-selector-footer">
          <button className="model-selector-skip" onClick={onComplete} disabled={!!downloading}>
            Omitir por ahora
          </button>
          <button
            className="model-selector-install"
            onClick={startDownload}
            disabled={selected.length === 0 || !!downloading || completed.length === selected.length}
          >
            {downloading
              ? `Descargando ${downloading}...`
              : completed.length === selected.length && selected.length > 0
                ? '¡Listo!'
                : `Instalar ${selected.length} modelo${selected.length !== 1 ? 's' : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  )
}
