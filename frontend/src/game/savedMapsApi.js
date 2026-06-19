// REST wrappers for the server-side SavedMap CRUD endpoints.
// Used by SavedMapsPage when the picker is opened in multiplayer
// context (LobbyPage's "Load Map" flow). The single-player path stays
// on `mapStorage.js` (localStorage) — these two modules deliberately
// have parallel shapes so the page doesn't need a mode-aware adapter.

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
