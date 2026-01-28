# Plan: Deselect Unit on Click

Created: 2026-01-28
Status: Implemented
Completed: 2026-01-28

## Overview
Implement the ability to deselect a selected unit by clicking on it again. Currently, clicking on a selected unit re-selects it (no visible change). This feature will allow users to cancel their selection by clicking the same unit.

## Requirements
- When a unit is selected and the user clicks on that same unit, deselect it
- Remove movement highlights when deselecting
- Clear the `selectedCoords` state
- Works in both single-player and multiplayer modes

## Analysis

### Affected Files
- `frontend/src/components/game/GameGrid.vue` - Add deselection logic to `processClick()` method

### Dependencies
None - this is a simple enhancement to existing click handling logic.

### Risks/Considerations
- **Edge case**: Ensure clicking on a different unit still selects that new unit (not deselects everything)
- **Visual feedback**: Users should see the green highlight disappear immediately
- **Selected action mode**: If `selectedAction` is set (e.g., scouting), clicking the selected unit shouldn't trigger deselection. Action has higher priority than any other operation.

## Implementation Steps

### Step 1: Add Deselection Logic to processClick() ✅ COMPLETED
**Files**: `frontend/src/components/game/GameGrid.vue`
**Description**: Modify the unit click handling to check if the clicked unit is already selected, and if so, deselect it instead of re-selecting.

**Code Changes**:
At lines 369-373 in `processClick()`, the current code is:
```javascript
const unit = this.field[x][y].unit;
if (unit) {
  // Select unit if it belongs to current player and hasn't moved
  if (unit.player === this.currentPlayer && !unit.hasMoved) {
    this.selectUnit(x, y, unit.movePoints);
  }
}
```

Change to:
```javascript
const unit = this.field[x][y].unit;
if (unit) {
  // Select unit if it belongs to current player and hasn't moved
  if (unit.player === this.currentPlayer && !unit.hasMoved) {
    // If clicking on already selected unit, deselect it
    if (this.selectedCoords && this.selectedCoords[0] === x && this.selectedCoords[1] === y) {
      this.selectedCoords = null;
      this.removeHighlights();
    } else {
      this.selectUnit(x, y, unit.movePoints);
    }
  }
}
```

**Note on Server-Side Changes**: No server changes are needed. Unit selection/deselection is purely **client-side UI state**. Looking at the multiplayer architecture:
- Only **game-affecting actions** are sent to the server: `moveUnit` (via `sendMove`), `scoutArea`, `endTurn`
- The `selectedCoords` state exists only in `GameGrid.vue` and affects only:
  - Visual highlighting of the selected cell
  - Which cell's unit will move when clicking an empty cell
- The server doesn't track which unit is "selected" - it only validates and processes actual moves
- Both single-player and multiplayer use the same `GameGrid.vue` component, so this change works for both modes automatically

### Step 2: Write Tests ✅ COMPLETED
**Files**: `frontend/tests/unit/GameGrid.spec.js` (if exists) or new test file
**Description**: Add test cases for deselection behavior

**Tests**:
- Test case 1: Clicking on a selected unit deselects it (selectedCoords becomes null)
- Test case 2: Clicking on a different selectable unit still selects it
- Test case 3: Movement highlights are removed when deselecting
- Test case 4: Clicking on a unit that has already moved does nothing
- Test case 5: Click on a selected unit with the `selectedAction` set does nothing

### Step 3: Final Verification ✅ COMPLETED
**Commands**:
```bash
cd frontend && npm run lint
cd frontend && npm run test
```

**Manual Tests**:
1. Start a single-player game
2. Click on one of your units - verify it becomes selected (green highlight)
3. Click on the same unit - verify it becomes deselected (no highlight)
4. Select a unit, then click a different selectable unit - verify the new unit is selected
5. Move a unit, verify it cannot be selected or deselected
6. Test in multiplayer mode as well

## Questions/Notes
- The implementation is minimal and follows the existing pattern of clearing `selectedCoords` and calling `removeHighlights()` (same pattern used in `moveUnit()` method)
- No changes needed to `selectUnit()` method itself since we handle deselection before calling it
