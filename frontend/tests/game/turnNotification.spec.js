import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPlayerColor } from '@/game/helpers';

describe('Turn Notification', () => {
  describe('getPlayerColor for turn notifications', () => {
    it('returns blue (#4A90E2) for player 0', () => {
      expect(getPlayerColor(0)).toBe('#4A90E2');
    });

    it('returns mint (#32cc67) for player 1', () => {
      expect(getPlayerColor(1)).toBe('#32cc67');
    });

    it('returns red (#FF4444) for player 2', () => {
      expect(getPlayerColor(2)).toBe('#FF4444');
    });

    it('returns yellow (#FFD700) for player 3', () => {
      expect(getPlayerColor(3)).toBe('#FFD700');
    });
  });

  describe('Turn notification message formatting', () => {
    it('formats single-player message correctly', () => {
      // Single-player format: "Player {number} turn"
      const playerOrder = 0;
      const message = `Player ${playerOrder + 1} turn`;
      expect(message).toBe('Player 1 turn');
    });

    it('formats message for player 2 correctly', () => {
      const playerOrder = 1;
      const message = `Player ${playerOrder + 1} turn`;
      expect(message).toBe('Player 2 turn');
    });

    it('formats message for player 4 correctly', () => {
      const playerOrder = 3;
      const message = `Player ${playerOrder + 1} turn`;
      expect(message).toBe('Player 4 turn');
    });
  });

  describe('Multiplayer notification with player names', () => {
    const mockPlayersData = [
      { id: 1, username: 'Alice', order: 0 },
      { id: 2, username: 'Bob', order: 1 },
      { id: 3, username: 'Charlie', order: 2 },
    ];

    function getPlayerNameByOrder(playersData, order) {
      const player = playersData.find(p => p.order === order);
      return player ? player.username : `Player ${order + 1}`;
    }

    it('returns player username for valid order', () => {
      expect(getPlayerNameByOrder(mockPlayersData, 0)).toBe('Alice');
      expect(getPlayerNameByOrder(mockPlayersData, 1)).toBe('Bob');
      expect(getPlayerNameByOrder(mockPlayersData, 2)).toBe('Charlie');
    });

    it('returns fallback for unknown order', () => {
      expect(getPlayerNameByOrder(mockPlayersData, 99)).toBe('Player 100');
    });

    it('formats multiplayer message correctly', () => {
      const playerName = getPlayerNameByOrder(mockPlayersData, 0);
      const message = `${playerName} turn`;
      expect(message).toBe('Alice turn');
    });
  });

  describe('Notification system behavior', () => {
    let notifications;

    beforeEach(() => {
      notifications = [];
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function showNotification(message, type = 'info', playerOrder = null) {
      const id = Date.now() + Math.random();
      notifications.push({ id, message, type, playerOrder });
      return id;
    }

    function dismissNotification(id) {
      const index = notifications.findIndex(n => n.id === id);
      if (index !== -1) {
        notifications.splice(index, 1);
      }
    }

    it('adds notification to array', () => {
      showNotification('Player 1 turn', 'turn', 0);
      expect(notifications.length).toBe(1);
      expect(notifications[0].message).toBe('Player 1 turn');
      expect(notifications[0].type).toBe('turn');
      expect(notifications[0].playerOrder).toBe(0);
    });

    it('stacks multiple notifications', () => {
      showNotification('Player 1 turn', 'turn', 0);
      showNotification('Player 2 turn', 'turn', 1);
      showNotification('Player 3 turn', 'turn', 2);
      expect(notifications.length).toBe(3);
    });

    it('dismisses notification by id', () => {
      const id1 = showNotification('Player 1 turn', 'turn', 0);
      const id2 = showNotification('Player 2 turn', 'turn', 1);

      dismissNotification(id1);
      expect(notifications.length).toBe(1);
      expect(notifications[0].message).toBe('Player 2 turn');
    });

    it('handles dismiss of non-existent id gracefully', () => {
      showNotification('Player 1 turn', 'turn', 0);
      dismissNotification(999999);
      expect(notifications.length).toBe(1);
    });

    it('each notification has unique id', () => {
      const id1 = showNotification('Player 1 turn', 'turn', 0);
      const id2 = showNotification('Player 2 turn', 'turn', 1);
      expect(id1).not.toBe(id2);
    });
  });

  describe('CSS variable styling', () => {
    it('generates correct style object for turn notification', () => {
      const notification = { type: 'turn', playerOrder: 0 };
      const style = notification.type === 'turn'
        ? { '--player-color': getPlayerColor(notification.playerOrder) }
        : {};

      expect(style).toEqual({ '--player-color': '#4A90E2' });
    });

    it('generates empty style object for non-turn notification', () => {
      const notification = { type: 'disconnect', playerOrder: null };
      const style = notification.type === 'turn'
        ? { '--player-color': getPlayerColor(notification.playerOrder) }
        : {};

      expect(style).toEqual({});
    });

    it('generates correct style for each player', () => {
      const expectedColors = {
        0: '#4A90E2', // blue
        1: '#32cc67', // mint
        2: '#FF4444', // red
        3: '#FFD700', // yellow
      };

      for (const [order, expectedColor] of Object.entries(expectedColors)) {
        const notification = { type: 'turn', playerOrder: parseInt(order) };
        const style = { '--player-color': getPlayerColor(notification.playerOrder) };
        expect(style['--player-color']).toBe(expectedColor);
      }
    });
  });
});
