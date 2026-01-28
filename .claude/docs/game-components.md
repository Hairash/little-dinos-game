# Game Components

## Overview

The game has two main controller components that manage game state and logic:

| Component | Purpose | Uses Mixin |
|-----------|---------|------------|
| `DinoGame.vue` | Single-player game | `gameCoreMixin` |
| `MultiplayerDinoGame.vue` | Multiplayer game | `gameCoreMixin` |

Both components use `gameCoreMixin` for shared logic.

---

## DinoGame.vue

**Location:** `frontend/src/components/DinoGame.vue`

### Purpose
Controls single-player games with bot opponents. Manages local game state, AI turns, and persistence.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `humanPlayersNum` | Number | Number of human players |
| `botPlayersNum` | Number | Number of bot players |
| `width` | Number | Field width |
| `height` | Number | Field height |
| `scoresToWin` | Number | Score threshold for victory |
| `enableFogOfWar` | Boolean | Enable fog of war |
| `fogOfWarRadius` | Number | Base visibility radius |
| `enableScoutMode` | Boolean | Enable scouting from obelisks |
| `maxUnitsNum` | Number | Maximum units per player |
| `maxBasesNum` | Number | Maximum bases per player |
| `enableUndo` | Boolean | Allow undo moves |
| `loadGame` | Boolean | Load from localStorage |

### Data (Component-Specific)

```javascript
{
  // From mixin: STATES, cellSize

  // Phase tracking
  WIN_PHASES: { progress, has_winner, informed },
  HUMAN_PHASES: { progress, all_eliminated, informed },
  LAST_PLAYER_PHASES: { progress, last_player, informed },

  // Game state
  players: [],
  currentPlayer: 0,
  field: null,
  winner: null,
  lastPlayer: null,

  // Undo system
  prevField: null,
  prevPlayer: 0,

  // Visibility
  tempVisibilityCoords: Set,
}
```

### Methods (Component-Specific)

| Method | Purpose |
|--------|---------|
| `startTurn()` | Restore units, produce new units, set visibility |
| `processEndTurn()` | End turn, check win conditions, advance to next player |
| `moveUnit(from, to)` | Execute unit movement with combat and capture |
| `makeBotMove()` | Execute AI turn |
| `checkEndOfGame()` | Check victory conditions |
| `saveState()` | Save to localStorage |
| `restoreField()` | Undo last move |

### Engines Used

- `CreateFieldEngine` - Generate initial field
- `WaveEngine` - Pathfinding
- `FieldEngine` - Game operations
- `BotEngine` - AI logic

---

## MultiplayerDinoGame.vue

**Location:** `frontend/src/components/MultiplayerDinoGame.vue`

### Purpose
Controls multiplayer games. Syncs with server via WebSocket, handles reconnection, and validates turns.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `gameCode` | String | Unique game identifier |
| `field` | Array | Initial field from server |
| `settings` | Object | Game settings from server |
| `gameState` | Object | Initial game state |
| `getAppState` | Function | Get parent app state |

### Data (Component-Specific)

```javascript
{
  // From mixin: STATES, cellSize

  // Local copies (for reactivity)
  localField: [],
  localSettings: null,

  // Player state
  players: [],
  currentPlayer: 0,
  currentUserId: null,
  myPlayerOrder: null,

  // Network
  gameWs: null,  // WebSocket instance
  clientSeq: 0,  // Move sequence counter
  reconnectAttempts: 0,

  // UI
  notifications: [],
  showEndTurnTip: false,
  showReadyLabel: true,

  // Game outcome
  winner: null,
  winnerUsername: null,

  // Visibility
  scoutRevealedCoords: Set,
}
```

### Computed

| Property | Description |
|----------|-------------|
| `isMyTurn` | True if `myPlayerOrder === currentPlayer` |

### Methods (Component-Specific)

| Method | Purpose |
|--------|---------|
| `connectGameWebSocket()` | Establish WebSocket connection |
| `sendMoveToServer(payload)` | Send move with clientSeq |
| `initializeFromServerState(state)` | Apply full state from server |
| `applyStatePatch(patch)` | Apply incremental update |
| `recalculateVisibilityForClient()` | Rebuild visibility after turn change |
| `showNotification(msg, type)` | Display toast notification |

### WebSocket Callbacks

| Callback | Trigger |
|----------|---------|
| `onJoined` | Connection established |
| `onStateUpdate` | Server sends state patch |
| `onReconnected` | Successful reconnection |
| `onPlayerDisconnected` | Other player disconnected |
| `onPlayerReconnected` | Other player reconnected |

---

## Shared Logic (gameCoreMixin)

Both components use `gameCoreMixin` which provides:

### Data
- `STATES` - State machine constants
- `cellSize` - Grid cell size in pixels

### Methods
- `getCurrentStats()` - Calculate units/towers stats
- `getCurrentUnitCoords()` - Get movable unit positions
- `findNextUnit()` - Select next unit
- `changeCellSize(delta)` - Zoom in/out
- `doesVisibilityMakeSense()` - Check if FOW applies
- `addVisibilityForCoords(x, y, r)` - Reveal area
- `setVisibilityForArea(x, y, r)` - Recalculate area visibility
- `exitGame()` - Exit to menu

### Abstraction Helpers
- `_getField()` - Returns `localField` or `field`
- `_getSettings()` - Returns `localSettings` or `settings` or `this`

---

## Child Components

### GameGrid.vue
Renders the game board as a grid of cells.

**Props:** `field`, `currentPlayer`, `cellSize`, `enableFogOfWar`, `currentStats`

### GameCell.vue
Renders individual cell with unit/building.

**Events:** Emits `moveUnit` on click

### InfoPanel.vue
Bottom HUD showing stats and controls.

**Props:** `currentStats`, `handleEndTurnBtnClick`, `handleUnitClick`

### ReadyLabel.vue / MultiplayerReadyLabel.vue
Turn transition overlay.

### VisibilityFrame.vue
Displays unit visibility radius as a colored frame overlay.

**Props:** `x`, `y`, `radius`, `cellSize`, `playerIndex`, `fieldWidth`, `fieldHeight`

**Behavior:**
- Shows when a unit is selected or right-clicked
- Frame color matches player color (blue for P1, mint for P2, etc.)
- Border width scales with zoom (1px at min, 3px at default, 7px at max)
- Clips to map boundaries

---

## Event Flow Example

```
User clicks enemy cell
        │
        ▼
GameCell emits 'moveUnit' event
        │
        ▼
DinoGame/MultiplayerDinoGame receives event
        │
        ├──── [Single-player] ────┐
        │                         ▼
        │                   moveUnit()
        │                   fieldEngine.moveUnit()
        │                   Update local state
        │                         │
        ├──── [Multiplayer] ──────┤
        │                         ▼
        │                   sendMoveToServer()
        │                   Wait for server response
        │                   applyStatePatch()
        │                         │
        ▼                         ▼
   Vue reactivity updates UI
```
