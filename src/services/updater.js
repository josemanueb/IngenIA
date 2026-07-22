const CURRENT_VERSION = '1.1.0'
const REPO_OWNER = 'josemanueb'
const REPO_NAME = 'IngenIA'

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

export async function checkForUpdates() {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      { signal: withTimeout(null, 8000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const latestVersion = data.tag_name?.replace('v', '') || null
    const downloadUrl = data.html_url
    const body = data.body || ''
    if (latestVersion && latestVersion !== CURRENT_VERSION) {
      return {
        current: CURRENT_VERSION,
        latest: latestVersion,
        url: downloadUrl,
        notes: body,
      }
    }
    return null
  } catch {
    return null
  }
}

export function getCurrentVersion() {
  return CURRENT_VERSION
}
