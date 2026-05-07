# Game Engines

## Overview

Game logic is extracted into "engine" classes that operate on game data structures. This separation allows:
- Unit testing without Vue
- Reuse between single-player and multiplayer
- Clear separation of concerns

| Engine | File | Purpose |
|--------|------|---------|
| FieldEngine | `fieldEngine.js` | Field operations, visibility, production |
| WaveEngine | `waveEngine.js` | Pathfinding (BFS) |
| BotEngine | `botEngine.js` | AI decision logic |
| CreateFieldEngine | `createFieldEngine.js` | Field generation |

---

## FieldEngine

**Location:** `frontend/src/game/fieldEngine.js`

### Purpose
Core game operations: unit movement, building capture, fog of war, unit production.

### Constructor

```javascript
new FieldEngine(
  field,           // 2D array of cells
  width,           // Field width
  height,          // Field height
  fogOfWarRadius,  // Base visibility radius
  players,         // Player array
  minSpeed,        // Min unit speed
  maxSpeed,        // Max unit speed
  speedMinVisibility,  // Visibility at min speed
  maxUnitsNum,     // Max units limit
  maxBasesNum,     // Max bases limit
  unitModifier,    // Habitation bonus
  baseModifier,    // Storage bonus
  killAtBirth,     // Kill units if over limit
  visibilitySpeedRelation,  // Link speed to visibility
)
```

### Key Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `restoreAndProduceUnits(player)` | player index | `{buildingsNum, unitsNum, producedNum}` | Reset movement, spawn units at bases |
| `moveUnit(from, to)` | coord arrays | void | Move unit, handle capture |
| `killNeighbours(x, y, player)` | coords, player | void | Kill adjacent enemy units |
| `captureBuilding(x, y, player)` | coords, player | boolean | Capture building for player |
| `getVisibleObjRadius(x, y, player, ...)` | coords, player | number | Get visibility radius of object |
| `areAllUnitsOnBuildings(player)` | player index | boolean | Check if all units are on buildings |

### Visibility System

The engine tracks what each player can see:

```javascript
// Reveal cells in radius
for (x in range) {
  for (y in range) {
    field[x][y].isHidden = false
  }
}
```

Visibility is recalculated:
- At turn start (full recalculation)
- After unit moves (local recalculation)
- After scouting action (add visibility)

---

## WaveEngine

**Location:** `frontend/src/game/waveEngine.js`

### Purpose
Pathfinding using BFS (Breadth-First Search) wave algorithm. Calculates reachable cells and paths.

### Constructor

```javascript
new WaveEngine(
  field,           // 2D array of cells
  width,           // Field width
  height,          // Field height
  fogOfWarRadius,  // Visibility radius
  enableScoutMode, // Enable obelisk scouting
)
```

### Key Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getReachableCoords(x, y, speed)` | start coords, movement points | `[[x,y], ...]` | Get all cells unit can reach |
| `isReachable(x0, y0, x1, y1, speed)` | start, end, movement | boolean | Check if destination is reachable |
| `getPath(x0, y0, x1, y1, movePoints)` | start, end coords, movement | `[[x,y], ...]` or `null` | Cell-by-cell path including both endpoints; `null` when unreachable. Used by the move animator. |

### Algorithm

```
Wave propagation (BFS):
1. Start at unit position with full movement points
2. Add adjacent cells to queue (cost = 1)
3. For each cell, propagate to neighbors if movement remaining
4. Mark cells as reachable when visited
5. Stop when queue empty or all cells processed
```

### Terrain Handling

- **Empty cells:** Cost = 1 movement point
- **Mountains:** Impassable (blocked)
- **Occupied cells:** Passable but can't stop (unless enemy)

---

## Move Animator

**Location:** `frontend/src/game/moveAnimator.js`

### Purpose
Plays the cell-by-cell unit walk along a pre-computed path. Pure (DOM-free), so it works the same in single-player (animates own and bot moves locally) and multiplayer (animates the per-recipient `pathSlice` from server patches).

