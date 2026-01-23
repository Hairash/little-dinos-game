# Little Dinos Game

Turn-based strategy game with Vue.js frontend and Django backend.

## Project Structure

```
little-dinos-game/
├── frontend/          # Vue.js 3 + Vite
│   ├── src/
│   │   ├── components/   # Vue components (DinoGame, GameGrid, etc.)
│   │   └── game/         # Game logic (models, engines, WebSocket)
│   └── tests/
├── backend/           # Django + Channels (WebSocket)
│   ├── game/
│   │   ├── services/     # Core game logic
│   │   ├── consumers.py  # WebSocket handlers
│   │   └── views.py      # REST API
│   └── server/           # Django settings
└── HOWTO.md           # Setup instructions
```

## Tech Stack

- **Frontend**: Vue.js 3, Vite, Vitest
- **Backend**: Django 4.2, Django Channels, Daphne (ASGI)
- **Database**: SQLite (local), PostgreSQL/Neon (prod)
- **Cache**: Redis/Upstash (prod WebSocket layer)
- **Hosting**: Fly.io (backend), Netlify (frontend)

## Running Locally

### Backend (Terminal 1)
```bash
cd backend
source venv/bin/activate
DJANGO_DEBUG=True daphne -b 0.0.0.0 -p 8008 server.asgi:application
```

### Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```

Frontend: http://localhost:5173
Backend API: http://localhost:8008

## Key Files

### Game Logic
- `frontend/src/game/models.js` - Unit, Building, Cell, Player classes
- `frontend/src/game/const.js` - Game constants and settings
- `frontend/src/game/fieldEngine.js` - Grid/field manipulation
- `frontend/src/game/botEngine.js` - AI player logic
- `backend/game/services/general.py` - Server-side game logic
- `backend/game/services/visibility.py` - Fog of war calculations

### UI Components
- `frontend/src/components/DinoGame.vue` - Single-player game
- `frontend/src/components/MultiplayerDinoGame.vue` - Multiplayer game
- `frontend/src/components/GameGrid.vue` - Grid rendering
- `frontend/src/components/GameCell.vue` - Individual cell
- `frontend/src/components/GameUnit.vue` - Unit rendering
- `frontend/src/components/GameBuilding.vue` - Building rendering

### Networking
- `frontend/src/game/gameWebSocket.js` - Game WebSocket client
- `frontend/src/game/lobbyWebSocket.js` - Lobby WebSocket client
- `backend/game/consumers.py` - GameConsumer, LobbyConsumer

## Game Mechanics

- **Units**: Have movement points, can attack adjacent enemies
- **Bases**: Produce units each turn, can be captured
- **Buildings**: Base, Habitation, Temple, Well, Storage, Obelisk
- **Terrain**: Empty fields (passable), Mountains (impassable)
- **Fog of War**: Units reveal cells within visibility radius
- **Scouting**: Special action to reveal distant areas

## Deployment

### Backend (Fly.io)
```bash
cd backend
fly deploy
```

### Frontend (Netlify)
Push to main branch - auto-deploys via Netlify CI

## Testing

```bash
cd frontend
npm run test      # Run Vitest
npm run lint      # ESLint check
```

## Environment Variables

### Backend (.env.local)
- `DJANGO_SECRET_KEY`
- `JWT_SECRET_KEY`
- `DATABASE_URL` (prod only)
- `REDIS_URL` (prod only)

### Frontend
- `VITE_API_BASE` - Backend URL (defaults to http://localhost:8008)
