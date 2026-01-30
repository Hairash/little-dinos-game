# Plan: Turn Notification

Created: 2026-01-29
Status: Implemented
Completed: 2026-01-29

## Overview
Add a notification label at the beginning of each player's turn, displayed in the bottom right corner of the game screen. The notification uses the current player's color as background and shows "Player {number} turn" for local games or "Player {name} turn" for network games. Multiple notifications can stack (new ones above old ones) when turns are faster than the 5-second auto-dismiss timer (e.g., during bot turns).

**Approach**: Reuse the existing notification system in MultiplayerDinoGame.vue and create an equivalent system in DinoGame.vue with consistent styling.

## Requirements
- Display a small label notification at the bottom right corner of the game screen at the beginning of each turn
- Background color should match the current player's color
- Text should be "Player {number} turn" in local (single-player) games
- Text should be "Player {name from lobby} turn" in network (multiplayer) games
- Notification slowly fades/disappears after 5 seconds
- Notification can be dismissed early by clicking on it
- When turns are faster than 5s (e.g., bot turns), multiple notifications should stack with new ones appearing above old ones
- Notifications should have a subtle fade-out animation

## Analysis

### Current Implementation

**Turn Change Flow (Single-player):**
1. `processEndTurn()` in DinoGame.vue calls `selectNextPlayerAndCheckPhases()`
2. `startTurn` event is emitted
3. `startTurn()` method is called which:
   - Calls `fieldEngine.restoreAndProduceUnits(currentPlayer)`
   - Sets visibility
   - If bot player, emits `makeBotMove`
   - If human player, emits `initTurn` and shows ready label if needed

**Turn Change Flow (Multiplayer):**
1. Server sends state patch with new `currentPlayer`
2. `applyStatePatch()` detects turn change (`previousPlayer !== currentPlayer`)
3. Clears scout-revealed coordinates, recalculates visibility
4. Emits `initTurn` and resets inactivity timer

