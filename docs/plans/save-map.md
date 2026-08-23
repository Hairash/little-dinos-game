# Plan: Save & Load Map

Created: 2026-06-18
Status: Draft

## Overview

Add the ability to save a game's starting map (terrain + buildings + player positions + game settings) as a reusable "map" and launch new games from previously saved maps.

- **Single-player** maps live in `localStorage`.
- **Multiplayer** maps live in a new server table (`SavedMap`).
- Both modes use the **same canonical Map JSON schema** so the future map editor and any cross-mode import/export can reuse it.
- Saving is offered from the in-game menu (`GameMenuOverlay`). A new icon is added between the zoom-out and exit buttons.
- The single-player main menu (`GameMenu.vue`) is restructured: the current **"New Game"** button becomes a submenu (**"New Game"**) containing three options — **Tutorial** (moved out of the main menu), **Random map** (current flow), **Saved map** (new — list + preview + launch).
- The current **"Load Game"** button (resume autosave) stays where it is — it is functionally distinct from launching a fresh game from a saved map.

## Requirements

### Functional
- Player can save the current game's starting map from the in-game menu (`GameMenuOverlay`) at any point during a game.
- Default map name: `{players}-{width}x{height}-{YYYY-MM-DD}` with a numeric postfix appended only if the name is already taken (e.g. `6-20x20-2026-07-01-1`).
- Saving uses the **starting** state of the game, not the live state. Mid-game saves must produce identical maps regardless of how much the game has progressed.
- Player can browse saved maps from a new **Saved map** submenu under **New Game**, preview each map (field + settings), and start a new game from any of them.
- Player can delete a saved map from the list.
- On game end (win/lose/exit), any temporary "start snapshot" data is cleaned up.

### Non-functional
- Canonical Map JSON schema is versioned (`version: 1`) and reusable by the future map editor.
- Schema is identical between single-player and multiplayer.
- Schema excludes runtime fields (fog of war, scores, hasMoved, movePoints, isHidden, informed_lose, scrollCoords, win/turn phase). It contains only what the map editor will care about: terrain, buildings, units (starting positions), players' types, and game settings.
- Saved-map UI works without internet (single-player) and without auth (single-player). Multiplayer maps require auth.
- No breaking change to the existing autosave (`FIELDS_TO_SAVE`) or to the in-game `Game.field` JSON.

## Analysis

### Decisions confirmed with the user
- **Schema**: new canonical versioned schema (not a wrapper around `FIELDS_TO_SAVE`). Yes — the `version` field is precisely for forward migration: if we later switch to a more efficient encoding (e.g. RLE-compressed terrain, indexed dictionaries, binary base64 blob), we bump to `version: 2` and the validator dispatches to a v2 decoder. The validator MUST reject unknown versions loudly so old clients don't silently misinterpret newer maps. A trivial v1→v2 migration helper can be added when the second version lands.
- **Scope**: save **and** load (start-new-game-from-saved-map), including a Saved-map submenu with list + preview. MP launch-from-saved-map is also in v1 (see below).
- **Menu restructure**: "New Game" becomes a submenu with Tutorial / Random map / Saved map. Tutorial moves out of the main menu.
- **MP temp storage**: add `initial_field` `JSONField` on `Game` model, captured at status `ready → playing`.
- **MP launch from saved map**: included in v1. In `LobbyPage.vue`, when the host has created a game, the existing **"Setup Game"** button is renamed to **"Setup Random Game"** and a new **"Load Map"** button is added next to it. The "Load Map" button opens the same `SavedMapsPage` UI used in single-player (in "pick-and-return" mode). A small label above the button row shows the current selection: **"Random game"** by default, or the chosen map's name once a map has been picked. Picking a map seeds the server's `Game.settings` + `Game.field` from the saved map directly (no GameSetup step).

### Open sub-decisions (resolved)
- **Editing settings on launch**: when launching from a saved map, settings are used **as-is** — no edit step in v1. Future enhancement can allow tweaking before launch.
- **Player seat choice on launch**: the saved map records each seat as human or bot, and we honour that. No "swap seats" UI in this change — flagged as a desirable follow-up.
- **Cross-mode import**: out of scope for v1. The schema is identical, so a future "Export to file / import" is one feature away.

## Canonical Map JSON Schema (v1)

The schema is shared between client (SP) and server (MP). Defined once on each side. Strip the runtime fields below from snapshots.

