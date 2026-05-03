# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Little Dinos is a turn-based strategy game. Vue 3 frontend, Django + Channels backend. The same game runs in two modes that share game-engine code but differ in authority:

- **Single-player**: client-authoritative. Vue components mutate state directly via engine classes. Save/load via `localStorage`.
- **Multiplayer**: server-authoritative. Client sends moves over WebSocket; server validates, mutates, and broadcasts state patches.

## Commands

### Backend (run from `backend/`)
```bash
source venv/bin/activate                                      # one-time per shell
DJANGO_DEBUG=True daphne -b 0.0.0.0 -p 8008 server.asgi:application   # dev server
pytest                                                        # tests
pytest game/tests/test_foo.py::test_bar                       # single test
black . && ruff check . --fix && ruff check . && mypy game/   # full lint (order matters: format → fix → check → types)
python manage.py migrate                                      # apply migrations
python manage.py makemigrations                               # create migration after model change
```

For prod-like run, source `.env.local` first; see `HOWTO.md` for the env-loading incantation.

### Frontend (run from `frontend/`)
```bash
npm run dev                              # vite dev server on :5173
npm run test                             # vitest (watch mode)
npx vitest run tests/foo.spec.js         # single test file, no watch
npm run format && npm run lint:fix && npm run lint   # full lint
```

### Deploy
- Backend: `cd backend && fly deploy`
- Frontend: push to `main` (Netlify auto-deploys)

## Architecture

### Engine pattern
Game logic lives in plain JS classes under `frontend/src/game/`, decoupled from Vue reactivity:

- `fieldEngine.js` — unit movement, capture, fog of war, unit production
- `waveEngine.js` — BFS pathfinding for reachable cells
- `botEngine.js` — AI player decisions
- `createFieldEngine.js` — random map generation

The same logic exists server-side in `backend/game/services/` (`game_logic.py`, `move_validation.py`, `unit_production.py`, `visibility.py`, `field.py`, `field_diff.py`, `undo_state.py`). When changing game rules, **both implementations must stay in sync** — multiplayer relies on the server's version, single-player on the client's.

### Component layering
- `DinoGame.vue` — single-player controller; owns state, calls engines directly
- `MultiplayerDinoGame.vue` — multiplayer controller; sends moves to server, applies returned patches
- `gameCoreMixin.js` — shared logic between the two controllers (state constants, stats, unit selection, visibility helpers)
- `GameGrid` / `GameCell` / `GameUnit` / `GameBuilding` — presentational; emit user intent

### Event bus
Components communicate via a mitt-based emitter (`game/eventBus.js`) instead of prop-drilling. Key events: `moveUnit`, `selectNextUnit`, `processEndTurn`, `startTurn`, `scoutArea`. Cell clicks bubble up to the controller this way.

### Network protocol (multiplayer)
- `gameWebSocket.js` ↔ `backend/game/consumers.py::GameConsumer`
- `lobbyWebSocket.js` ↔ `LobbyConsumer`
- On join: server sends full state (`onJoined`)
- On move: client sends `{type, payload, clientSeq}`; server replies with a **state patch**, not full state. Patches can be either a replacement field array (turn change) or a sparse nested object (e.g. `{ field: { 5: { 3: { isHidden: false } } } }` for scouting). Patch merge logic lives in `frontend/src/game/fieldDiff.js` / `backend/game/services/field_diff.py`.

### Game models
`frontend/src/game/models.js` defines `Unit`, `Building`, `Cell`, `Player`. `const.js` holds tunable settings (speeds, modifiers, visibility radii). When adding a new building or unit type, expect to touch: `models.js`, `const.js`, `fieldEngine.js`, the corresponding backend service, and the rendering components.

## Tech Stack

Vue 3 (Options API + mixins, **not** Composition API), Vite, Vitest, mitt. Django 4.2, Channels, Daphne (ASGI). SQLite locally, PostgreSQL (Neon) + Redis (Upstash) in prod.

## Environment Variables

Backend (`backend/.env.local`): `DJANGO_SECRET_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL` (prod), `REDIS_URL` (prod).
Frontend: `VITE_API_BASE` — defaults to `http://localhost:8008`.

## Further Reading

`.claude/docs/` contains deeper docs maintained alongside the code: `architecture.md`, `game-engines.md`, `game-components.md`, `game-rules.md`, `mixins.md`, `troubleshooting.md`, `deployment-guide.md`, `security-guidelines.md`, `api/`. Also: `LINTING.md` (lint ordering rationale), `HOWTO.md` (first-time setup).
