# Scenarios

Scenarios are pre-designed single-player maps with a story hook —
"Ambush", "King of the Hill", etc. Each one is a hand-built canonical
Map JSON (see `mapSchema.js`) that runs through exactly the same code
path as a saved map: `ScenariosPage` emits `startGame` with the chosen
map as `initialMap`, and `DinoGame` rehydrates it the same way it
rehydrates a localStorage save.

There is no parallel engine, no scripted hints (that's the tutorial
system — see `tutorial.md`), and no per-step state machine. A
scenario is just a starting field plus a settings block.

---

## File layout

### Built-in scenarios (read-only JSON files)

Built-ins are one JSON file per scenario in
`frontend/src/game/scenarios/`, using the **same wrapper format the Map
Editor's Export produces** (`{ kind, version, description, map }`). To
add or change a default scenario, author it in the editor, Export it,
and drop the file into the folder — both `.json` and `.ldm` names are
picked up.

**Ordering**: files are listed in filename order, so a numeric prefix
controls the picker order (easiest first, say). **Zero-pad it** — the
sort is lexicographic, so an unpadded `2-foo.json` lands after
`10-bar.json`. Any separator after the digits works (`01-ambush.json`,
`01 Wild world.json`), and the prefix is stripped from the entry id so
renumbering to reorder the list never changes a scenario's identity.
Leaving gaps (`10-`, `20-`, `30-`) means inserting a scenario later is
one new file instead of renaming every file after it. Built-ins never appear in the Map Editor
and cannot be edited — the old override layer is gone (existing
overrides are migrated into user scenarios once, see _Legacy override
migration_).

| File                                              | Role                                                                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `frontend/src/game/scenarios/*.json`              | The shipped scenarios, one wrapper-format file each. Content, not code — add, remove or renumber freely; the tests assert the folder's contract, never a particular set.                                          |
| `frontend/src/game/scenarios/index.js`            | Folder loader: `import.meta.glob` over `./*.json` / `./*.ldm`, sorted by filename. Exports `SCENARIOS` (array of `{ id, description, map }`) and `getScenarioById`.                                               |
| `frontend/src/components/game/ScenariosPage.vue`  | List + preview + Start Game UI. Mirrors `SavedMapsPage.vue`; lists built-ins from `SCENARIOS` **merged with user-authored scenarios from `mapEditorStorage`**, with an "↑ Import scenario from file" item on top of the list (same `.ldm`/`.json` import the editor offers — lands in the user bucket). |
| `frontend/src/components/game/NewGameSubmenu.vue` | The "Scenarios" button that routes to the page.                                                                                                                                                                   |
| `frontend/src/App.vue`                            | The `v-if="state === GAME_STATES.scenarios"` branch that mounts `ScenariosPage`; plus the editor branches (see below).                                                                                            |
| `frontend/src/game/const.js`                      | `GAME_STATES.scenarios`, `GAME_STATES.mapEditor`, `GAME_STATES.mapEditorCanvas`.                                                                                                                                  |

### Map Editor (user-authored scenarios)

