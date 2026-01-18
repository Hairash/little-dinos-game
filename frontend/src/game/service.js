import { MULTIPLAYER_INITIAL_SETTINGS } from '@/game/const';
import { API_URL } from '@/config';

// Helper to get auth headers with JWT token
function getAuthHeaders() {
  const headers = {};
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function createGame() {
  const response = await fetch(API_URL + '/games/', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error((await response.json()).detail || 'Create game failed');
  }
  return response.json();
}

export async function leaveGame(gameCode) {
  console.log('Leaving game call', gameCode);
  const response = await fetch(API_URL + `/games/${gameCode}/leave/`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    // Don't throw error if game not found or not in game - just log it
    const errorData = await response.json().catch(() => ({}));
    console.warn('Leave game warning:', errorData.error || errorData.message || 'Leave game failed');
    return { success: false, message: errorData.error || errorData.message };
  }
  return response.json();
}

export async function joinGame(gameCode) {
  console.log('Joining game call', gameCode);
  const response = await fetch(API_URL + `/games/${gameCode}/join/`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error((await response.json()).detail || 'Join game failed');
  }
  return response.json();
}

export async function startMultiplayerGame(gameCode, customSettings = null) {
  console.log('Starting multiplayer game call', gameCode, 'with settings:', customSettings);
  // Use custom settings if provided, otherwise use default
  const settings = customSettings || MULTIPLAYER_INITIAL_SETTINGS;
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() };
  const response = await fetch(API_URL + `/games/${gameCode}/start/`, {
    method: 'POST',
    credentials: 'include',
    headers: headers,
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    throw new Error((await response.json()).detail || 'Start game failed');
  }
  return response.json();
}

export async function getActiveGames(limit = 10) {
  const url = limit === null || limit === undefined
    ? `${API_URL}/games/active/?limit=all`
    : `${API_URL}/games/active/?limit=${limit}`;
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error((await response.json()).detail || 'Get active games failed');
  }
  return response.json();
}
