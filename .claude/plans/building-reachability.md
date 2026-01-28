# Plan: Building Reachability

Created: 2026-01-28
Status: Implemented
Completed: 2026-01-28

## Overview
Ensure all buildings on the generated map are reachable by units (not blocked by impassable rocks/mountains). Currently, the `CreateFieldEngine` validates that all player start positions can reach each other. This plan extends that check to include all buildings placed on the map.

**Implementation Scope:**
- Frontend (`createFieldEngine.js`) - for single-player games
- Backend (`backend/game/services/field.py`) - for multiplayer games

## Requirements
- All buildings (Habitation, Temple, Well, Storage, Obelisk) must be reachable from at least one player start position
- If a building is unreachable, remove mountain cells to create a path
- Maintain the existing player-to-player reachability guarantee
- Keep the algorithm efficient for typical map sizes (up to ~50x50)

## Analysis

### Current Implementation

The existing `makeFieldLinked()` method in `createFieldEngine.js` works as follows:

1. **Wave propagation**: Uses BFS from player 0's start position, counting the number of mountains that must be crossed to reach each cell
2. **Detection**: Finds the player start position with the highest "wall count" (mountains to cross)
3. **Repair**: Removes one mountain at a time to reduce the path cost
4. **Iteration**: Repeats until all players are reachable (wall count = 0 for all)

The algorithm uses a "wave field" where each cell contains the minimum number of mountains that must be crossed to reach it from player 0's position.

### Affected Files
- `frontend/src/game/createFieldEngine.js` - Extend `makeFieldLinked()` and related methods to include buildings

### Dependencies
- No new dependencies required
- Uses existing `Models` classes

### Risks/Considerations
1. **Performance**: Adding buildings to the check increases the number of targets, but the wave algorithm already computes reachability for the entire field, so the cost is minimal
2. **Edge cases**: Very dense mountain maps could theoretically fail to place all buildings AND keep them reachable - the fallback should gracefully handle this

## Implementation Steps

### Step 1: Reorder Generation Flow

**Files**: `frontend/src/game/createFieldEngine.js`

**Description**: Move building placement BEFORE `makeFieldLinked()` call, so we only need to call it once with all targets.

Currently the order is:
1. Place player bases → 2. `makeFieldLinked()` → 3. Place buildings

New order:
1. Place player bases → 2. Place buildings → 3. `makeFieldLinked()` once

**Code Changes**:
- In `generateField()`, move the building placement loop (lines 101-138) to BEFORE the `makeFieldLinked()` call (line 98)
- This is safe because building placement only requires empty (non-mountain) cells, and `makeFieldLinked()` only removes mountains

### Step 2: Refactor to Support Any Target Position

**Files**: `frontend/src/game/createFieldEngine.js`

**Description**: Generalize `getMaxNumCell()` and `allPlayersReached()` to work with any list of target positions, not just start positions.

**Code Changes**:
- Rename `allPlayersReached(wField)` to `allTargetsReached(wField, targets)` - accepts a list of [x, y] coordinates to check
- Rename `getMaxNumCell(wField, field)` to `getMaxNumCell(wField, field, targets)` - accepts targets instead of using `this.startPositions`
- Update `makeFieldLinked()` to pass targets explicitly to these methods

### Step 3: Create Method to Collect Building Positions

**Files**: `frontend/src/game/createFieldEngine.js`

**Description**: Add a helper method to collect all building positions from the field.

**Code Changes**:
- Add `getBuildingPositions(field)` method that returns an array of [x, y] coordinates for all cells with buildings (including player bases and neutral buildings)

### Step 4: Update makeFieldLinked to Include Buildings

**Files**: `frontend/src/game/createFieldEngine.js`

**Description**: Modify `makeFieldLinked()` to ensure all buildings are reachable.

**Code Changes**:
- Change `makeFieldLinked(field)` to collect building positions and include them as targets
- Pass `[...this.startPositions, ...this.getBuildingPositions(field)]` to `getMaxNumCell()` and `allTargetsReached()`

### Step 5: Write Tests

**Files**: `frontend/tests/game/createFieldEngine.spec.js` (new file)

**Description**: Add unit tests for the building reachability feature.

**Tests**:
- Test that `getBuildingPositions()` correctly collects all building positions
- Test that `allTargetsReached()` returns true when all targets have wave value 0
- Test that `allTargetsReached()` returns false when any target has wave value > 0
- Test that `generateField()` produces a field where all buildings are reachable from player start positions (integration test)
- Test edge case: building placed adjacent to a player start (should always be reachable)
- Test edge case: building surrounded by mountains gets a path cleared

### Step 6: Update Documentation

**Files**: `.claude/docs/game-engines.md`

**Description**: Document the updated generation algorithm.

**Updates**:
- Update the "Generation Algorithm" section under CreateFieldEngine to mention building reachability validation
- Add note that mountains may be removed to ensure building accessibility

### Step 7: Final Verification

**Commands**:
```bash
cd frontend && npm run lint
cd frontend && npm run test
```

**Manual Tests**:
- Generate several maps with different sizes and building rates
- Visually verify that all buildings can be reached by walking from any player start position
- Test with high mountain ratio (modify MOUNTAIN_RATIO temporarily to ~0.5) to stress the algorithm
- Verify game still plays correctly after field generation

## Backend Implementation

The same algorithm was implemented in the backend for multiplayer field generation.

### Files Modified
- `backend/game/services/field.py` - Field generation service

### Changes Made
1. **Reordered generation flow**: Building placement moved BEFORE `make_field_linked()` call
2. **Added `get_building_positions(field, width, height)`**: Collects all neutral building positions
3. **Renamed `all_players_reached()` to `all_targets_reached(w_field, targets)`**: Generalized to work with any list of targets
4. **Updated `make_field_linked(field, width, height, targets)`**: Now accepts combined targets (start positions + buildings)
5. **Updated `get_max_num_cell(w_field, field, targets)`**: Works with any list of targets
6. **Updated `wave(field, width, height, targets)`**: Works with any list of targets

### Tests Added
- `backend/game/tests/test_services_field.py`:
  - `TestGetBuildingPositions` - Tests for collecting building positions
  - `TestAllTargetsReached` - Tests for checking target reachability
  - `TestMakeFieldLinkedWithBuildings` - Tests for field linking with buildings
  - `TestGenerateFieldBuildingReachability` - Integration tests for generated fields

### Documentation Updated
- `.claude/docs/architecture.md` - Added `field.py` to backend services list
- `.claude/docs/game-engines.md` - Added note about backend using same algorithm

## Questions/Notes

1. **Why reorder instead of calling makeFieldLinked twice?** Building placement only requires empty (non-mountain) cells, and `makeFieldLinked()` only removes mountains. By placing buildings first, we can call `makeFieldLinked()` once with all targets (start positions + buildings), which is simpler and more efficient.

2. **Future improvement**: The `wave()` function could be optimized to use a visited set instead of re-checking cells, but this is out of scope for this change.
