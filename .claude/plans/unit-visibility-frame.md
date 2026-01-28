# Plan: Unit Visibility Frame

Created: 2026-01-28
Status: Implemented
Completed: 2026-01-28

## Overview
Display the selected unit's visibility radius as a transparent colored frame on the map. The frame uses the player's color (e.g., blue for player 1) and scales with the current zoom level. This helps players understand exactly what area their unit can see. The visibility frame is shown when a unit is selected (clicked) or when right-clicking on any cell with a unit.

## Requirements
- Display a square frame showing the unit's visibility radius when a unit is selected
- Frame color matches the player's color (blue for player 1, mint for player 2, etc.)
- Frame border width scales with zoom: 1px at minimum scale (10px cells), 3px at normal scale (30px cells), proportionally higher at max scale (70px cells)
- Frame must be transparent - player sees everything inside
- Frame border must end exactly at the edge of the last visible cell (not extending into non-visible cells)
- Also display the frame when right-clicking on any cell containing a unit, doesn't matter which player it belong to (existing context menu trigger)

## Analysis

### Current Implementation

**Unit Selection Flow:**
1. User clicks on a cell with their unit in `GameGrid.vue`
2. `processClick()` calls `selectUnit(x, y, movePoints)`
3. `selectUnit()` sets `selectedCoords = [x, y]` and calls `setHighlights()` for movement range

**Right-Click Flow:**
1. User right-clicks on a cell
2. `GameCell.vue` emits `contextMenu` event
3. `GameGrid.vue` handles it in `handleContextMenu()` and shows `CellContextHelp` tooltip

**Key Data:**
- `selectedCoords` in `GameGrid.vue` - the currently selected unit's position
- `unit.visibility` - the unit's visibility radius (from the Unit model)
- `cellSize` - current zoom level (10-70, default 30)
- `getPlayerColor(order)` from helpers.js - returns player's color

### Affected Files
- `frontend/src/components/game/GameGrid.vue` - Add visibility frame overlay component, track visibility frame state
- `frontend/src/components/game/VisibilityFrame.vue` (new) - New component to render the frame
- `frontend/src/game/const.js` - Add cell size constants for border calculation

### Dependencies
- `getPlayerColor()` from `@/game/helpers` - already exists
- No new external dependencies

### Risks/Considerations
1. **Performance**: The frame is a simple CSS-based overlay, should have minimal impact
2. **Edge cases**: Units at map edges - frame should be clipped to map bounds
3. **Z-index**: Frame must appear above terrain but below context menus and other UI
4. **Right-click visibility**: Need to track which unit's visibility to show (could be different from selected unit)

## Implementation Steps

### Step 1: Add Cell Size Constants

**Files**: `frontend/src/game/const.js`

**Description**: Add constants for min/max cell sizes and border width calculation.

**Code Changes**:
- Add `MIN_CELL_SIZE = 10`
- Add `MAX_CELL_SIZE = 70`
- Add `DEFAULT_CELL_SIZE = 30`
- Add `DEFAULT_BORDER_WIDTH = 3` (at default scale)

### Step 2: Create VisibilityFrame Component

**Files**: `frontend/src/components/game/VisibilityFrame.vue` (new file)

**Description**: Create a new component that renders the visibility frame overlay.

**Props**:
- `x`, `y` - unit position (cell coordinates)
- `radius` - visibility radius (cells)
- `cellSize` - current cell size in pixels
- `playerIndex` - unit's player for color
- `fieldWidth`, `fieldHeight` - map dimensions for boundary clipping

**Implementation**:
- Calculate frame position: `x * cellSize - radius * cellSize` (top-left corner)
- Calculate frame size: `(radius * 2 + 1) * cellSize` (full visibility square)
- Clip frame to map bounds (min 0, max field dimensions)
- Calculate border width based on cellSize ratio: `Math.max(1, Math.round(cellSize / DEFAULT_CELL_SIZE * DEFAULT_BORDER_WIDTH))`
- Use `box-sizing: border-box` so border is inside the frame bounds
- Style: transparent background, colored border, `pointer-events: none`

### Step 3: Add Visibility Frame State to GameGrid

**Files**: `frontend/src/components/game/GameGrid.vue`

**Description**: Track state for showing the visibility frame.

**Code Changes**:
- Add data property `visibilityFrameUnit: null` - stores {x, y, visibility, player} when frame should show
- Computed property `showVisibilityFrame` - true when visibilityFrameUnit is set
- Update `selectUnit()` to set `visibilityFrameUnit` with unit's visibility data
- Update `initTurn()` and other deselection points to clear `visibilityFrameUnit`
- Import and use `getPlayerColor` helper

### Step 4: Render VisibilityFrame in GameGrid Template

**Files**: `frontend/src/components/game/GameGrid.vue`

**Description**: Add the VisibilityFrame component to the template.

**Code Changes**:
- Import `VisibilityFrame` component
- Add `<VisibilityFrame>` inside `.board-wrapper`, after the `.board` div
- Pass required props: x, y, radius, cellSize, playerIndex, fieldWidth, fieldHeight
- Conditionally render with `v-if="visibilityFrameUnit"`

### Step 5: Add Right-Click Visibility Frame

**Files**: `frontend/src/components/game/GameGrid.vue`

**Description**: Show visibility frame when right-clicking on a cell with a unit.

**Code Changes**:
- Modify `handleContextMenu()` to also set `visibilityFrameUnit` if the clicked cell has a unit
- When context help closes, clear `visibilityFrameUnit` only if it was set by right-click (not by selection)
- Add tracking to distinguish between selection-triggered and right-click-triggered frames

### Step 6: Style and Polish

**Files**: `frontend/src/components/game/VisibilityFrame.vue`

**Description**: Final styling and edge case handling.

**Code Changes**:
- Ensure frame is positioned absolutely within board-wrapper
- Set appropriate z-index (above cells, below context menus)
- Handle edge cases: unit at map edge (frame clipped to bounds)
- Smooth appearance (no transition needed, instant show/hide)

### Step 7: Write Tests

**Files**: `frontend/tests/game/visibilityFrame.spec.js` (new file)

**Description**: Unit tests for the visibility frame feature.

**Tests**:
- Test border width calculation at different cell sizes (min=10, default=30, max=70)
- Test frame position calculation (center unit, edge unit, corner unit)
- Test frame size calculation with different visibility radii
- Test frame clipping at map boundaries
- Test frame shows correct player color

### Step 8: Update Documentation

**Files**: `.claude/docs/game-components.md`

**Description**: Document the new VisibilityFrame component.

**Updates**:
- Add VisibilityFrame to the child components section
- Document props and behavior

### Step 9: Final Verification

**Commands**:
```bash
cd frontend && npm run lint
cd frontend && npm run test
```

**Manual Tests**:
- Select a unit and verify visibility frame appears with correct color and size
- Test at different zoom levels (10px to 70px cells) - border should scale smoothly
- Test with unit at map edge - frame should not extend beyond map
- Test right-click on unit - frame should appear
- Test right-click on cell without unit - no frame
- Test that clicking elsewhere dismisses the frame
- Test with different players - colors should match

## Questions/Notes

1. **Frame appearance timing**: The frame appears immediately when unit is selected. If the user prefers animation, we can add a fade-in transition later.

2. **Right-click behavior**: When right-clicking shows both context help AND visibility frame, the frame remains visible until context help is dismissed. This provides useful information while viewing unit details.

3. **Border width formula**: `Math.max(1, Math.round(cellSize / 30 * 3))` gives:
   - 10px cells → 1px border
   - 30px cells → 3px border
   - 70px cells → 7px border
