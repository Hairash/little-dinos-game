import { MULTIPLAYER_INITIAL_SETTINGS } from '@/game/const';
import { API_URL } from '@/config';

export async function createGame() {
  const response = await fetch(API_URL + '/games/', {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error((await response.json()).detail || 'Create game failed');
  }
  return response.json();
}

export async function joinGame(gameCode) {
  console.log('Joining game call', gameCode);
  const response = await fetch(API_URL + `/games/${gameCode}/join/`, {
    method: 'POST',
    credentials: 'include',
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
  const response = await fetch(API_URL + `/games/${gameCode}/start/`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
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
  });
  if (!response.ok) {
    throw new Error((await response.json()).detail || 'Get active games failed');
  }
  return response.json();
}
