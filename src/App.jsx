import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import CompareView from './components/CompareView'
import SettingsModal from './components/SettingsModal'
import ModelSelector from './components/ModelSelector'
import { THEMES } from './components/ThemeSelector'
import { listModels, checkOllamaStatus, getRunningModels, preloadModel } from './services/ollama'
import { checkForUpdates } from './services/updater'
import { getRecentConversations, loadConversation, deleteConversation, getConversationsForModel } from './services/history'

const DEFAULT_PARAMS = {
  temperature: 0.8,
  top_k: 40,
  top_p: 0.9,
  num_ctx: 2048,
  repeat_penalty: 1.1,
  num_predict: -1,
}

function applyTheme(themeKey) {
  const theme = THEMES[themeKey]
  if (!theme) return
  const r = document.documentElement
  r.style.setProperty('--bg-primary', theme.bgPrimary)
  r.style.setProperty('--bg-secondary', theme.bgSecondary)
  r.style.setProperty('--bg-tertiary', theme.bgTertiary)
  r.style.setProperty('--bg-hover', theme.bgHover)
  r.style.setProperty('--bg-active', theme.bgActive)
  r.style.setProperty('--text-primary', theme.textPrimary)
  r.style.setProperty('--text-secondary', theme.textSecondary)
  r.style.setProperty('--text-muted', theme.textMuted)
  r.style.setProperty('--border', theme.border)
  r.style.setProperty('--accent', theme.accent)
  r.style.setProperty('--accent-hover', theme.accentHover)
}

export default function App() {
  const [models, setModels] = useState([])
  const [ollamaRunning, setOllamaRunning] = useState(false)
  const [view, setView] = useState('chat')
  const [selectedModel, setSelectedModel] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentTheme, setCurrentTheme] = useState('midnight')
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loadingModels, setLoadingModels] = useState({})
  const [readyModels, setReadyModels] = useState({})
  const [initialLoad, setInitialLoad] = useState(true)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [updateInfo, setUpdateInfo] = useState(null)
  const [conversationId, setConversationId] = useState(null)
  const [historyTrigger, setHistoryTrigger] = useState(0)

  const loadModels = useCallback(async () => {
    const running = await checkOllamaStatus()
    setOllamaRunning(running)
    if (running) {
      const [m, runningModels] = await Promise.all([listModels(), getRunningModels()])
      setModels(m)
      const ready = {}
      runningModels.forEach(rm => { ready[rm.name] = true })
      setReadyModels(ready)
      if (m.length > 0) {
        setSelectedModel(prev => {
          if (!prev) return m[0].name
          if (m.some(model => model.name === prev)) return prev
          return m[0].name
        })
      }
    } else {
      setModels([])
    }
    setInitialLoad(false)
  }, [])

  useEffect(() => {
    loadModels()
    const interval = setInterval(loadModels, 15000)
    return () => clearInterval(interval)
  }, [loadModels])

  useEffect(() => {
    applyTheme(currentTheme)
    localStorage.setItem('ollama-theme', currentTheme)
  }, [currentTheme])

  useEffect(() => {
    const savedTheme = localStorage.getItem('ollama-theme')
    if (savedTheme && THEMES[savedTheme]) {
      setCurrentTheme(savedTheme)
    }
    const savedParams = localStorage.getItem('ollama-params')
    if (savedParams) {
      try { setParams(JSON.parse(savedParams)) } catch {}
    }

    const hasVisited = localStorage.getItem('ingenia-visited')
    if (!hasVisited) {
      setShowModelSelector(true)
    }

    const checkUpdate = async () => {
      const update = await checkForUpdates()
      if (update) {
        setUpdateInfo(update)
      }
    }
    checkUpdate()
  }, [])

  const handleModelSelectComplete = () => {
    localStorage.setItem('ingenia-visited', 'true')
    setShowModelSelector(false)
    loadModels()
  }

  const handleModelSelect = async (modelName) => {
    setSelectedModel(modelName)
    setView('chat')
    if (!readyModels[modelName]) {
      setLoadingModels(prev => ({ ...prev, [modelName]: true }))
      const ok = await preloadModel(modelName)
      if (ok) {
        setReadyModels(prev => ({ ...prev, [modelName]: true }))
      }
      setLoadingModels(prev => ({ ...prev, [modelName]: false }))
    }
  }

  const handleParamsChange = (newParams) => {
    setParams(newParams)
    localStorage.setItem('ollama-params', JSON.stringify(newParams))
  }

  const handleViewChange = (v) => {
    if (v === 'settings') {
      setSettingsOpen(true)
    } else {
      setSettingsOpen(false)
      setView(v)
    }
  }

  if (showModelSelector) {
    return <ModelSelector onComplete={handleModelSelectComplete} />
  }

  return (
    <div className="app">
      <Sidebar
        models={models}
        ollamaRunning={ollamaRunning}
        view={view}
        onViewChange={handleViewChange}
        selectedModel={selectedModel}
        onModelSelect={handleModelSelect}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        currentTheme={currentTheme}
        onThemeChange={setCurrentTheme}
        themes={THEMES}
        loadingModels={loadingModels}
        readyModels={readyModels}
        updateInfo={updateInfo}
        historyTrigger={historyTrigger}
        onSelectHistory={(convId, modelName) => {
          setConversationId(convId)
          if (modelName) handleModelSelect(modelName)
          setView('chat')
        }}
        onDeleteHistory={(convId) => {
          deleteConversation(convId)
          setHistoryTrigger(t => t + 1)
        }}
      />
      <main className="main-content">
        {view === 'chat' ? (
          <ChatView
            model={selectedModel}
            ollamaRunning={ollamaRunning}
            params={params}
            conversationId={conversationId}
            onConversationChange={setConversationId}
          />
        ) : view === 'compare' ? (
          <CompareView models={models} ollamaRunning={ollamaRunning} params={params} />
        ) : null}
      </main>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => { setSettingsOpen(false); setView('chat') }}
        params={params}
        onParamsChange={handleParamsChange}
      />
    </div>
  )
}
