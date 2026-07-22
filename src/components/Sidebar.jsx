import { useState, useEffect } from 'react'
import { getRecentConversations, loadConversation } from '../services/history'

export default function Sidebar({
  models,
  ollamaRunning,
  view,
  onViewChange,
  selectedModel,
  onModelSelect,
  searchQuery,
  onSearchChange,
  currentTheme,
  onThemeChange,
  themes,
  loadingModels,
  readyModels,
  updateInfo,
  historyTrigger,
  onSelectHistory,
  onDeleteHistory,
}) {
  const [recentConvs, setRecentConvs] = useState([])

  useEffect(() => {
    setRecentConvs(getRecentConversations(20))
  }, [historyTrigger, models])

  const deleteConv = (e, convId) => {
    e.stopPropagation()
    onDeleteHistory(convId)
    setRecentConvs(getRecentConversations(20))
  }
  const [showThemes, setShowThemes] = useState(false)

  const getModelType = (name) => {
    const codeModels = ['codellama', 'deepseek-coder', 'starcoder2', 'codegemma']
    const visionModels = ['llava', 'bakllava']
    if (codeModels.some(c => name.toLowerCase().includes(c))) return 'code'
    if (visionModels.some(v => name.toLowerCase().includes(v))) return 'vision'
    return 'general'
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'code': return '{ }'
      case 'vision': return '👁'
      default: return '💬'
    }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'code': return '#10b981'
      case 'vision': return '#8b5cf6'
      default: return '#3b82f6'
    }
  }

  const formatSize = (model) => {
    if (model.size) {
      const gb = (model.size / (1024 * 1024 * 1024)).toFixed(1)
      return `${gb} GB`
    }
    return ''
  }

  const filteredModels = models.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getModelStatus = (name) => {
    if (loadingModels[name]) return 'loading'
    if (readyModels[name]) return 'ready'
    return 'idle'
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="logo">
          <img src="/logo.png" alt="IngenIA" className="logo-img" />
          IngenIA
        </h1>
        {updateInfo && (
          <a
            href={updateInfo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="update-badge"
            title={`Nueva versión: ${updateInfo.latest}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            {updateInfo.latest}
          </a>
        )}
        <div className={`status ${ollamaRunning ? 'online' : 'offline'}`}>
          <span className="status-dot" />
          {ollamaRunning ? 'Conectado' : 'Desconectado'}
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-btn ${view === 'chat' ? 'active' : ''}`}
          onClick={() => onViewChange('chat')}
        >
          💬 Chat
        </button>
        <button
          className={`nav-btn ${view === 'compare' ? 'active' : ''}`}
          onClick={() => onViewChange('compare')}
        >
          ⚡ Comparar
        </button>
        <button
          className={`nav-btn ${view === 'settings' ? 'active' : ''}`}
          onClick={() => onViewChange('settings')}
        >
          ⚙️
        </button>
      </nav>

      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="🔍 Buscar modelos..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button className="search-clear" onClick={() => onSearchChange('')}>✕</button>
        )}
      </div>

      <div className="model-list">
        <h3 className="model-list-title">
          Modelos ({filteredModels.length}{filteredModels.length !== models.length ? ` de ${models.length}` : ''})
        </h3>
        {filteredModels.map((model) => {
          const type = getModelType(model.name)
          const status = getModelStatus(model.name)
          return (
            <button
              key={model.name}
              className={`model-item ${selectedModel === model.name ? 'selected' : ''}`}
              onClick={() => onModelSelect(model.name)}
            >
              <span
                className={`model-type-badge ${status === 'loading' ? 'loading' : ''} ${status === 'ready' ? 'ready' : ''}`}
                style={status !== 'loading' ? { background: getTypeColor(type) } : {}}
              >
                {status === 'loading' ? (
                  <span className="spinner" />
                ) : (
                  getTypeIcon(type)
                )}
              </span>
              <div className="model-info">
                <span className="model-name">{model.name}</span>
                <span className="model-meta">{formatSize(model)}</span>
              </div>
              {status === 'ready' && <span className="model-status-dot ready" />}
              {status === 'loading' && <span className="model-status-text">Cargando...</span>}
            </button>
          )
        })}
        {filteredModels.length === 0 && models.length > 0 && (
          <p className="no-models">No se encontraron modelos</p>
        )}
        {models.length === 0 && ollamaRunning && (
          <p className="no-models">No hay modelos instalados</p>
        )}
        {!ollamaRunning && (
          <p className="no-models">
            Inicia Ollama con:<br />
            <code>ollama serve</code>
          </p>
        )}
      </div>

      {recentConvs.length > 0 && (
        <div className="sidebar-history">
          <h3 className="model-list-title">Historial ({recentConvs.length})</h3>
          <div className="history-list">
            {recentConvs.map(conv => (
              <button
                key={conv.id}
                className="history-item"
                onClick={() => onSelectHistory(conv.id, conv.model)}
              >
                <div className="history-info">
                  <span className="history-model">{conv.model}</span>
                  <span className="history-preview">{conv.preview}</span>
                </div>
                <button
                  className="history-delete"
                  onClick={(e) => deleteConv(e, conv.id)}
                  title="Eliminar"
                >
                  ✕
                </button>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sidebar-footer">
        <button
          className="theme-toggle"
          onClick={() => setShowThemes(!showThemes)}
        >
          🎨 Tema
        </button>
        {showThemes && themes && (
          <div className="theme-popup">
            {Object.entries(themes).map(([key, theme]) => (
              <button
                key={key}
                className={`theme-option ${currentTheme === key ? 'active' : ''}`}
                onClick={() => { onThemeChange(key); setShowThemes(false) }}
              >
                <div className="theme-preview">
                  <span className="theme-dot" style={{ background: theme.bgPrimary, border: `1px solid ${theme.border}` }} />
                  <span className="theme-dot" style={{ background: theme.accent }} />
                </div>
                {theme.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
