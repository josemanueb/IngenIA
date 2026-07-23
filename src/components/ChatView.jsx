import { useState, useRef, useEffect, useCallback } from 'react'
import { chatStream } from '../services/ollama'
import { saveConversation, loadConversation, getConversationsForModel } from '../services/history'

export default function ChatView({ model, ollamaRunning, params, conversationId, onConversationChange }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showParams, setShowParams] = useState(false)
  const [recording, setRecording] = useState(false)
  const [ttsLang, setTtsLang] = useState('es-ES')
  const [speaking, setSpeaking] = useState(null)
  const [ttsVoices, setTtsVoices] = useState([])
  const [ttsError, setTtsError] = useState(null)
  const [ttsMode, setTtsMode] = useState('auto')
  const [localConvId, setLocalConvId] = useState(null)

  const messagesEndRef = useRef(null)
  const abortRef = useRef(null)
  const messagesRef = useRef([])
  const recognitionRef = useRef(null)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const currentAssistantIndexRef = useRef(-1)
  const saveTimerRef = useRef(null)

  const syncMessages = useCallback((msgs) => {
    messagesRef.current = msgs
    setMessages(msgs)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (model) {
      if (conversationId) {
        const msgs = loadConversation(model, conversationId)
        if (msgs && msgs.length > 0) {
          syncMessages(msgs)
          setLocalConvId(conversationId)
          currentAssistantIndexRef.current = -1
          return
        }
      }
      const convs = getConversationsForModel(model)
      if (convs.length > 0) {
        const last = convs[0]
        const msgs = loadConversation(model, last.id)
        if (msgs && msgs.length > 0) {
          syncMessages(msgs)
          setLocalConvId(last.id)
          if (onConversationChange) onConversationChange(last.id)
          return
        }
      }
    }
    syncMessages([])
    setLocalConvId(null)
    if (onConversationChange) onConversationChange(null)
    currentAssistantIndexRef.current = -1
  }, [model, conversationId])

  useEffect(() => {
    if (messages.length > 0 && !loading) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        const id = saveConversation(model, messagesRef.current, localConvId)
        if (id) {
          setLocalConvId(id)
          if (onConversationChange) onConversationChange(id)
        }
      }, 800)
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [messages, loading, model])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort()
      if (abortRef.current) abortRef.current.abort()
      window.speechSynthesis?.cancel()
    }
  }, [])

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setTtsError('Tu navegador no soporta síntesis de voz')
      return
    }
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices()
      if (v.length > 0) {
        setTtsVoices(v)
        setTtsError(null)
      }
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    // Force periodic retry on Linux (speech-dispatcher may start late)
    const retryInterval = setInterval(() => {
      const v = window.speechSynthesis.getVoices()
      if (v.length > 0 && ttsVoices.length === 0) {
        setTtsVoices(v)
        setTtsError(null)
      }
    }, 3000)
    return () => clearInterval(retryInterval)
  }, [ttsVoices.length])

  const handleNewChat = () => {
    if (messages.length > 0) {
      saveConversation(model, messagesRef.current, localConvId)
    }
    syncMessages([])
    setLocalConvId(null)
    if (onConversationChange) onConversationChange(null)
  }

  const doSend = async (msgs) => {
    setLoading(true)
    let completed = false
    try {
      abortRef.current = new AbortController()
      let fullContent = ''

      const assistantIndex = msgs.length
      currentAssistantIndexRef.current = assistantIndex
      const updated = [...msgs, { role: 'assistant', content: '' }]
      syncMessages(updated)

      await chatStream(
        model,
        msgs.map(m => ({ role: m.role, content: m.content, images: m.images })),
        (chunk) => {
          fullContent += chunk
          const current = messagesRef.current
          if (current.length > assistantIndex && current[assistantIndex].role === 'assistant') {
            const next = [...current]
            next[assistantIndex] = { role: 'assistant', content: fullContent }
            syncMessages(next)
          }
        },
        abortRef.current.signal,
        params
      )

      const final = messagesRef.current
      if (final.length > assistantIndex && final[assistantIndex].role === 'assistant') {
        const next = [...final]
        next[assistantIndex] = { role: 'assistant', content: fullContent }
        syncMessages(next)
      }
      completed = true
    } catch (err) {
      if (err.name !== 'AbortError') {
        const errorMsg = `Error: ${err.message}`
        const current = messagesRef.current
        if (current.length > 0 && current[current.length - 1].role === 'assistant' && current[current.length - 1].content === '') {
          const next = [...current]
          next[next.length - 1] = { role: 'assistant', content: errorMsg }
          syncMessages(next)
        } else {
          syncMessages([...current, { role: 'assistant', content: errorMsg }])
        }
      } else {
        if (messagesRef.current.length > 0) {
          const current = messagesRef.current
          const last = current[current.length - 1]
          if (last.role === 'assistant' && last.content === '') {
            const next = current.slice(0, -1)
            syncMessages(next)
          }
        }
      }
    } finally {
      setLoading(false)
      currentAssistantIndexRef.current = -1
    }
  }

  const handleSend = async () => {
    if (!input.trim() || !model || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const newMessages = [...messagesRef.current, userMsg]
    syncMessages(newMessages)
    setInput('')
    await doSend(newMessages)
  }

  const handleRegenerate = async () => {
    if (loading || !model || messagesRef.current.length === 0) return
    let lastUserIdx = -1
    for (let i = messagesRef.current.length - 1; i >= 0; i--) {
      if (messagesRef.current[i].role === 'user') {
        lastUserIdx = i
        break
      }
    }
    if (lastUserIdx === -1) return
    const trimmed = messagesRef.current.slice(0, lastUserIdx + 1)
    syncMessages(trimmed)
    await doSend(trimmed)
  }

  const handleFileAttach = () => fileInputRef.current?.click()
  const handleImageAttach = () => imageInputRef.current?.click()

  const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !model || loading) return
    e.target.value = ''

    const ext = file.name.split('.').pop().toLowerCase()
    const textExts = ['txt','md','js','jsx','ts','tsx','py','java','c','cpp','h','css','html','json','yaml','yml','toml','xml','sql','sh','rb','go','rs','php','swift','kt','r','lua','pl','vue','svelte','astro','mdx','log','csv','env','gitignore','dockerfile','makefile']
    const isText = textExts.includes(ext) || file.type.startsWith('text/')

    if (isText) {
      const text = await file.text()
      const userMsg = {
        role: 'user',
        content: `[Archivo: ${file.name}]\n\`\`\`\n${text}\n\`\`\``,
      }
      const newMessages = [...messagesRef.current, userMsg]
      syncMessages(newMessages)
      setInput('')
      await doSend(newMessages)
    } else {
      const base64 = await readFileAsBase64(file)
      const userMsg = {
        role: 'user',
        content: `[Archivo adjunto: ${file.name}]`,
        images: [base64],
      }
      const newMessages = [...messagesRef.current, userMsg]
      syncMessages(newMessages)
      setInput('')
      await doSend(newMessages)
    }
  }

  const handleImageSelected = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !model || loading) return
    e.target.value = ''

    const base64 = await readFileAsBase64(file)
    const userMsg = {
      role: 'user',
      content: input.trim() || 'Describe esta imagen',
      images: [base64],
    }
    const newMessages = [...messagesRef.current, userMsg]
    syncMessages(newMessages)
    setInput('')
    await doSend(newMessages)
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleMic = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'es-ES'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInput(transcript)
    }
    recognition.onerror = () => setRecording(false)
    recognition.onend = () => setRecording(false)
    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

  const speakViaServer = async (text, lang) => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang }),
      })
      const data = await res.json()
      if (!data.ok) {
        setTtsError(data.error || 'Error en TTS del servidor')
        setSpeaking(null)
        return false
      }
      // spd-say is async, give it a moment then check if audio played
      setTtsMode('srv')
      return true
    } catch {
      setTtsError('No se pudo conectar al servidor TTS')
      setSpeaking(null)
      return false
    }
  }

  const speakText = (text, index) => {
    if (!('speechSynthesis' in window)) {
      setTtsError('Tu navegador no soporta síntesis de voz')
      return
    }

    if (speaking === index) {
      window.speechSynthesis.cancel()
      setSpeaking(null)
      return
    }

    window.speechSynthesis.cancel()

    let voices = ttsVoices
    if (voices.length === 0) {
      voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) setTtsVoices(voices)
    }

    const langPrefix = ttsLang.split('-')[0]
    const available = voices.filter(v => v.lang.startsWith(langPrefix))

    // Use Web Speech API if voices available
    if (voices.length > 0 && available.length > 0) {
      setTtsMode('web')
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = ttsLang
      utterance.rate = 1

      const femaleVoice = available.find(v =>
        v.name.toLowerCase().includes('femenina') ||
        v.name.toLowerCase().includes('female') ||
        v.name.toLowerCase().includes('paulina') ||
        v.name.toLowerCase().includes('helena') ||
        v.name.toLowerCase().includes('monica') ||
        (v.name.toLowerCase().includes('google') && v.name.toLowerCase().includes('female')) ||
        v.name.includes('♀') ||
        v.name.includes('Female')
      )

      if (femaleVoice) utterance.voice = femaleVoice
      else utterance.voice = available[0]

      utterance.onend = () => setSpeaking(null)
      utterance.onerror = () => setSpeaking(null)
      setSpeaking(index)
      setTtsError(null)
      window.speechSynthesis.speak(utterance)
      return
    }

    // Fallback to server TTS via spd-say/espeak
    speakViaServer(text, ttsLang).then(ok => {
      if (ok) setSpeaking(index)
    })
  }

  const exportMarkdown = () => {
    const lines = [`# Chat con ${model}`, '', `*Exportado el ${new Date().toLocaleString('es')}*`, '']
    messagesRef.current.forEach(msg => {
      const name = msg.role === 'user' ? 'Tú' : model
      lines.push(`## ${name}`, '', msg.content, '')
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-${model}-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyMarkdown = () => {
    const lines = [`# Chat con ${model}`, '']
    messagesRef.current.forEach(msg => {
      const name = msg.role === 'user' ? 'Tú' : model
      lines.push(`## ${name}`, '', msg.content, '')
    })
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
  }

  return (
    <div className="chat-view">
      <div className="chat-header">
        <h2>{model || 'Selecciona un modelo'}</h2>
        {model && <span className="chat-model-tag">Chat</span>}
        <div className="header-left-actions">
          {model && messages.length > 0 && (
            <button className="header-badge new-chat-btn" onClick={handleNewChat} title="Nuevo chat">
              ✦ Nuevo
            </button>
          )}
          <button className="header-badge" onClick={() => setShowParams(!showParams)}>
            ⚙️ Params
          </button>
        </div>
        <div className="header-actions">
          <button
            className={`tts-lang-btn ${ttsLang === 'es-ES' ? 'active' : ''}`}
            onClick={() => setTtsLang(ttsLang === 'es-ES' ? 'en-US' : 'es-ES')}
            title={ttsLang === 'es-ES' ? 'Cambiar a inglés' : 'Cambiar a español'}
          >
            {ttsLang === 'es-ES' ? '🇪🇸 ES' : '🇺🇸 EN'}
          </button>
          {ttsMode === 'srv' && <span className="tts-mode" title="Usando TTS del sistema (spd-say)">🖥️</span>}
          {ttsError && <span className="tts-error" title={ttsError}>🔇</span>}
          {messages.length > 0 && (
            <>
              <button className="header-btn" onClick={copyMarkdown} title="Copiar como Markdown">📋</button>
              <button className="header-btn" onClick={exportMarkdown} title="Descargar como Markdown">💾</button>
            </>
          )}
        </div>
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

      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <img src="/logo.png" alt="IngenIA" className="empty-logo" />
            <h3>IngenIA</h3>
            <p>Escribe un mensaje para empezar a chatear con <strong>{model}</strong></p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              ) : (
                <img src="/logo.png" alt="AI" className="avatar-img" />
              )}
            </div>
            <div className="message-body">
              <div className="message-content">
                <div className="message-role">{msg.role === 'user' ? 'Tú' : model}</div>
                {loading && i === messages.length - 1 && msg.role === 'assistant' && msg.content === '' ? (
                  <div className="message-text typing">
                    <span className="dot" /><span className="dot" /><span className="dot" />
                  </div>
                ) : (
                  <div className="message-text">{msg.content}</div>
                )}
                {msg.images && msg.images.length > 0 && (
                  <div className="message-images">
                    {msg.images.map((img, j) => (
                      <img key={j} src={`data:image/png;base64,${img}`} alt="Adjunto" className="message-attachment-img" />
                    ))}
                  </div>
                )}
              </div>

              {!loading && msg.content && (
                <div className="message-actions">
                  {msg.role === 'assistant' && (
                    <button
                      className={`msg-action-btn ${speaking === i ? 'speaking' : ''}`}
                      onClick={() => speakText(msg.content, i)}
                      title={speaking === i ? 'Detener lectura' : 'Leer en voz alta'}
                    >
                      {speaking === i ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="6" y="4" width="4" height="16"/>
                          <rect x="14" y="4" width="4" height="16"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                        </svg>
                      )}
                    </button>
                  )}
                  {msg.role === 'user' && (
                    <>
                      <button className="msg-action-btn" onClick={handleFileAttach} title="Adjuntar archivo">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                      </button>
                      <button className="msg-action-btn" onClick={handleImageAttach} title="Adjuntar imagen">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                          <circle cx="9" cy="9" r="2"/>
                          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                        </svg>
                      </button>
                    </>
                  )}
                  {msg.role === 'assistant' && i === messages.length - 1 && (
                    <button className="msg-action-btn" onClick={handleRegenerate} title="Regenerar respuesta">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                        <path d="M3 3v5h5"/>
                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                        <path d="M16 16h5v5"/>
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <button className="input-icon-btn" onClick={handleFileAttach} title="Adjuntar archivo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        <button className="input-icon-btn" onClick={handleImageAttach} title="Adjuntar imagen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
        </button>
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={model ? `Escribe un mensaje para ${model}...` : 'Selecciona un modelo primero'}
          disabled={!model || !ollamaRunning}
          rows={1}
        />
        <button className={`mic-btn ${recording ? 'recording' : ''}`} onClick={toggleMic} title={recording ? 'Detener grabación' : 'Hablar'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" x2="12" y1="19" y2="22"/>
          </svg>
        </button>
        {loading ? (
          <button className="send-btn stop" onClick={handleStop}>⏹</button>
        ) : (
          <button className="send-btn" onClick={handleSend} disabled={!input.trim() || !model || !ollamaRunning}>➤</button>
        )}
      </div>

      <input ref={fileInputRef} type="file" hidden onChange={handleFileSelected} />
      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleImageSelected} />
    </div>
  )
}