```jsonc
{
  "version": 1,
  "name": "6-20x20-2026-07-01",
  "metadata": {
    "playersNum": 6,            // = humanPlayersNum + botPlayersNum
    "humanPlayersNum": 1,
    "botPlayersNum": 5,
    "width": 20,
    "height": 20,
    "savedAt": "2026-07-01T12:34:56Z"
  },
  "settings": {
    // gameplay knobs — full superset of GameSetup.vue settings, EXCLUDING
    // runtime status fields (winPhase, winner, etc.)
    "sectorsNum": 6,
    "enableFogOfWar": true,
    "fogOfWarRadius": 3,
    "visibilitySpeedRelation": false,
    "speedMinVisibility": 2,
    "minSpeed": 3,
    "maxSpeed": 6,
    "maxUnitsNum": 30,
    "maxBasesNum": 5,
    "unitModifier": 3,
    "baseModifier": 3,
    "buildingRates": { /* per-type rates */ },
    "hideEnemySpeed": false,
    "killAtBirth": true,
    "enableUndo": false
  },
  "field": [
    [
      // Cell: only structural data, no per-cell runtime state.
      {
        "terrain": { "kind": "land", "idx": 0 },
        "building": null,               // or { "player": 0|null, "_type": "base" }
        "unit": null                    // or { "player": 0, "_type": "warrior" }
      }
      // ... more rows
    ]
    // ... more cols
  ],
  "players": [
    { "_type": "human" },
    { "_type": "bot" }
    // ... one entry per seat, order = player index
  ]
}
```

**Excluded runtime fields (NOT in schema):**
- Cell: `isHidden`
- Unit: `movePoints`, `hasMoved`, `visibility` (visibility is derived from settings + buildings anyway)
- Player: `killed`, `lost`, `score`, `active`, `informed_lose`, `scrollCoords`
- Global: `winPhase`, `winner`, `humanPhase`, `lastPlayerPhase`, `lastPlayer`

### Affected Files

**Frontend (single-player + shared)**
- `frontend/src/game/mapSchema.js` *(new)* — `MAP_SCHEMA_VERSION`, `toCanonicalMap(snapshot)`, `fromCanonicalMap(map)`, validation.
- `frontend/src/game/mapStorage.js` *(new)* — localStorage CRUD: `listSavedMaps()`, `getSavedMap(name)`, `saveMap(map)`, `deleteSavedMap(name)`, `mapNameExists(name)`, `nextDefaultName(players, width, height, date)`. Stored under one `savedMaps` key as `{ [name]: Map }`.
- `frontend/src/game/const.js` — extend `FIELDS_TO_SAVE` with `initialMapSnapshot` so the snapshot survives autosave/resume.
- `frontend/src/game/eventBus.js` — register events: `saveMap`, `openSaveMapDialog`.
- `frontend/src/components/game/DinoGame.vue` — capture `initialMapSnapshot` at game start (after `loadFieldOrGenerateNewField`/`loadOrCreatePlayers` if NOT resumed), persist via autosave, handle `saveMap` event by calling `mapStorage.saveMap()`, clear snapshot on game end.
- `frontend/src/components/game/MultiplayerDinoGame.vue` — handle `saveMap` event by sending a new WS message; clear local snapshot reference on game end.
- `frontend/src/components/game/GameMenuOverlay.vue` — add "Save map" button between zoom-out and exit; emits `openSaveMapDialog`.
- `frontend/src/components/dialogs/SaveMapDialog.vue` *(new)* — modal with text input, default-name preview, Save / Cancel buttons; modeled on `ExitDialog.vue`. Handles in-place conflict detection (SP) or server-side error (MP).
- `frontend/src/components/game/GameMenu.vue` — main-menu restructure:
  - "New Game" button → opens **NewGameSubmenu** view (state `GAME_STATES.newGame`).
  - Tutorial button is removed from the main menu and moves into the submenu.