| File                                                     | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/game/mapEditorStorage.js`                  | localStorage CRUD for user scenarios (`mapEditor.scenarios.v1`) + unified accessors that ALSO route to the saved-maps bucket. Per-bucket helpers: `listEditorScenarios`/`getEditorScenarioById`/`saveEditorScenario`/`deleteEditorScenario`. **Unified accessors** the canvas calls: `getAnyEditorEntry(id, source)`, `saveAnyEditorEntry`, `deleteAnyEditorEntry` — routing on the entry's `source` (`'scenario'` \| `'savedMap'`, see `ENTRY_SOURCES`); saved maps live in `mapStorage.js`'s `savedMaps` bucket with the map **name** as the id (a rename moves the key and refuses to clobber an existing name). Also: `buildScenarioFile`/`importEditorScenario` (export/import, `.ldm`), `migrateLegacyBuiltinOverrides` (one-time copy of the retired override bucket into user scenarios), `createNewScenario` (factory, default name `{seq}-{W}x{H}-{YYYY-MM-DD}-{rev}`, seeds `EDITOR_DEFAULT_SETTINGS` with `enableUndo: true`), `resizeMap`, `updatePlayerCounts`, `playerCountChangeWouldDrop`. |
| `frontend/src/components/editor/MapEditorListPage.vue`   | The Map Editor list with **two tabs** — _Scenarios_ (user-authored; "+ Create new" and "↑ Import" live here) and _Saved maps_ (the `savedMaps` bucket; shows the saved date instead of a description). Built-ins are not listed. Shared per-entry actions on both tabs: **Edit** (opens the canvas with `{ id, source }`), **Test** (immediate SP launch of the selected entry, scout mode forced on), **Export** (downloads the entry as a `.ldm` file), **Delete**. Parameter editing happens inside the canvas's ⚙ menu — **not** here. |
| `frontend/src/components/editor/MapEditorCanvasPage.vue` | Game-style canvas, intentionally indistinguishable from a live game at a glance. Cells use the exact same DOM shape as `GameGrid` (`.board > .cell_line > div.cell` with `inline-block` cells and `<img class="terrainImg">` for terrain — no per-cell borders, no gaps). Persistent UI is only the **bottom panel** (`panel.png`, max-width 400px, centred — same as `InfoPanel`): gear + zoom + undo on the LEFT, tool buttons + Move on the RIGHT (see _Bottom panel layout_). The gear opens an overlay that visually clones `GameMenuOverlay`: `ingame_menu_border.png` outer plate + `ingame_menu_texture.png` inner parchment, black text, button row at the bottom (Back / Help / Save / Exit) using `small_button.png` 26×26 + 22×22 icons. Tracks a `dirty` flag and prompts on exit if there are unsaved changes. Tool subtypes are picked via **floating popups** anchored to the bottom panel (there is no longer a separate dialog component).                                              |
| `frontend/src/game/longPressTouch.js`                    | Global iOS long-press → synthetic `contextmenu` dispatcher, installed once from `main.js`. Lets every `@contextmenu` consumer in the app (editor tool buttons, gear-menu hints, cell menus) fire on a touch long-press even though iOS Safari won't emit `contextmenu` on plain elements. See _iOS long-press → contextmenu synthesis_.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `frontend/src/components/game/GameMenu.vue`              | The top-level "Map editor" button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

(`ToolOptionsDialog.vue` was removed — tool subtypes are now edited through the bottom-panel floating popups, not a modal dialog.)

---

## Runtime flow

1. `New Game` → `NewGameSubmenu` → "Scenarios" → `emitter.emit('goToPage', GAME_STATES.scenarios)`.
2. `App.vue` renders `ScenariosPage`. The page merges `SCENARIOS` with any **built-in overrides** applied (so an edited built-in previews its edited form) and appends user scenarios, then shows the description and a `MapPreview` for the selected entry. When the map has fog of war on, the preview is **masked to the human player's starting visibility** (`viewingPlayer`) so it doesn't spoil the layout — see _Fog-of-war preview masking_.
3. "Start Game" emits `startGame` with the canonical map flattened into a settings payload (same shape as `SavedMapsPage.mapToStartSettings`) **plus** an explicit `enableScoutMode: true` (see _Rules_ below).
4. `App.startGame` stores the payload as `settings` and switches state to `game`.
5. `DinoGame` mounts, reads `initialMap`, rebuilds `Models.Cell`/`Building`/`Unit` instances, and reseeds each unit's `movePoints`/`visibility` via `createNewUnit(player, minSpeed, minSpeed, …)` — exactly as it does for saved maps. Starting unit speed is `minSpeed`, **except** editor maps that stamp an explicit `movePoints` (including `0`) on a starter, which is honoured instead — see _Honoring explicit unit speed_.

There is no backend involvement and no localStorage write at launch. The map JSON lives in memory only.

---

## Rules every scenario must follow

These are engine-level constraints, not stylistic preferences. Violating
them produces visibly broken games.

### 1. Fog of war blocks movement (`enableScoutMode: true`)

The naming is historical and inverted from what you'd guess:

| `enableScoutMode`                           | Behaviour                               |
| ------------------------------------------- | --------------------------------------- |
| `true` (modern, **required for scenarios**) | Units cannot path through hidden cells. |
| `false` (legacy "scout mode")               | Units can plot a path through fog.      |

`enableScoutMode` is **not** in `SETTINGS_FIELDS` (mapSchema.js), so it
is stripped from any canonical map's `.settings`. To keep the modern
rule, every map-launch boundary forces `enableScoutMode: true` into the
start payload: `ScenariosPage.vue`, `SavedMapsPage.mapToStartSettings`,
and the editor list page's **Test** button. Don't try to put it in a
map's settings — the schema drops it. The option is legacy and always
`true` for map launches; the legacy permissive mode (units pathing
through fog) is not a playable option here.

### 2. Only `base` has per-player owners

The engine treats building ownership like this:

- **`base`** — owned by a player. `building.player` is the index. Captured by walking onto it (`captureBuildingIfNeeded`, see `fieldEngine.js`).
- **`habitation`, `temple`, `well`, `storage`, `obelisk`** — always neutral (`building.player === null`). The owner's bonus is awarded by **occupation** (a unit standing on the cell) via `getBuildingsOccupied`, not by ownership.

So in scenarios:

```js
placeBuilding(field, x, y, "base", 0); // player 0's tower — OK
placeBuilding(field, x, y, "base", null); // neutral tower to capture — OK
placeBuilding(field, x, y, "habitation", null); // bonus building — OK
placeBuilding(field, x, y, "habitation", 0); // BROKEN: see below
```

A player-owned non-base building has no asset (`habitation1.webp` does
not exist — only `base1.webp` … `base8.webp` ship per-player variants)
and is meaningless to the engine. Both `GameCell.getBuildingImg` and
`MapPreview.buildingImage` only append the `+1` suffix for `base`; the
engine's `getBuildingsOccupied` ignores `building.player` entirely for
non-base types. Use `null` for everything except bases.

### 3. Starting unit speed is `minSpeed`

When `DinoGame` rehydrates `initialMap`, every starting unit's
`movePoints` is reseeded via `createNewUnit(player, minSpeed, minSpeed, …)`
— both bounds collapsed to `minSpeed`. So:

- The `_type` on a unit (`dino1`, `dino2`) controls its sprite/colour.
- For **built-in** scenarios and random maps, the speed of starting units is always `minSpeed`, regardless of what was on the unit in the map JSON. To give starters more move points, raise `minSpeed` for the scenario.
- Newly **produced** units use the full `[minSpeed, maxSpeed]` range, modified by temples adjacent to the producing base.

This is the same behaviour random maps get; scenarios just inherit it. **Exception:** map-editor scenarios may stamp an explicit `movePoints` (including `0`) on a starter, which overrides the `minSpeed` reseed — see _Honoring explicit unit speed_ below.

### 4. Connectivity is the author's responsibility

`CreateFieldEngine.makeFieldLinked` is **not** called for scenarios —
the random-map flow runs it because mountains are placed randomly, but
hand-authored fields skip the whole `generateField` path. If you wall
off a unit or a base behind mountains it can't navigate, the
scenario will be unplayable and nothing will warn you.

When you finish a scenario:

- Launch it from the in-game menu and visually trace each player's
  reachable area.
- Pay special attention to narrow passes — `mountain()` won't overwrite
  a cell that already holds a building/unit, but it _will_ fill
  one-cell gaps you forgot about.
- Check the bot can reach the player. Bots stuck in a pocket make for
  a non-game.

### 5. Terrain `idx` ranges

| Kind       | `idx` range | Why                                                                                                                                                                                                                        |
| ---------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `empty`    | 1 – 9       | Nine `empty{n}.webp` assets.                                                                                                                                                                                               |
| `mountain` | 1 – 5       | Only `mountain1.webp` … `mountain5.webp` exist. `GameCell` and `MapPreview` mirror `idx 6..9 → 4..1` defensively, but staying in `1..5` keeps the preview honest. The builder's `mountainIdx(x, y)` always returns `1..5`. |

The `emptyIdx`/`mountainIdx` helpers are deterministic (`(x + y * …) % N`) so the same scenario looks the same every launch — no `Math.random()` at module load.

---

## Map composition

### Coordinate convention

`field[x][y]` — `x` is the column, `y` is the row, both 0-indexed.
`(0, 0)` is the top-left. This matches the canonical schema and every
engine in the codebase; don't transpose it.

(The old procedural builder DSL in `scenariosData.js` is gone — built-in
maps are static JSON now, and new maps are authored in the Map Editor.)

---

## Adding a new built-in scenario

1. **Build the map in the Map Editor** (or hand-write the JSON if you
   must — the wrapper shape is `{ kind: 'little-dinos-scenario',
   version: 1, description, map }`).
2. **Decide the seat counts.** `humanPlayersNum` is 1 — built-ins are
   single-player only. Bots: 1 to ~5.
3. **Pick the map size.** 16×16 to 20×20 is the sweet spot. Anything smaller feels cramped with `fogOfWarRadius = 3`; anything bigger and the bot turn drags. For corridor-shaped scenarios, asymmetric sizes (e.g. 22×11 for "Mountain Pass") work well.
4. **Fill the description** in the editor's ⚙ menu (2–3 sentences
   explaining the situation and the strategic hook — shown next to the
   preview) and common settings tweaks: `enableFogOfWar: false` for
   "everyone sees the prize" premises, `minSpeed: 2+` for faster starters,
   `maxUnitsNum: 6`/`7` for headroom, `fogOfWarRadius: 2` for mazes.
5. **Export** the entry (`.ldm`) and drop the file into
   `frontend/src/game/scenarios/` with an `NN-` order prefix, e.g.
   `11-my-scenario.json` (rename freely — the id derives from the
   filename with the prefix stripped).
6. **Walk the map.** Launch the scenario, open the fog, check that every player can reach every other player. Verify no buildings are stranded behind a wall the bot can't navigate.
7. **Lint and test.** `npm run format && npm run lint:fix && npm run lint && npm run test` (`tests/game/builtinScenarios.spec.js` pins the folder contract (valid maps, unique prefix-free ids, blue placed) and adapts to whatever the folder holds).

---

## What scenarios are NOT

- **Not the tutorial.** Tutorials script step-by-step hints with the scenario as a backdrop; see `docs/tutorial.md`. Scenarios are sandbox starts — no hints, no win condition beyond the regular elimination rule, no per-step locking of UI.
- **Built-ins are single-player only.** They run in `DinoGame.vue` with 1 human seat plus bots, and the lobby picker doesn't list them. **Custom scenarios and saved maps ARE multiplayer-capable** — see _Playing maps in multiplayer_ below.
- **Built-ins are read-only.** The Map Editor never lists them and there is no override layer any more. To riff on a built-in, Import its exported file as a user scenario (or just build your own).
- **Not validated for playability.** `validateMap` runs only on the canonical-map _shape_ (client-side on save/import, server-side on multiplayer start). It does not check that mountains don't trap units, that the bot has a reachable base, or that a "No Tower" scenario is actually winnable. That's on you. Walk every scenario before merging.

---

## Playable seats vs. declared capacity

`metadata.playersNum` is the map's **colour capacity** — how many owner
colours the editor offers. A designer can leave slots empty, and an empty
slot is **not a playable seat**: whoever is assigned to it starts with
nothing and is eliminated on their first turn.

The playable seats are **derived from the field**, never stored: any slot
owning at least one unit or one base (neutral buildings belong to nobody
and never count). Deriving avoids the drift a cached count would suffer
the moment a map is edited, imported, or hand-written, and the scan is
O(width × height) over at most 50×50 cells.

| Helper | Where |
| ------ | ----- |
| `getOccupiedSeats(map)` → `[0, 3, 6]` | `frontend/src/game/mapSchema.js` |
| `getActualPlayerCounts(map)` → `{ seats, total, humans, bots }` | `frontend/src/game/mapSchema.js` |
| `occupied_seats(field)` → `[0, 3, 6]` | `backend/game/services/map_snapshot.py` |

Keep the two languages in sync, as with `updatePlayerCounts` /
`reconcile_seats`.

**Seats stay sparse — colours are never renumbered.** A map using blue,
yellow and purple is seats `[0, 3, 6]`, and the second player plays
*yellow*, not a compacted seat 1. That works because `order` already *is*
the seat index everywhere (ownership, visibility filtering,
`getPlayerColor`), and `compute_next_player` walks the player rows rather
than a dense `0..N` range, so gaps rotate correctly.

Consequences across the app:

- **Single-player**: only placed slots are seated. Empty slots stay in the
  `players` array as inactive, non-participating placeholders (the array
  is indexed by seat — collapsing it would repaint everyone), and turn
  rotation skips them for being inactive. The turn opens on the first
  placed seat.
- **Multiplayer**: the lobby's capacity is the placed-seat count, and at
  start each joiner is given a real map seat in join order (creator →
  seat 0). Placed seats nobody claimed are trimmed by `reconcile_seats`.
- **In-game menu**: the player table lists only participating seats, so a
  7-slot map with three colours shows three rows, not seven.
- **Pickers** show the playable count (`3p`); the **editor** shows
  `3 of 7` so a designer sees the gap while building.
- `Models.Player.participating` carries the flag (persisted through
  save/load; absent in older saves, which are treated as all-participating).

### Why blue must be placed (multiplayer)

`order == 0` is how the creator is identified, and each joiner is handed a
real map seat at start — so seat 0 has to be one of the playable seats or
the creator would end up without order 0. `start_game` rejects a
multiplayer map whose blue slot is empty. Designers start from blue
anyway, so this is a guard rail rather than a real constraint.

---

## Playing maps in multiplayer

Custom scenarios and saved maps can seed multiplayer games. The lobby's
**"Load Map"** opens `SavedMapsPage` in pick mode with two tabs — _Saved
maps_ and _Custom scenarios_ — both reading the client's localStorage
(built-ins are excluded). Flow:

0. The Custom scenarios tab carries an "↑ Import scenario from file"
   item, the same one the single-player Scenarios page offers and writing
   to the same `mapEditor.scenarios.v1` bucket — so a scenario someone
   sends you can be imported and played without backing out of the lobby.
1. The creator picks a map. The pick's summary (name + seat count) is
   synced to the server (`POST /games/{code}/map/`) and broadcast to the
   lobby, so joiners see which map they're getting. Picking "Setup Random
   Game" clears it.
2. **Join capacity**: while a map is picked, `join_game` refuses joins
   beyond the map's PLAYABLE seat count with an explanatory message.
3. On Start, the full canonical map travels in the request
   (`settings.initialMap`). The server **validates it** (schema v1,
   dimensions 5–50, ≤ 8 seats, ≤ 3 MB payload, blue placed — client JSON
   is never trusted), hydrates the field, and **reconciles seats**: joined
   players take the map's PLAYABLE seats in join order (creator = seat 0,
   blue; seats can be sparse, see _Playable seats vs. declared capacity_);
   unclaimed playable seats are trimmed via `reconcile_seats` (units
   dropped, bases demoted to neutral — the Python mirror of the editor's
   `updatePlayerCounts` rule). More joiners than playable seats → HTTP
   400, the game stays `ready`.
4. The map's human/bot split metadata is ignored in multiplayer — every
   joined player is human (`botPlayersNum = 0`; when MP bots arrive,
   their seats extend the kept set passed to `reconcile_seats`).
5. The server stamps `settings.fromInitialMap = true` so the in-game
   Save-map button hides (only random maps are saveable). The flag is not
   part of `SETTINGS_FIELDS`, so it never round-trips into a saved map.
6. `hydrate_field_for_game` honours the editor's explicit unit
   `movePoints` (including speed 0) exactly like `DinoGame.vue` does —
   see _Honoring explicit unit speed_.

---

## Map Editor

The Map Editor is a UI for authoring scenarios at runtime — terrain,
buildings, and units placed cell-by-cell via point-and-click.
User-authored scenarios live in `localStorage` under
`mapEditor.scenarios.v1` and appear in the "Scenarios" picker alongside
the built-ins (no separate launch path — play them the same way you play
"Ambush"). The editor also lists and edits **saved maps** (its second
tab), and both kinds are usable in multiplayer via the lobby picker —
see _Playing maps in multiplayer_.

### Entry points

- **Main menu → "Map editor"**: the top-level button. Routes to the list page (no New Game submenu in between — this is by design; the editor is a separate concern from launching games).
- **List page**: two tabs — **Scenarios** (user-authored) and **Saved maps** — with the entry list on the left, preview + settings icon-row + description (or saved date) on the right. This page is read-only for parameter values — same icon vocabulary as `SavedMapsPage` so the two pages feel like siblings. Per-entry actions on both tabs: **Edit** (opens the canvas), **Test** (immediate SP launch), **Export** (`.ldm`), **Delete**.
- **List page → "+ Create new scenario"**: opens a small dialog for `width / height / total players`. Defaults to `20 × 20 / 2`. The total is split as 1 human + (total − 1) bots — the same split the gear-menu Players row enforces. On Create, a blank entry is persisted with the auto-generated name `{seq}-{W}x{H}-{YYYY-MM-DD}-{rev}` (e.g. `6-20x20-2026-07-01-1`) and the app immediately routes to the canvas editor — the user doesn't bounce back to the list.
- **Canvas page**: the only persistent UI is the bottom panel — **no top header, no back arrow, no title**. The map fills the viewport (less the panel) and is scrollable on both axes. The panel carries gear + zoom + undo on the left and the tool buttons + Move on the right (see _Bottom panel layout_).
- **Canvas page → ⚙ gear icon** (bottom-left, `settings_icon.webp` — same asset as the in-game `toggleMenu`): opens the overlay holding the **map parameters form** and a game-style **icon button row** at the bottom matching `GameMenuOverlay`'s: `← Back` (close menu), `? Help`, `💾 Save`, `✕ Exit`. Zoom lives on the bottom panel, not in this row (step `±10` between `[MIN_CELL_SIZE, MAX_CELL_SIZE]`, same constants as the in-game `changeCellSize`).
- **Icon-only form**: every parameter except scenario name + description is a single row of `[setting-icon] [input or value]`, using the same `icon.png`-plated asset vocabulary as `SavedMapsPage` and the list page's preview. No text labels, no section headings. Toggles (fog, vis/speed relation, kill-at-birth, hide-enemy-speed) are clickable icons that swap to the paired off-asset when off — the asset itself is the state cue. (Undo is not a setting — it's always on; see _Where the data lives_.)
- **Dimensions** row shows `{W}×{H}` next to a pencil-icon button (`pencil_icon.webp`, in an `.edit-btn` plate). Clicking it opens a centered modal (`error_plate.png` plate — same plate `SaveMapDialog` uses, sits at z-index 10090 above the gear menu) with width/height inputs + 💾 (apply, same `save_icon`) and ✕ (cancel, same `exit_icon`). Apply pads bottom/right when growing, truncates bottom/right when shrinking (units/buildings in dropped cells are silently lost).
- **Players** row shows the single **total** next to a pencil-icon button (`pencil_icon.webp`) (no human/bot split surfaced — the editor locks the split at 1 human + (total − 1) bots, matching the create dialog). Same modal-dialog pattern. Apply rebuilds the `players[]` array, updates the metadata counters, and reconciles the field: units owned by removed players are dropped and player-owned bases of removed players are demoted to neutral (`player: null`) so the base stays on the field as a capturable tower. If the change would drop anything, a `ConfirmDialog` is shown first. The dino/building tool's active owner is auto-clamped to a valid index after the update.

### Bottom panel layout

The only persistent UI is the bottom panel (`panel.png`, max-width 400px, centred — same as the in-game `InfoPanel`), split into two groups of 26×26 `.infoBtn` plates:

- **Left group:** ⚙ gear → `+` zoom-in → `−` zoom-out → ↶ undo. Zoom steps ±10 px between `MIN_CELL_SIZE`/`MAX_CELL_SIZE` (same constants as the in-game `changeCellSize`); the `+`/`−` buttons disable at the range ends and undo disables when there's nothing to revert.
- **Right group (tools):** Terrain → **Building cluster** → **Dino cluster** → Eraser → Move.

The **Building** and **Dino** tools are **clusters**: a normal icon-half `.infoBtn` (shows the configured type / dino) sitting next to a small **colour-square** (shows the configured owner colour). Left-clicking either half arms the tool; the two halves have _distinct_ right-click menus (see _Floating popups_). Terrain, Eraser, and Move are single buttons.

### Keyboard shortcuts

Desktop-only (keyboard, so never on touch), handled in `handleKeydown`. Each button's `title` also carries its key:

| Key | Action             |     | Key       | Action                     |
| --- | ------------------ | --- | --------- | -------------------------- |
| `T` | Terrain tool       |     | `Z`       | Undo                       |
| `B` | Building tool      |     | `=` / `+` | Zoom in                    |
| `U` | Unit (dino) tool   |     | `-`       | Zoom out                   |
| `E` | Eraser tool        |     | `.`       | Toggle the gear menu       |
| `M` | Move tool (toggle) |     | `Esc`     | Cancel an in-progress Move |

Letter keys are case-insensitive. Shortcuts are suppressed while a text/number field has focus, while any modifier (Ctrl/Cmd/Alt) is held (so browser undo/zoom and `Cmd+Z` still work), and — except `.` (menu) and `Esc` (cancel-move) — while an overlay/dialog is open. A handled shortcut also dismisses any transient floating popup / cell menu.

### Tool model

Five actions live on the right group — four placement tools plus Move:

| Action       | Left-click a cell                                                                                                                     | Right-click the button                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Terrain**  | Sets terrain to the configured kind. **Refuses** `mountain` on a cell holding a building/unit.                                        | Kind popup (empty / mountain).                                                |
| **Building** | Sets building to the configured type + owner. **Refuses** on mountain. Forces `player = null` for any non-`base` type (see _Rule 2_). | Icon-half → type popup; colour-square → owner popup (neutral + one per seat). |
| **Dino**     | Places a unit owned by the configured player at the configured speed. **Refuses** on mountain.                                        | Icon-half → speed popup (**0–20**); colour-square → owner popup.              |
| **Eraser**   | Wipes the cell (terrain → empty, building/unit → null).                                                                               | Nothing.                                                                      |
| **Move**     | Advances the Move state machine (see _Move tool_).                                                                                    | Shows a right-click hint.                                                     |

Left-click on a tool button arms it via `selectTool(id)`, which also **cancels any in-progress Move flow** so only one bottom-panel button ever wears the gold halo (`toolBtn-active`). The active tool's icon shows the currently configured subtype: terrain shows the kind, building shows the type (with player-coloured `base{N}` for bases), dino shows the colour plus a small corner speed badge. **Building colour is preserved across type switches** — picking `habitation` while an owner is set keeps that owner on the config (the engine still forces neutral at apply time, and the swatch greys out for non-base types), so switching back to `base` restores the colour without re-picking. The dino speed picker runs **0–20** (0 = an immobile starter — see _Honoring explicit unit speed_).

Default active tool on load is **Terrain (mountain)**, so a fresh scenario opens ready to paint mountains.

### Floating popups

Right-clicking a tool button opens a bare row/grid of option buttons docked just above the bottom panel (`bottom: 100%`), not a modal. They're dismissed by clicking outside, picking an option, or opening another popup (a document-level `click` handler, `handleOutsidePopupClick`). Horizontal anchoring is layout-math against the panel's right edge:

- **Narrow popups** centre above their button via a fixed right-offset + `translateX(50%)`: terrain at `right: 168px`, building-type at `right: 136px`.
- **Wide popups** (dino speed 3×7 grid, and any colour row at high seat counts) instead **pin their right edge to the panel's right edge** (`.popup-anchor-panel-right`, `right: 9px`) so they never overflow off-screen. The building-colour popup uses the same right-pin for the same reason.

### Drag-to-paint (PC only)

`mousedown.left` on a cell arms the brush and paints the start cell; `mouseenter` paints any cell crossed while the button stays down (`onPaintMove` dedups consecutive enters on the same cell); a **window-level** `mouseup` ends the stroke so releasing off the grid still stops it. There's no `click` handler — `mousedown` already paints. A touch tap is synthesised as a mousedown+mouseup pair so single-tap painting works, but **drag-paint is PC-only by design** — a touch drag has to keep scrolling the canvas, so it never fires `mouseenter`. One `captureUndo()` fires at stroke start, so undo reverts the whole stroke (see _Single-step undo_).

### Cell context menu

Right-clicking a cell that holds a building and/or unit opens a small menu at the cursor (`cellMenu = { x, y, screenX, screenY }`) with up to **six** items, gated by cell contents:

- **building present** → Change building type, Remove building
- **base present** → Change tower colour
- **unit present** → Change unit colour, Change unit speed, Remove unit

The "change" items open a **panel-level picker** (`cellPicker`) — same `.floating-popup` plate as the tool popups, but positioned at the cursor — that applies the choice **directly to that cell** (not the tool config). The two "remove" items act immediately (their own confirmation). Every mutating item calls `captureUndo()` first. Both the menu and its pickers are pulled back inside the viewport after render by `clampCellOverlays` (reads the rendered rect, subtracts any right/bottom overflow). Right-clicking an empty cell is suppressed (`@contextmenu.prevent`); right-clicking during a Move flow cancels the move instead.

### Move tool

A multi-click action that moves a rectangular area to a new location. **3-stage state machine** held in `moveState`:

1. **`corner1`** — waiting for the first cell click.
2. **`corner2`** — first corner picked; waiting on the second. The first cell shows a single-cell gold contour.
3. **`destination`** — both corners picked, normalised into a bounding box shown as a gold contour over the board (`.move-selection` div inside `.board`). Waiting on the destination click (top-left of the new location).

**PC drag-select** (alternative to the two corner clicks): in the `corner1` stage, pressing the mouse on the board arms `moveDrag` (`{ x1, y1, x2, y2 }`) instead of immediately advancing the state machine; `onPaintMove` live-updates `x2/y2` as the cursor crosses cells (rendered through the same `moveSelectionRect`, which checks `moveDrag` first). On `onPaintEnd` (window `mouseup`): if the release cell differs from the press cell it was a real drag — both corners are set and the machine jumps straight to `destination`; if it's the same cell it was a plain click/tap, so it falls back to the `corner2` stage. This is **PC-only** by construction — a touch drag scrolls the canvas and never fires `mouseenter`, so every touch tap is a same-cell press → two-click flow. `moveDrag` is cleared on every cancel path alongside `moveState`.

A full-screen-centred hint banner (`.move-hint`, mirrors the in-game `ActionHint`) shows the stage line: _"Drag to select an area, or click two opposite corners"_ (corner stages) or _"Choose the place to move (top-left corner)"_ (destination).

On the destination click, `performMove` runs: normalise the two corners → clamp the destination so the area stays on the map (silent) → snapshot the source cells (deep copy of `terrain`/`building`/`unit`) → wipe source cells that don't sit inside the destination rect → paste the snapshot into the destination by mutating each target cell in place (preserves Vue reactivity). The snapshot-then-wipe-then-paste order handles overlapping source/destination correctly.

**Cancel paths**: tap the Move button again, right-click any cell, pick a placement tool, or open the gear menu. The Move button is the only one wearing the gold halo while armed.

### Single-step undo

The panel's ↶ button (`undo.webp`) reverts the last map-mutating action. Each such action snapshots the whole `map.field` into `undoSnapshot` _before_ mutating, via `captureUndo()`. Snapshots are taken at: paint-stroke start (`onPaintStart` — once per drag so undo reverts the entire stroke), `performMove`, and each cell-context-menu edit/removal. `undo()` reassigns `entry.map.field` from the snapshot (Vue 3 tracks the replacement) and clears it, so exactly **one** level is undoable — the button is `:disabled="!undoSnapshot"` and re-arms only on the next action. The snapshot is dropped on load and on structural changes (resize, player-count update) whose old-dimension/old-ownership field would desync if restored.

### What's locked (and why)

| Field                                                                         | When                    | Why                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `humanPlayersNum`, `botPlayersNum`                                            | After creation, forever | Changing seat counts would orphan any unit/building owned by a dropped player. The editor refuses rather than silently drop entities. Delete and recreate if you really need a different seat split.                                                                                                                                                            |
| `width`, `height` (in the params form)                                        | n/a                     | The params form is read-only for dimensions.                                                                                                                                                                                                                                                                                                                    |
| `width`, `height` (in the canvas editor's ⚙ → Resize panel)                   | Never                   | Free to change. Growing pads bottom/right with empty cells; shrinking truncates from the bottom/right and **drops** any buildings/units in the removed cells. (The user sees the field shrink — visual confirmation, no separate confirm dialog.) Refits the default cell size after applying so a small-to-big resize doesn't leave a huge zoom.               |
| `humanPlayersNum`, `botPlayersNum` (in the canvas editor's ⚙ → Players panel) | Never                   | The form surfaces a single **total** and the editor splits it as 1 human + (total − 1) bots (current product decision; the underlying schema still tracks the two counters separately). Reducing the total drops units owned by removed players and demotes their bases to neutral — a `ConfirmDialog` runs first when the change would actually drop anything. |

### What's intentionally NOT in the canonical map schema

`sectorsNum` is **not** in `SETTINGS_FIELDS` — and therefore not in any
saved map's `.settings`. It's an internal generation knob that only
`CreateFieldEngine` reads when building a _random_ map (it picks player
start sectors so seats don't all cluster in one corner). For saved
maps and scenarios the field is fully baked in `initialMap`, so
`generateField` never runs and the value would have no effect — keeping
it out of the schema avoids exposing an internal parameter through the
editor's Parameters form or the random-map "Save Map" round-trip.

If you ever genuinely need to surface a new generation knob in saved
maps, add it to `SETTINGS_FIELDS` _and_ mirror it in the backend's
`SETTINGS_FIELDS` (`backend/game/services/map_snapshot.py`) so the
multiplayer flow stays consistent.

### What's intentionally permissive

The editor does **not** enforce the gameplay rules baked into the
random-map flow. In particular:

- **Unit speed can exceed `minSpeed`/`maxSpeed`.** The speed popup accepts **0–20**. Those scenario settings control freshly _produced_ units; starting units are designer-placed, so the picker honours whatever you set (including 0 — see _Honoring explicit unit speed_).
- **Player-owned non-base buildings are still allowed by the config**, but the colour is forced to `player = null` at apply time for any non-`base` type (Rule 2). The swatch greys out while a non-base type is active, and the list-view assets render correctly.
- **No connectivity check.** You can wall off a base, strand a bot, or make a scenario unwinnable. The "walk every scenario before merging" rule applies to user maps too — play your map after editing.

### Where the data lives

Two `localStorage` buckets, surfaced as the list page's two tabs:

- **`mapEditor.scenarios.v1`** — user-authored scenarios,
  `[{ id, description, map }]` entries.
- **`savedMaps`** (owned by `mapStorage.js`) — maps saved from games
  (SP and MP alike), `{ [name]: map }`. In the editor these wrap into the
  same entry shape with `id = name` and no description.

The canvas doesn't touch the buckets directly — it goes through the
**unified accessors** (`getAnyEditorEntry(id, source)`,
`saveAnyEditorEntry`, `deleteAnyEditorEntry`), which dispatch on the
entry's `source` (`'scenario' | 'savedMap'`, exported as
`ENTRY_SOURCES`). Scenario saves force-set `settings.enableUndo = true`
(undo is always allowed in editor scenarios — there's no toggle for it);
saved-map saves keep the map's own settings as played, and a rename moves
the storage key (refusing to overwrite a different existing map).

The `map` is a canonical Map JSON (mapSchema v1) — identical shape to the built-ins — with **one extra**: units may carry `movePoints` (and optionally `visibility`). The canonical `stripUnit` would drop those, so the editor writes JSON directly without going through `toCanonicalMap`. `validateMap` doesn't inspect cell-level fields, so extras pass through.

### Honoring explicit unit speed

`DinoGame.loadFieldOrGenerateNewField` was updated to detect an
explicit `movePoints` on a starting unit and use it instead of the
default `minSpeed` reseed (see the `// Map-editor scenarios can stamp
an explicit movePoints` comment in `DinoGame.vue`). Built-in
scenarios (and random maps) don't ship `movePoints` on starters, so
they keep the original "everyone starts at minSpeed" behaviour —
only editor maps with an explicit speed see varied starting speeds.

**Speed 0 is a valid explicit choice** (an immobile dino, as tutorial
scenarios place). The detection test is `saved.movePoints >= 0` (not
`> 0`), so a placed `0` is honoured rather than falling through to the
`minSpeed` reseed. Four call sites use the `>= 0` test and must stay
in sync: `DinoGame.vue` (the in-game reseed), `MapPreview.vue` (the
picker's fog preview), the editor's cell speed badge in
`MapEditorCanvasPage.vue` (`movePoints != null`, not a truthy check, so
`0` renders instead of showing as blank), and the backend's
`hydrate_field_for_game` in `backend/game/services/map_snapshot.py`
(multiplayer launches from editor maps).

**Visibility is scaled against the game's `minSpeed`, never the unit's
own speed.** `createNewUnit` uses its `min` bound for both the speed
roll and the visibility scale, so handing it the explicit speed as the
min would normalise every placed unit to `0` on the curve — i.e. the
maximum visibility, whatever its speed. `DinoGame` therefore recomputes
`calculateUnitVisibility(max(speed, minSpeed), minSpeed,
speedMinVisibility, fogOfWarRadius)` after the reseed, and `MapPreview`
mirrors it. Speeds below `minSpeed` (only `0`) clamp up, which keeps the
rule that an immobile dino still sees as far as the slowest moving one.
(Before this, a placed speed-3 dino on a fog-2 / threshold-5 map saw 3
instead of 2 — every placed unit had slowest-unit sight.)

### Random terrain idx

Painting (terrain tool, eraser) and resize-grow assign a **fresh random** `terrain.idx` per cell (`emptyIdx` = 1–9, `mountainIdx` = 1–5) using `Math.random()` — repeated taps on the same cell visibly cycle the variant, including mountain-over-mountain. Built-in scenarios ship deterministic indices baked into their JSON files so they look identical on every load; only the editor takes the random roll (the one place a designer actively wants variety).

### Speed badge style

The editor's cell speed badge and the dino tool button's badge both mirror `GameUnit.movePointsLabel`: white background, black text, 4 px rounded corners, font-size `≈ cellSize * 0.3`. The cell badge is hidden when `cellSize === MIN_CELL_SIZE` (matches `GameUnit`'s `v-if="width > 10"`), and its `v-if` tests `movePoints != null` (not truthiness) so a speed-`0` dino still shows its `0`.

### Input palette

Numeric inputs (speeds, radii, counts) are the shared `.num-input` plate; the resize/players modals reuse it. Toggle settings (fog, vis/speed relation, kill-at-birth, hide-enemy-speed) are **clickable icon buttons** (`.setting-icon-btn`) that swap to the paired off-asset — the icon itself is the only state cue, no checkbox. The Dimensions/Players rows' edit affordance is a **pencil-icon button** (`pencil_icon.webp` inside an `.edit-btn` plate). Speed/colour options in popups are `.floating-opt` plates (`small_button.png`).

### Legacy override migration

Built-ins used to be editable through an override bucket
(`mapEditor.builtinOverrides.v1`). They are read-only now, so
`migrateLegacyBuiltinOverrides()` (called on `ScenariosPage` and
`MapEditorListPage` mount) copies each existing override into the user
bucket once, named `"<Name> (edited)"`, behind a
`mapEditor.overridesMigrated.v1` flag. **Nothing is deleted** — the
legacy bucket stays in localStorage, it just stops being read.

### Export / import

**Export** (`buildScenarioFile`) wraps an entry as `{ kind: SCENARIO_FILE_KIND, version: SCENARIO_FILE_VERSION, description, map }`, serialises it, and triggers a download via a temporary Blob URL + a synthetic `<a download>` click (revoked afterward). The filename uses the **`.ldm`** extension ("Little Dinos Map" — plain JSON inside, like `.geojson`/`.ipynb`). **Import** accepts `.ldm` plus legacy `.json` exports (`accept=".ldm,.json,application/json"`), `JSON.parse`s the file, and passes it to `importEditorScenario`, which validates the wrapper `kind`/`version` and the inner `map` (via `validateMap`) — validity is decided by the wrapper, never the extension — then saves it as a **new user entry** with a fresh id. A malformed or wrong-`kind` file is rejected with an error rather than partially imported. Import always lands in the Scenarios bucket, whatever the file's origin.

### Fog after a loss

Losing normally lifts the fog so the player can watch the rest play out
(`setVisibilityStartTurn` → `showField` once
`doesVisibilityMakeSense()` goes false for an eliminated player). **Scenarios** — default or custom — keep
their fog instead (`keepsFogAfterLoss`): the layout is the puzzle and the
scenario can be replayed, so handing it over on defeat spoils it. A
**saved map** behaves like the random game it was saved from: revealed,
with the bots still watchable. A game with fog switched off reveals
either way.

Both arrive as the same canonical map, so the launching page states which
it is via an `isScenario` flag on the `startGame` payload —
`ScenariosPage` always sets it, the editor's **Test** button sets it only
from the Scenarios tab, and `SavedMapsPage` leaves it off. The flag is in
`FIELDS_TO_SAVE`, so a **resumed** game keeps its rules; without that a
reloaded scenario would count as a random game and reveal the map it had
been hiding. (`App.loadGame` also copies `INITIAL_SETTINGS` rather than
aliasing it, so a resumed scenario can't leave the flag behind in the
shared defaults.)

A lost scenario also drops the "Or you may watch bot fighting" offer
(`canWatchBots` on `ReadyLabel`): its End-turn button is disabled, so
there is no bot fight to watch.

There is no "explored memory" in the engine — visibility is recomputed
each turn from the units and bases a player currently owns. An
eliminated player owns nothing, so keeping the fog means they see
nothing. That is why **losing a scenario also blocks End turn**
(`lostMapGame`, passed to `InfoPanel` as `endTurnBlocked` and guarding
`processEndTurn`, so the `e` shortcut is covered too): there is nothing
to advance to, and Exit from the menu is the only way on. The block
applies whether or not fog is on — with fog off the board is revealed but
the run is still over. Random games and saved maps keep the button. It can only trigger once every human is out, since
the rotation stops on an eliminated player only after `humanPhase` leaves
`progress`, so it can't strand a hotseat rival.

**Spectating never re-fogs.** After a random game is lost the field is
revealed once, but bot turns keep recomputing `cell.isHidden` for the
bot's own AI, which would black the board out between moves. Three places
re-assert the reveal for an eliminated viewer: `displayVisibilityCoords`
(returns the full coord set), the move-animation snapshot (left null
rather than freezing the spectator's empty visibility), and the
birth-animation filter (unfiltered, so spawns still animate). A lost
scenario takes the opposite branch in each — empty set, stays dark.

**Multiplayer always reveals** and enters spectator mode, both for an
eliminated player and for everyone once the game ends
(`effective_fog_of_war` in `backend/game/consumers.py`), including for
map-seeded games — deliberately left as-is. The backend already ships
spectators the full field on every patch rather than a sparse diff, so
their map doesn't flicker between moves either.

### Sight radius on a shared cell

`FieldEngine.getCurrentVisibilitySet` walks the cells returned by
`getPlayerObjectCoords(player)` — which include a cell when **either**
the unit **or** the base belongs to that player. Each contribution
therefore carries its own ownership check: only the player's own unit
lends its `visibility`, and only the player's own base lends
`fogOfWarRadius`. Without them an enemy unit parked on your tower would
extend your sight, and your unit standing on an enemy tower would borrow
that tower's radius. When both objects on a cell are yours, the **larger**
of the two wins. The backend's `calculate_visibility`
(`backend/game/services/visibility.py`) has always checked per source;
this is the frontend matching it.

(Moving onto a base is a different path: `buildingCaptured` means the
base is yours by the time the post-move visibility is added, so taking
`max(unit.visibility, fogOfWarRadius)` there is correct.)

### Fog-of-war preview masking

`MapPreview` takes an optional `viewingPlayer` prop. When it's non-null **and** the map has `enableFogOfWar`, the preview computes the set of cells visible to that player at scenario start (`visibleSet`) and renders everything else as fog (`.map-preview-cell-fog`), hiding buildings/units there — so the picker doesn't spoil the layout. The visibility math mirrors the engine: each owned unit contributes its `visibility` (or, if only `movePoints` is set, `calculateUnitVisibility(speed, speed, threshold, fogR)` — min collapsed to the unit's own speed, matching `DinoGame`'s reseed); each owned base contributes `fogOfWarRadius`; ranges use Chebyshev distance. **Every browser opts in** — `ScenariosPage`, `MapEditorListPage` (both tabs) and `SavedMapsPage` (both launch and lobby-pick mode) each pass the first human seat's index, so no picker spoils a layout you're about to play blind. Maps saved from multiplayer mark every seat human, so that's seat 0 for them too.

### Validation and feedback

`validateSettings()` mirrors `GameSetup.isInputValid`: a per-field `LIMITS` range check (width/height/speeds/counts/modifiers/radii) plus the cross-field invariants (total ≤ 8, `maxSpeed ≥ minSpeed`, and `speedMinVisibility ≥ minSpeed` when fog + vis/speed relation are on). On a failed **Save**, the gear menu shows a two-line `.menu-error` — a constant preamble ("Game cannot be saved because of an error:") on line 1 and the specific reason on line 2. A successful Save shows a green `.menu-success` **"Game saved"** toast in the same slot, auto-clearing after 2 s. The resize/players modals surface their own errors inline (`.param-dialog-error`) so a bad value there doesn't muddy the main menu. All three notices are cleared on `closeGearMenu`.

### Help and hints

The gear menu's button row is **Back / Help / Save / Exit**. **Help** toggles an inline `.menu-help` block (a bulleted cheat-sheet) in the same slot as the error/toast; it closes on a second click or when the menu closes. **Right-click hints**: right-clicking gear-menu UI (setting icons, edit pencils, toggle buttons, the button row) or the bottom-panel **Move** button pops a dark `.editor-hint` pill (`showHint` → 3 s auto-hide, or dismissed by any left-click via `handleOutsidePopupClick`). Hints are wired only on gear-menu controls and the Move button — not on ordinary cells (right-click there is the cell context menu) or the other tool buttons (right-click there opens their option popup).

### iOS long-press → contextmenu synthesis

iOS Safari/Chrome don't fire `contextmenu` from a long-press on plain elements, which would silently break every right-click hint and menu in the app. `frontend/src/game/longPressTouch.js` installs one pair of document-level listeners (`installLongPress()`, called once from `main.js`): a 500 ms timer on single-finger `touchstart`, cancelled if the finger moves > ~10 px or lifts early; on fire it dispatches a synthetic bubbling `contextmenu` `MouseEvent` at the touch point, so any ancestor `@contextmenu` handler catches it. It then suppresses the synthetic `mousedown`/`mouseup`/`click` iOS emits afterward (capture-phase listeners) so the just-opened menu/hint isn't immediately dismissed and no paint fires under it. Paired global CSS in `App.vue` (`-webkit-touch-callout: none`, `-webkit-user-select: none` on the board) stops the iOS text-selection callout from fighting the custom menu.

### Adding a new editor feature

1. **Visual changes** to the canvas itself → `MapEditorCanvasPage.vue`.
2. **A new placement tool** → extend the `TOOLS` array at the top of `MapEditorCanvasPage.vue`, add a config entry under `toolConfig` for its subtype (or omit it if stateless like the eraser), add a bottom-panel button (route its click through `selectTool`), and add an `else if (tool === 'newToolId')` branch to `applyTool(x, y)`. If the tool has subtype options, add a **floating popup** block + an `openPopup` right-click handler (there is no `ToolOptionsDialog` any more).
3. **Picker options on an existing tool** (new building types, alternate sprites, more dino colours) → add options to the relevant floating-popup `v-for`. Keep the config shape stable per tool (terrain → `{ kind }`; building → `{ _type, player }`; dino → `{ player, speed }`).
4. **New cell-targeted actions** (like remove / recolour) → add an item to the **cell context menu** and, if it needs a chooser, a matching `cellPicker` block that mutates the cell directly; remember to call `captureUndo()` before mutating.
5. **New settings in the gear-menu params form** → inputs bind directly to `entry.map.settings.*`; the deep watcher on `entry` sets `dirty`. (To also show it in the list-page preview icon row, add a row to `MapEditorListPage.vue`.)
6. **Storage changes** (new entry fields, migrations) → remember the editor touches **two buckets** (`mapEditor.scenarios.v1` and `mapStorage.js`'s `savedMaps`); version and migrate scenario-bucket changes in `mapEditorStorage.js` (bump `…v2`), and keep the saved-maps shape in sync with the SP/MP save flows. Don't quietly extend v1 with required new fields — old saved data will trip. (The retired `mapEditor.builtinOverrides.v1` bucket must stay readable by `migrateLegacyBuiltinOverrides`.)

### Tests

Editor/scenario coverage lives under `frontend/tests/`:

- `tests/editor/mapEditorStorage.spec.js` — user-bucket CRUD, unified accessors (`getAnyEditorEntry`/`saveAnyEditorEntry` routing by `source`, saved-map rename semantics), the legacy override migration, export/import (`buildScenarioFile`/`importEditorScenario`, including rejection paths), `resizeMap`, `updatePlayerCounts`, `playerCountChangeWouldDrop`, and `enableUndo` seeding.
- `tests/editor/editorTabs.spec.js` — the list page's two tabs, Edit `{ id, source }` payload, the Test launch payload, override migration on mount, and the lobby picker's pick-mode tabs.
- `tests/game/builtinScenarios.spec.js` — the scenarios-folder contract (count, ids, order, schema validity).
- `tests/game/saveGating.spec.js` — Save-map gating for SP/MP map-seeded games and the MP `map_saved` → localStorage write.
- `tests/editor/mapEditorCanvas.spec.js` — mounts `MapEditorCanvasPage` and exercises placement (incl. a speed-0 dino), single-step undo capture/restore, `performMove`, the "deselect tool after a move" rule, PC drag-select finalisation, Esc-to-cancel, and the destination hover preview (`moveDestPreviewRect`, incl. edge clamping).
- `tests/editor/mapPreview.fog.spec.js` — fog-of-war preview masking via `viewingPlayer`, the no-mask cases, and speed-0/speed-1 radius parity.
- `tests/game/helpers.spec.js` — `calculateUnitVisibility` speed-0 vs speed-1 parity (the core of the immobile-dino rule).
