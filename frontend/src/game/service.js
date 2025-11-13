import { MULTIPLAYER_INITIAL_SETTINGS } from '@/game/const';
const API = (p) => 'http://localhost:8008' + p;

export async function createGame() {
  const response = await fetch(API('/games/'), {
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
  const response = await fetch(API(`/games/${gameCode}/join/`), {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error((await response.json()).detail || 'Join game failed');
  }
  return response.json();
}

export async function startMultiplayerGame(gameCode) {
  console.log('Starting multiplayer game call', gameCode);
  const response = await fetch(API(`/games/${gameCode}/start/`), {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify(MULTIPLAYER_INITIAL_SETTINGS),
  });
  if (!response.ok) {
    throw new Error((await response.json()).detail || 'Start game failed');
  }
  return response.json();
}