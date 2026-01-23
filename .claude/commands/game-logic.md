# Game Logic Helper

Help with game logic implementation and debugging.

## Context

This is a turn-based strategy game. Key concepts:

### Units
- Have movement points (how many cells they can move per turn)
- Attack adjacent enemies when movement ends
- Defined in `frontend/src/game/models.js` (Unit class)
- Server validation in `backend/game/services/move_validation.py`

### Buildings
- **Base**: Produces units, can be captured
- **Habitation**: Provides housing
- **Temple, Well, Storage, Obelisk**: Special buildings
- Defined in `frontend/src/game/models.js` (Building class)

### Visibility (Fog of War)
- Units reveal cells within their visibility radius
- Frontend: `frontend/src/game/fieldEngine.js`
- Backend: `backend/game/services/visibility.py`

### Turn Flow
1. Player moves their units
2. Player ends turn
3. Next player's turn begins
4. At turn start, bases produce new units

## Instructions

When the user asks about game logic:
1. Identify which component they're working on (units, buildings, visibility, turns)
2. Read the relevant files to understand current implementation
3. Provide targeted assistance

Key files to reference:
- `frontend/src/game/models.js` - Data models
- `frontend/src/game/const.js` - Game constants
- `frontend/src/game/fieldEngine.js` - Field operations
- `backend/game/services/general.py` - Core game logic
