/**
 * WebSocket service for lobby real-time updates
 */

import { shouldLobbyReconnect } from './connectionState';
import { WS_URL } from '@/config';


export class LobbyWebSocket {
  constructor(gameCode, callbacks = {}, getAppState = null) {
    this.gameCode = gameCode;
    this.callbacks = callbacks;
    this.getAppState = getAppState;  // Function to get current app state: () => { state, gameCode }
    this.ws = null;
    this.reconnectTimeout = null;  // Store timeout ID to clear it if needed
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    const url = WS_URL + '/ws/lobby/' + this.gameCode + '/';
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('Lobby WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'players') {
          if (this.callbacks.onPlayersUpdate) {
            this.callbacks.onPlayersUpdate(data.players);
          }
        } else if (data.type === 'game_started') {
          if (this.callbacks.onGameStarted) {
            this.callbacks.onGameStarted(data.gameState);
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('Lobby WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('Lobby WebSocket disconnected');
      // Check if we should reconnect based on current app state
      this.reconnectTimeout = setTimeout(() => {
        if (this.shouldReconnect()) {
          this.connect();
        }
        this.reconnectTimeout = null;
      }, 3000);
    };
  }

  shouldReconnect() {
    // Check if we should reconnect based on current app state
    if (!this.getAppState) {
      // Fallback: if no state getter provided, don't reconnect
      return false;
    }
    const { state, gameCode } = this.getAppState();
    return shouldLobbyReconnect(state, gameCode);
  }

  disconnect() {
    console.log('Lobby WebSocket disconnecting');
    
    // Clear any pending reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

