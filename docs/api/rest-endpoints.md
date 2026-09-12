# REST API Documentation

## Authentication

All authenticated endpoints require a JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

### POST /auth/signup/

Create a new user account.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "ok": true,
  "user": {
    "id": 1,
    "username": "string"
  },
  "token": "jwt_token_string"
}
```

**Errors:**
- `400`: Username and password required, username taken, or password validation failed

---

### POST /auth/signin/

Sign in to an existing account.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "ok": true,
  "user": {
    "id": 1,
    "username": "string"
  },
  "token": "jwt_token_string"
}
```

**Errors:**
- `401`: Invalid credentials

---

### POST /auth/signout/

Sign out (clears session cookies for backward compatibility).

**Response (200):**
```json
{
  "ok": true
}
```

Note: JWT token clearing is handled client-side (`localStorage.removeItem('auth_token')`).

---

### GET /auth/whoami/

Check current authentication status.

**Response (authenticated):**
```json
{
  "auth": true,
  "user": {
    "id": 1,
    "username": "string"
  }
}
```

**Response (not authenticated):**
```json
{
  "auth": false
}
```

---

## Games

### POST /games/

Create a new game. Requires authentication.

**Response (200):**
```json
{
  "gameCode": "abc12345"
}
```

The creator is automatically added as player 0 (game host).

---

### GET /games/active/

Get active (in-progress) games for the current user. Requires authentication.

**Query Parameters:**
- `limit` (optional): Number of games to return (default: 10, use "all" for no limit)

**Response (200):**
```json
{
  "games": [
    {
      "gameCode": "abc12345",
      "status": "playing",
      "settings": { ... },
      "turnPlayer": "username",
      "players": [
        { "id": 1, "username": "player1", "order": 0 },
        { "id": 2, "username": "player2", "order": 1 }
      ]
    }
  ],
  "total": 5,
  "hasMore": false
}
```

---

### GET /games/{game_code}/

Get game details. Requires authentication and being a participant.

**Response (200):**
```json
{
  "gameCode": "abc12345",
  "status": "ready|playing|ended",
  "settings": { ... },
  "field": [...],
  "turnPlayer": "username",
  "players": [...]
}
```

**Errors:**
- `403`: You are not a participant in this game
- `404`: Game not found

---

### POST /games/{game_code}/join/

Join an existing game. Requires authentication.

**Response (200):**
```json
{
  "message": "Joined game"
}
```

**Errors:**
- `400`: Game is not ready (already started)
- `400`: The creator picked a map and its seat capacity is already
  reached (`error` names the map and its player limit)

---

### POST /games/{game_code}/leave/

Leave a game (before it starts). Requires authentication.

**Response (200):**
```json
{
  "message": "Left game"
}
```

**Errors:**
- `400`: Not in game, or game has already started
- `404`: Game not found

---

### POST /games/{game_code}/map/

Sync the creator's lobby map pick (name + seat count). Requires
authentication and being the game creator (order=0). The full map JSON
still travels with the start request — this stores only the
lobby-visible summary, broadcast to the lobby WebSocket group, and lets
`join` enforce the seat capacity. Send `{"name": null}` (or `{}`) to
revert to a random game.

**Request Body:**
```json
{ "name": "My Map", "seats": 4 }
```

**Response (200):**
```json
{ "message": "Map selection updated", "pickedMapName": "My Map", "pickedMapSeats": 4 }
```

**Errors:**
- `400`: Game is not ready / missing name / invalid seat count (1–8)
- `403`: Only the game creator can pick a map
- `404`: Game not found

---

### POST /games/{game_code}/start/

Start a game. Requires authentication and being the game creator (order=0).

**Request Body:**
```json
{
  "width": 20,
  "height": 20,
  "enableFogOfWar": true,
  "fogOfWarRadius": 3,
  ...
}
```

Starting also runs the opening player's start-of-turn production, so
their empty towers spawn on turn 1. Every later turn gets this from the
end-turn handler, which produces for the player about to start — but no
turn ends before the first one.

To start from a picked map (saved map or custom scenario), include the
full canonical Map JSON under `initialMap`. The server validates it
(schema v1 shape, dimensions 5–50, ≤ 8 seats, ≤ 3 MB body), hydrates the
field from it instead of generating a random one, stamps
`settings.fromInitialMap = true` (hides the in-game Save-map button), and
reconciles seats: joined players take map seats `0…N-1` in join order;
surplus map seats are trimmed (their units dropped, their bases demoted
to neutral).

**Response (200):**
```json
{
  "message": "Started game",
  "game": {
    "gameCode": "abc12345",
    "status": "playing",
    "settings": { ... },
    "turnPlayer": "username",
    "players": [...]
  }
}
```

**Errors:**
- `400`: Game is not ready
- `400`: Invalid `initialMap` (schema, dimensions, seats) or payload too large
- `400`: More players joined than the map supports (game stays `ready`)
- `403`: Only the game creator can start the game
- `404`: Game not found
