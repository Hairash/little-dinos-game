/**
 * WebSocket service for game real-time updates (moves, state patches, etc.)
 */

import { shouldGameReconnect } from './connectionState';

import { WS_URL } from '@/config';

export class GameWebSocket {
  constructor(gameCode, callbacks = {}, getAppState = null) {
    this.gameCode = gameCode;
    this.callbacks = callbacks;
    this.getAppState = getAppState;  // Function to get current app state: () => { state, gameCode }
    this.ws = null;
    this.reconnectTimeout = null;  // Store timeout ID to clear it if needed
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;  // Maximum number of reconnect attempts
    this.reconnectDelay = 1000;  // Initial delay in ms (will increase exponentially)
    this.isReconnecting = false;
    this.isConnected = false;
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const url = WS_URL + '/ws/game/' + this.gameCode + '/';
    console.log(`[WS] Connecting to ${url} (attempt ${this.reconnectAttempts + 1})`);
    this.ws = new WebSocket(url);
    this.isReconnecting = this.reconnectAttempts > 0;
    this.authenticated = false;  // Track authentication state

    this.ws.onopen = () => {
      const wasReconnecting = this.reconnectAttempts > 0;
      console.log('Game WebSocket connected', wasReconnecting ? '(reconnected)' : '');
      this.isConnected = true;
      this.isReconnecting = false;
      this.reconnectAttempts = 0;  // Reset on successful connection
      this.reconnectDelay = 1000;  // Reset delay
      
      // Wait for server to send auth_required or send auth immediately
      // The server will send auth_required if not authenticated, or we can send auth proactively
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Send auth proactively - server will handle it
        console.log('[WS] Sending auth token');
        this.ws.send(JSON.stringify({ t: 'auth', token: token }));
      } else {
        console.error('[WS] No auth token found in localStorage');
        this.ws.close();
        return;
      }
      
      if (this.callbacks.onOpen) {
        this.callbacks.onOpen();
      }
      if (wasReconnecting && this.callbacks.onReconnected) {
        this.callbacks.onReconnected();
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle different message types
        switch (data.t) {
          case 'auth_required':
            // Server is requesting authentication - send token if we have it
            const token = localStorage.getItem('auth_token');
            if (token) {
              this.ws.send(JSON.stringify({ t: 'auth', token: token }));
            } else {
              console.error('[WS] Auth required but no token available');
              this.ws.close();
            }
            break;
          case 'joined':
            // Mark as authenticated after successful join
            this.authenticated = true;
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
          case 'player_disconnected':
            console.log('[WS] Received player_disconnected message:', data);
            if (this.callbacks.onPlayerDisconnected) {
              this.callbacks.onPlayerDisconnected(data.player);
            } else {
              console.warn('[WS] No onPlayerDisconnected callback registered');
            }
            break;
          case 'player_reconnected':
            console.log('[WS] Received player_reconnected message:', data);
            if (this.callbacks.onPlayerReconnected) {
              this.callbacks.onPlayerReconnected(data.player);
            } else {
              console.warn('[WS] No onPlayerReconnected callback registered');
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

    this.ws.onclose = (event) => {
      console.log('Game WebSocket disconnected', { code: event.code, reason: event.reason, wasClean: event.wasClean });
      this.isConnected = false;
      
      if (this.callbacks.onClose) {
        this.callbacks.onClose();
      }
      
      // Don't reconnect if it was a clean close (intentional disconnect)
      // or if we've exceeded max attempts
      if (event.wasClean || this.reconnectAttempts >= this.maxReconnectAttempts) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error(`[WS] Max reconnect attempts (${this.maxReconnectAttempts}) reached. Stopping reconnection.`);
          if (this.callbacks.onMaxReconnectAttempts) {
            this.callbacks.onMaxReconnectAttempts();
          }
        }
        return;
      }
      
      // Check if we should reconnect based on current app state
      if (this.shouldReconnect()) {
        this.reconnectAttempts++;
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        if (this.callbacks.onReconnecting) {
          this.callbacks.onReconnecting(this.reconnectAttempts, delay);
        }
        
        this.reconnectTimeout = setTimeout(() => {
          this.reconnectTimeout = null;
          this.connect();
        }, delay);
      }
    };
  }

  sendMove(payload, clientSeq) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        t: 'move',
        payload,
        clientSeq,
      }));
      return true;
    } else {
      console.warn('[WS] Cannot send move - WebSocket not connected. State:', this.ws?.readyState);
      // If reconnecting, the move will be lost, but server will sync state on reconnect
      return false;
    }
  }
  
  isReady() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
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
    
    // Reset reconnect state
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.isReconnecting = false;
    this.isConnected = false;
    
    if (this.ws) {
      // Close with code 1000 (normal closure) to prevent reconnection
      this.ws.close(1000, 'Intentional disconnect');
      this.ws = null;
    }
  }
}

