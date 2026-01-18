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
    this.shouldReconnectFlag = true;  // Flag to control reconnection (can be set to false to prevent reconnection)
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    const url = WS_URL + '/ws/lobby/' + this.gameCode + '/';
    this.ws = new WebSocket(url);
    this.authenticated = false;

    this.ws.onopen = () => {
      console.log('Lobby WebSocket connected');
      // Send authentication token in first message (more secure than query string)
      const token = localStorage.getItem('auth_token');
      if (token) {
        this.ws.send(JSON.stringify({ type: 'auth', token: token }));
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'auth_required') {
          // Server is requesting authentication - send token if we have it
          const token = localStorage.getItem('auth_token');
          if (token) {
            this.ws.send(JSON.stringify({ type: 'auth', token: token }));
          } else {
            console.error('[WS] Auth required but no token available');
            this.ws.close();
          }
        } else if (data.type === 'players') {
          // Mark as authenticated after receiving players list
          this.authenticated = true;
          if (this.callbacks.onPlayersUpdate) {
            this.callbacks.onPlayersUpdate(data.players);
          }
        } else if (data.type === 'game_started') {
          if (this.callbacks.onGameStarted) {
            this.callbacks.onGameStarted(data.gameState);
          }
        } else if (data.type === 'error') {
          console.error('[WS] Lobby error:', data.message);
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
      // Only try to reconnect if the flag allows it
      if (!this.shouldReconnectFlag) {
        console.log('Reconnection prevented by flag');
        return;
      }
      // Check if we should reconnect based on current app state
      this.reconnectTimeout = setTimeout(() => {
        if (this.shouldReconnect() && this.shouldReconnectFlag) {
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
    
    // Prevent reconnection when intentionally disconnecting
    this.shouldReconnectFlag = false;
    
    // Clear any pending reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      // Remove onclose handler to prevent it from firing after we've set shouldReconnectFlag
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}

