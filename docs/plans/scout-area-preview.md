# Plan: Scout Area Preview

Created: 2026-01-28
Status: Implemented
Completed: 2026-01-29

## Overview
Display a preview of the scout area before applying the scout action. When the player is in scouting mode (has a unit on an obelisk and triggered the scout action), show a visibility frame highlighting the area that will be revealed. The preview should:
- Display the same visibility frame used for unit visibility display
- Mark the central cell with an "X" symbol in the same color as the frame
- On PC: Show immediately on hover over any cell
- On PC and mobile: Show on right-click (long-tap) on a point

## Requirements
- Reuse the existing `VisibilityFrame.vue` component for displaying the scout preview area
- Add a central cell marker ("X") to indicate the exact point being scouted
- Show the preview frame during hover when in scout mode (PC only)
- Show the preview frame on right-click/long-tap when in scout mode (PC and mobile)
- Use the current player's color for the frame and X marker
- The preview radius should match `fogOfWarRadius` (the actual scout radius)

## Analysis

### Affected Files
- `frontend/src/components/game/GameGrid.vue` - Add scout preview state, hover/right-click handling during scout mode
- `frontend/src/components/game/GameCell.vue` - Emit hover events for scout preview
- `frontend/src/components/game/VisibilityFrame.vue` - Add optional central marker ("X")

### Dependencies
- Existing `VisibilityFrame.vue` component
- Existing `selectedAction` state in `GameGrid.vue`
- `fogOfWarRadius` prop available in `GameGrid.vue`
- `getPlayerColor()` helper function
- `ACTIONS.scouting` constant

### Risks/Considerations
- Hover events on mobile are limited; the right-click/long-tap approach handles this
- Need to ensure the preview doesn't interfere with the regular visibility frame display (unit right-click). So if there is an active scout action, right click should also display context help of cell, but not the unit's visibility.
- Performance: hover events fire frequently, but showing/hiding a single element should be lightweight
- The X marker should be visible but not obscure the cell content

## Implementation Steps

### Step 1: Add Central Marker to VisibilityFrame
**Files**: `frontend/src/components/game/VisibilityFrame.vue`
**Description**: Add an optional "X" marker at the center of the frame.
**Code Changes**:
- Add new props: `showCenterMarker` (Boolean, default false)
- Add a centered "X" SVG or styled div that appears when `showCenterMarker` is true
- The X should be the same color as the frame border (`playerColor`)
- Scale the X size based on `cellSize`

### Step 2: Add Scout Preview State to GameGrid
**Files**: `frontend/src/components/game/GameGrid.vue`
**Description**: Add state and logic to track and display scout preview.
**Code Changes**:
- Add `scoutPreviewCoords` data property (object with x, y or null)
- Add computed property `scoutPreviewFrame` that returns frame config when in scout mode
- Render a second `VisibilityFrame` component for scout preview (with `showCenterMarker: true`)
- Use `currentPlayer` for the player index (for color)
- Use `fogOfWarRadius` for the radius

### Step 3: Handle Hover Events for Scout Preview (PC)
**Files**: `frontend/src/components/game/GameCell.vue`, `frontend/src/components/game/GameGrid.vue`
**Description**: Show scout preview on hover when in scout mode.
**Code Changes**:
- **GameCell.vue**:
  - Add `@mouseenter` event handler that emits `'mouseEnter'` with cell coordinates
  - Add `@mouseleave` event handler that emits `'mouseLeave'`
- **GameGrid.vue**:
  - Add handlers for `mouseEnter` and `mouseLeave` events from GameCell
  - In `handleCellMouseEnter`: If `selectedAction === ACTIONS.scouting`, set `scoutPreviewCoords` to the cell coordinates
  - In `handleCellMouseLeave`: Clear `scoutPreviewCoords` if in scout mode

### Step 4: Handle Right-Click for Scout Preview
**Files**: `frontend/src/components/game/GameGrid.vue`
**Description**: Modify context menu handling to show scout preview when in scout mode.
**Code Changes**:
- In `handleContextMenu` method:
  - If `selectedAction === ACTIONS.scouting`:
    - Set `scoutPreviewCoords` to the right-clicked cell coordinates
    - Skip the normal unit visibility frame, but show context help
  - Otherwise, continue with existing behavior (show unit visibility frame and context help)

### Step 5: Clear Scout Preview on Action or Mode Exit
**Files**: `frontend/src/components/game/GameGrid.vue`
**Description**: Clear the scout preview when scout action is performed or cancelled.
**Code Changes**:
- In `processClick`: When scouting action is executed, ensure `scoutPreviewCoords` is cleared
- In `initTurn`: Already clears `selectedAction`, also clear `scoutPreviewCoords`
- In `setAction`: If action is cleared (set to null), also clear `scoutPreviewCoords`

### Step 6: Write Tests
**Files**: `frontend/tests/components/VisibilityFrame.spec.js` (new or update existing)
**Description**: Test cases for the new functionality.
**Tests**:
- Test that VisibilityFrame renders X marker when `showCenterMarker` is true
- Test that X marker is not rendered when `showCenterMarker` is false
- Test that X marker uses correct player color
- Test that the visibility frame coordinates are correct

### Step 7: Final Verification
**Commands**:
```bash
cd frontend && npm run lint
cd frontend && npm run test
```
**Manual Tests**:
- Start a game with scout mode enabled and obelisks on the map
- Move a unit to an obelisk to trigger scout mode
- **PC Hover Test**: Move mouse over different cells - verify scout preview frame appears with X marker at center
- **PC/Mobile Right-Click Test**: Right-click (or long-tap) on a cell - verify scout preview appears
- Click to perform scout action - verify preview disappears and area is revealed
- Verify the frame color matches the current player's color
- Verify the X marker is visible and properly centered

## Notes
- The X marker design: Should be a simple styled text "X".
- Scout preview should coexist with the context help tooltip when right-clicking during scout mode.
