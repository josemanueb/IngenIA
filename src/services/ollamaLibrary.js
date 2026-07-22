const STATIC_MODELS = [
  { name: 'llama3.2', desc: 'Modelo general rápido y capaz', size: '~2 GB', type: 'general', recommended: true },
  { name: 'llama3.2:1b', desc: 'Modelo ligero para equipos con poca RAM', size: '~1.3 GB', type: 'general' },
  { name: 'llama3.2-vision', desc: 'Modelo multimodal con visión', size: '~2.7 GB', type: 'vision' },
  { name: 'llama3.1:8b', desc: 'Modelo general versátil', size: '~4.7 GB', type: 'general' },
  { name: 'codellama:7b', desc: 'Especializado en código', size: '~3.8 GB', type: 'code' },
  { name: 'codellama:13b', desc: 'Código con mayor capacidad', size: '~7.3 GB', type: 'code' },
  { name: 'deepseek-coder:6.7b', desc: 'Excelente para programación', size: '~3.9 GB', type: 'code' },
  { name: 'deepseek-coder:33b', desc: 'Código con razonamiento profundo', size: '~19 GB', type: 'code' },
  { name: 'deepseek-r1:8b', desc: 'Razonamiento y código', size: '~4.9 GB', type: 'code' },
  { name: 'mistral:7b', desc: 'Modelo general de alta calidad', size: '~4.1 GB', type: 'general' },
  { name: 'mixtral:8x7b', desc: 'Modelo masivo de alta calidad', size: '~26 GB', type: 'general' },
  { name: 'gemma2:2b', desc: 'Modelo ligero de Google', size: '~1.6 GB', type: 'general' },
  { name: 'gemma2:9b', desc: 'Modelo equilibrado de Google', size: '~5.5 GB', type: 'general' },
  { name: 'phi3:mini', desc: 'Modelo compacto de Microsoft', size: '~2.2 GB', type: 'general' },
  { name: 'phi3:medium', desc: 'Microsoft con mayor capacidad', size: '~6.6 GB', type: 'general' },
  { name: 'llava:7b', desc: 'Modelo con visión (imágenes)', size: '~4.7 GB', type: 'vision' },
  { name: 'llava:13b', desc: 'Visión con más capacidad', size: '~8.1 GB', type: 'vision' },
  { name: 'bakllava', desc: 'Modelo vision avanzado', size: '~5.2 GB', type: 'vision' },
  { name: 'starcoder2:7b', desc: 'Código y más código', size: '~4.1 GB', type: 'code' },
  { name: 'starcoder2:15b', desc: 'Código pesado', size: '~9.1 GB', type: 'code' },
  { name: 'qwen2.5:7b', desc: 'Modelo general equilibrado', size: '~4.7 GB', type: 'general' },
  { name: 'qwen2.5:14b', desc: 'Mayor capacidad general', size: '~9.1 GB', type: 'general' },
  { name: 'qwen2.5:32b', desc: 'Modelo general masivo', size: '~19 GB', type: 'general' },
  { name: 'nomic-embed-text', desc: 'Embeddings de texto', size: '~274 MB', type: 'general' },
  { name: 'mxbai-embed-large', desc: 'Embeddings grandes', size: '~669 MB', type: 'general' },
  { name: 'llama3.2:3b', desc: 'Ligero y rápido', size: '~2 GB', type: 'general' },
  { name: 'command-r', desc: 'Modelo conversacional de Cohere', size: '~16 GB', type: 'general' },
  { name: 'command-r-plus', desc: 'Cohere con máxima capacidad', size: '~35 GB', type: 'general' },
  { name: 'dolphin-mixtral:8x7b', desc: 'Modelo desbloqueado', size: '~26 GB', type: 'general' },
  { name: 'tinyllama', desc: 'Ultra ligero', size: '~637 MB', type: 'general' },
]

const LIBRARY_API_URL = 'https://ollama.com/api/library'

export function getStaticModels() {
  return STATIC_MODELS
}

export async function fetchLibraryModels(searchTerm = '') {
  try {
    const url = searchTerm
      ? `${LIBRARY_API_URL}?q=${encodeURIComponent(searchTerm)}`
      : LIBRARY_API_URL
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error('API no disponible')
    const data = await res.json()
    if (Array.isArray(data)) {
      return data.map(m => ({
        name: m.name || m,
        desc: m.description || '',
        size: m.size ? `~${m.size}` : '',
        type: m.type || 'general',
        recommended: false,
      }))
    }
    return []
  } catch {
    return null
  }
}
