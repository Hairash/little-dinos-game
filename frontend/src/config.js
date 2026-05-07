// Auto-detect API URL based on current hostname for network access
function getApiUrl() {
  // If explicitly set via environment variable, use that
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE
  }

  // In browser, detect current hostname and use it for API
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    // If accessing via network IP (not localhost), use same IP for API
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:8008`
    }
  }

  // Default to localhost for local development
  return 'http://localhost:8008'
}

export const API_URL = getApiUrl()
export const WS_URL = API_URL
  ? API_URL.replace('https', 'wss').replace('http', 'ws')
  : 'ws://localhost:8008'
