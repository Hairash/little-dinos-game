---
name: game-logic
description: Guide to understanding and modifying game logic
---

Guide to the game logic implementation.

## Key Files

### Frontend Game Logic

| File | Purpose |
|------|---------|
| `frontend/src/game/models.js` | Unit, Building, Cell, Player classes |
| `frontend/src/game/const.js` | Game constants and settings |
| `frontend/src/game/fieldEngine.js` | Grid/field manipulation, unit movement |
| `frontend/src/game/waveEngine.js` | Pathfinding, reachable cells calculation |
| `frontend/src/game/botEngine.js` | AI player decision making |
| `frontend/src/game/helpers.js` | Utility functions |

### Backend Game Logic

| File | Purpose |
|------|---------|
| `backend/game/services/general.py` | Move validation, game state updates |
| `backend/game/services/visibility.py` | Fog of war calculations |
| `backend/game/services/field.py` | Field generation |

## Game Flow

1. **Turn Start** (`DinoGame.vue: startTurn`)
   - Restore unit move points
   - Produce new units at towers
   - Check win/lose conditions

2. **Player Actions** (`GameGrid.vue`)
   - Click unit to select
   - Click destination to move
   - Use Obelisk for scouting

3. **Move Processing** (Backend)
   - `apply_move_txn`: Validate and apply unit movement
   - `apply_end_turn_txn`: Handle turn transition
   - `apply_scout_txn`: Handle Obelisk reveals

4. **State Sync** (WebSocket)
   - Server broadcasts patches to all players
   - Each player receives fog-filtered field

## Modifying Game Mechanics

### Add New Building Type

1. Add to `Models.BuildingTypes` in `models.js`
2. Update `buildingContent()` in `CellContextHelp.vue`
3. Add building image to `/public/images/`
4. Update field generation in `field.py`
5. Implement building effect in relevant engine

### Modify Unit Movement

1. Movement logic: `fieldEngine.js: moveUnit()`
2. Pathfinding: `waveEngine.js: getReachableCoordsArr()`
3. Validation: `backend/game/services/general.py`

### Modify Combat

Combat happens in `fieldEngine.js: moveUnit()` when a unit moves onto an enemy.

### Modify Visibility

Visibility calculated in:
- Frontend: `fieldEngine.js: calculateVisibility()`
- Backend: `services/visibility.py: filter_field_for_player()`

## Testing Changes

1. Run frontend tests: `cd frontend && npm run test`
2. Test in single-player mode first
3. Test in multiplayer mode
4. Check fog of war filtering
