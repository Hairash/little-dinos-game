/**
 * WebSocket service for game real-time updates (moves, state patches, etc.)
 */

import { shouldGameReconnect } from './connectionState';

const WS_URL = (gameCode) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = 'localhost:8008';
  return `${protocol}//${host}/ws/game/${gameCode}/`;
};

export class GameWebSocket {
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

    const url = WS_URL(this.gameCode);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('Game WebSocket connected');
      if (this.callbacks.onOpen) {
        this.callbacks.onOpen();
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle different message types
        switch (data.t) {
          case 'joined':
            if (this.callbacks.onJoined) {
              // Backend sends gameState, not state
              this.callbacks.onJoined(data.gameState || data.state);
            }
            break;
          case 'state':
            if (this.callbacks.onStateUpdate) {
              this.callbacks.onStateUpdate(data.patch, data.serverTick);
            }
            break;
          case 'game_started':
            if (this.callbacks.onGameStarted) {
              this.callbacks.onGameStarted(data.gameState);
            }
            break;
          case 'err':
            if (this.callbacks.onError) {
              this.callbacks.onError(data);
            }
            break;
          default:
            console.log('Unknown message type:', data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('Game WebSocket error:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
    };

    this.ws.onclose = () => {
      console.log('Game WebSocket disconnected');
      if (this.callbacks.onClose) {
        this.callbacks.onClose();
      }
      // Check if we should reconnect based on current app state
      this.reconnectTimeout = setTimeout(() => {
        if (this.shouldReconnect()) {
          this.connect();
        }
        this.reconnectTimeout = null;
      }, 3000);
    };
  }

  sendMove(payload, clientSeq) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        t: 'move',
        payload,
        clientSeq,
      }));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  shouldReconnect() {
    // Check if we should reconnect based on current app state
    if (!this.getAppState) {
      // Fallback: if no state getter provided, don't reconnect
      return false;
    }
    const { state, gameCode } = this.getAppState();
    return shouldGameReconnect(state, gameCode);
  }

  disconnect() {
    console.log('Game WebSocket disconnecting');
    
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

