import { describe, it, expect } from 'vitest';
import {
  shouldLobbyReconnect,
  shouldGameReconnect,
  getConnectionState,
} from '@/game/websocket/connectionState';
import { GAME_STATES } from '@/game/const';

describe('connectionState', () => {
  describe('shouldLobbyReconnect', () => {
    it('returns true when in lobby state', () => {
      expect(shouldLobbyReconnect(GAME_STATES.lobby, null)).toBe(true);
      expect(shouldLobbyReconnect(GAME_STATES.lobby, 'abc123')).toBe(true);
    });

    it('returns false when in game state', () => {
      expect(shouldLobbyReconnect(GAME_STATES.game, 'abc123')).toBe(false);
      expect(shouldLobbyReconnect(GAME_STATES.game, null)).toBe(false);
    });

    it('returns false when in menu state', () => {
      expect(shouldLobbyReconnect(GAME_STATES.menu, null)).toBe(false);
    });

    it('returns false when in login state', () => {
      expect(shouldLobbyReconnect(GAME_STATES.login, null)).toBe(false);
    });

    it('returns false when in setup state', () => {
      expect(shouldLobbyReconnect(GAME_STATES.setup, null)).toBe(false);
    });
  });

  describe('shouldGameReconnect', () => {
    it('returns true when in game state with game code', () => {
      expect(shouldGameReconnect(GAME_STATES.game, 'abc123')).toBe(true);
      expect(shouldGameReconnect(GAME_STATES.game, 'xyz789')).toBe(true);
    });

    it('returns false when in game state without game code (local game)', () => {
      expect(shouldGameReconnect(GAME_STATES.game, null)).toBe(false);
    });

    it('returns false when in lobby state', () => {
      expect(shouldGameReconnect(GAME_STATES.lobby, 'abc123')).toBe(false);
    });

    it('returns false when in menu state', () => {
      expect(shouldGameReconnect(GAME_STATES.menu, 'abc123')).toBe(false);
    });

    it('returns false when in login state', () => {
      expect(shouldGameReconnect(GAME_STATES.login, 'abc123')).toBe(false);
    });
  });

  describe('getConnectionState', () => {
    it('identifies local game correctly', () => {
      const state = getConnectionState(GAME_STATES.game, null);
      expect(state.isLocalGame).toBe(true);
      expect(state.isMultiplayerGame).toBe(false);
      expect(state.isLobby).toBe(false);
      expect(state.shouldLobbyReconnect).toBe(false);
      expect(state.shouldGameReconnect).toBe(false);
    });

    it('identifies multiplayer game correctly', () => {
      const state = getConnectionState(GAME_STATES.game, 'abc123');
      expect(state.isLocalGame).toBe(false);
      expect(state.isMultiplayerGame).toBe(true);
      expect(state.isLobby).toBe(false);
      expect(state.shouldLobbyReconnect).toBe(false);
      expect(state.shouldGameReconnect).toBe(true);
    });

    it('identifies lobby correctly', () => {
      const state = getConnectionState(GAME_STATES.lobby, 'abc123');
      expect(state.isLocalGame).toBe(false);
      expect(state.isMultiplayerGame).toBe(false);
      expect(state.isLobby).toBe(true);
      expect(state.shouldLobbyReconnect).toBe(true);
      expect(state.shouldGameReconnect).toBe(false);
    });

    it('includes appState and gameCode in result', () => {
      const state = getConnectionState(GAME_STATES.menu, 'test123');
      expect(state.appState).toBe(GAME_STATES.menu);
      expect(state.gameCode).toBe('test123');
    });
  });
});
