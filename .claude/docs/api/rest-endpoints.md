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
- `403`: Only the game creator can start the game
- `404`: Game not found