- `frontend/src/components/game/NewGameSubmenu.vue` *(new)* — three buttons: Tutorial, Random map, Saved map; emits `goToPage` to `tutorial`, `setup`, or `savedMaps` respectively.
- `frontend/src/components/game/SavedMapsPage.vue` *(new)* — list of saved maps (left pane, scrollable, modeled on `TutorialPage.vue`), preview pane (right, renders the map field + settings stats), Start Game / Delete buttons. Supports two modes via a prop: **`launch`** (default — Start Game button launches a fresh single-player game) and **`pick`** (Start Game button emits `mapPicked(map)` back to the caller; used by LobbyPage to seed an MP game).
- `frontend/src/components/game/MapPreview.vue` *(new)* — read-only renderer: wraps `GameGrid` with `tutorialInputBlocked=true` and pre-cooked props (cell size auto-fit; no fog). Or, if `GameGrid` proves to be too coupled, a slimmer purpose-built renderer that just walks the field array.
- `frontend/src/App.vue` — register new states `newGame`, `savedMaps`; route to new components; pass a "start from saved map" path into the existing `startGame(settings)` flow (settings come from the map + map's initial field is supplied to `DinoGame` via a new `initialMap` prop).
- `frontend/src/game/const.js` — extend `GAME_STATES` with `newGame` and `savedMaps`.

**Backend (multiplayer)**
- `backend/game/models.py` — extend `Game` with `initial_field = models.JSONField(null=True, blank=True)`. Add new `SavedMap` model: `user` (FK), `name` (CharField), `data` (JSONField), `players_num`, `width`, `height`, `created_at`. Unique constraint `(user, name)`.
- `backend/game/migrations/00XX_initial_field_and_savedmap.py` — auto-generated.
- `backend/game/services/map_snapshot.py` *(new)* — `capture_initial_snapshot(game)`, `to_canonical_map(game, name)`, `from_canonical_map(map_json)`. Pure functions, mirror frontend's `mapSchema.js`.
- `backend/game/consumers.py` — in `GameConsumer`:
  - At game start (status transition `ready → playing` in lobby/start path), call `capture_initial_snapshot(game)` and write to `game.initial_field`.
  - Handle new client message `{t: 'save_map', payload: {name}}` → validate, look up user, build canonical map from `game.initial_field` + `game.settings`, conflict-check `(user, name)`, persist `SavedMap`, reply with `{t: 'map_saved', payload: {name}}` or `{t: 'map_save_error', payload: {reason}}`.
- `backend/game/services/game_logic.py` *or* wherever game-start happens — call `capture_initial_snapshot` once when the game transitions to playing. Confirm via grep where this transition actually fires (likely `LobbyConsumer` or a `start_game` view/method).
- `backend/game/views.py` — REST endpoints for SavedMap CRUD (required in v1 since LobbyPage needs to list saved maps before a Game exists):
  - `GET /api/saved-maps/` → list current user's maps (full data — the list view needs preview content).
  - `DELETE /api/saved-maps/<name>/` → delete one.
  - (No POST — save happens via WS during a game.)
- `backend/game/urls.py` — wire the new endpoints.
- `backend/game/serializers.py` *(if used in this project; otherwise inline)* — `SavedMapSerializer`.
- `backend/game/consumers.py` — extend `LobbyConsumer` (or the existing game-create flow) to accept `{t: 'create_game_from_map', payload: {savedMapName}}` that seeds `Game.field` and `Game.settings` from the picked saved map (skipping the GameSetup random-generation path). Alternatively, expose this via a REST endpoint if game creation already lives there — confirm during implementation.
- `frontend/src/game/savedMapsApi.js` *(new)* — wrapper for REST calls to the new endpoints; used by `SavedMapsPage.vue` whenever it's rendered in MP context.
- `frontend/src/components/LobbyPage.vue` — host-only changes when a game has been created (`gameCode && isGameCreator`):
  - Rename the existing **"Setup Game"** button to **"Setup Random Game"**.
  - Add a new **"Load Map"** button next to it. On click, navigates to `SavedMapsPage` in `pick` mode.
  - Add a small label above the button row showing the current selection: **"Random game"** when no map is picked, or the map's `metadata.name` when one is.
  - Stash the picked saved map locally (lobby-page data); on **Start Game**, if a map is picked, send the new `create_game_from_map` message (or call the seed endpoint) before triggering start.
- `frontend/src/App.vue` — when `GAME_STATES.savedMaps` is opened from the lobby (MP context), pass `mode="pick"` to `SavedMapsPage` and a callback that returns the user to the lobby with the chosen map; in default SP context, pass `mode="launch"`.
- `frontend/src/game/websocket/gameWebSocket.js` — add `save_map` send method and `map_saved` / `map_save_error` event handlers; if `create_game_from_map` goes over WS, add it here too.
- `frontend/src/game/websocket/lobbyWebSocket.js` — same as above if the create-from-map flow lands on the lobby WS instead.

### Dependencies
- Existing autosave (`saveState()` in `DinoGame.vue`) — used to persist `initialMapSnapshot` alongside other fields.
- Existing `ExitDialog.vue` — pattern reference for `SaveMapDialog.vue`.
- Existing `GameGrid.vue` props `tutorialInputBlocked` / `isHidden` — used for read-only preview.
- Existing `TutorialPage.vue` list layout — pattern reference for `SavedMapsPage.vue` list pane.
- Backend `Game` model already has `field` and `settings` JSONFields — the snapshot logic only needs to deep-copy at the right moment.

### Risks / Considerations
- **Snapshot timing in MP**: must fire exactly once and before any move is processed. If the user reconnects between game-create and game-start the snapshot must still be present. Storing on the Game row (rather than in Redis) avoids this entirely.
- **Snapshot timing in SP**: `DinoGame.created()` calls `loadFieldOrGenerateNewField` and `loadOrCreatePlayers`. The snapshot must be taken only on a fresh game (not when resuming via autosave). Persist via `FIELDS_TO_SAVE` so a resumed game still has it. *Edge:* a game saved before this feature shipped has no `initialMapSnapshot` — handle gracefully by hiding the Save button in that case (or, simpler, accept that "Save" produces a map only if a snapshot is present).
- **Schema drift**: the canonical Map schema is implemented twice (JS + Python). Add a sanity test that round-trips a known fixture through both sides and gets the same bytes. Bake the version into the validator so we fail loud on unknown versions.
- **Map editor compatibility**: future editor will read/write this schema directly. To avoid future migrations, keep the schema minimal — no derived fields, no UI hints — and put extension points (`metadata.author`, `metadata.description`) at the metadata level rather than top-level.
- **Building/unit-ownership integrity**: a saved map encodes player indices on buildings/units. When loaded, the player-index space must match `metadata.playersNum`. Validate.
- **Preview rendering performance**: a 50×50 field rendered through `GameGrid` for preview should be fine (we already render this size in play), but lock down cellSize so the preview fits a card.
- **Naming collisions** are user-scoped in MP (unique per user) and global in SP (single browser, single user effectively). Default name's postfix is appended client-side after a quick lookup.

## Implementation Steps

### Phase A — Canonical Map Schema (shared foundation)

#### Step A1: Define schema in JS
**Files**: `frontend/src/game/mapSchema.js` *(new)*
- Export `MAP_SCHEMA_VERSION = 1`.
- Export `toCanonicalMap({ field, players, settings, humanPlayersNum, botPlayersNum, name, savedAt })` — builds Map JSON, strips runtime fields.
- Export `fromCanonicalMap(mapJson)` — returns `{ field (Cell[][]), players (Player[]), settings, metadata }` ready to plug into `DinoGame`.
- Export `validateMap(mapJson)` — checks version, shape, dims.
- Provide a single `RUNTIME_FIELDS_TO_STRIP` list for cell/unit/player so the strip logic has one source of truth.

#### Step A2: Define schema in Python (mirror)
**Files**: `backend/game/services/map_snapshot.py` *(new)*
- `to_canonical_map(field, settings, players, human_n, bot_n, name)` — returns dict with same shape as JS.
- `from_canonical_map(map_json)` — returns `(field, settings, players)`.
- `validate_map(map_json)` — same checks as JS side; raise `ValueError` on mismatch.
- Bake `MAP_SCHEMA_VERSION = 1` here too.

#### Step A3: Cross-side round-trip test
**Files**: `backend/game/tests/test_map_snapshot.py` *(new)*, `frontend/tests/mapSchema.spec.js` *(new)*
- Fixture: a known small canonical map (8×8, 2 players, deterministic).
- JS test: `fromCanonicalMap(toCanonicalMap(snapshot))` round-trips losslessly.
- Python test: same.
- JS test: feed the Python fixture (committed as JSON) through `fromCanonicalMap` cleanly.
- Python test: feed the JS fixture through `from_canonical_map` cleanly.

### Phase B — Single-player save

#### Step B1: Capture snapshot at SP game start
**Files**: `frontend/src/components/game/DinoGame.vue`, `frontend/src/game/const.js`
- Add `initialMapSnapshot` (default `null`) to component data.
- In `created()`, AFTER `loadFieldOrGenerateNewField`/`loadOrCreatePlayers`, if `!this.loadGame` (fresh game), call `toCanonicalMap(...)` with the freshly-generated field/players/settings and store on `this.initialMapSnapshot`.
- Add `'initialMapSnapshot'` to `FIELDS_TO_SAVE` in `const.js` so it persists across autosaves.
- Re-hydrate from autosave on resume just like other fields.
- Clear `initialMapSnapshot` (and from localStorage) on game end / "Exit" / "New Game" flows that wipe the autosave.

#### Step B2: localStorage CRUD for saved maps
**Files**: `frontend/src/game/mapStorage.js` *(new)*
- Backing key: `savedMaps` → JSON object `{ [name]: MapJson }`.
- `listSavedMaps() → MapJson[]` sorted by `metadata.savedAt` desc.
- `getSavedMap(name) → MapJson | null`.
- `saveMap(map) → void` (overwrites or rejects on conflict per caller's choice — accept overwrite=false flag).
- `deleteSavedMap(name) → void`.
- `mapNameExists(name) → boolean`.
- `nextDefaultName(playersNum, width, height, dateStr) → string` — tries `{p}-{w}x{h}-{date}`, then `-1`, `-2`, …

#### Step B3: Save-map dialog
**Files**: `frontend/src/components/dialogs/SaveMapDialog.vue` *(new)*
- Modal modeled on `ExitDialog.vue` (`position: fixed`, semi-transparent backdrop, z-index above `GameMenuOverlay`'s 10080 — use 10090 like ExitDialog).
- Text input pre-filled with `nextDefaultName(...)` result.
- Save button: validates non-empty, checks `mapNameExists` — if collision and user typed manually, show inline error "Name already exists". Otherwise calls `mapStorage.saveMap(...)` and emits `'saved'`. (In MP, emits `'saveRequested'` instead and waits for server reply.)
- Cancel button: closes the dialog, returns to `GameMenuOverlay`.

#### Step B4: Save button in `GameMenuOverlay`
**Files**: `frontend/src/components/game/GameMenuOverlay.vue`
- Insert a new `<button>` between the Zoom Out button (line 139–146) and Exit button (line 147–154).
- Title "Save map". Icon: needs a new asset (`save_icon.png`) — placeholder OK for v1 (e.g. reuse an existing icon like `arrow` rotated, or load `floppy.png` if added).
- On click: hide `GameMenuOverlay`, show `SaveMapDialog`. State managed at the controller (`DinoGame` / `MultiplayerDinoGame`) via the existing event bus pattern (`openSaveMapDialog`).
- After save, reopen `GameMenuOverlay` (or just resume — TBD; default: resume).
- Disable the button if `initialMapSnapshot` is missing (older autosave from before this feature).

#### Step B5: Wire SP save flow
**Files**: `frontend/src/components/game/DinoGame.vue`
- Listen for `openSaveMapDialog` event — toggle `showSaveMapDialog: true` data.
- Render `<SaveMapDialog v-if="showSaveMapDialog" :defaultName=... @saved=... @cancel=...>`.
- On `saved`: hide dialog, optionally toast or just resume (resume by default).

### Phase C — Single-player load (Saved-map menu)

#### Step C1: Restructure main menu
**Files**: `frontend/src/components/game/GameMenu.vue`, `frontend/src/game/const.js`, `frontend/src/App.vue`
- Add `GAME_STATES.newGame` and `GAME_STATES.savedMaps` to `const.js`.
- In `GameMenu.vue`: rename "New Game" to keep label but change `handleStartBtnClick` to emit `goToPage(GAME_STATES.newGame)`. Remove the Tutorial button (it moves into the submenu).
- In `App.vue`: add `v-if="state === GAME_STATES.newGame"` → `NewGameSubmenu`, and `v-if="state === GAME_STATES.savedMaps"` → `SavedMapsPage`.

#### Step C2: New Game submenu
**Files**: `frontend/src/components/game/NewGameSubmenu.vue` *(new)*
- Three buttons: **Tutorial**, **Random map**, **Saved map**.
- Tutorial → emits `goToPage(GAME_STATES.tutorial)`.
- Random map → emits `goToPage(GAME_STATES.setup)` (current "New Game" flow).
- Saved map → emits `goToPage(GAME_STATES.savedMaps)`.
- A Back button → emits `goToPage(GAME_STATES.menu)`.
- Style: match `GameMenu.vue`'s button look.

#### Step C3: Map preview component
**Files**: `frontend/src/components/game/MapPreview.vue` *(new)*
- Props: `map` (canonical MapJson), `maxSize` (px).
- Reconstruct `field` (Cell[][]) and `players` from `fromCanonicalMap(map)`.
- Render via `<GameGrid>` with `tutorialInputBlocked=true`, fog disabled, computed `cellSize = clamp(MIN_CELL_SIZE, floor(maxSize / max(width, height)), MAX_CELL_SIZE)`.
- If `GameGrid`'s coupling to a live engine proves too tight (e.g., needs a `fieldEngine` prop with non-trivial dependencies), fall back to a slim purpose-built renderer that walks the field array and emits the same cell visuals — but try `GameGrid` reuse first.

#### Step C4: Saved-maps page
**Files**: `frontend/src/components/game/SavedMapsPage.vue` *(new)*
- Layout: left list pane (modeled on `TutorialPage.vue`'s `.scenario-list`), right preview pane.
- List item shows `metadata.name`, `metadata.playersNum`, `metadata.width × metadata.height`, formatted `metadata.savedAt`.
- Click → set `selectedMap`.
- Preview pane shows `<MapPreview :map="selectedMap" />` + settings summary table (players H/B, fog on/off, speeds, unit/base limits, killAtBirth, etc.).
- Footer: **Start Game** (launches via `App.vue` `startGame(settings, initialMap=selectedMap)`), **Delete** (with confirm), **Back**.
- Empty state: "No saved maps yet."

#### Step C5: Wire launch-from-saved-map
**Files**: `frontend/src/App.vue`, `frontend/src/components/game/DinoGame.vue`
- In `App.vue`, extend `startGame` to accept optional `initialMap` argument and pass through as a prop to `DinoGame`.
- In `DinoGame.vue`, accept `initialMap` prop. If supplied:
  - Skip `createFieldEngine`'s random generation.
  - Use `fromCanonicalMap(initialMap)` to seed field/players/settings.
  - Behave otherwise like a fresh game (initialise the runtime fields back from defaults; capture a fresh `initialMapSnapshot` from the loaded map so the player can re-save it under a different name).
- Confirm: starting from a saved map produces gameplay identical to a freshly-rolled game with the same settings except deterministic terrain/buildings/start positions.

### Phase D — Multiplayer save

#### Step D1: Migration — `Game.initial_field` + `SavedMap`
**Files**: `backend/game/models.py`, new migration
- Add `initial_field` to `Game`.
- New `SavedMap(models.Model)` with `user`, `name`, `data`, `players_num`, `width`, `height`, `created_at`, `Meta.unique_together = ("user", "name")`.
- `makemigrations` + commit the migration file.

#### Step D2: Capture initial field at game start
**Files**: backend file that owns the ready→playing transition (likely `LobbyConsumer` or a `start_game` method). Confirm via `grep -rn "playing" backend/game/`.
- After the field is finalised and **before** any move is accepted, deep-copy `game.field` (or `to_canonical_map`-strip-and-store) into `game.initial_field`, save.
- Skip if `game.initial_field` is already set (idempotent on reconnect).

#### Step D3: WS `save_map` handler
**Files**: `backend/game/consumers.py`, `frontend/src/game/websocket/gameWebSocket.js`
- Backend: in `GameConsumer.receive_json`, handle `t == 'save_map'`:
  - Auth: must be a member of the game.
  - Validate name (length, charset, non-empty).
  - Compute canonical map via `to_canonical_map(game.initial_field, game.settings, players, ...)`. Use settings for human/bot counts and dims.
  - Conflict-check `(user, name)`. If colliding: reply `map_save_error`. Otherwise create `SavedMap` row and reply `map_saved`.
- Frontend: in `gameWebSocket.js` add `sendSaveMap(name)` and handlers `onMapSaved` / `onMapSaveError`.
- Frontend: `MultiplayerDinoGame.vue` listens for `openSaveMapDialog`, shows `SaveMapDialog` in MP mode, plumbs result through WS.

#### Step D4: REST list/delete endpoints
**Files**: `backend/game/views.py`, `backend/game/urls.py`, `frontend/src/game/savedMapsApi.js` *(new)*
- `GET /api/saved-maps/` → JSON array of `SavedMap.data` blobs for the current user.
- `DELETE /api/saved-maps/<name>/` → delete by `(user, name)`.
- Frontend wrapper in `savedMapsApi.js`. `SavedMapsPage.vue` chooses between `mapStorage` (SP) and `savedMapsApi` (MP) via the context it's mounted in (a prop or a small adapter selected by the caller).

### Phase F — Multiplayer launch from saved map (LobbyPage)

#### Step F1: LobbyPage UI changes
**Files**: `frontend/src/components/LobbyPage.vue`
- In the `gameCode && isGameCreator` block (around line 53–63):
  - Above the existing button row add a small label: `"Selected: Random game"` or `"Selected: {mapName}"`.
  - Rename **"Setup Game"** → **"Setup Random Game"**.
  - Add a new **"Load Map"** button next to it; clicking it navigates to `GAME_STATES.savedMaps` in pick mode (preserving the lobby state so we can return to it).
- Add `pickedMap` to component data (null by default; holds the canonical map JSON).
- Emit a new event `mapPickedForLobby` from `SavedMapsPage` when it's in pick mode and the user clicks Start Game.

#### Step F2: Wire pick-mode return path
**Files**: `frontend/src/App.vue`, `frontend/src/components/game/SavedMapsPage.vue`
- `SavedMapsPage` accepts a `mode` prop: `"launch"` (default) or `"pick"`. In pick mode, the Start Game button label becomes "Use This Map" and emits `mapPicked(map)` instead of starting the game directly.
- `App.vue` tracks where the user opened `SavedMapsPage` from. If from `LobbyPage`, on `mapPicked` it routes back to `GAME_STATES.lobby` and passes the picked map to `LobbyPage` (via prop or event-bus).

#### Step F3: Server-side seed-from-saved-map
**Files**: `backend/game/consumers.py` (or wherever game creation/setup currently happens), `backend/game/services/map_snapshot.py`
- Identify the existing "setup-game" path the host uses today (search for `setupGame`/`gameSetup` handlers on the backend).
- Add a path that accepts a saved map name (looked up against `SavedMap` for the requesting user) and writes its `data.field` and `data.settings` into `Game.field` / `Game.settings`. **Do not** start the game yet — the host still controls "Start Game". Also write to `Game.initial_field` immediately so a save-during-this-game produces the same map.
- The "Start Game" path (player count check etc.) stays unchanged.

#### Step F4: LobbyPage "Start Game" with picked map
**Files**: `frontend/src/components/LobbyPage.vue`, `frontend/src/game/websocket/*.js`
- When the host clicks **Start Game**:
  - If `pickedMap` is null → existing behaviour (use the field already produced by Setup Random Game).
  - If `pickedMap` is set → fire the seed-from-saved-map message **before** Start, then proceed with Start.
- Clear `pickedMap` if the host then clicks Setup Random Game (mutually exclusive with the random setup).

### Phase G — Cleanup & event-bus hygiene

#### Step G1: Snapshot cleanup on game end
**Files**: `frontend/src/components/game/DinoGame.vue`, `frontend/src/components/game/MultiplayerDinoGame.vue`
- On win/lose final dialog dismiss, on Exit, on "start new game" — clear `initialMapSnapshot` in component data and from localStorage (SP). On MP, no per-client cleanup needed beyond UI state; the `Game.initial_field` row can be left in place (it's small and the Game row is the lifetime).

#### Step G2: Event bus registration
**Files**: `frontend/src/game/eventBus.js`
- Add `openSaveMapDialog`, `saveMap`, `mapPickedForLobby` events to whatever doc/registration exists in this codebase. (If there's no registration, just call from the listeners as we do for `moveUnit` etc.)

## Testing Strategy

### Existing tests to extend
- `backend/game/tests/test_views.py` — extend with `GET /api/saved-maps/` and `DELETE /api/saved-maps/<name>/` happy / unauthorised / not-found paths.
- `backend/game/tests/test_models.py` — extend with SavedMap model basics (unique-per-user constraint).

### New tests
- `frontend/tests/mapSchema.spec.js` — round-trip + validation + version check (including a deliberate `version: 2` payload that must be rejected).
- `frontend/tests/mapStorage.spec.js` — list/save/delete/exists/nextDefaultName logic against a mocked localStorage.
- `backend/game/tests/test_map_snapshot.py` — `to_canonical_map` and `from_canonical_map` round-trip; cross-language fixture parity (load JSON fixture committed under `backend/game/tests/fixtures/map_v1_sample.json`).
- `backend/game/tests/test_consumers_save_map.py` — `save_map` WS path: happy path, name conflict, unauthorised user, missing `initial_field`.
- `backend/game/tests/test_consumers_create_game_from_map.py` — seed-from-saved-map flow: host-only auth, unknown map name, success populates `Game.field`/`settings`/`initial_field`.

### Manual verification
- Single-player: start a game, save with default name, save again — postfix appears. Save with custom name, save again same name — see "exists" error. Open Saved map menu, preview, start, play a turn, save again — second save reflects the same starting state as the first.
- Single-player: save, exit, return to menu, autosave-resume, save — saved-map JSON identical to the first save (modulo `savedAt`).
- Multiplayer: start a game, save mid-turn, reconnect, save again — both saves identical.
- Multiplayer: as host in lobby, click **Load Map**, pick one, see the label change to the map name; click **Start Game**; the game starts with that map's terrain/buildings/start positions. Save again from in-game → identical map round-trips.
- Multiplayer: REST list/delete via the new endpoints (browser network tab or a small Vue page).

## Verification Checklist

### Business
- [ ] Default name format matches `{players}-{w}x{h}-{YYYY-MM-DD}` with `-N` postfix on collision.
- [ ] Save uses initial state — confirmed identical across mid-turn vs. game-start save points.
- [ ] Saved map launches a playable game with the same starting positions (SP).
- [ ] LobbyPage host can click **Load Map**, pick a map, and start a multiplayer game from it.
- [ ] LobbyPage label correctly shows "Random game" or the picked map's name.
- [ ] Picking a map then clicking **Setup Random Game** resets the selection back to random.
- [ ] Tutorial is reachable from the new submenu, not the main menu.
- [ ] "Load Game" (resume autosave) still works exactly as before.
- [ ] Cross-language schema round-trips byte-identically (modulo dict ordering).
- [ ] Schema validator rejects unknown versions with a clear error.

### Code quality
- [ ] `frontend/src/game/mapSchema.js` and `backend/game/services/map_snapshot.py` share field names and shapes.
- [ ] Runtime fields are stripped at the canonical-map boundary.
- [ ] Default name generation is pure (no random / time inside — pass `date` in).
- [ ] No new global event-bus events left undocumented.

### Tests + lint
- [ ] `cd frontend && npm run format && npm run lint:fix && npm run lint`
- [ ] `cd frontend && npm run test`
- [ ] `cd backend && source venv/bin/activate && black . && ruff check . --fix && ruff check . && mypy game/`
- [ ] `cd backend && pytest`
- [ ] `cd backend && python manage.py migrate` (apply new migration locally)

## Deployment Order
1. Backend (migration + WS handler + `SavedMap` model). Fly deploy.
2. Frontend (Netlify auto-deploys on `main` push).

Backend must ship first so the `save_map` WS handler exists when the frontend starts emitting it.

## Notes & Follow-ups (out of scope for v1)
- Export to file / import from file: easy follow-up once the canonical schema is settled.
- Map editor: separate plan; will read/write canonical Map JSON directly.
- "Edit settings on launch" when starting from a saved map: future polish.
- "Swap seats" UI on launch (let the player pick which seat is human): desirable follow-up.
- Cross-mode import (SP map → MP, MP map → SP): trivial once endpoints exist; schema is identical.
- Schema v2 (e.g. RLE-compressed terrain, dictionary-encoded buildings): add a v1→v2 migration helper at the time we introduce it.

---

## Changes Made

### Iteration: 2026-06-18

| Comment | Location | Resolution |
|---------|----------|------------|
| "May we change the schema later using version field? E.g. if decide to use more efficient way to store maps?" | Decisions confirmed → Schema | Yes — added explicit guidance: validator MUST reject unknown versions, future v2 lands with a migration helper. Added a v2 follow-up note. Added a "rejects unknown versions" verification checklist item and a deliberate-v2 unit test. |
| "When the host creates game there is an option to 'Setup game'. We should add 'Load map' nearby, rename 'Setup game' to 'Setup random game', and show a small label above the row." | Open sub-decisions → MP launch from saved map | Promoted into v1 scope. Added LobbyPage UI changes (button rename, new "Load Map" button, selection label). Added new **Phase F** (Steps F1–F4) covering LobbyPage UI, pick-mode return path, server-side seed-from-saved-map, and Start-Game wiring. `SavedMapsPage.vue` gains a `mode` prop (`launch` / `pick`). REST endpoints promoted from optional to required (LobbyPage needs them before a Game exists). Renamed the cleanup phase to **Phase G** to make room. Added test files and verification checklist items for the new flow. |
| "Keep as is for now" | Open sub-decisions → Editing settings on launch | Marker removed. Decision retained: settings used as-is on launch in v1. |
| "Would be nice later, but let's skip for now" | Open sub-decisions → Player seat choice | Marker removed. Decision retained: honour saved seat types; added explicit "swap seats" follow-up to the Notes section. |

**Summary of updates:**
- Made schema versioning forward-compatibility explicit, with a test and a verification item.
- Brought MP launch-from-saved-map into v1 with full LobbyPage UX and a new **Phase F** (4 steps).
- `SavedMapsPage` now has a `launch` / `pick` mode prop so it can serve both single-player Start Game and host-only map picker.
- REST endpoints (`GET/DELETE /api/saved-maps/`) promoted from optional to required.
- Renamed Phase E (cleanup) to Phase G; added Phase F slot.
- Tests and verification checklist expanded for the new MP launch path.
- Three deferred sub-decisions confirmed and markers removed; one new follow-up ("swap seats") added to the Notes section.
