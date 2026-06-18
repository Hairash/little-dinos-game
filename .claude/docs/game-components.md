# Game Components

## Overview

The game has two main controller components that manage game state and logic:

| Component | Purpose | Uses Mixin |
|-----------|---------|------------|
| `DinoGame.vue` | Single-player game and tutorial mode | `gameCoreMixin` |
| `MultiplayerDinoGame.vue` | Multiplayer game | `gameCoreMixin` |

Both components use `gameCoreMixin` for shared logic.

Tutorial scenarios reuse `DinoGame.vue` (with a `tutorialScenario`
prop) and mount a child `TutorialController` from
`components/tutorial/`. See [`tutorial.md`](./tutorial.md) for the
full tutorial subsystem.

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
| `tutorialScenario` | Object \| null | Tutorial scenario object (see `tutorial.md`). When set, swaps in scripted field/players, mounts `TutorialController`, and toggles a number of tutorial-only behavioural guards. |

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

  // Undo system — two independent stacked layers (at most one is set at a time):
  //   moveUndoState   — present after a move; cleared by undo or by picking a scout target
  //   scoutUndoState  — present after picking a scout target; commits the move
  // The undo button reverts whichever layer is set; scout takes priority by construction.
  moveUndoState: null,   // { diff: [...], canUndo: boolean }
  scoutUndoState: null,  // { revealedCoords: [[x,y], ...], canUndo: boolean }

  // Visibility
  tempVisibilityCoords: Set,

  // Tutorial-only state is provided by `tutorialMixin`:
  //   tutorialInputBlocked / tutorialEndTurnBlocked / tutorialUndoBlocked
  //     — independent lock gates (cells+Next-unit / End-turn+'e' /
  //       Undo+middle-mouse), managed via the matching
  //       `tutorial:*BlockChanged` emitter events
  //   tutorialFirstProductionDone — latch for the first-batch
  //     `firstProducedSpeed` / `firstProducedSpeedForbidden` override
}
```

### Computed

| Property | Description |
|----------|-------------|
| `canUndo` | True if undo is allowed: not a bot turn, game still in progress (winPhase/humanPhase=progress), and either scoutUndoState.canUndo or moveUndoState.canUndo is true. Scout layer is consulted first. |

### Methods (Component-Specific)

| Method | Purpose |
|--------|---------|
| `startTurn()` | Restore units, produce new units, set visibility, show turn notification |
| `processEndTurn()` | End turn, check win conditions, advance to next player |
| `moveUnit(from, to)` | Execute unit movement with combat and capture |
| `makeBotMove()` | Execute AI turn |
| `checkEndOfGame()` | Check victory conditions |
| `saveState()` | Save to localStorage |
| `undoLastMove()` | Undo whichever layer is set: scoutUndoState re-hides the revealed cells and re-emits `setAction(scouting)` to re-arm scout-pick mode; moveUndoState applies the field diff and recalculates visibility. Always emits `initTurn` first to deselect the unit. |
| `handleScoutArea(data)` | Apply scout reveal AND set `scoutUndoState`; drops `moveUndoState` (picking a scout target commits the move) |
| `showTurnNotification(playerOrder)` | Display "Player {n} turn" notification with player color |
| `showNotification(message, type, playerOrder)` | Add notification to display queue |
| `dismissNotification(id)` | Remove notification by ID |

### Engines Used

- `CreateFieldEngine` - Generate initial field
- `WaveEngine` - Pathfinding
- `FieldEngine` - Game operations
- `BotEngine` - AI logic

### Tutorial Mode

`DinoGame` opts in via `mixins: [gameCoreMixin, tutorialMixin]`.
`tutorialMixin.js` owns the lock-state data flags, the
`tutorial:*BlockChanged` subscriptions, the
`isAnimating → tutorial:animatingChanged` watcher, the first-batch
production override, and the `getTutorialContext()` helper. Inline
guards left in `DinoGame.vue` are marked with `// [tutorial]`
comments so they're easy to find.

When the `tutorialScenario` prop is non-null:

- `loadFieldOrGenerateNewField` calls `scenario.buildField()` instead
  of generating a random field.
- `loadOrCreatePlayers` calls `scenario.buildPlayers()` instead of
  `createPlayers(...)`.
- `FieldEngine` receives the scenario's `playerOverrides` via
  `setPlayerOverrides(...)` (per-player `minSpeed` / `maxSpeed` /
  `maxUnitsNum` / `maxBasesNum`).
- `saveState` is a no-op (tutorial sessions never touch localStorage).
- `checkEndOfGame` skips the elimination check unless
  `scenario.useEliminationWin === true`, and never sets
  `state = STATES.ready`. Still emits `tutorial:gameWon`.
