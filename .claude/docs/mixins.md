# Vue Mixins

## Overview

Mixins extract shared Vue component logic that can be reused across multiple components. This project uses mixins (Options API pattern) rather than composables (Composition API) to match the existing code style.

---

## gameCoreMixin

**Location:** `frontend/src/game/mixins/gameCoreMixin.js`

### Purpose

Shared logic between `DinoGame.vue` (single-player) and `MultiplayerDinoGame.vue`. Eliminates code duplication for common functionality.

### Usage

```javascript
import { gameCoreMixin } from '@/game/mixins/gameCoreMixin'

export default {
  name: 'DinoGame',
  mixins: [gameCoreMixin],

  // Component-specific code
  data() { ... },
  methods: { ... },
}
```

### What the Mixin Provides

#### Data Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `STATES` | Object | `{ready, play, exitDialog}` | State machine constants |
| `cellSize` | Number | `30` | Grid cell size in pixels |

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `_getField()` | - | Array | Get field (handles localField vs field) |
| `_getSettings()` | - | Object | Get settings (handles different sources) |
| `getCurrentStats()` | - | Object | Calculate units/towers statistics |
| `getCurrentUnitCoords(playerNum)` | player index | Array | Get movable unit coordinates |
| `findNextUnit()` | - | void | Emit event to select next unit |
| `changeCellSize(delta)` | number | void | Zoom in/out (10-70px range) |
| `doesVisibilityMakeSense()` | - | boolean | Check if FOW should apply |
| `addVisibilityForCoords(x, y, r)` | coords, radius | void | Reveal cells in radius |
| `setVisibilityForArea(x, y, r)` | coords, radius | void | Recalculate area visibility |
| `exitGame()` | - | void | Exit game (reload or disconnect) |

### Stats Object Structure

```javascript
getCurrentStats() returns:
{
  units: {
    active: 3,      // Units that haven't moved
    total: 5,       // All units owned
    max: 8,         // Maximum allowed (with modifiers)
    coordsArr: [[x,y], ...],  // Coordinates of active units
  },
  towers: {
    total: 2,       // Bases owned
    max: 3,         // Maximum allowed (with modifiers)
    empty: 1,       // Bases without units (will produce)
  },
}
```

### Abstraction Pattern

The mixin handles differences between single-player and multiplayer:

```javascript
// Single-player uses:
this.field          // Direct field reference
this.maxUnitsNum    // Direct prop

// Multiplayer uses:
this.localField     // Copy of server field
this.localSettings  // Copy of server settings

// Mixin abstracts this:
_getField() {
  return this.localField || this.field
}

_getSettings() {
  return this.localSettings || this.settings || this
}
```

### Unit Priority Logic

`getCurrentStats()` and `getCurrentUnitCoords()` return units in priority order:

1. **First:** Units NOT on special buildings (should move)
2. **Last:** Units on own bases, neutral bases, or obelisks (can stay)

This helps the UI suggest which unit to move next.

```javascript
// Excluded from priority (can stay in place)
const isOnExcludedBuilding = building && (
  (building._type === BASE && building.player === currentPlayer) ||
  (building._type === BASE && building.player === null) ||
  building._type === OBELISK
)
```

---

## What Stays in Components

### DinoGame.vue Keeps

- `WIN_PHASES`, `HUMAN_PHASES`, `LAST_PLAYER_PHASES` - Single-player phase tracking
- `prevField`, `prevPlayer` - Undo system
- `tempVisibilityCoords` - Obelisk visibility tracking
- `startTurn()`, `processEndTurn()` - Turn lifecycle (uses FieldEngine)
- `moveUnit()` - Movement with combat (uses FieldEngine)
- `makeBotMove()` - AI turns (uses BotEngine)
- `checkEndOfGame()` - Victory conditions
- `saveState()`, `loadFieldOrGenerateNewField()` - localStorage persistence
- `restoreField()` - Undo functionality

### MultiplayerDinoGame.vue Keeps

- `gameWs`, `clientSeq` - WebSocket state
- `localField`, `localSettings` - Server state copies
- `myPlayerOrder`, `currentUserId` - Player identification
- `notifications` - Toast messages
- `scoutRevealedCoords` - Scout visibility tracking
- `connectGameWebSocket()` - WebSocket setup
- `sendMoveToServer()` - Network communication
- `initializeFromServerState()`, `applyStatePatch()` - Server sync
- `recalculateVisibilityForClient()` - Client-side FOW

---

## Mixin Merge Behavior

Vue merges mixin properties with component properties:

```javascript
// Mixin
data() { return { cellSize: 30 } }

// Component
data() { return { cellSize: 40 } }  // Overrides mixin!

// Result: cellSize = 40
```

**Important:** Component properties override mixin properties with same name.

### Lifecycle Hook Merging

Both mixin and component hooks are called:

```javascript
// Mixin
mounted() { console.log('mixin mounted') }

// Component
mounted() { console.log('component mounted') }

// Result: Both are called (mixin first, then component)
```

---

## Extending the Mixin

To add shared functionality:

1. Edit `gameCoreMixin.js`
2. Add to `data()` or `methods`
3. Both components automatically get the new functionality

```javascript
// Adding a new shared method
methods: {
  // Existing methods...

  newSharedMethod() {
    // Available in both DinoGame and MultiplayerDinoGame
  },
}
```

---

## Testing Mixins

```javascript
import { mount } from '@vue/test-utils'
import { gameCoreMixin } from '@/game/mixins/gameCoreMixin'

// Create test component that uses mixin
const TestComponent = {
  mixins: [gameCoreMixin],
  template: '<div>{{ cellSize }}</div>',
  data() {
    return {
      field: [[{unit: null, building: null}]],
      currentPlayer: 0,
      width: 1,
      height: 1,
    }
  },
}

test('changeCellSize works', () => {
  const wrapper = mount(TestComponent)
  expect(wrapper.vm.cellSize).toBe(30)

  wrapper.vm.changeCellSize(10)
  expect(wrapper.vm.cellSize).toBe(40)

  wrapper.vm.changeCellSize(-50)
  expect(wrapper.vm.cellSize).toBe(10)  // Min is 10
})
```
