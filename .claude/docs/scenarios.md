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

### Built-in scenarios (editable via the override layer)

Built-ins ship read-only in `scenariosData.js`, but the editor makes
them **user-editable** through an override bucket — see _Editing
built-in scenarios_ below. An edited built-in shows a **default badge**
on the list until it's Reset, which drops the override and restores the
shipped version.

| File                                              | Role                                                                                                                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `frontend/src/game/scenariosData.js`              | The 10 scenarios + the procedural map-builder helpers (`emptyField`, `mountain`, `hLine`, `vLine`, `fillRect`, `clearRect`, `placeBuilding`, `placeUnit`) and the `toScenarioMap` wrapper that produces the canonical JSON. Exports `SCENARIOS` (array) and `getScenarioById`. |
| `frontend/src/components/game/ScenariosPage.vue`  | List + preview + Start Game UI. Mirrors `SavedMapsPage.vue`; lists built-ins from `SCENARIOS` **merged with user-authored scenarios from `mapEditorStorage`** so both kinds are playable from the same picker.                                                                 |
| `frontend/src/components/game/NewGameSubmenu.vue` | The "Scenarios" button that routes to the page.                                                                                                                                                                                                                                |
| `frontend/src/App.vue`                            | The `v-if="state === GAME_STATES.scenarios"` branch that mounts `ScenariosPage`; plus the editor branches (see below).                                                                                                                                                         |
| `frontend/src/game/const.js`                      | `GAME_STATES.scenarios`, `GAME_STATES.mapEditor`, `GAME_STATES.mapEditorCanvas`.                                                                                                                                                                                               |

### Map Editor (user-authored scenarios)

