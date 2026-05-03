# Plan: Undo Move Button

Created: 2026-01-31
Updated: 2026-05-03
Status: Reviewed

## Overview

Add an undo button to the info panel that allows players to revert their last unit move. The undo is conditional - it can only be performed if the move didn't reveal any new cells (fog of war). This feature works in both single-player (local) and multiplayer (network) modes.

## Requirements

From user specification:
- Button placed in InfoPanel, left side, immediately after the menu button
- Undo only the last unit move (single move, not full history)
- Conditional undo based on revealed information:
  - If fog of war is disabled: always allow undo
  - If fog of war is enabled: only allow undo if no new cells were revealed
  - Move with scout action from obelisk: only allow undo if scouting revealed no new cells. In this case the move itself (to the obelisk cell) should be undone
- Button disabled states:
  - Immediately after performing an undo (can't undo twice in a row)
  - When last move revealed new area
  - When no move has been made yet this turn
- Works in both single-player (DinoGame) and multiplayer (MultiplayerDinoGame)

## Analysis

### Existing Undo Code Found

1. **GameSetup.vue** (lines 237-239): Commented out `enableUndo` checkbox setting
2. **DinoGame.vue** (lines 161, 607-627):
   - `prevField` and `prevPlayer` data properties exist
   - `restoreField()` method exists but has issues (lines 607-621)
   - `storeStateIfNeeded()` method exists (lines 622-627)
   - Middle-click handler for undo (lines 234-239) - but is broken

### Current Problems with Existing Undo

1. The `restoreField()` method directly copies units/buildings without proper handling
2. No tracking of whether new cells were revealed
3. Only works with middle-click, no UI button
4. Not integrated with multiplayer at all
5. No proper disabling logic after undo

### Key Architecture Decisions

1. **Client-side vs Server-side undo for multiplayer:**
   - For multiplayer, undo must be server-authoritative
   - Need new WebSocket message type: `undo`
   - Server must track undo diff globally on the Game model (not per-player)

2. **Tracking revealed cells:**
   - Need to compare visibility before and after move
   - Store `prevVisibleCoords` Set before each move
   - After move, compare with new visibility to detect reveals

3. **Storage approach for undo state (DIFF-BASED):**
   - Store only the changed cells, not the full field
   - Create utility functions: `computeFieldDiff(oldField, newField)` and `applyFieldDiff(field, diff)`
   - Diff format: `[{ x, y, cell }, ...]` - array of original cells before the move
   - Typically 2-6 cells per move (source, destination, killed enemies)
   - Much more memory-efficient than full field clone

### Affected Files

**Frontend:**
- `frontend/src/game/fieldDiff.js` - **NEW** - Utility functions for field diff
- `frontend/src/components/game/InfoPanel.vue` - Add undo button UI
- `frontend/src/components/game/DinoGame.vue` - Fix and enhance single-player undo logic
- `frontend/src/components/game/MultiplayerDinoGame.vue` - Add multiplayer undo support

**Backend (for multiplayer):**
- `backend/game/services/field_diff.py` - **NEW** - Utility functions for field diff
- `backend/game/consumers.py` - Handle undo message type
- `backend/game/services/game_logic.py` - Add `apply_undo_txn()` function
- `backend/game/models.py` - Add undo tracking fields to Game model

**Assets:**
- `frontend/public/images/undo_icon.png` - Create curved arrow undo icon

### Dependencies

- InfoPanel already receives `currentPlayer`, `players`, `field`, `fieldEngine` as props
- Visibility calculation available via `fieldEngine.getCurrentVisibilitySet()` in DinoGame
- WebSocket infrastructure already supports new message types

### Risks/Considerations

1. **Race conditions in multiplayer:** Not a concern - the undo button is only enabled after server confirms the move, so sequential processing is guaranteed.

2. **Scout + move combination:** If scout revealed no new cells, undo is allowed and will restore the field to pre-move state. The scout action itself doesn't need special handling since we're restoring changed cells (unit returns to pre-obelisk position).

3. **Building capture:** If move captured a building, undo will restore original owner (handled by diff restoration).

4. **Unit kills:** Undo WILL restore killed enemy units. The diff captures the original state of cells that changed, so restoring brings back killed units. This is the expected behavior.

5. **Performance:** Diff-based storage is very efficient - typically only 2-6 cells per move instead of entire field (400+ cells for 20x20 map).

## Implementation Steps

### Step 1: Create Field Diff Utility Functions (Frontend)

**Files**: `frontend/src/game/fieldDiff.js` (new file)

**Description**: Create utility functions to compute and apply field diffs. These are pure functions that can be easily tested.

**Code:**
```javascript
/**
 * Compute the diff between two field states.
 * Returns an array of cells that changed, storing the ORIGINAL values (from oldField).
 *
 * @param {Array} oldField - Field state before the change
 * @param {Array} newField - Field state after the change
 * @param {number} width - Field width
 * @param {number} height - Field height
 * @returns {Array} Array of { x, y, cell } objects representing original cell states
 */
export function computeFieldDiff(oldField, newField, width, height) {
  const diff = [];

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const oldCell = oldField[x][y];
      const newCell = newField[x][y];

      // Compare cells - check unit and building changes
      if (!cellsEqual(oldCell, newCell)) {
        // Store the original cell (deep clone to preserve state)
        diff.push({
          x,
          y,
          cell: structuredClone(oldCell),
        });
      }
    }
  }

  return diff;
}

/**
 * Check if two cells are equal (same unit, building state).
 * Note: We ignore isHidden as that's visibility, not game state.
 */
function cellsEqual(cellA, cellB) {
  // Compare units
  const unitA = cellA.unit;
  const unitB = cellB.unit;

  if ((unitA === null) !== (unitB === null)) return false;
  if (unitA && unitB) {
    if (unitA.player !== unitB.player) return false;
    if (unitA.movePoints !== unitB.movePoints) return false;
    if (unitA.hasMoved !== unitB.hasMoved) return false;
  }

  // Compare buildings
  const buildingA = cellA.building;
  const buildingB = cellB.building;

  if ((buildingA === null) !== (buildingB === null)) return false;
  if (buildingA && buildingB) {
    if (buildingA.player !== buildingB.player) return false;
    if (buildingA._type !== buildingB._type) return false;
  }

  return true;
}

/**
 * Apply a diff to restore the field to a previous state.
 * Modifies the field in place.
 *
 * @param {Array} field - Current field to modify
 * @param {Array} diff - Array of { x, y, cell } objects to restore
 */
export function applyFieldDiff(field, diff) {
  for (const { x, y, cell } of diff) {
    // Restore the original cell (deep clone to avoid reference issues)
    field[x][y].unit = cell.unit ? structuredClone(cell.unit) : null;
    field[x][y].building = cell.building ? structuredClone(cell.building) : null;
  }
}
```

### Step 2: Create Field Diff Utility Functions (Backend)

**Files**: `backend/game/services/field_diff.py` (new file)

**Description**: Python equivalent of the field diff functions for server-side undo.

**Code:**
```python
import copy


def compute_field_diff(old_field: list, new_field: list, width: int, height: int) -> list:
    """
    Compute the diff between two field states.
    Returns a list of cells that changed, storing the ORIGINAL values (from old_field).

    Args:
        old_field: Field state before the change
        new_field: Field state after the change
        width: Field width
        height: Field height

    Returns:
        List of {"x": x, "y": y, "cell": cell_data} dicts representing original cell states
    """
    diff = []

    for x in range(width):
        for y in range(height):
            old_cell = old_field[x][y]
            new_cell = new_field[x][y]

            if not cells_equal(old_cell, new_cell):
                # Store the original cell (deep copy to preserve state)
                diff.append({
                    "x": x,
                    "y": y,
                    "cell": copy.deepcopy(old_cell),
                })

    return diff


def cells_equal(cell_a: dict, cell_b: dict) -> bool:
    """
    Check if two cells are equal (same unit, building state).
    Note: We ignore isHidden as that's visibility, not game state.
    """
    # Compare units
    unit_a = cell_a.get("unit")
    unit_b = cell_b.get("unit")

    if (unit_a is None) != (unit_b is None):
        return False
    if unit_a and unit_b:
        if unit_a.get("player") != unit_b.get("player"):
            return False
        if unit_a.get("movePoints") != unit_b.get("movePoints"):
            return False
        if unit_a.get("hasMoved") != unit_b.get("hasMoved"):
            return False

    # Compare buildings
    building_a = cell_a.get("building")
    building_b = cell_b.get("building")

    if (building_a is None) != (building_b is None):
        return False
    if building_a and building_b:
        if building_a.get("player") != building_b.get("player"):
            return False
        if building_a.get("_type") != building_b.get("_type"):
            return False

    return True


def apply_field_diff(field: list, diff: list) -> None:
    """
    Apply a diff to restore the field to a previous state.
    Modifies the field in place.

    Args:
        field: Current field to modify
        diff: List of {"x": x, "y": y, "cell": cell_data} dicts to restore
    """
    for item in diff:
        x = item["x"]
        y = item["y"]
        cell = item["cell"]

        # Restore the original cell (deep copy to avoid reference issues)
        field[x][y]["unit"] = copy.deepcopy(cell.get("unit"))
        field[x][y]["building"] = copy.deepcopy(cell.get("building"))
```

### Step 3: Add Undo Button to InfoPanel

**Files**: `frontend/src/components/game/InfoPanel.vue`

**Description**: Add a new undo button between the menu button and the unit stats section.

**Code Changes**:
- Add new prop `canUndo: Boolean` to receive undo availability from parent
- Add new prop `handleUndoClick: Function` to handle undo action
- Add button element with undo icon after menu button (line ~20)
- Style the button consistently with existing buttons
- Button disabled when `!canUndo` or `menuOpen`

**Template addition (after menu button, before spacer):**
```vue
<button
  type="button"
  class="infoBtn undoBtn"
  @click="handleUndoClick"
  @contextmenu.prevent="showContextHelp($event, 'Undo last move')"
  :disabled="!canUndo || menuOpen"
  title="Undo last move"
>
  <img
    class="curPlayerImage"
    :src="getImagePath('undo_icon')"
    style="margin-left: 1px; margin-top: 1px;"
  >
</button>
```

### Step 4: Create Undo Icon

**Files**: `frontend/public/images/undo_icon.png`

**Description**: Create a curved arrow icon typical for undo operations, matching the game's visual style.

**Approach**: Create a curved/circular arrow pointing left/counterclockwise. Should use similar color scheme and line weight as existing icons (settings_icon, arrow, etc.).

### Step 5: Enhance Single-Player Undo Logic (DinoGame.vue)

**Files**: `frontend/src/components/game/DinoGame.vue`

**Description**: Refactor the existing broken undo system to use diff-based storage.

**Code Changes**:

1. **Import diff functions:**
```javascript
import { computeFieldDiff, applyFieldDiff } from '@/game/fieldDiff';
```

2. **New data properties:**
```javascript
// Replace existing prevField/prevPlayer with:
undoState: null,  // { diff: [...], canUndo: boolean } - null means no move to undo
```

The `undoState` being non-null indicates a move was made. Setting it to `null` after undo prevents double-undo.

3. **New computed property:**
```javascript
canUndo() {
  if (!this.undoState) return false;  // No move made yet, or already undone
  if (!this.undoState.canUndo) return false;  // Move revealed new cells
  if (this.players[this.currentPlayer]._type === Models.PlayerTypes.BOT) return false;
  return true;
}
```

4. **Modify `moveUnit()` method:**
```javascript
moveUnit(fromCoords, toCoords) {
  // Capture field state BEFORE the move
  const fieldSnapshot = structuredClone(this.localField);

  // Capture visibility BEFORE the move (if fog of war enabled)
  let visibleCoordsBefore = null;
  if (this.doesVisibilityMakeSense()) {
    visibleCoordsBefore = this.fieldEngine.getCurrentVisibilitySet(this.currentPlayer);
  }

  // ... existing move logic ...

  // After move completes, compute diff
  const diff = computeFieldDiff(fieldSnapshot, this.localField, this.width, this.height);

  // Check if new cells were revealed
  let canUndo = true;
  if (this.doesVisibilityMakeSense()) {
    const visibleCoordsAfter = this.fieldEngine.getCurrentVisibilitySet(this.currentPlayer);
    // If any new coords are visible, undo is not allowed
    for (const coord of visibleCoordsAfter) {
      if (!visibleCoordsBefore.has(coord)) {
        canUndo = false;
        break;
      }
    }
  }

  // Store undo state
  this.undoState = { diff, canUndo };
}
```

5. **Rename `restoreField()` to `undoLastMove()`:**
```javascript
undoLastMove() {
  if (!this.undoState) return;

  // Apply the diff to restore original cell states
  applyFieldDiff(this.localField, this.undoState.diff);

  // Recalculate visibility for restored state
  if (this.doesVisibilityMakeSense()) {
    this.setVisibility();
  }

  // Clear undo state (prevents double-undo)
  this.undoState = null;
}
```

6. **Modify `processEndTurn()` method:**
   - Clear undo state: `this.undoState = null`

7. **Modify `handleScoutArea()` method:**
   - After scout, check if new cells were revealed
   - If scout revealed new cells: set `this.undoState.canUndo = false`

8. **Pass props to InfoPanel:**
```javascript
:can-undo="canUndo"
:handle-undo-click="undoLastMove"
```

### Step 6: Add Multiplayer Undo Support (Frontend)

**Files**: `frontend/src/components/game/MultiplayerDinoGame.vue`

**Description**: Add undo capability for multiplayer games with server validation.

**Code Changes**:

1. **New data property:**
```javascript
canUndo: false,  // Received from server after each move
```

2. **Modify `applyStatePatch()` method:**
   - After server response for a move, read `canUndo` from patch
   - Update local `this.canUndo` accordingly

3. **New method `undoLastMove()`:**
```javascript
undoLastMove() {
  if (!this.canUndo || !this.isMyTurn) return;
  this.sendUndoToServer();
}
```

4. **New method `sendUndoToServer()`:**
```javascript
sendUndoToServer() {
  if (!this.gameWs || !this.canUndo) return;
  this.clientSeq++;
  this.gameWs.sendUndo(this.clientSeq);
}
```

5. **Handle server's undo response in `applyStatePatch()`:**
   - Server sends `undoApplied: true` and `canUndo: false` in patch
   - Apply diff from server to restore field state
   - Update `this.canUndo = patch.canUndo`

6. **Pass props to InfoPanel:**
```javascript
:can-undo="canUndo && isMyTurn"
:handle-undo-click="undoLastMove"
```

### Step 7: Add WebSocket Message Handler for Undo

**Files**: `frontend/src/game/websocket/gameWebSocket.js`

**Description**: Add method to send undo request.

**Code Changes**:
```javascript
sendUndo(clientSeq) {
  this.send({
    t: 'move',
    payload: { type: 'undo' },
    clientSeq,
  });
}
```

### Step 8: Add Backend Undo Logic

**Files**: `backend/game/services/game_logic.py`

**Description**: Add server-side undo transaction handler using diff-based restoration.

**Code Changes**:

1. **Import diff functions:**
```python
from game.services.field_diff import compute_field_diff, apply_field_diff
```

2. **Modify `apply_move_txn()` to track undo eligibility:**
```python
def apply_move_txn(game_code: str, user_id: int, payload: dict, client_seq: int):
    with transaction.atomic():
        game = Game.objects.select_for_update().get(game_code=game_code)

        # ... existing validation ...

        # Capture field state BEFORE the move
        field_before = copy.deepcopy(game.field)

        # Capture visibility BEFORE the move
        visible_coords_before = calculate_visibility(...)

        # ... apply move logic ...

        # Compute diff (what changed)
        diff = compute_field_diff(field_before, game.field, width, height)

        # Check if new cells were revealed
        visible_coords_after = calculate_visibility(...)
        can_undo = not (visible_coords_after - visible_coords_before)  # No new coords revealed

        # Store undo state on game
        game.undo_diff = diff
        game.can_undo = can_undo
        game.save(update_fields=['field', 'undo_diff', 'can_undo'])

        # Include canUndo in response
        patch["canUndo"] = can_undo

        return True, {"patch": patch, "server_tick": tick}
```

3. **New function `apply_undo_txn()`:**
```python
def apply_undo_txn(game_code: str, user_id: int, client_seq: int):
    """
    Transactional 'undo last move':
    - Lock game row
    - Check if undo is allowed
    - Apply stored diff to restore field
    - Delete the last Move record
    Returns: (ok, data|error)
    """
    with transaction.atomic():
        game = Game.objects.select_for_update().get(game_code=game_code)

        # Check turn ownership
        if game.turn_player_id != user_id:
            return False, {"code": "NOT_YOUR_TURN", "msg": "Not your turn"}

        # Check if undo is allowed
        if not game.can_undo or not game.undo_diff:
            return False, {"code": "UNDO_NOT_ALLOWED", "msg": "Cannot undo this move"}

        # Apply diff to restore field
        apply_field_diff(game.field, game.undo_diff)

        # Clear undo state
        game.can_undo = False
        game.undo_diff = None
        game.save(update_fields=['field', 'can_undo', 'undo_diff'])

        # Delete the last move record
        Move.objects.filter(game=game, player_id=user_id).order_by('-server_tick').first().delete()

        tick = now_ms()
        return True, {
            "patch": {
                "field": game.field,
                "undoApplied": True,
                "canUndo": False
            },
            "server_tick": tick
        }
```

### Step 9: Add Database Fields for Undo Tracking

**Files**: `backend/game/models.py`

**Description**: Add fields to Game model to track undo state. Store the diff (changed cells only), not the full field.

**Code Changes**:
```python
class Game(models.Model):
    # ... existing fields ...

    # Undo tracking (reset at turn end)
    undo_diff = models.JSONField(null=True, blank=True)  # List of changed cells: [{"x": x, "y": y, "cell": {...}}, ...]
    can_undo = models.BooleanField(default=False)  # Whether undo is currently allowed
```

**Migration needed**: Create migration for new fields.

### Step 10: Handle Undo Message in Consumer

**Files**: `backend/game/consumers.py`

**Description**: Add handling for undo message type in the game consumer.

**Code Changes** (in `receive_json` method, after line 143):
```python
elif payload.get("type") == "undo":
    ok, res = await database_sync_to_async(apply_undo_txn)(
        self.game_code, user_id, client_seq
    )
```

### Step 11: Reset Undo State at Turn End

**Files**: `backend/game/services/game_logic.py`

**Description**: Clear undo eligibility when turn ends.

**Code Changes** (in `apply_end_turn_txn`):
```python
# Clear undo state for the game
game.can_undo = False
game.undo_diff = None
# Add to save: game.save(update_fields=["field", "turn_player", "can_undo", "undo_diff"])
```

### Step 12: Handle Scout Undo

**Files**:
- `backend/game/services/game_logic.py`
- `frontend/src/components/game/DinoGame.vue`
- `frontend/src/components/game/MultiplayerDinoGame.vue`

**Description**: Handle the case where a move to an obelisk triggered a scout action.

**Key insight**: If the scout reveals nothing new, undo is allowed and simply restores changed cells (unit returns to pre-obelisk position). No special handling needed.

**Code Changes**:
- In `handleScoutArea()` / `emitScoutArea()`: After scout completes, check if new cells were revealed
- If new cells revealed: set `canUndo = false` (or `undoState.canUndo = false` for single-player)
- On undo: diff restoration automatically "undoes" the move because unit returns to original position

### Step 13: Write Tests

**Files**:
- `frontend/tests/fieldDiff.spec.js` (new file)
- `frontend/tests/undo.spec.js` (new file)

**Description**: Test cases for diff functions and undo functionality.

**fieldDiff.spec.js Tests:**
```javascript
describe('computeFieldDiff', () => {
  it('returns empty array when fields are identical', () => {
    // ...
  });

  it('detects unit movement (source and destination cells)', () => {
    // Unit moves from (0,0) to (1,0)
    // Should return 2 cells in diff
  });

  it('detects unit kill (3 cells: source, dest, killed)', () => {
    // Unit moves and kills adjacent enemy
    // Should return 3 cells in diff
  });

  it('detects building capture', () => {
    // Unit captures building, building.player changes
    // Should include that cell in diff
  });

  it('ignores isHidden changes (visibility only)', () => {
    // Only isHidden changed, no unit/building changes
    // Should return empty diff
  });
});

describe('applyFieldDiff', () => {
  it('restores field to original state', () => {
    // Make changes, compute diff, apply diff
    // Field should match original
  });

  it('restores killed units', () => {
    // Unit kills enemy, apply diff
    // Enemy unit should be restored
  });

  it('restores building ownership', () => {
    // Building captured, apply diff
    // Building owner should be restored
  });
});
```

**undo.spec.js Tests:**
- Test case 1: Undo allowed when fog of war is disabled
- Test case 2: Undo allowed when move didn't reveal new cells
- Test case 3: Undo blocked when move revealed new cells
- Test case 4: Undo blocked after undo was just performed (undoState is null)
- Test case 5: Undo state cleared at turn end
- Test case 6: Undo properly restores field state (including killed units)
- Test case 7: Scout action properly affects undo eligibility
- Test case 8: Diff contains only changed cells (verify efficiency)

### Step 14: Update Documentation

**Files**: `.claude/docs/game-components.md`, `CLAUDE.md`

**Description**: Document the undo feature and its constraints.

**Updates**:
- game-components.md: Add undo button documentation to InfoPanel section
- game-components.md: Document `canUndo` computed property in DinoGame/MultiplayerDinoGame
- game-components.md: Document fieldDiff utility functions
- CLAUDE.md: Add brief mention of undo feature

### Step 15: Final Verification

**Commands**:
```bash
cd frontend && npm run lint
cd frontend && npm run test
```

**Manual Tests**:
1. Single-player with fog of war disabled:
   - Make a move, verify undo button is enabled
   - Click undo, verify move is reverted
   - Verify undo button is now disabled
   - Make another move, verify undo is enabled again

2. Single-player with fog of war enabled:
   - Move unit to already-visible area, verify undo enabled
   - Move unit to fog area revealing new cells, verify undo disabled
   - Move to obelisk, scout area with no new cells, verify undo enabled
   - Move to obelisk, scout area revealing new cells, verify undo disabled

3. Multiplayer game:
   - Make a move, verify undo state received from server
   - Click undo when allowed, verify server accepts
   - Try to undo when not allowed, verify server rejects
   - Verify turn end clears undo state

4. Kill + undo scenario:
   - Move unit to kill an enemy
   - If no new cells revealed, verify undo is allowed
   - Click undo, verify enemy unit is restored

5. Verify diff efficiency:
   - Make a simple move, check diff has only 2 cells
   - Make a move that kills enemy, check diff has 3 cells

## Questions/Notes

1. **Icon design**: Will create a curved arrow icon for undo. Should match the game's existing visual style.

2. **Diff efficiency**: Typical diff size is 2-6 cells vs 400+ for full field clone on 20x20 map. Significant memory savings.

---

## Amendment 2026-05-03 (revised): Scout commits the move; undo re-enters scout-pick mode

### Problem

The original logic combined the move and the scout into a single undo unit. If a unit moved to an obelisk and that move revealed new cells, the move's `canUndo` was `false`. A subsequent scout misclick couldn't be reverted — the `false` flag persisted. Unfair: a player should always be able to redo a scout misclick.

### New behaviour

The unit's act of **picking a scout target commits the move**. From that moment the move can no longer be undone — the only thing undo reverts is the scout choice itself, putting the player back into scout-target-selection mode.

| Phase | What "undo" reverts |
|---|---|
| After regular move (not to obelisk) | The move (subject to fog-of-war eligibility) |
| Move-to-obelisk done, scout-pick mode active, **no target picked yet** | The move — unit returns to its origin (subject to fog-of-war eligibility) |
| Scout target picked, area revealed (or revealed nothing) | The scout — re-hide revealed cells, re-enter scout-pick mode. Unit stays on the obelisk. Move-undo is gone. |
| Scout target picked, scout revealed new cells | Disabled — scout reveal can't be unseen |
| End of turn | Both layers cleared |

Key invariant: at most one of `moveUndoState` and `scoutUndoState` is non-null. Picking a scout target swaps the move layer out for the scout layer; undoing the scout swaps it back to neither (and re-enters scout-pick mode), since the move is now locked.

### Frontend single-player (`DinoGame.vue`)

State remains:

```javascript
moveUndoState: null,   // { diff, canUndo }
scoutUndoState: null,  // { revealedCoords: [[x,y], ...], canUndo }
```

`handleScoutArea` — picking a scout target commits the move:

```javascript
this.scoutUndoState = { revealedCoords, canUndo: revealedCoords.length === 0 };
this.moveUndoState = null;  // commit the move
```

`undoLastMove` — scout-undo re-enters scout-pick mode via `setAction`:

```javascript
if (this.scoutUndoState) {
  for (const [x, y] of this.scoutUndoState.revealedCoords) {
    this.localField[x][y].isHidden = true;
    this.tempVisibilityCoords.delete(`${x},${y}`);
  }
  this.scoutUndoState = null;
  emitter.emit('setAction', ACTIONS.scouting);  // re-enter target-picker
  return;
}
// ... move-undo path: applyFieldDiff, setVisibility, emit('initTurn'), etc.
```

`canUndo` computed and `processEndTurn` cleanup are unchanged from the previous revision (priority: scout, then move; both cleared at end of turn).

### Backend

**Storage** — a single `Game.undo_state` JSONField holds at most one pending layer; the schema is owned by `backend/game/services/undo_state.py`:

```
None                                              — nothing pending
{"move":  {"diff": [...], "canUndo": bool}}      — pending move undo
{"scout": {"coords": [[x,y],...], "canUndo": bool}}  — pending scout undo
```

Helpers: `clear(game)`, `set_move(game, *, diff, can_undo)`, `set_scout(game, *, coords, can_undo)`, `get_move(game)`, `get_scout(game)`. Always pair with `update_fields=[..., "undo_state"]`.

`apply_scout_txn` — committing the move means dropping the move layer; `set_scout` does this:

```python
undo.set_scout(game, coords=[list(c) for c in newly_revealed_coords],
                     can_undo=len(newly_revealed_coords) == 0)
game.save(update_fields=["undo_state"])
patch["canUndo"] = game.undo_state["scout"]["canUndo"]
```

`apply_undo_txn` (scout branch) — surface a flag telling the client to re-enter scout mode, and tag the result `private` so the consumer routes it via `send_json` to the initiator only (mirroring `apply_scout_txn`):

```python
scout_layer = undo.get_scout(game)
if scout_layer is not None:
    if not scout_layer["canUndo"]:
        return False, {"code": "UNDO_NOT_ALLOWED", ...}
    # Re-hide cells: drop them from GamePlayer.scout_revealed_coords
    # (see service for full implementation)
    undo.clear(game)
    game.save(update_fields=["undo_state"])
    patch = {
        "unrevealedCoords": unrevealed,
        "reenterScoutMode": True,        # client re-emits setAction(scouting)
        "undoApplied": True,
        "canUndo": False,                 # move below was committed by scout
        "currentPlayer": player_order,
    }
    return True, {"patch": patch, "server_tick": now_ms(), "private": True}
```

The consumer's `undo` branch checks `res.get("private")` and uses `self.send_json(...)` instead of `group_send` when set — so opponents never see scout-mode signals or revealed-cell info.

### Frontend multiplayer (`MultiplayerDinoGame.vue`)

In `applyStatePatch`, after handling `unrevealedCoords`:

```javascript
if (patch.reenterScoutMode) {
  emitter.emit('setAction', ACTIONS.scouting);
}
```

The existing `patch.undoApplied` branch must NOT run `initTurn` for the scout-undo case (that would clear the action we just set). Either move the `initTurn` emit so it only fires when there's no `reenterScoutMode`, or skip the branch in that case.

### Tests

Refresh `frontend/tests/DinoGame/dinogame.undo.spec.js`:

1. After scout target picked, `moveUndoState` is null and `scoutUndoState` is set.
2. Scout-undo re-emits `setAction(scouting)` and clears `scoutUndoState`.
3. Scout-undo with cells revealed: re-hide exactly those cells; do not touch other previously-visible cells.
4. Move (revealed new) + scout (revealed nothing) → undo allowed; reverts the scout, re-enters scout mode; subsequent undo disabled (move was locked).
5. End of turn clears both states.

### Truth table

| Move reveals new? | Scout reveals new? | Undo button after move-then-scout | Undo restores |
|---|---|---|---|
| No | No | Enabled | Scout (1st click) → move (2nd click) |
| No | Yes | Disabled | — |
| Yes | No | Enabled | Scout only |
| Yes | Yes | Disabled | — |

### Frontend single-player (`DinoGame.vue`)

Replace `undoState: null` with two fields:

```javascript
moveUndoState: null,   // { diff, canUndo }   — set on move, cleared by undo or new move
scoutUndoState: null,  // { revealedCoords: [[x,y], ...], canUndo }  — set on scout
```

`canUndo` computed (priority: scout, then move):

```javascript
canUndo() {
  if (this.players[this.currentPlayer]._type === Models.PlayerTypes.BOT) return false;
  if (this.scoutUndoState) return this.scoutUndoState.canUndo;
  if (this.moveUndoState) return this.moveUndoState.canUndo;
  return false;
}
```

`moveUnit` (changes only at the tail):

```javascript
this.moveUndoState = { diff, canUndo };
this.scoutUndoState = null;   // a new move invalidates any pending scout undo
```

`handleScoutArea` (replaces the existing reveal-detection branch — no longer touches `moveUndoState.canUndo`):

```javascript
const revealedCoords = [];
if (this.doesVisibilityMakeSense()) {
  const { x, y, fogRadius } = data;
  for (let cx = x - fogRadius; cx <= x + fogRadius; cx++) {
    for (let cy = y - fogRadius; cy <= y + fogRadius; cy++) {
      if (this.fieldEngine.areExistingCoords(cx, cy) && this.localField[cx][cy].isHidden) {
        revealedCoords.push([cx, cy]);
      }
    }
  }
}
this.addTempVisibilityForCoords(data.x, data.y, data.fogRadius);
this.scoutUndoState = { revealedCoords, canUndo: revealedCoords.length === 0 };
```

`undoLastMove` (scout takes priority):

```javascript
if (this.scoutUndoState) {
  for (const [x, y] of this.scoutUndoState.revealedCoords) {
    this.localField[x][y].isHidden = true;
    this.tempVisibilityCoords.delete(`${x},${y}`);
  }
  this.scoutUndoState = null;
  emitter.emit('initTurn');
  return;
}
if (this.moveUndoState) {
  applyFieldDiff(this.localField, this.moveUndoState.diff);
  emitter.emit('initTurn');
  if (this.doesVisibilityMakeSense()) this.setVisibility();
  this.moveUndoState = null;
}
```

`processEndTurn`: clear both states.

### Backend (`game/models.py`, `game_logic.py`, new migration)

Add to `Game`:

```python
scout_undo_coords = models.JSONField(null=True, blank=True,
    help_text="Coords newly revealed by the last scout this turn: [[x, y], ...]")
scout_can_undo = models.BooleanField(default=False)
```

Migration: `0003_add_scout_undo_fields.py`.

`apply_scout_txn` — replace the existing "if newly_revealed_coords and can_undo: game.can_undo = False" block with:

```python
game.scout_undo_coords = [list(c) for c in newly_revealed_coords]
game.scout_can_undo = len(newly_revealed_coords) == 0
game.save(update_fields=["scout_undo_coords", "scout_can_undo"])
patch["canUndo"] = game.scout_can_undo
```

`apply_move_txn` — clear scout-undo state alongside the move-undo state (`scout_undo_coords=None`, `scout_can_undo=False`); add to `update_fields`.

`apply_undo_txn` — check scout state before move state:

```python
if game.scout_undo_coords is not None:
    if not game.scout_can_undo:
        return False, {"code": "UNDO_NOT_ALLOWED", ...}
    # Re-hide cells: drop them from GamePlayer.scout_revealed_coords
    revealed = {tuple(c) for c in game_player.scout_revealed_coords or []}
    revealed -= {tuple(c) for c in game.scout_undo_coords}
    game_player.scout_revealed_coords = [list(c) for c in revealed]
    unrevealed = list(game.scout_undo_coords)
    game.scout_undo_coords = None
    game.scout_can_undo = False
    # Move undo state (game.can_undo / game.undo_diff) preserved for chained undo
    game_player.save(update_fields=["scout_revealed_coords"])
    game.save(update_fields=["scout_undo_coords", "scout_can_undo"])
    patch = {
        "unrevealedCoords": unrevealed,        # NEW: client re-hides these cells
        "undoApplied": True,
        "canUndo": game.can_undo,              # move underneath may still be undoable
        "currentPlayer": player_order,
    }
    return True, {"patch": patch, "server_tick": now_ms()}
# else: existing move-undo logic
```

`apply_end_turn_txn`: extend the cleared fields to include `scout_undo_coords=None`, `scout_can_undo=False`.

### Frontend multiplayer (`MultiplayerDinoGame.vue`)

The server prioritises scout vs move and sends the right `canUndo`. Client just trusts. New patch field handling:

```javascript
if (patch.unrevealedCoords) {
  for (const [x, y] of patch.unrevealedCoords) {
    if (this.localField[x] && this.localField[x][y]) {
      this.localField[x][y].isHidden = true;
      this.localField[x][y].unit = null;
      this.localField[x][y].building = null;
    }
    this.scoutRevealedCoords.delete(`${x},${y}`);
  }
}
```

The existing `patch.undoApplied` branch already emits `initTurn`; nothing else to change there.

### Tests

Add scenarios to `frontend/tests/`:

1. Move (revealed nothing) + scout (revealed nothing) → first undo reverts scout, second undo reverts move.
2. Move (revealed new) + scout (revealed nothing) → undo reverts scout, button then disabled (move was non-undoable).
3. Move (revealed new) + scout (revealed new) → undo disabled.
4. Scout, then move another unit → `scoutUndoState` cleared, undo targets the new move.
5. End turn clears both states.

