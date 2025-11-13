/**
 * Connection state manager - determines which WebSocket should be active/reconnect
 * based on the global application state.
 */

import { GAME_STATES } from './const';

/**
 * Determines if lobby WebSocket should be active/reconnect
 * @param {string} appState - Current application state (GAME_STATES)
 * @param {string|null} gameCode - Current game code (null if no multiplayer game)
 * @returns {boolean}
 */
export function shouldLobbyReconnect(appState, gameCode) {
  // Lobby WS should only reconnect when we're in lobby state
  return appState === GAME_STATES.lobby;
}

/**
 * Determines if game WebSocket should be active/reconnect
 * @param {string} appState - Current application state (GAME_STATES)
 * @param {string|null} gameCode - Current game code (null if no multiplayer game)
 * @returns {boolean}
 */
export function shouldGameReconnect(appState, gameCode) {
  // Game WS should only reconnect when we're in game state AND have a game code (multiplayer)
  return appState === GAME_STATES.game && gameCode !== null;
}

/**
 * Get current connection state info
 * @param {string} appState - Current application state
 * @param {string|null} gameCode - Current game code
 * @returns {object} Connection state info
 */
export function getConnectionState(appState, gameCode) {
  return {
    appState,
    gameCode,
    isLocalGame: appState === GAME_STATES.game && !gameCode,
    isLobby: appState === GAME_STATES.lobby,
    isMultiplayerGame: appState === GAME_STATES.game && gameCode !== null,
    shouldLobbyReconnect: shouldLobbyReconnect(appState, gameCode),
    shouldGameReconnect: shouldGameReconnect(appState, gameCode),
  };
}

