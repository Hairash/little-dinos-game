import { MULTIPLAYER_INITIAL_SETTINGS } from '@/game/const'
import { API_URL } from '@/config'

// Helper to get auth headers with JWT token
function getAuthHeaders() {
  const headers = {}
  const token = localStorage.getItem('auth_token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export async function createGame() {
  const response = await fetch(API_URL + '/games/', {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    // A 500 returns an HTML error page — .catch keeps the thrown error
    // readable instead of surfacing a JSON SyntaxError.
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || data.detail || 'Create game failed')
  }
  return response.json()
}

export async function leaveGame(gameCode) {
  console.log('Leaving game call', gameCode)
  const response = await fetch(API_URL + `/games/${gameCode}/leave/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    // Don't throw error if game not found or not in game - just log it
    const errorData = await response.json().catch(() => ({}))
    console.warn('Leave game warning:', errorData.error || errorData.message || 'Leave game failed')
    return { success: false, message: errorData.error || errorData.message }
  }
  return response.json()
}

export async function joinGame(gameCode) {
  console.log('Joining game call', gameCode)
  const response = await fetch(API_URL + `/games/${gameCode}/join/`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    // The backend reports refusals under `error` (e.g. "the lobby is
    // full" when a picked map's seats are taken) — surface that text.
    throw new Error(data.error || data.detail || 'Join game failed')
  }
  return response.json()
}

// Sync the creator's lobby map pick (name + seat count) to the server so
// joiners see the selection and the server can enforce seat capacity.
// Pass `null` to revert to a random game. The full map JSON still travels
// with the start request — this is only the lobby-visible summary.
export async function setGameMap(gameCode, pick) {
  const body = pick ? { name: pick.name, seats: pick.seats } : { name: null }
  const response = await fetch(API_URL + `/games/${gameCode}/map/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || data.detail || 'Map selection failed')
  }
  return response.json()
}

export async function startMultiplayerGame(gameCode, customSettings = null) {
  console.log('Starting multiplayer game call', gameCode, 'with settings:', customSettings)
  // Use custom settings if provided, otherwise use default
  const settings = customSettings || MULTIPLAYER_INITIAL_SETTINGS
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() }
  const response = await fetch(API_URL + `/games/${gameCode}/start/`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(settings),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    // `error` carries map-launch refusals (invalid map, too many players
    // for the picked map's seats) — show the real reason, not a generic.
    throw new Error(data.error || data.detail || 'Start game failed')
  }
  return response.json()
}

export async function getActiveGames(limit = 10) {
  const url =
    limit === null || limit === undefined
      ? `${API_URL}/games/active/?limit=all`
      : `${API_URL}/games/active/?limit=${limit}`
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error((await response.json()).detail || 'Get active games failed')
  }
  return response.json()
}