**Player Colors:**
- `getPlayerColor(order)` in `frontend/src/game/helpers.js` returns player color by order
- Colors: blue (#4A90E2) for player 1, mint (#32cc67) for player 2, etc.

**Existing Notification System (Multiplayer):**
- `notifications: []` array in MultiplayerDinoGame.vue
- `showNotification(message, type)` method adds notification with auto-dismiss after 5 seconds
- `dismissNotification(id)` removes notification
- CSS with slide-in animation, positioned at bottom-right
- Notification types: `disconnect` (red border), `reconnect` (green border), default (tan border)
- Styling: dark background (#222222), 2px border, white text, 14px font, bold

### Affected Files
- `frontend/src/components/game/DinoGame.vue` - Add notification system (same pattern as multiplayer)
- `frontend/src/components/game/MultiplayerDinoGame.vue` - Extend existing notification system with turn notifications

### Dependencies
- `getPlayerColor()` from `@/game/helpers` - already exists
- No new external dependencies

### Risks/Considerations
1. **Stacking behavior**: Existing system already handles stacking with flex-direction column and gap
2. **Multiplayer player names**: Need to store player usernames from server data (currently only `Models.Player` objects are stored without usernames)
3. **Z-index**: Existing notifications use z-index 10000, sufficient for game UI
4. **Performance**: Multiple notifications during fast bot turns should not impact performance
5. **Mobile responsiveness**: Existing notification sizing (min-width 200px, max-width 300px) works well

## Implementation Steps

### Step 1: Store Player Names in Multiplayer Game

**Files**: `frontend/src/components/game/MultiplayerDinoGame.vue`

**Description**: Store player usernames from server data for use in turn notifications.

**Code Changes**:
- Add `playersData: []` to data() - stores original player data with usernames
- Update `initializePlayers()` to store `this.playersData = playersData`
- Add method `getPlayerNameByOrder(order)` that returns username for given player order

### Step 2: Add Turn Notification Type to Multiplayer CSS

**Files**: `frontend/src/components/game/MultiplayerDinoGame.vue`

**Description**: Add CSS styling for turn notifications using player colors as background.

**Code Changes**:
Add dynamic notification styling that uses player color as background:
```css
.notification-turn {
  background-color: var(--player-color);
  border-color: var(--player-color);
  color: #000000;  /* Black text for readability on colored backgrounds */
}

.notification-turn:hover {
  filter: brightness(1.1);
}
```

### Step 3: Add Turn Notification Method to Multiplayer Game

**Files**: `frontend/src/components/game/MultiplayerDinoGame.vue`

**Description**: Add method to show turn notifications using existing notification system.

**Code Changes**:
- Add method `showTurnNotification(playerOrder)` that:
  - Gets player name from `playersData` using `getPlayerNameByOrder()`
  - Creates message: `Player ${playerName} turn`
  - Calls `showNotification(message, 'turn', playerOrder)` with player order for color
- Modify `showNotification()` to accept optional `playerOrder` parameter for turn notifications
- Update template to pass player color as CSS variable for turn notifications

### Step 4: Trigger Turn Notification in Multiplayer

**Files**: `frontend/src/components/game/MultiplayerDinoGame.vue`

**Description**: Show turn notification when turn changes.

**Code Changes**:
- Call `showTurnNotification(this.currentPlayer)` in `applyStatePatch()` when `currentPlayer` changes
- Call `showTurnNotification(this.currentPlayer)` in `initializeFromServerState()` for initial turn

### Step 5: Update Multiplayer Template for Turn Notifications

**Files**: `frontend/src/components/game/MultiplayerDinoGame.vue`

**Description**: Update notification template to support dynamic player color styling.

**Code Changes**:
- Modify notification div to include inline style for player color when type is 'turn':
```html
<div
  v-for="notification in notifications"
  :key="notification.id"
  :class="['notification', `notification-${notification.type}`]"
  :style="notification.type === 'turn' ? { '--player-color': getPlayerColor(notification.playerOrder) } : {}"
  @click="dismissNotification(notification.id)"
>
  {{ notification.message }}
</div>
```
- Import `getPlayerColor` from helpers

### Step 6: Add Notification System to Single-Player Game

**Files**: `frontend/src/components/game/DinoGame.vue`

**Description**: Add notification system to single-player game (same pattern as multiplayer).

**Code Changes**:
- Add `notifications: []` to data()
- Add `showNotification(message, type, playerOrder)` method (same as multiplayer)
- Add `dismissNotification(id)` method (same as multiplayer)
- Add `showTurnNotification(playerOrder)` method that creates message `Player ${playerOrder + 1} turn`

### Step 7: Add Notification Template to Single-Player Game

**Files**: `frontend/src/components/game/DinoGame.vue`

**Description**: Add notification container to template (same HTML structure as multiplayer).

**Code Changes**:
- Import `getPlayerColor` from helpers
- Add notification container div after GameGrid:
```html
<div id="notifications-container">
  <div
    v-for="notification in notifications"
    :key="notification.id"
    :class="['notification', `notification-${notification.type}`]"
    :style="notification.type === 'turn' ? { '--player-color': getPlayerColor(notification.playerOrder) } : {}"
    @click="dismissNotification(notification.id)"
  >
    {{ notification.message }}
  </div>
</div>
```

### Step 8: Add Notification CSS to Single-Player Game

**Files**: `frontend/src/components/game/DinoGame.vue`

**Description**: Add notification styles (copy from multiplayer with turn notification support).

**Code Changes**:
Add scoped CSS (same as multiplayer):
```css
#notifications-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-end;
  pointer-events: none;
}

.notification {
  padding: 12px 20px;
  background-color: #222222;
  border: 2px solid #d8a67e;
  border-radius: 6px;
  color: #ffffff;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  pointer-events: auto;
  min-width: 200px;
  max-width: 300px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  transition: opacity 0.3s, transform 0.3s;
  animation: slideIn 0.3s ease-out;
}

.notification:hover {
  background-color: #333333;
  border-color: #ae7b62;
}

.notification-turn {
  background-color: var(--player-color);
  border-color: var(--player-color);
  color: #000000;
}

.notification-turn:hover {
  filter: brightness(1.1);
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

### Step 9: Trigger Turn Notification in Single-Player Game

**Files**: `frontend/src/components/game/DinoGame.vue`

**Description**: Show turn notification at start of each player's turn.

**Code Changes**:
- Call `showTurnNotification(this.currentPlayer)` at the beginning of `startTurn()` method
- This will show notifications for both human and bot players

### Step 10: Write Tests

**Files**: `frontend/tests/components/turnNotification.spec.js` (new file)

**Description**: Unit tests for the turn notification feature.

**Tests**:
- Test notification displays correct player number for local game ("Player 1 turn", "Player 2 turn", etc.)
- Test notification displays correct player name for network game
- Test notification uses correct player color for background
- Test notification stacks when multiple are added (bot turns)
- Test notification auto-dismisses after 5 seconds
- Test notification can be dismissed by click
- Test `getPlayerNameByOrder()` returns correct username

### Step 11: Update Documentation

**Files**: `.claude/docs/game-components.md`

**Description**: Document the turn notification feature.

**Updates**:
- Add turn notification to DinoGame.vue documentation
- Document notification types (disconnect, reconnect, turn)
- Note the player color styling for turn notifications

### Step 12: Final Verification

**Commands**:
```bash
cd frontend && npm run lint
cd frontend && npm run test
```

**Manual Tests**:
- Single-player: Start game, verify "Player 1 turn" notification appears with blue background
- Single-player: End turn, verify "Player 2 turn" appears with mint background
- Single-player: Verify notifications stack during fast bot turns
- Single-player: Verify notifications fade out after 5 seconds
- Single-player: Click notification to dismiss early
- Multiplayer: Join game, verify notification shows player name instead of number
- Multiplayer: Verify opponent's turn shows their name with correct color
- Test with 4 players to verify all colors display correctly
- Test zoom levels - notification should stay fixed position
- Test on mobile viewport - notification should be visible

## Questions/Notes

1. **Notification text format**: The plan uses "Player {number} turn" for single-player and "Player {name} turn" for multiplayer, matching the original request.

2. **Stacking direction**: Using existing flex-direction column with gap, new notifications appear at the bottom of the stack. If "new ones above old ones" is strictly required, can change to `flex-direction: column-reverse`.

3. **Fade animation timing**: Using existing 5-second auto-dismiss. The `transition: opacity 0.3s` provides subtle fade effect.

4. **Reusing existing notification system**: The turn notifications reuse the same `notifications` array and methods, with a new `type: 'turn'` and dynamic player color styling via CSS variable. This maintains consistency and reduces code duplication.

5. **Player name in multiplayer**: Storing `playersData` array from server response provides access to usernames indexed by player order.
