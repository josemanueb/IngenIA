const STORAGE_KEY = 'ingenia-chats'
const INDEX_KEY = 'ingenia-chat-index'

export function getChatIndex() {
  try {
    const data = localStorage.getItem(INDEX_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveChatIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

export function loadConversation(modelName, conversationId) {
  try {
    const data = localStorage.getItem(`${STORAGE_KEY}-${conversationId}`)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export function saveConversation(modelName, messages, conversationId) {
  if (!messages || messages.length === 0) return null

  const index = getChatIndex()
  let id = conversationId
  let entry = index.find(e => e.id === id)

  if (!id || !entry) {
    id = `${modelName}-${Date.now()}`
    const preview = messages.find(m => m.role === 'user')?.content?.slice(0, 80) || 'Chat vacío'
    entry = { id, model: modelName, preview, timestamp: Date.now() }
    index.unshift(entry)
  } else {
    const preview = messages.find(m => m.role === 'user')?.content?.slice(0, 80) || 'Chat vacío'
    entry.preview = preview
    entry.timestamp = Date.now()
  }

  const maxEntries = 50
  const trimmed = index.slice(0, maxEntries)
  saveChatIndex(trimmed)

  try {
    localStorage.setItem(`${STORAGE_KEY}-${id}`, JSON.stringify(messages))
  } catch {
    const old = trimmed.pop()
    if (old) localStorage.removeItem(`${STORAGE_KEY}-${old.id}`)
    try {
      localStorage.setItem(`${STORAGE_KEY}-${id}`, JSON.stringify(messages))
    } catch {}
    saveChatIndex(trimmed)
  }

  return id
}

export function deleteConversation(conversationId) {
  const index = getChatIndex().filter(e => e.id !== conversationId)
  saveChatIndex(index)
  localStorage.removeItem(`${STORAGE_KEY}-${conversationId}`)
}

export function getConversationsForModel(modelName) {
  return getChatIndex().filter(e => e.model === modelName)
}

export function getRecentConversations(limit = 10) {
  return getChatIndex().slice(0, limit)
}
