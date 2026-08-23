# Plan: Fix Load Game Prop Validator Warnings

Created: 2026-01-30
Status: Implemented
Completed: 2026-01-30

## Overview

Fix Vue prop validator warnings that occur when loading a saved game from localStorage. The warnings appear because `JSON.parse()` returns plain objects that don't pass `instanceof` checks in `GameCell.vue` prop validators.

## Requirements

- Eliminate all Vue validator warnings when loading a saved game
- Properly reconstruct `Building`, `Unit`, `Cell`, and `Player` class instances from serialized JSON data
- Maintain backward compatibility with existing saved games
- Ensure all game functionality works correctly after loading

## Analysis

### Root Cause

When a game is saved:
1. Objects are spread (`{ ...cell }`) losing their prototype chain
2. `JSON.stringify()` converts them to JSON strings (prototypes are lost)
3. Data is stored in `localStorage`

When loading:
1. `JSON.parse()` returns plain objects with copied properties but NO class prototypes
2. These plain objects are passed to `GameCell.vue`
3. Prop validators use `instanceof Models.Building` and `instanceof Models.Unit`
4. Validation fails because plain objects are not instances of those classes

### Affected Files

| File | Changes Required |
|------|------------------|
| `frontend/src/game/models.js` | Add static `fromJSON()` factory methods to `Building`, `Unit`, `Cell`, and `Player` classes |
| `frontend/src/components/game/DinoGame.vue` | Add reconstruction logic in `loadFieldOrGenerateNewField()` and `loadOrCreatePlayers()` |

### Dependencies

- `frontend/src/game/models.js` - Class definitions
- `frontend/src/game/const.js` - `FIELDS_TO_SAVE` constant

### Risks/Considerations

1. **Backward Compatibility**: Existing saved games may have slightly different data structures. The `fromJSON()` methods should handle missing/extra properties gracefully.
2. **Deep Object Reconstruction**: `Cell` contains `Unit` and `Building` which need to be reconstructed recursively.
3. **Player References**: Units and buildings have `player` property that may need to reference actual Player instances for proper equality checks.

## Implementation Steps

### Step 1: Add `fromJSON()` Factory Methods to Models

**Files**: `frontend/src/game/models.js`

**Description**: Add static factory methods to reconstruct class instances from plain objects.

**Code Changes**:

1. Add `fromJSON()` to `Building` class:
```javascript
static fromJSON(obj) {
  if (!obj) return null;
  return new Building(obj.player, obj._type);
}
```

2. Add `fromJSON()` to `Unit` class:
```javascript
static fromJSON(obj) {
  if (!obj) return null;
  const unit = new Unit(obj.player, obj._type, obj.movePoints, obj.visibility);
  unit.hasMoved = obj.hasMoved ?? false;
  return unit;
}
```

3. Add `fromJSON()` to `Cell` class:
```javascript
static fromJSON(obj) {
  if (!obj) return null;
  const cell = new Cell(obj.terrain);
  cell.building = Building.fromJSON(obj.building);
  cell.unit = Unit.fromJSON(obj.unit);
  cell.isHidden = obj.isHidden ?? true;
  return cell;
}
```

4. Add `fromJSON()` to `Player` class:
```javascript
static fromJSON(obj) {
  if (!obj) return null;
  const player = new Player(obj.name, obj.id, obj.isBot, obj.isActive);
  player.gameStatus = obj.gameStatus ?? 'playing';
  return player;
}
```

### Step 2: Update Field Loading in DinoGame.vue

**Files**: `frontend/src/components/game/DinoGame.vue`

**Description**: Reconstruct Cell instances (with nested Building/Unit) when loading from localStorage.

**Location**: `loadFieldOrGenerateNewField()` method (around line 534-595)

**Code Changes**:

Replace direct assignment of parsed JSON with proper reconstruction:

```javascript
// Before (current code around line 548):
if (parsedField && Array.isArray(parsedField) && parsedField.length > 0) {
  this.field = parsedField;
}

// After:
if (parsedField && Array.isArray(parsedField) && parsedField.length > 0) {
  this.field = parsedField.map(row =>
    row.map(cellData => Models.Cell.fromJSON(cellData))
  );
}
```

### Step 3: Update Players Loading in DinoGame.vue

**Files**: `frontend/src/components/game/DinoGame.vue`

**Description**: Reconstruct Player instances when loading from localStorage.

**Location**: `loadOrCreatePlayers()` method

**Code Changes**:

Find the code that loads players from localStorage and ensure they are reconstructed:

```javascript
// When loading players from localStorage, reconstruct them:
const parsedPlayers = JSON.parse(localStorage.getItem('players'));
if (parsedPlayers && Array.isArray(parsedPlayers)) {
  this.players = parsedPlayers.map(p => Models.Player.fromJSON(p));
}
```

### Step 4: Write Tests

**Files**: `frontend/tests/models.spec.js` or new file `frontend/tests/serialization.spec.js`

**Description**: Test cases for the new `fromJSON()` factory methods.

**Tests**:
- Test `Building.fromJSON()` correctly creates Building instance
- Test `Unit.fromJSON()` correctly creates Unit instance with all properties
- Test `Cell.fromJSON()` correctly creates Cell with nested Building and Unit
- Test `Player.fromJSON()` correctly creates Player instance
- Test `fromJSON()` methods handle `null` input gracefully
- Test round-trip: create instance → serialize → deserialize → validate

### Step 5: Final Verification

**Commands**:
```bash
cd frontend && npm run lint
cd frontend && npm run test
```

**Manual Tests**:
1. Start a new game with bots
2. Play a few turns (move units, capture buildings)
3. Save the game
4. Reload the page
5. Load the saved game
6. Verify NO Vue warnings appear in console
7. Verify game state is correctly restored (units, buildings, player turns)
8. Continue playing to ensure game mechanics work correctly

## Questions/Notes

- The `player` property in `Unit` and `Building` is stored as a number (player ID). This should work correctly as long as the prop validators only check for `instanceof` and don't do deep player object comparisons.
- Consider whether to add a version field to saved game data for future migrations.