- `checkSkipReadyLabel` always returns true (no "get ready" / "Player
  N wins" overlay during a scenario).
- `selectNextPlayerAndCheckPhases` skips the `lastPlayerPhase`
  trigger so the "only player left" notice can't fire mid-scenario.
- `startTurn` skips the scroll-restore to `scrollCoords` when births
  ran, so the camera stays parked on the last birth.
- `processEndTurn`, the `'e'` shortcut, and `undoLastMove` short-
  circuit on `tutorialEndTurnBlocked` / `tutorialUndoBlocked`.
- `exitGame` routes to `GAME_STATES.tutorial` (back to the scenario
  list) instead of `window.location.reload()`.
- `applyTutorialFirstProductionOverride(births)` runs after the first
  production batch and honours `firstProducedSpeed` (force a value
  and recompute visibility under `visibilitySpeedRelation`) or
  `firstProducedSpeedForbidden` (re-roll if matched).

`DinoGame` also emits the tutorial event surface
(`tutorial:moveFinished`, `tutorial:turnEnded`, `tutorial:turnStarted`
**after** production, `tutorial:towerCaptured`, `tutorial:undone`,
`tutorial:unitKilled` for move-kills and birth-kills, `tutorial:gameWon`,
`tutorial:animatingChanged`) and subscribes to the three lock-state
events `tutorial:inputBlockChanged` / `tutorial:endTurnBlockChanged` /
`tutorial:undoBlockChanged`. Subscriptions are registered in
`created()` (not `mounted()`) so the initial emissions from the child
controller's `immediate: true` watchers aren't lost.

See [`tutorial.md`](./tutorial.md) for the full event table and the
scenario / step schema.

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

  // Undo state — single flag pushed by the server. The server picks priority
  // (scout layer first, else move) and sends the right value in each patch.
  canUndo: false,
}
```

### Computed

| Property | Description |
|----------|-------------|
| `isMyTurn` | True if `myPlayerOrder === currentPlayer` |

The undo button binding combines this with turn ownership and end-of-game gating:
`canUndo && isMyTurn && winner === null`. The `undoLastMove()` method enforces the
same triple-gate before sending an `undo` message to the server.

### Methods (Component-Specific)

| Method | Purpose |
|--------|---------|
| `connectGameWebSocket()` | Establish WebSocket connection |
| `sendMoveToServer(payload)` | Send move with clientSeq |
| `initializeFromServerState(state)` | Apply full state from server, show initial turn notification |
| `applyStatePatch(patch)` | Apply incremental update, show turn notification on turn change |
| `recalculateVisibilityForClient()` | Rebuild visibility after turn change |
| `undoLastMove()` | Send `{type: "undo"}` to server. Server's response carries either an updated `field` (move-undo) or `unrevealedCoords` + `reenterScoutMode: true` (scout-undo); `applyStatePatch` handles both. Scout-undo patches are sent only to the initiating player — opponents see nothing. |
| `showNotification(msg, type, playerOrder)` | Display toast notification (types: disconnect, reconnect, turn) |
| `showTurnNotification(playerOrder)` | Display "{playerName} turn" notification with player color |
| `dismissNotification(id)` | Remove notification by ID |
| `getPlayerNameByOrder(order)` | Get player username from stored playersData |

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

## Tutorial Components

Live in `frontend/src/components/tutorial/`. See [`tutorial.md`](./tutorial.md)
for the full subsystem.

### TutorialPage.vue
Scenario-list screen. Reads `loadCompletedScenarios()` and shows a ✓
on each completed scenario. Clicking a scenario emits
`startTutorialScenario` with its id; `App.vue` resolves it and switches
to `GAME_STATES.tutorialGame`.

### TutorialController.vue
Mounted as a child of `DinoGame` when `tutorialScenario` is set. Owns
the `stepIndex` cursor and three lock-state computeds
(`inputBlocked`, `endTurnBlocked`, `undoBlocked`) that emit
`tutorial:inputBlockChanged` / `tutorial:endTurnBlockChanged` /
`tutorial:undoBlockChanged` to `DinoGame`. Subscribes to the tutorial
event surface, advances steps, runs `resolveSkipIf` on entry, and
renders `TutorialHint`. Owns the end-of-scenario completion overlay
(`Next scenario` / `Back to tutorial menu` buttons).

### TutorialHint.vue
The on-screen hint. Renders text + optional `note` + optional `image`
(resolved via `getImagePath`) + either an OK button or pulsing dots.
Anchor types: `center`, `top|bottom`, the four corners,
`near-{end-turn,undo,next-unit,menu}`, plus `anchorCell: [x, y]`
which looks up the rendered `GameCell` by its `data-cell-x` /
`data-cell-y` attributes and tracks scroll/resize. Click-to-shift
(when `note` is set) flips the hint to the opposite screen edge so
the player can push it out of the way.

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