### API

```javascript
animateMovePath(field, path, unit, opts)
// opts.delay        — ms between visible steps (default MOVE_ANIMATION_DELAY = 100)
// opts.isVisible    — predicate; if false for both endpoints of a step, the sleep is skipped
// opts.isCancelled  — abort gate (component unmount, end-of-game)
```

The animator only handles the visual walk. Capture/kill/visibility recompute and undo-diff stay in the controller (`DinoGame.vue` / `MultiplayerDinoGame.vue`) and run after `await animateMovePath(...)` resolves.

### Multiplayer wire format

`apply_move_txn` attaches the full BFS `path` plus the `movingUnit` to the patch. The consumer's `_filter_patch_for_player` slices `path` against the recipient's visibility set and renames it to `pathSlice` (the move-maker keeps the full path; opponents get only visible cells). If `len(pathSlice) < 2`, both `pathSlice` and `movingUnit` are dropped.

---

## BotEngine

**Location:** `frontend/src/game/botEngine.js`

### Purpose
AI decision-making for bot players. Evaluates moves and selects optimal actions.

### Constructor

```javascript
new BotEngine(
  field,           // 2D array of cells
  width,           // Field width
  height,          // Field height
  enableFogOfWar,  // Whether FOW affects bot
  fieldEngine,     // FieldEngine instance
  waveEngine,      // WaveEngine instance
)
```

### Key Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `makeBotUnitMove(unitCoords, player, moveCallback)` | coords array, player, callback | void | Move one bot unit |
| `evaluateMove(from, to, player)` | coords, player | number | Score a potential move |

### AI Strategy

```
For each unit:
1. Get reachable coordinates
2. Score each destination:
   - Can capture enemy unit? +high
   - Can capture building? +medium
   - Move toward enemy base? +low
   - Stay safe? +low
3. Select highest-scoring move
4. Call moveCallback(from, to)
```

### Bot Behavior Priorities

1. **Kill enemy units** - Eliminate threats
2. **Capture buildings** - Especially bases
3. **Advance toward enemies** - Apply pressure
4. **Avoid danger** - Don't suicide

---

## CreateFieldEngine

**Location:** `frontend/src/game/createFieldEngine.js`

### Purpose
Generate randomized game fields with fair player starting positions.

### Constructor

```javascript
new CreateFieldEngine(
  playersNum,      // Number of players
  width,           // Field width
  height,          // Field height
  sectorsNum,      // Number of map sectors
  minSpeed,        // Min unit speed
  maxSpeed,        // Max unit speed
  speedMinVisibility,  // Visibility at min speed
  fogOfWarRadius,  // Base visibility
  visibilitySpeedRelation,  // Link speed to visibility
  buildingRates,   // Building spawn rates
)
```

### Key Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `generateField()` | none | 2D Cell array | Generate complete field |
| `placePlayers(field)` | field | void | Place starting bases and units |
| `placeBuildings(field)` | field | void | Randomly place buildings |
| `placeTerrain(field)` | field | void | Add mountains and obstacles |

### Generation Algorithm

```
1. Create empty field grid with random mountains
2. Divide into sectors (for player placement)
3. Place player starting bases (one per sector edge)
4. Place initial units at bases
5. Randomly place neutral buildings (on empty cells)
6. Validate all players AND buildings are reachable
7. Remove mountains as needed to create paths
```

**Reachability Guarantee:** The algorithm ensures all buildings (player bases and neutral buildings) are reachable from any player's starting position. Mountains are automatically removed to create paths if needed. This uses a BFS wave algorithm that counts mountains to cross, then removes the minimum necessary to connect all targets.

> **Note:** The backend (`backend/game/services/field.py`) uses the same algorithm for multiplayer field generation, ensuring consistent behavior between single-player and multiplayer games.

### Building Distribution

