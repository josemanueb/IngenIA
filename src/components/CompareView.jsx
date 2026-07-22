import { useState, useRef, useEffect } from 'react'
import { chatStream } from '../services/ollama'

export default function CompareView({ models, ollamaRunning, params }) {
  const [prompt, setPrompt] = useState('')
  const [selectedModels, setSelectedModels] = useState([])
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState({})
  const [showParams, setShowParams] = useState(false)
  const abortRefs = useRef({})
  const resultsEndRef = useRef(null)
  const resultsRef = useRef({})
  const unmountedRef = useRef(false)
  const runningRef = useRef({})

  useEffect(() => {
    return () => {
      unmountedRef.current = true
      Object.values(abortRefs.current).forEach(ctrl => ctrl.abort())
    }
  }, [])

  const toggleModel = (name) => {
    setSelectedModels(prev =>
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    )
  }

  useEffect(() => {
    resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [results])

  const handleCompare = async () => {
    if (!prompt.trim() || selectedModels.length === 0 || !ollamaRunning) return

    const initialResults = {}
    const initialLoading = {}
    selectedModels.forEach(m => {
      initialResults[m] = ''
      initialLoading[m] = true
    })
    setResults(initialResults)
    resultsRef.current = initialResults
    setLoading(initialLoading)

    const comparisons = selectedModels.map(async (model) => {
      try {
        abortRefs.current[model] = new AbortController()
        let fullContent = ''

        await chatStream(
          model,
          [{ role: 'user', content: prompt.trim() }],
          (chunk) => {
            fullContent += chunk
            const updated = { ...resultsRef.current, [model]: fullContent }
            resultsRef.current = updated
            setResults(updated)
          },
          abortRefs.current[model].signal,
          params
        )

        if (!unmountedRef.current) {
          setLoading(prev => ({ ...prev, [model]: false }))
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          const updated = { ...resultsRef.current, [model]: `Error: ${err.message}` }
          resultsRef.current = updated
          setResults(updated)
        }
        if (!unmountedRef.current) {
          setLoading(prev => ({ ...prev, [model]: false }))
        }
      }
    })

    await Promise.all(comparisons)
  }

  const handleStopAll = () => {
    Object.values(abortRefs.current).forEach(ctrl => ctrl.abort())
    setLoading({})
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCompare()
    }
  }

  const getModelType = (name) => {
    const codeModels = ['codellama', 'deepseek-coder', 'starcoder2']
    const visionModels = ['llava']
    if (codeModels.some(c => name.toLowerCase().includes(c))) return 'code'
    if (visionModels.some(v => name.toLowerCase().includes(v))) return 'vision'
    return 'general'
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'code': return '#10b981'
      case 'vision': return '#8b5cf6'
      default: return '#3b82f6'
    }
  }

  const anyLoading = Object.values(loading).some(v => v)
  const hasResults = Object.values(results).some(v => v && v.length > 0)

  const exportMarkdown = () => {
    const lines = [`# Comparación de Modelos`, '', `**Prompt:** ${prompt}`, `**Fecha:** ${new Date().toLocaleString('es')}`, '']
    Object.entries(results).forEach(([model, content]) => {
      if (content) {
        lines.push(`## ${model}`, '', content, '---', '')
      }
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comparacion-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyMarkdown = () => {
    const lines = [`# Comparación de Modelos`, '', `**Prompt:** ${prompt}`, '']
    Object.entries(results).forEach(([model, content]) => {
      if (content) {
        lines.push(`## ${model}`, '', content, '---', '')
      }
    })
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
  }

  return (
    <div className="compare-view">
      <div className="compare-header">
        <h2>⚡ Comparar Modelos</h2>
        <p className="compare-subtitle">Envía un prompt y compara respuestas lado a lado</p>
        <div className="header-actions">
          {hasResults && (
            <>
              <button className="header-btn" onClick={copyMarkdown} title="Copiar como Markdown">📋</button>
              <button className="header-btn" onClick={exportMarkdown} title="Descargar como Markdown">💾</button>
            </>
          )}
        </div>
      </div>

      <div className="compare-model-selector">
        <h3>Selecciona modelos para comparar:</h3>
        <div className="compare-model-chips">
          {models.map((model) => {
            const type = getModelType(model.name)
            return (
              <button
                key={model.name}
                className={`compare-chip ${selectedModels.includes(model.name) ? 'selected' : ''}`}
                onClick={() => toggleModel(model.name)}
                style={selectedModels.includes(model.name) ? { borderColor: getTypeColor(type) } : {}}
              >
                <span className="chip-dot" style={{ background: getTypeColor(type) }} />
                {model.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="compare-input-area">
        <textarea
          className="compare-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu prompt aquí... (ej: 'Explica qué es un closure en JavaScript')"
          disabled={!ollamaRunning}
          rows={2}
        />
        <div className="compare-actions">
          <button className="compare-params-btn" onClick={() => setShowParams(!showParams)}>
            ⚙️ Params
          </button>
          {anyLoading ? (
            <button className="compare-btn stop" onClick={handleStopAll}>⏹ Detener todo</button>
          ) : (
            <button
              className="compare-btn"
              onClick={handleCompare}
              disabled={!prompt.trim() || selectedModels.length === 0 || !ollamaRunning}
            >
              ⚡ Comparar ({selectedModels.length})
            </button>
          )}
        </div>
        {showParams && (
          <div className="params-bar">
            {params.temperature !== undefined && <span className="param-chip">temp: {params.temperature}</span>}
            {params.top_k !== undefined && <span className="param-chip">top_k: {params.top_k}</span>}
            {params.top_p !== undefined && <span className="param-chip">top_p: {params.top_p}</span>}
            {params.num_ctx !== undefined && <span className="param-chip">ctx: {params.num_ctx}</span>}
            {params.repeat_penalty !== undefined && <span className="param-chip">penalty: {params.repeat_penalty}</span>}
            {params.num_predict !== undefined && <span className="param-chip">predict: {params.num_predict}</span>}
          </div>
        )}
      </div>

      <div className="compare-results">
        {selectedModels.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">⚡</span>
            <h3>Selecciona al menos un modelo</h3>
            <p>Elige los modelos que quieres comparar y escribe un prompt</p>
          </div>
        )}
        {selectedModels.map((model) => {
          const type = getModelType(model)
          return (
            <div key={model} className="compare-column">
              <div className="compare-col-header">
                <span className="compare-col-badge" style={{ background: getTypeColor(type) }}>
                  {type === 'code' ? '{ }' : type === 'vision' ? '👁' : '💬'}
                </span>
                <span className="compare-col-name">{model}</span>
                {loading[model] && <span className="typing-indicator">escribiendo...</span>}
              </div>
              <div className="compare-col-body">
                {results[model] ? (
                  <p className="compare-response">{results[model]}</p>
                ) : (
                  <p className="compare-placeholder">Esperando respuesta...</p>
                )}
              </div>
            </div>
          )
        })}
        <div ref={resultsEndRef} />
      </div>
    </div>
  )
}
