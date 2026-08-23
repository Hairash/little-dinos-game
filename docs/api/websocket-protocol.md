# WebSocket Protocol Documentation

## Overview

The game uses two WebSocket connections:
1. **Lobby WebSocket** - For player list updates in game lobby
2. **Game WebSocket** - For real-time game state updates during gameplay

## Connection URLs

- Lobby: `ws(s)://<host>/ws/lobby/<game_code>/`
- Game: `ws(s)://<host>/ws/game/<game_code>/`

## Authentication Flow

Both WebSocket connections require JWT authentication:

1. Client connects to WebSocket
2. Server sends `auth_required` message
3. Client sends `auth` message with JWT token
4. Server validates token and sends initial state

### Auth Message (Client -> Server)
```json
{
  "t": "auth",
  "token": "jwt_token_string"
}
```

### Auth Required (Server -> Client)
```json
{
  "t": "auth_required"
}
```

---

## Lobby WebSocket Messages

### Players Update (Server -> Client)
Sent when player list changes (join/leave).
```json
{
  "type": "players",
  "players": [
    { "id": 1, "username": "player1", "order": 0 },
    { "id": 2, "username": "player2", "order": 1 }
  ]
}
```

### Game Started (Server -> Client)
Broadcast when game host starts the game.
```json
{
  "type": "game_started",
  "gameCode": "abc12345",
  "gameState": {
    "gameCode": "abc12345",
    "status": "playing",
    "settings": { ... },
    "turnPlayer": "username",
    "players": [...]
  }
}
```

---

## Game WebSocket Messages

### Joined (Server -> Client)
Sent after successful authentication, contains initial game state.
```json
{
  "t": "joined",
  "gameCode": "abc12345",
  "gameState": {
    "gameCode": "abc12345",
    "status": "playing",
    "settings": { ... },
    "field": [...],
    "turnPlayer": "username",
    "currentPlayer": 0,
    "players": [...],
    "lastClientSeq": 5
  }
}
```

Note: The `field` is filtered based on player's visibility (fog of war).

### Move (Client -> Server)
Send a game action (move unit, end turn, scout).
```json
{
  "t": "move",
  "payload": {
    "type": "move|endTurn|scout",
    ...
  },
  "clientSeq": 1
}
```

#### Move Types:

**Unit Move:**
```json
{
  "type": "move",
  "from": [x, y],
  "to": [x, y]
}
```

**End Turn:**
```json
{
  "type": "endTurn"
}
```

**Scout (Obelisk):**
```json
{
  "type": "scout",
  "targetX": x,
  "targetY": y,
  "sourceX": x,
  "sourceY": y,
  "fogRadius": 3
}
```

### State Update (Server -> Client)
Broadcast to all players after a successful move.
```json
{
  "t": "state",
  "gameCode": "abc12345",
  "patch": {
    "field": [...],
    "currentPlayer": 1,
    "turnPlayer": "player2",
    ...
  },
  "serverTick": 10
}
```

The patch contains only changed fields. The `field` is filtered for each player's visibility.

### Error (Server -> Client)
Sent when a move fails validation.
```json
{
  "t": "err",
  "code": "ERROR_CODE",
  "message": "Error description"
}
```

Common error codes:
- `AUTH_REQUIRED`: Authentication needed
- `AUTH_FAILED`: Invalid token
- `NOT_YOUR_TURN`: Tried to move when not your turn
- `INVALID_MOVE`: Move validation failed

### Player Disconnected (Server -> Client)
Broadcast when a player disconnects.
```json
{
  "t": "player_disconnected",
  "player": {
    "id": 1,
    "username": "player1"
  }
}
```

### Player Reconnected (Server -> Client)
Broadcast when a player reconnects.
```json
{
  "t": "player_reconnected",
  "player": {
    "id": 1,
    "username": "player1"
  }
}
```

---

## Reconnection

The client implements automatic reconnection with exponential backoff:
- Initial delay: 1 second
- Max delay: 30 seconds
- Max attempts: 10

On reconnection:
1. Client reconnects to WebSocket
2. Authenticates with JWT
3. Receives full game state including `lastClientSeq`
4. Client can resume from where it left off

---

## Client Sequence Numbers

Each move includes a `clientSeq` number for:
- Ordering moves
- Detecting missed/duplicate messages
- Enabling proper state recovery on reconnection

The server tracks `lastClientSeq` per player and returns it in the `joined` message.