| File                                                     | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/game/mapEditorStorage.js`                  | localStorage CRUD across **two buckets** + unified accessors. User scenarios live in `mapEditor.scenarios.v1`; edits to built-ins live as overrides in `mapEditor.builtinOverrides.v1` (keyed by built-in id) so the shipped `scenariosData.js` entries stay pristine. Per-bucket helpers: `listEditorScenarios`/`getEditorScenarioById`/`saveEditorScenario`/`deleteEditorScenario` (user) and `listBuiltinOverrides`/`getBuiltinOverride`/`saveBuiltinOverride`/`deleteBuiltinOverride` + `builtinHasOverride` (built-in). **Unified accessors** the pages actually call: `listAllEditorEntries`, `getAnyEditorEntry`, `saveAnyEditorEntry`, `deleteAnyEditorEntry` — these route to the right bucket by `entry.isBuiltin`. Also: `buildScenarioFile`/`importEditorScenario` (export/import), `createNewScenario` (factory, default name `{seq}-{W}x{H}-{YYYY-MM-DD}-{rev}`, seeds `EDITOR_DEFAULT_SETTINGS` with `enableUndo: true`), `resizeMap`, `updatePlayerCounts`, `playerCountChangeWouldDrop`. |
| `frontend/src/components/editor/MapEditorListPage.vue`   | The Map Editor list: scenarios on the left (built-ins first, each with a **default badge** when it carries an override), preview + settings icon-row + description on the right (mirrors `SavedMapsPage`, plus a description block). Per-entry actions: **Edit** (opens the canvas), **Delete** (user) / **Reset** (built-in with an override → drops the override), **Export** (downloads the entry as a `.json` file), and **Import** (reads a scenario file into a new user entry). A "+ Create new scenario" entry opens a small dialog for dimensions / seat counts. Parameter editing happens inside the canvas's ⚙ menu — **not** here.                                                                                                                                                                                                                                                                                                                                                            |
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
rule, `ScenariosPage.vue` adds `enableScoutMode: true` to the
`startGame` payload at the boundary. Don't try to put it in
`SCENARIO_DEFAULTS` or in a per-scenario override — `pickSettings`
will drop it. Don't pass `false` from `ScenariosPage` either; the
legacy mode is not a playable option here.

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

## Builder helpers

Scenarios are composed from a tiny vocabulary in `scenariosData.js`.
The intent is that anyone reading a `buildX()` function can see the
map's layout at a glance — _no_ ASCII art, _no_ nested template
strings.

| Helper                                                    | Effect                                                                                                                                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `emptyField(w, h)`                                        | Empty field, deterministic per-cell texture indices. Returns plain JS objects (not `Models.Cell` instances) — that's the canonical format, rehydrated by `DinoGame`.                                       |
| `mountain(field, x, y)`                                   | Convert a single cell to mountain. **No-op if the cell already has a building or unit** — order matters: lay terrain first, then place things.                                                             |
| `hLine(field, x1, x2, y)` / `vLine(field, x, y1, y2)`     | Mountain rows/columns. Inclusive on both ends.                                                                                                                                                             |
| `fillRect(field, x1, y1, x2, y2)`                         | Filled mountain rectangle.                                                                                                                                                                                 |
| `clearRect(field, x1, y1, x2, y2)` / `clear(field, x, y)` | Turn mountain (or anything) back to empty terrain. Useful to punch a gate through a `fillRect` wall, or to ensure a specific cell is walkable.                                                             |
| `placeBuilding(field, x, y, type, player = null)`         | Auto-clears terrain under the cell, then sets the building. `player = null` for neutrals; an integer for player-owned **bases only** (see Rule 2).                                                         |
| `placeUnit(field, x, y, player)`                          | Same shape as `placeBuilding`. The unit's `_type` is derived as `dino${player + 1}` — eight player sprites available (`dino1.webp` … `dino8.webp`).                                                        |
| `toScenarioMap(name, build, humans, bots, overrides?)`    | Wraps a `build()` result into the canonical Map JSON: merges `SCENARIO_DEFAULTS` with `overrides`, runs `pickSettings`, fills `metadata`, and seats the `humans + bots` players (humans first, then bots). |

### Coordinate convention

`field[x][y]` — `x` is the column, `y` is the row, both 0-indexed.
`(0, 0)` is the top-left. This matches the canonical schema and every
engine in the codebase; don't transpose it.

### Order of operations

1. `emptyField(W, H)` — blank slate.
2. Terrain shaping: `fillRect`, `hLine`, `vLine`, `mountain`. Punch holes with `clear` / `clearRect`.
3. Buildings and units. These auto-clear the cell, so they will overwrite mountains placed in step 2 — by design.

Reversing 2 and 3 means `mountain()` skips the cells you've already populated, which is usually what you want; but punching a gate through a wall _after_ placing a neighbouring base is clearer than placing the base first and praying the wall doesn't engulf it.

---

## Adding a new scenario

1. **Write the `buildX()` function** in `scenariosData.js`. Use the helpers above. Aim for 15–25 lines.
2. **Decide the seat counts.** `humanPlayersNum` is 1 unless you're testing — single-player only. `botPlayersNum` is anywhere from 1 to ~5. The sum must equal the highest `player` index in your `placeUnit` / `placeBuilding` calls **plus one**.
3. **Pick the map size.** 16×16 to 20×20 is the sweet spot. Anything smaller feels cramped with `fogOfWarRadius = 3`; anything bigger and the bot turn drags. For corridor-shaped scenarios, asymmetric sizes (e.g. 22×11 for "Mountain Pass") work well.
4. **Decide per-scenario settings overrides.** Common ones:
   - `enableFogOfWar: false` — only when the scenario premise is "everyone can see the prize from turn 1" (Race to the Tower, King of the Hill).
   - `minSpeed: 2` (or higher) — when you want starting units to move faster than 1 cell/turn.
   - `maxUnitsNum: 6` / `7` — when the player needs more headroom.
   - `fogOfWarRadius: 2` — for mazes / scout-heavy scenarios where visibility is the puzzle.
5. **Add the entry** to `SCENARIOS` with an `id` (kebab-case), `description` (2–3 sentences explaining the situation and the strategic hook — shown next to the preview), and `map: toScenarioMap('Display Name', buildX, humans, bots, overrides)`.
6. **Walk the map.** Launch the scenario, open the fog, check that every player can reach every other player. Verify no buildings are stranded behind a wall the bot can't navigate.
7. **Lint and test.** `npm run format && npm run lint:fix && npm run lint && npm run test`.

Use the existing 10 scenarios as templates — `buildAmbush` is the simplest, `buildKingOfTheHill` is the busiest.

---

## What scenarios are NOT

- **Not the tutorial.** Tutorials script step-by-step hints with the scenario as a backdrop; see `.claude/docs/tutorial.md`. Scenarios are sandbox starts — no hints, no win condition beyond the regular elimination rule, no per-step locking of UI.
- **Not multiplayer.** Scenarios run in `DinoGame.vue`, not `MultiplayerDinoGame.vue`. They are single-player only by design (one human seat plus bots). If multiplayer scenarios are wanted later, the same canonical maps could be served via the lobby's "Load Map" flow, but `ScenariosPage` does not currently offer this.
- **Built-ins are user-editable via the override layer** — the 10 shipped scenarios in `scenariosData.js` stay pristine, but the Map Editor can edit them; edits persist as overrides in `mapEditor.builtinOverrides.v1` and can be Reset back to the shipped version (see _Editing built-in scenarios_). User-authored scenarios and edited built-ins are merged into the Scenarios picker automatically.
- **Not validated.** `validateMap` runs only on the canonical-map _shape_. It does not check that mountains don't trap units, that the bot has a reachable base, or that a "No Tower" scenario is actually winnable. That's on you. Walk every scenario before merging.

---

## Map Editor

The Map Editor is a UI for authoring scenarios at runtime — terrain,
buildings, and units placed cell-by-cell via point-and-click instead of
the procedural builder in `scenariosData.js`. User-authored scenarios
live in `localStorage` under `mapEditor.scenarios.v1` and appear in the
"Scenarios" picker alongside the built-ins (no separate launch path —
play them the same way you play "Ambush").

### Entry points

- **Main menu → "Map editor"**: the top-level button. Routes to the list page (no New Game submenu in between — this is by design; the editor is a separate concern from launching games).
- **List page**: scenarios on the left, preview + settings icon-row + description on the right. This page is read-only for parameter values — same icon vocabulary as `SavedMapsPage` so the two pages feel like siblings. Per-entry actions: **Edit** (opens the canvas) and **Delete**.
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

Two `localStorage` buckets, both holding `[{ id, description, map }]` entries:

- **`mapEditor.scenarios.v1`** — user-authored scenarios.
- **`mapEditor.builtinOverrides.v1`** — edits to built-ins, keyed by the built-in's `id`. The shipped `scenariosData.js` entries are never mutated; an override wins when present and _Reset_ just deletes it.

Pages don't touch the buckets directly — they go through the **unified accessors** (`listAllEditorEntries`, `getAnyEditorEntry`, `saveAnyEditorEntry`, `deleteAnyEditorEntry`), which dispatch on `entry.isBuiltin`. `saveAnyEditorEntry` also force-sets `settings.enableUndo = true` on every save (undo is always allowed in editor scenarios — there's no toggle for it).

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
`minSpeed` reseed. `createNewUnit` is called with `min = max = 0`,
which — because `calculateUnitVisibility` normalises `(speed − min) /
(max − min)` — gives a speed-0 dino the **same (max) visibility a
speed-1 dino gets**, so a stationary unit still sees as far as the
slowest moving one. Three call sites use the `>= 0` test and must stay
in sync: `DinoGame.vue` (the in-game reseed), `MapPreview.vue` (the
scenarios-picker fog preview, which also collapses `min = max = speed`
so the preview radius matches in-game), and the editor's cell speed
badge in `MapEditorCanvasPage.vue` (`movePoints != null`, not a truthy
check, so `0` renders instead of showing as blank).

### Random terrain idx

Painting (terrain tool, eraser) and resize-grow assign a **fresh random** `terrain.idx` per cell (`emptyIdx` = 1–9, `mountainIdx` = 1–5) using `Math.random()` — repeated taps on the same cell visibly cycle the variant, including mountain-over-mountain. Built-in scenarios keep the deterministic formula in `scenariosData.js` so they look identical on every load; only the editor takes the random roll (the one place a designer actively wants variety).

### Speed badge style

The editor's cell speed badge and the dino tool button's badge both mirror `GameUnit.movePointsLabel`: white background, black text, 4 px rounded corners, font-size `≈ cellSize * 0.3`. The cell badge is hidden when `cellSize === MIN_CELL_SIZE` (matches `GameUnit`'s `v-if="width > 10"`), and its `v-if` tests `movePoints != null` (not truthiness) so a speed-`0` dino still shows its `0`.

### Input palette

Numeric inputs (speeds, radii, counts) are the shared `.num-input` plate; the resize/players modals reuse it. Toggle settings (fog, vis/speed relation, kill-at-birth, hide-enemy-speed) are **clickable icon buttons** (`.setting-icon-btn`) that swap to the paired off-asset — the icon itself is the only state cue, no checkbox. The Dimensions/Players rows' edit affordance is a **pencil-icon button** (`pencil_icon.webp` inside an `.edit-btn` plate). Speed/colour options in popups are `.floating-opt` plates (`small_button.png`).

### Editing built-in scenarios

Built-ins are editable through the **override layer**. Opening a built-in in the canvas loads it via `getAnyEditorEntry` (which returns the override if one exists, else the shipped entry) and stamps `isBuiltin: true` on the working copy. Saving routes through `saveAnyEditorEntry` → `saveBuiltinOverride`, writing to `mapEditor.builtinOverrides.v1` under the built-in's id — the shipped `scenariosData.js` is never touched. The list page shows a **default badge** on any built-in that has an override and offers **Reset**, which calls `deleteBuiltinOverride` to drop the override and restore the shipped version. `ScenariosPage` and `MapEditorListPage` both apply overrides when listing, so an edited built-in previews and plays in its edited form everywhere.

### Export / import

**Export** (`buildScenarioFile`) wraps an entry as `{ kind: SCENARIO_FILE_KIND, version: SCENARIO_FILE_VERSION, description, map }`, serialises it, and triggers a download via a temporary Blob URL + a synthetic `<a download>` click (revoked afterward). **Import** reads a chosen file, `JSON.parse`s it, and passes it to `importEditorScenario`, which validates the wrapper `kind`/`version` and the inner `map` (via `validateMap`), then saves it as a **new user entry** with a fresh id (never as a built-in override, even if the source was an edited built-in). A malformed or wrong-`kind` file is rejected with an error rather than partially imported.

### Fog-of-war preview masking

`MapPreview` takes an optional `viewingPlayer` prop. When it's non-null **and** the map has `enableFogOfWar`, the preview computes the set of cells visible to that player at scenario start (`visibleSet`) and renders everything else as fog (`.map-preview-cell-fog`), hiding buildings/units there — so the picker doesn't spoil the layout. The visibility math mirrors the engine: each owned unit contributes its `visibility` (or, if only `movePoints` is set, `calculateUnitVisibility(speed, speed, threshold, fogR)` — min collapsed to the unit's own speed, matching `DinoGame`'s reseed); each owned base contributes `fogOfWarRadius`; ranges use Chebyshev distance. **Only `ScenariosPage` opts in** (it passes the first human seat's index); the editor and saved-maps browser pass nothing, so they always render the whole field unmasked.

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
6. **Storage changes** (new entry fields, migrations) → remember there are **two buckets** (`mapEditor.scenarios.v1`, `mapEditor.builtinOverrides.v1`); bump both keys (`…v2`) and migrate in `mapEditorStorage.js`. Don't quietly extend v1 with required new fields — old saved data will trip.

### Tests

Editor/scenario coverage lives under `frontend/tests/`:

- `tests/editor/mapEditorStorage.spec.js` — the two buckets, unified accessors (`getAnyEditorEntry`/`saveAnyEditorEntry` routing by `isBuiltin`), built-in overrides + Reset, export/import (`buildScenarioFile`/`importEditorScenario`, including rejection paths), `resizeMap`, `updatePlayerCounts`, `playerCountChangeWouldDrop`, and `enableUndo` seeding.
- `tests/editor/mapEditorCanvas.spec.js` — mounts `MapEditorCanvasPage` and exercises placement (incl. a speed-0 dino), single-step undo capture/restore, `performMove`, the "deselect tool after a move" rule, PC drag-select finalisation, Esc-to-cancel, and the destination hover preview (`moveDestPreviewRect`, incl. edge clamping).
- `tests/editor/mapPreview.fog.spec.js` — fog-of-war preview masking via `viewingPlayer`, the no-mask cases, and speed-0/speed-1 radius parity.
- `tests/game/helpers.spec.js` — `calculateUnitVisibility` speed-0 vs speed-1 parity (the core of the immobile-dino rule).