```javascript
buildingRates = {
  HABITATION: 0.05,  // 5% chance per cell
  TEMPLE: 0.03,
  WELL: 0.02,
  STORAGE: 0.02,
  OBELISK: 0.01,
}
```

---

## Data Models

**Location:** `frontend/src/game/models.js`

### Unit

```javascript
{
  player: 0,           // Owner player index
  speed: 3,            // Movement points
  visibility: 2,       // Sight radius
  hasMoved: false,     // Moved this turn?
}
```

### Building

```javascript
{
  _type: BuildingTypes.BASE,  // Type enum
  player: 0,           // Owner (null = neutral)
}
```

### Cell

```javascript
{
  terrain: TerrainTypes.EMPTY,  // or MOUNTAIN
  building: Building | null,
  unit: Unit | null,
  isHidden: true,      // Fog of war state
}
```

### Player

```javascript
{
  _type: PlayerTypes.HUMAN,  // or BOT
  active: true,         // Still in game?
  score: 0,
  killed: 0,
  lost: 0,
}
```

---

## Usage Example

```javascript
// In Vue component
import { FieldEngine } from '@/game/fieldEngine'
import { WaveEngine } from '@/game/waveEngine'
import { BotEngine } from '@/game/botEngine'

// Create engines
this.fieldEngine = new FieldEngine(field, width, height, ...)
this.waveEngine = new WaveEngine(field, width, height, ...)
this.botEngine = new BotEngine(field, width, height, ..., fieldEngine, waveEngine)

// Use in game loop
startTurn() {
  this.fieldEngine.restoreAndProduceUnits(this.currentPlayer)
}

moveUnit(from, to) {
  this.fieldEngine.moveUnit(from, to)
  this.fieldEngine.killNeighbours(to[0], to[1], player)
}

makeBotTurn() {
  while (unitsRemain) {
    this.botEngine.makeBotUnitMove(units, player, this.moveUnit)
  }
}
```

---

## Field Diff Utilities

**Location:** `frontend/src/game/fieldDiff.js`

### Purpose

Utility functions for computing and applying field state diffs. Used by the undo system to efficiently store and restore field state changes.

### Functions

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `computeFieldDiff(oldField, newField, width, height)` | two fields, dimensions | Array of `{x, y, cell}` | Compares fields, returns changed cells with original values |
| `applyFieldDiff(field, diff)` | field, diff array | void | Restores cells from diff to field (in-place) |

### Usage Example

```javascript
import { computeFieldDiff, applyFieldDiff } from '@/game/fieldDiff'

// Before making a move, snapshot the field
const fieldBefore = structuredClone(this.localField)

// Apply move (modifies this.localField)
this.fieldEngine.moveUnit(x0, y0, x1, y1, unit)

// Compute what changed (stores original cell states)
const diff = computeFieldDiff(fieldBefore, this.localField, width, height)

// Later, to undo:
applyFieldDiff(this.localField, diff)  // Restores original cells
```

### Diff Format

Each diff entry contains the original cell state:
```javascript
[
  { x: 0, y: 0, cell: { unit: {...}, building: null, ... } },  // Source cell
  { x: 1, y: 0, cell: { unit: null, building: null, ... } },   // Destination cell
  { x: 1, y: 1, cell: { unit: {...}, building: null, ... } },  // Killed enemy cell
]
```

### Notes

- Only compares `unit` and `building` properties (ignores `isHidden` for visibility)
- Mirrored on the backend at `backend/game/services/field_diff.py` — same algorithm in Python, used by `apply_move_txn` to persist the diff for server-authoritative undo in multiplayer
- Scout undo does **not** use field diffs (scout doesn't modify the field). It tracks revealed coords directly in `scoutUndoState.revealedCoords` (single-player) or `Game.undo_state["scout"]["coords"]` (multiplayer) and re-hides those cells on undo.
- Typical diff size: 2-6 cells per move
- Backend equivalent: `backend/game/services/field_diff.py`
