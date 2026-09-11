// REST wrappers for the server-side SavedMap CRUD endpoints.
//
// CURRENTLY UNUSED by any client flow: the lobby's "Load Map" picker
// reads the client's localStorage (saved maps + custom scenarios), and
// multiplayer saves land locally via the `map_saved` WS reply. The
// server-side SavedMap store keeps accumulating rows on every MP save
// and these wrappers are kept deliberately — planned for future reuse
// (e.g. cross-device map sync). Shapes stay parallel to `mapStorage.js`
// so a caller doesn't need a mode-aware adapter.

import { API_URL } from '@/config'

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function listSavedMaps() {
  const response = await fetch(API_URL + '/saved-maps/', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
  })
  if (!response.ok) {
    throw new Error('Failed to load saved maps')
  }
  const data = await response.json()
  return data.savedMaps || []
}

export async function deleteSavedMap(name) {
  const response = await fetch(API_URL + `/saved-maps/${encodeURIComponent(name)}/`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
  })
  if (!response.ok && response.status !== 404) {
    throw new Error('Failed to delete saved map')
  }
}
