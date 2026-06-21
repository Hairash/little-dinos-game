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

### Built-in scenarios (read-only)

| File | Role |
| --- | --- |
| `frontend/src/game/scenariosData.js` | The 10 scenarios + the procedural map-builder helpers (`emptyField`, `mountain`, `hLine`, `vLine`, `fillRect`, `clearRect`, `placeBuilding`, `placeUnit`) and the `toScenarioMap` wrapper that produces the canonical JSON. Exports `SCENARIOS` (array) and `getScenarioById`. |
| `frontend/src/components/game/ScenariosPage.vue` | List + preview + Start Game UI. Mirrors `SavedMapsPage.vue`; lists built-ins from `SCENARIOS` **merged with user-authored scenarios from `mapEditorStorage`** so both kinds are playable from the same picker. |
| `frontend/src/components/game/NewGameSubmenu.vue` | The "Scenarios" button that routes to the page. |
| `frontend/src/App.vue` | The `v-if="state === GAME_STATES.scenarios"` branch that mounts `ScenariosPage`; plus the editor branches (see below). |
| `frontend/src/game/const.js` | `GAME_STATES.scenarios`, `GAME_STATES.mapEditor`, `GAME_STATES.mapEditorCanvas`. |

### Map Editor (user-authored scenarios)

| File | Role |
| --- | --- |
| `frontend/src/game/mapEditorStorage.js` | localStorage CRUD for user scenarios (`mapEditor.scenarios.v1`). Exports `listEditorScenarios`, `getEditorScenarioById`, `saveEditorScenario`, `deleteEditorScenario`, `createNewScenario` (factory with default name `{seq}-{W}x{H}-{YYYY-MM-DD}-{rev}`), `resizeMap`, `EDITOR_DEFAULT_SETTINGS`. |
| `frontend/src/components/editor/MapEditorListPage.vue` | The Map Editor list: scenarios on the left, preview + settings icon-row + description on the right (mirrors `SavedMapsPage` exactly so the two browsers feel identical, plus a description block). Per-entry actions: **Edit** (opens the canvas) and **Delete**. A "+ Create new scenario" entry at the bottom opens a small dialog for dimensions / seat counts. Parameter editing happens inside the canvas's ⚙ menu — **not** here. |
| `frontend/src/components/editor/MapEditorCanvasPage.vue` | Game-style canvas, intentionally indistinguishable from a live game at a glance. Cells use the exact same DOM shape as `GameGrid` (`.board > .cell_line > div.cell` with `inline-block` cells and `<img class="terrainImg">` for terrain — no per-cell borders, no gaps). Persistent UI is only the **bottom panel** (`panel.png`, max-width 400px, centred — same as `InfoPanel`): gear on the LEFT (mirroring InfoPanel's toggleMenu position), four tool buttons on the RIGHT, all using `small_button.png` + `infoBtn` styling. The gear opens an overlay that visually clones `GameMenuOverlay`: `ingame_menu_border.png` outer plate + `ingame_menu_texture.png` inner parchment, black text, h2 centred, button row at the bottom using `small_button.png` 26×26 + 22×22 icons. Tracks a `dirty` flag and prompts on exit if there are unsaved changes. |
| `frontend/src/components/editor/ToolOptionsDialog.vue` | Per-tool subtype picker. Right-clicking a tool button (terrain / building / dino) opens this dialog with the appropriate inputs: terrain = kind (empty/mountain); building = type + (for `base`) owner; dino = owner + starting speed. The eraser tool has no options and ignores right-click. Speed accepts 1–20 and is not clamped to the scenario's `minSpeed`/`maxSpeed` (see *Map Editor* below). |
| `frontend/src/components/game/GameMenu.vue` | The top-level "Map editor" button. |

---

## Runtime flow

1. `New Game` → `NewGameSubmenu` → "Scenarios" → `emitter.emit('goToPage', GAME_STATES.scenarios)`.
2. `App.vue` renders `ScenariosPage`. The page lists `SCENARIOS` by name, shows the description and `MapPreview` for the selected entry.
3. "Start Game" emits `startGame` with the canonical map flattened into a settings payload (same shape as `SavedMapsPage.mapToStartSettings`) **plus** an explicit `enableScoutMode: true` (see *Rules* below).
4. `App.startGame` stores the payload as `settings` and switches state to `game`.
5. `DinoGame` mounts, reads `initialMap`, rebuilds `Models.Cell`/`Building`/`Unit` instances, and reseeds each unit's `movePoints`/`visibility` via `createNewUnit(player, minSpeed, minSpeed, …)` — exactly as it does for saved maps. Starting unit speed is always `minSpeed`.

There is no backend involvement and no localStorage write at launch. The map JSON lives in memory only.

---

## Rules every scenario must follow

These are engine-level constraints, not stylistic preferences. Violating
them produces visibly broken games.

### 1. Fog of war blocks movement (`enableScoutMode: true`)

The naming is historical and inverted from what you'd guess:

| `enableScoutMode` | Behaviour |
| --- | --- |
| `true` (modern, **required for scenarios**) | Units cannot path through hidden cells. |
| `false` (legacy "scout mode") | Units can plot a path through fog. |

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
placeBuilding(field, x, y, 'base',       0)     // player 0's tower — OK
placeBuilding(field, x, y, 'base',       null)  // neutral tower to capture — OK
placeBuilding(field, x, y, 'habitation', null)  // bonus building — OK
placeBuilding(field, x, y, 'habitation', 0)     // BROKEN: see below
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
- The speed of starting units is always `minSpeed`, regardless of what was on the unit in the map JSON. To give starters more move points, raise `minSpeed` for the scenario.
- Newly **produced** units use the full `[minSpeed, maxSpeed]` range, modified by temples adjacent to the producing base.

This is the same behaviour random maps get; scenarios just inherit it.

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
  a cell that already holds a building/unit, but it *will* fill
  one-cell gaps you forgot about.
- Check the bot can reach the player. Bots stuck in a pocket make for
  a non-game.

### 5. Terrain `idx` ranges

| Kind | `idx` range | Why |
| --- | --- | --- |
| `empty` | 1 – 9 | Nine `empty{n}.webp` assets. |
| `mountain` | 1 – 5 | Only `mountain1.webp` … `mountain5.webp` exist. `GameCell` and `MapPreview` mirror `idx 6..9 → 4..1` defensively, but staying in `1..5` keeps the preview honest. The builder's `mountainIdx(x, y)` always returns `1..5`. |

The `emptyIdx`/`mountainIdx` helpers are deterministic (`(x + y * …) % N`) so the same scenario looks the same every launch — no `Math.random()` at module load.

---

## Builder helpers

Scenarios are composed from a tiny vocabulary in `scenariosData.js`.
The intent is that anyone reading a `buildX()` function can see the
map's layout at a glance — *no* ASCII art, *no* nested template
strings.

| Helper | Effect |
| --- | --- |
| `emptyField(w, h)` | Empty field, deterministic per-cell texture indices. Returns plain JS objects (not `Models.Cell` instances) — that's the canonical format, rehydrated by `DinoGame`. |
| `mountain(field, x, y)` | Convert a single cell to mountain. **No-op if the cell already has a building or unit** — order matters: lay terrain first, then place things. |
| `hLine(field, x1, x2, y)` / `vLine(field, x, y1, y2)` | Mountain rows/columns. Inclusive on both ends. |
| `fillRect(field, x1, y1, x2, y2)` | Filled mountain rectangle. |
| `clearRect(field, x1, y1, x2, y2)` / `clear(field, x, y)` | Turn mountain (or anything) back to empty terrain. Useful to punch a gate through a `fillRect` wall, or to ensure a specific cell is walkable. |
| `placeBuilding(field, x, y, type, player = null)` | Auto-clears terrain under the cell, then sets the building. `player = null` for neutrals; an integer for player-owned **bases only** (see Rule 2). |
| `placeUnit(field, x, y, player)` | Same shape as `placeBuilding`. The unit's `_type` is derived as `dino${player + 1}` — eight player sprites available (`dino1.webp` … `dino8.webp`). |
| `toScenarioMap(name, build, humans, bots, overrides?)` | Wraps a `build()` result into the canonical Map JSON: merges `SCENARIO_DEFAULTS` with `overrides`, runs `pickSettings`, fills `metadata`, and seats the `humans + bots` players (humans first, then bots). |

### Coordinate convention

`field[x][y]` — `x` is the column, `y` is the row, both 0-indexed.
`(0, 0)` is the top-left. This matches the canonical schema and every
engine in the codebase; don't transpose it.

### Order of operations

1. `emptyField(W, H)` — blank slate.
2. Terrain shaping: `fillRect`, `hLine`, `vLine`, `mountain`. Punch holes with `clear` / `clearRect`.
3. Buildings and units. These auto-clear the cell, so they will overwrite mountains placed in step 2 — by design.

Reversing 2 and 3 means `mountain()` skips the cells you've already populated, which is usually what you want; but punching a gate through a wall *after* placing a neighbouring base is clearer than placing the base first and praying the wall doesn't engulf it.

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
- **(Built-ins are) not user-editable** — the 10 scenarios in `scenariosData.js` are read-only. For custom maps the player uses the Map Editor (see below), and editor scenarios are merged into the Scenarios picker automatically.
- **Not validated.** `validateMap` runs only on the canonical-map *shape*. It does not check that mountains don't trap units, that the bot has a reachable base, or that a "No Tower" scenario is actually winnable. That's on you. Walk every scenario before merging.

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
- **Canvas page**: the only persistent UI is the bottom panel — **no top header, no back arrow, no title**. The map fills the viewport (less the panel) and is scrollable on both axes. The bottom panel has four tool buttons + a gear icon (see *Tool model* below).
- **Canvas page → ⚙ gear icon** (bottom-left, `settings_icon.webp` — same asset as the in-game `toggleMenu`): opens the overlay holding the **map parameters form** and a game-style **icon button row** at the bottom matching `GameMenuOverlay`'s: `← back-to-canvas`, `+ zoom in (+10px)`, `− zoom out (-10px)`, `💾 save`, `✕ exit-editor`. The zoom step is `±10` and the range is `[MIN_CELL_SIZE, MAX_CELL_SIZE]` — same constants and step the in-game `changeCellSize` uses, so the editor zoom feels identical to the game.
- **Icon-only form**: every parameter except scenario name + description is a single row of `[setting-icon] [input or value]`, using the same `icon.png`-plated asset vocabulary as `SavedMapsPage` and the list page's preview. No text labels, no section headings. Toggles (fog, vis/speed relation, kill-at-birth, hide-enemy-speed, enable-undo) are clickable icons that swap to the paired off-asset when off — the asset itself is the state cue (the `enable-undo` toggle has no paired off-asset and dims grayscale instead).
- **Dimensions** row shows `{W}×{H}` next to a pencil ✎ button. Clicking it opens a centered modal (`error_plate.png` plate — same plate `SaveMapDialog` uses, sits at z-index 10090 above the gear menu) with width/height inputs + 💾 (apply, same `save_icon`) and ✕ (cancel, same `exit_icon`). Apply pads bottom/right when growing, truncates bottom/right when shrinking (units/buildings in dropped cells are silently lost).
- **Players** row shows the single **total** next to a pencil ✎ button (no human/bot split surfaced — the editor locks the split at 1 human + (total − 1) bots, matching the create dialog). Same modal-dialog pattern. Apply rebuilds the `players[]` array, updates the metadata counters, and reconciles the field: units owned by removed players are dropped and player-owned bases of removed players are demoted to neutral (`player: null`) so the base stays on the field as a capturable tower. If the change would drop anything, a `ConfirmDialog` is shown first. The dino/building tool's active owner is auto-clamped to a valid index after the update.

### Tool model

The canvas has **four** placement tools on the bottom panel:

| Tool | Click on a cell does… | Right-click on the tool button opens… |
| --- | --- | --- |
| **Terrain** | Sets the cell's terrain to the configured kind (empty / mountain). **Refuses** to set `mountain` if the cell holds a building or a unit. | Kind picker (empty / mountain). |
| **Building** | Sets the cell's building to the configured type + owner. **Refuses** if the cell is mountain. Forces `player = null` for any non-`base` type (engine semantics — see *Rule 2*). | Type + (for `base` only) owner picker. |
| **Dino** | Places a unit owned by the configured player with the configured starting speed. **Refuses** if the cell is mountain. | Owner + speed picker (1–20). |
| **Eraser** | Wipes the cell: terrain → empty, building → null, unit → null. | Nothing (eraser has no subtype). |

Left-click on a tool button arms it (active tool gets a highlighted border). The active tool's icon shows the *currently configured* subtype so the user can see what will be painted at a glance: terrain shows the kind, building shows the type with player colour for bases, dino shows the colour plus a small speed badge in the corner. There is **no** per-cell dialog any more — every click on a cell directly applies the active tool. Right-click on a cell is suppressed (`@contextmenu.prevent`).

Default active tool on load is **Terrain (mountain)**, so a fresh scenario opens ready to paint mountains.

### What's locked (and why)

| Field | When | Why |
| --- | --- | --- |
| `humanPlayersNum`, `botPlayersNum` | After creation, forever | Changing seat counts would orphan any unit/building owned by a dropped player. The editor refuses rather than silently drop entities. Delete and recreate if you really need a different seat split. |
| `width`, `height` (in the params form) | n/a | The params form is read-only for dimensions. |
| `width`, `height` (in the canvas editor's ⚙ → Resize panel) | Never | Free to change. Growing pads bottom/right with empty cells; shrinking truncates from the bottom/right and **drops** any buildings/units in the removed cells. (The user sees the field shrink — visual confirmation, no separate confirm dialog.) Refits the default cell size after applying so a small-to-big resize doesn't leave a huge zoom. |
| `humanPlayersNum`, `botPlayersNum` (in the canvas editor's ⚙ → Players panel) | Never | The form surfaces a single **total** and the editor splits it as 1 human + (total − 1) bots (current product decision; the underlying schema still tracks the two counters separately). Reducing the total drops units owned by removed players and demotes their bases to neutral — a `ConfirmDialog` runs first when the change would actually drop anything. |

### What's intentionally NOT in the canonical map schema

`sectorsNum` is **not** in `SETTINGS_FIELDS` — and therefore not in any
saved map's `.settings`. It's an internal generation knob that only
`CreateFieldEngine` reads when building a *random* map (it picks player
start sectors so seats don't all cluster in one corner). For saved
maps and scenarios the field is fully baked in `initialMap`, so
`generateField` never runs and the value would have no effect — keeping
it out of the schema avoids exposing an internal parameter through the
editor's Parameters form or the random-map "Save Map" round-trip.

If you ever genuinely need to surface a new generation knob in saved
maps, add it to `SETTINGS_FIELDS` *and* mirror it in the backend's
`SETTINGS_FIELDS` (`backend/game/services/map_snapshot.py`) so the
multiplayer flow stays consistent.

### What's intentionally permissive

The editor does **not** enforce the gameplay rules baked into the
random-map flow. In particular:

- **Unit speed can exceed `minSpeed`/`maxSpeed`.** The dialog accepts 1–20. Those scenario settings control freshly *produced* units; starting units are designer-placed, so the speed picker honours whatever you set.
- **Player-owned non-base buildings are still allowed by the dialog**, but only the `base` owner picker shows — the dialog forces `player = null` on any other building type before emitting Apply (Rule 2 — `scenarios.md`). The list-view assets render correctly.
- **No connectivity check.** You can wall off a base, strand a bot, or make a scenario unwinnable. The "walk every scenario before merging" rule applies to user maps too — play your map after editing.

### Where the data lives

Editor scenarios are stored as `[{ id, description, map }]` in
`localStorage` under `mapEditor.scenarios.v1`. The `map` is a canonical
Map JSON (mapSchema v1) — identical shape to the built-ins — with
**one extra**: units may carry `movePoints` (and optionally
`visibility`). The canonical `stripUnit` would drop those, so the
editor writes JSON directly without going through `toCanonicalMap`.
`validateMap` doesn't inspect cell-level fields, so extras pass through.

### Honoring explicit unit speed

`DinoGame.loadFieldOrGenerateNewField` was updated to detect an
explicit `movePoints` on a starting unit and use it instead of the
default `minSpeed` reseed (see the `// Map-editor scenarios can stamp
an explicit movePoints` comment in `DinoGame.vue`). Built-in
scenarios (and random maps) don't ship `movePoints` on starters, so
they keep the original "everyone starts at minSpeed" behaviour —
only editor maps with an explicit speed see varied starting speeds.

### Adding a new editor feature

1. **Visual changes** to the canvas itself → `MapEditorCanvasPage.vue`.
2. **A new placement tool** → extend the `TOOLS` array at the top of `MapEditorCanvasPage.vue`, add a config entry under `toolConfig` for its subtype (or omit it if stateless like the eraser), and add an `else if (tool === 'newToolId')` branch to `applyTool(x, y)`. If the tool has subtype options, add a `v-if` block to `ToolOptionsDialog.vue` and a title entry.
3. **Picker options on an existing tool** (new building types, alternate sprites, more dino colours) → `ToolOptionsDialog.vue`. Keep the emitted shape stable per tool (terrain → `{ kind }`; building → `{ _type, player }`; dino → `{ player, speed }`); the canvas page installs the new config into `toolConfig` and the next click reads it.
4. **New settings to expose in the gear menu's params form** → the form lives at the top of the gear-menu overlay in `MapEditorCanvasPage.vue`. Inputs are bound directly to `entry.map.settings.*` via `v-model.number` / `v-model` — adding a row is just adding a `<label class="field-inline">`. The deep watcher on `entry` automatically sets `dirty` true for any change. (To also surface the new setting in the list-page preview's icon row, add a `.settings-row` to `MapEditorListPage.vue`.)
5. **Storage changes** (new fields on the entry, schema migrations) → bump the `STORAGE_KEY` (`mapEditor.scenarios.v1` → `…v2`) and write a migration in `mapEditorStorage.js`. Don't quietly extend v1 with required new fields — old saved data will trip.
