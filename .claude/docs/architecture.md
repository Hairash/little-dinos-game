# Little Dinos Game - Architecture

## Project Structure

```
little-dinos-game/
├── frontend/                    # Vue.js 3 + Vite
│   ├── src/
│   │   ├── components/          # Vue components
│   │   │   ├── DinoGame.vue     # Single-player game controller
│   │   │   ├── MultiplayerDinoGame.vue  # Multiplayer game controller
│   │   │   ├── GameGrid.vue     # Game board rendering
│   │   │   ├── GameCell.vue     # Individual cell
│   │   │   ├── GameUnit.vue     # Unit rendering
│   │   │   ├── GameBuilding.vue # Building rendering
│   │   │   ├── InfoPanel.vue    # Bottom HUD panel
│   │   │   ├── ReadyLabel.vue   # Turn start overlay (single-player)
│   │   │   └── MultiplayerReadyLabel.vue  # Turn overlay (multiplayer)
│   │   ├── game/                # Game logic (non-Vue)
│   │   │   ├── models.js        # Data models (Unit, Building, Cell, Player)
│   │   │   ├── const.js         # Game constants and settings
│   │   │   ├── helpers.js       # Utility functions
│   │   │   ├── fieldEngine.js   # Field operations, visibility, production
│   │   │   ├── waveEngine.js    # Pathfinding (BFS wave algorithm)
│   │   │   ├── botEngine.js     # AI player logic
│   │   │   ├── createFieldEngine.js  # Field generation
│   │   │   ├── mixins/          # Vue mixins
│   │   │   │   └── gameCoreMixin.js  # Shared component logic
│   │   │   ├── gameWebSocket.js # WebSocket client for game
│   │   │   ├── lobbyWebSocket.js # WebSocket client for lobby
│   │   │   ├── service.js       # REST API client
│   │   │   └── eventBus.js      # Event emitter (mitt)
│   │   └── auth/                # Authentication
│   └── tests/                   # Vitest tests
├── backend/                     # Django + Channels
│   ├── game/
│   │   ├── services/            # Core game logic
│   │   │   ├── game_logic.py        # apply_move_txn / apply_scout_txn / apply_undo_txn / apply_end_turn_txn
│   │   │   ├── move_validation.py   # validate_move / apply_move_to_cell
│   │   │   ├── unit_production.py   # restore_and_produce_units (turn start)
│   │   │   ├── visibility.py        # calculate_visibility / filter_field_for_player
│   │   │   ├── field.py             # Field generation (multiplayer)
│   │   │   ├── field_diff.py        # compute/apply diff (Python twin of frontend/src/game/fieldDiff.js)
│   │   │   └── undo_state.py        # Owns the schema of Game.undo_state JSONField
│   │   ├── consumers.py         # WebSocket handlers (GameConsumer, LobbyConsumer)
│   │   └── views.py             # REST API endpoints
│   └── server/                  # Django settings
└── .claude/docs/                # Documentation
```

## Architecture Patterns

### 1. Engine Pattern

Game logic is extracted into stateful "engine" classes that operate on game data:

```
┌─────────────────┐     ┌─────────────────┐
│  Vue Component  │────▶│     Engine      │
│  (DinoGame)     │     │  (FieldEngine)  │
└─────────────────┘     └─────────────────┘
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   Game State    │◀────│   Operations    │
│ (field, players)│     │ (move, capture) │
└─────────────────┘     └─────────────────┘
```

**Benefits:**
- Separates game logic from Vue reactivity
- Engines can be unit tested independently
- Same engines used in single-player and multiplayer

### 2. Mixin Pattern (Options API)

Shared Vue component logic extracted into mixins:

```javascript
// Component uses mixin
export default {
  mixins: [gameCoreMixin],
  // Component-specific code
}
```

**gameCoreMixin provides:**
- State constants (STATES)
- UI state (cellSize)
- Stats calculation (getCurrentStats)
- Unit selection (findNextUnit)
- Visibility helpers

### 3. Event Bus Pattern

Components communicate via centralized event emitter:

```
┌──────────┐   emitter.emit('moveUnit')   ┌──────────┐
│ GameCell │─────────────────────────────▶│ DinoGame │
└──────────┘                              └──────────┘
                                                │
                                                ▼
                                          moveUnit()
```

**Key events:**
- `moveUnit` - Unit movement request
- `selectNextUnit` - Highlight next unit
- `processEndTurn` - End current turn
- `startTurn` - Begin new turn
- `scoutArea` - Reveal area (obelisk)

## Data Flow

### Single-Player

```
User Input → Vue Component → Engine → State Update → Vue Reactivity → UI
```

1. User clicks cell
2. GameCell emits `moveUnit` event
3. DinoGame calls `fieldEngine.moveUnit()`
4. Field array is mutated
5. Vue detects changes, updates UI

### Multiplayer

```
User Input → Vue Component → WebSocket → Server → WebSocket → State Update → UI
```

1. User clicks cell
2. GameCell emits `moveUnit` event
3. MultiplayerDinoGame sends move via WebSocket
4. Server validates and processes move
5. Server broadcasts state patch
6. Client applies patch to local state
7. Vue updates UI

## State Management

### Single-Player State

```javascript
// Stored in component data()
{
  field: [[Cell, Cell], ...],  // 2D array
  players: [Player, Player],
  currentPlayer: 0,
  state: 'play',  // ready | play | exitDialog
  winPhase: 'progress',
}
```

**Persistence:** localStorage (save/load game)

### Multiplayer State

```javascript
// Stored in component data()
{
  localField: [[Cell, Cell], ...],  // Local copy from server
  localSettings: {...},
  players: [Player, Player],
  currentPlayer: 0,  // From server
  myPlayerOrder: 1,  // This client's player
  clientSeq: 5,  // Move sequence number
}
```

**Source of truth:** Server (client syncs via patches)

## Network Architecture

### WebSocket Protocol

```
Client                          Server
   │                               │
   │──── connect ─────────────────▶│
   │◀─── onJoined (full state) ───│
   │                               │
   │──── move {type, payload} ────▶│
   │◀─── onStateUpdate (patch) ───│
   │                               │
   │──── endTurn ─────────────────▶│
   │◀─── onStateUpdate (new turn)─│
```

### State Patches

Server sends minimal patches instead of full state:

```javascript
// Full field update (new turn)
{ field: [[...]], currentPlayer: 1 }

// Partial update (scout action)
{ field: { 5: { 3: { isHidden: false } } } }
```

## Testing Strategy

- **Unit tests:** Game engines (fieldEngine, waveEngine)
- **Component tests:** Vue components with mocked engines
- **E2E tests:** Full game flows (not yet implemented)

## Deployment

- **Frontend:** Netlify (auto-deploy on push to main)
- **Backend:** Fly.io (manual deploy via `fly deploy`)
- **Database:** PostgreSQL on Neon (production)
- **WebSocket:** Redis on Upstash (channel layer)
