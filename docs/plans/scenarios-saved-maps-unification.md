# Plan: Scenarios / Saved Maps / Editor Flow Unification

Created: 2026-09-11
Status: Implemented
Completed: 2026-09-11 (all five phases; see docs/scenarios.md and
docs/api/ for the resulting behavior)

## Overview

Complete the scenarios / saved maps / map editor flow:

1. Built-in ("default") scenarios are static JSON map files in a repo
   folder — read-only, not shown in the Map Editor, not editable.
   Dropping a new file into the folder is all it takes to add one.
2. The in-game "Save map" button appears **only** in games started from a
   random map (SP and MP). Games launched from any scenario or saved map
   never show it.
3. Saving from SP and MP lands in the **same client localStorage bucket**
   (`savedMaps`). The server-side `SavedMap` store keeps working as-is
   (kept for future reuse) — the local write is additive.
4. The Map Editor shows two tabs: **Scenarios** (user-authored) and
   **Saved maps** — both fully editable, sharing the same controls
   (Edit / Export / Delete) plus a new **Test** button that immediately
   launches an SP game on the selected entry.
5. Map types and where they can be played:
   - **Default scenarios** — singleplayer only.
   - **Custom scenarios** (editor) — SP and MP.
   - **Saved random maps** — SP and MP.
   MP seats: creator = seat 0 (blue), joiners take the next seats in join
   order. Extra map seats are removed from the field (units dropped, bases
   demoted to neutral). Joining a lobby beyond the picked map's capacity
   is blocked with an explanatory message; start re-validates as a safety
   net.
6. Exported map files use the **`.ldm`** extension (JSON content
   unchanged); import accepts `.ldm` and legacy `.json`.

This plan partially **supersedes `docs/plans/save-map.md`**: MP saved maps
become client-side; the server `SavedMap` store stays in place but the
lobby picker no longer reads from it.

## Confirmed decisions (2026-09-11)

1. **Built-ins live in a repo folder** (`frontend/src/game/scenarios/`),
   auto-loaded — new files appear without code changes. Builders in
   `scenariosData.js` are converted once (throwaway script) and deleted.
2. **No data deletion.** Existing built-in overrides are *copied* into the
   user-scenarios bucket as `"<Name> (edited)"`; the old
   `mapEditor.builtinOverrides.v1` bucket is left untouched (just no
   longer read), guarded by a one-time migration flag.
3. **Server `SavedMap` store stays** — model, REST, WS insert all keep
   working unchanged (reuse planned later). MP save *additionally*
   returns the canonical map in the `map_saved` reply so the client also
   writes it to localStorage. `savedMapsApi.js` stays in the codebase but
   the lobby picker stops using it.
4. **SP seat split from saved maps: leave as-is** (metadata split is
   restored; hotseat replay keeps working). Revisit later. Known
   consequence: a map saved from an MP game has
   `humanPlayersNum = joined, botPlayersNum = 0`, so replaying it in SP
   currently starts a hotseat game — accepted for now.
5. **Saved maps are fully editable** in the canvas, same controls as
   scenarios (Edit / Export / Delete) + **Test** on both tabs.
6. **Type/playability matrix** as in Overview §5. Built-ins are excluded
   from the MP lobby picker.
7. **Join blocking** at map capacity (convenient option) *and* start-time
   validation as the net. Feasible cheaply because the picked map's
   name + capacity are synced to the server anyway (see missing point 4).
8. **Seat trimming runs on the backend.**
9. **`.ldm`** as the real extension, JSON inside.

Missing-points confirmations:

- MP save returns the map over WS (client can't rebuild it — its field is
  fog-filtered; server holds `Game.initial_field`). If this proves
  disruptive, fallback approved: download as a file instead.
- **Port the explicit-`movePoints` rule** (incl. speed-0) to
  `hydrate_field_for_game` for SP/MP parity.
- **Server-side `validate_map` + size cap on uploaded maps** — treat as
  mandatory (client-supplied JSON must not be trusted).
- **Broadcast the picked map's name** to the lobby (v1: name only; full
  map preview later).
- **`enableScoutMode` is legacy — always `true` for now**: force `true`
  at every map-launch boundary (scenarios already do; saved-map launches
  currently don't). The GameSetup toggle for random games is untouched in
  this plan.
- **MP bots come later** — keep the seat-reconciliation logic
  parameterized on a seat list, not hard-coded to `botPlayersNum = 0`.

### Implementation defaults chosen under the umbrella answers

- **Built-in file format = the export wrapper**
  (`{ kind: 'little-dinos-scenario', version, description, map }`), so an
  editor-exported file can be dropped into the folder verbatim. Loader
  accepts both `.json` and `.ldm` filenames via
  `import.meta.glob('./scenarios/*', …)`; the entry `id` derives from the
  filename.
- **Saved-map rename in the canvas** = save under the new name + remove
  the old key (standard rename; the no-deletion rule applies to
  migrations, not user-initiated renames).
- **Description field** is hidden when the canvas edits a saved map — the
  canonical map schema has no description (it lives on the editor-entry
  wrapper only).
- **Test button** launches a normal SP game; exiting returns to the main
  menu (existing exit behavior), not back to the editor.

## Current state vs target

| Target | Current state | Gap |
|--------|---------------|-----|
| Built-ins are JSON files, read-only, hidden from editor | Procedural JS builders in `scenariosData.js`; shown in editor with a full **override layer** (`mapEditor.builtinOverrides.v1`, default badge, Reset) | Convert to folder JSON; remove built-ins from editor list; retire override layer (copy-migration, old bucket kept) |
| Save only in random games | SP: `initialMapSnapshot` captured for **every** fresh non-tutorial game (`DinoGame.vue:436`), so Save shows in scenario/saved-map games too. MP: `:can-save-map="true"` hardcoded (`MultiplayerDinoGame.vue:60`) | SP: skip snapshot when `initialMap` present. MP: server flags map-seeded games |
| SP+MP save → same localStorage | SP → localStorage `savedMaps`; MP → WS `save_map` → server `SavedMap` table only | `map_saved` reply carries the canonical map; client writes `savedMaps`; server insert unchanged |
| Editor: 2 tabs, editable, Test | Editor lists scenarios only (built-ins + user); saved maps invisible there; no Test | Tabs; saved-maps CRUD routing; Test launch |
| Custom maps playable in MP | Lobby "Load Map" exists **end to end** but lists **server**-saved maps only; editor scenarios and SP-local maps unreachable in MP | Picker → local sources with the two tabs; upload path (`settings.initialMap` → `start_game` → `hydrate_field_for_game`) already works |
| MP seat reconciliation + capacity | **None.** `start_game` overwrites `humanPlayersNum` with map metadata (`views.py:203-206`); a 6-seat map started by 2 players yields orphan seats whose units never move (turn rotation walks `GamePlayer` rows only). Join has no capacity concept | Sync picked map name+capacity to server; block join at capacity; trim/validate at start. Fixes a live bug |
| `.ldm` extension | Export downloads `${name}.json`; import accepts `.json` | Rename export, widen import accept |

## Analysis

### A. Built-in scenarios → repo JSON folder

- New folder `frontend/src/game/scenarios/` holding one wrapper-format
  file per built-in (see defaults above). A small `index.js` loads them
  eagerly via `import.meta.glob` and exports `SCENARIOS` /
  `getScenarioById` with the existing `{ id, description, map }` shape —
  `ScenariosPage` keeps working with minimal changes.
- One-time node script converts the 10 builders' output into files
  (deterministic `emptyIdx`/`mountainIdx` visuals are baked into the
  JSON, so nothing changes on screen); then `scenariosData.js` and the
  script are deleted.
- `ScenariosPage` stops applying overrides; still merges built-ins + user
  scenarios for the SP picker.
- `MapEditorListPage` lists user entries only. `mapEditorStorage.js`
  drops the override helpers; unified accessors collapse to the user
  bucket; the copy-migration (Decision 2) runs once behind a flag.

### B. Save-map gating

- SP: in `DinoGame.created()`, skip `initialMapSnapshot` capture when the
  game was launched with `initialMap`. `canSaveMap` already keys off the
  snapshot; resumed map-games follow automatically.
- MP: `start_game` sets `settings_dict["fromInitialMap"] = True` when
  map-seeded; `MultiplayerDinoGame` derives `canSaveMap` from it.
  `fromInitialMap` must **not** enter `SETTINGS_FIELDS` (either mirror) or
  it round-trips into saved maps.

### C. MP save → localStorage (additive)

- `_save_map_txn` keeps inserting the `SavedMap` row; the `map_saved`
  reply gains the canonical map payload. Client handler writes it via
  `mapStorage.saveMap` (name conflicts handled client-side the same way
  the SP dialog does).
- Nothing server-side is removed; `savedMapsApi.js` becomes unused by the
  picker but stays.

### D. Editor tabs + Test

- `MapEditorListPage`: tab header **Scenarios | Saved maps**. Buckets stay
  separate — the tab *is* the bucket (`mapEditor.scenarios.v1` vs
  `savedMaps`); no storage migration.
- Shared per-entry controls on both tabs: **Edit** (canvas), **Export**
  (`.ldm`), **Delete**, **Test** (immediate SP launch via the same
  `mapToStartSettings` path `SavedMapsPage` uses). Import + "Create new"
  stay on the Scenarios tab (import lands in the scenarios bucket).
- Canvas save routing: an entry gets a `source` marker
  (`'scenario' | 'savedMap'`); save dispatches to
  `saveAnyEditorEntry` or `mapStorage.saveMap(map, { overwrite: true })`.
  Saved-map rename moves the key; description input hidden for saved
  maps. Right-pane shows `savedAt` date instead of description on the
  Saved-maps tab.

### E. Playing maps in SP

- Seat behavior unchanged (Decision 4).
- Force `enableScoutMode: true` in `SavedMapsPage.mapToStartSettings` and
  the editor Test launch (ScenariosPage already forces it).

### F. Playing maps in MP

1. **Picked-map sync (new).** When the creator picks a map (or reverts to
   random), the client sends `{ name, seats }` to the server (REST or
   lobby WS message); server stores it on the `Game` row and broadcasts to
   the lobby so joiners see the map name. Reverting clears it.
2. **Join blocking.** `join_game` rejects when a picked map's capacity is
   reached: `"Map '<name>' supports N players — ask the creator to pick a
   bigger map or somebody to leave"`. No picked map → no cap (random MP
   sizes itself by join count, as today).
3. **Start-time validation (net).** `joined > seats` → HTTP 400, game
   stays `ready` (covers picking a small map after people joined).
4. **Server-side map validation.** `start_game` runs `validate_map` +
   bounds (dimensions within LIMITS, players ≤ 8) + a payload size cap on
   the uploaded `initialMap` before hydrating.
5. **Seat trimming (backend).** `joined < seats` → trim seats
   `joined … seats-1` from the hydrated field: drop their units, demote
   their bases to neutral. Python port of the reconcile logic in
   `mapEditorStorage.updatePlayerCounts`, parameterized on the surviving
   seat list (bot seats will join that list later).
   `humanPlayersNum = joined`, `botPlayersNum = 0` for now.
6. **Explicit-speed parity.** `hydrate_field_for_game` honors an explicit
   unit `movePoints >= 0` (incl. speed-0, with the collapsed-visibility
   calc) instead of always reseeding to `minSpeed` — mirrors
   `DinoGame.vue`'s rule.
7. **Lobby picker.** "Load Map" opens the picker on **local** sources with
   the same two tabs (custom scenarios + saved maps); built-ins excluded.

### G. `.ldm` extension

- Export: `a.download = `${safe}.ldm``; wrapper content unchanged.
- Import: `accept=".ldm,.json,application/json"`; validation stays on the
  `kind`/`version` wrapper, never the extension.

## Affected files

**Frontend**
- `frontend/src/game/scenarios/` (new folder: 10 wrapper JSONs + `index.js` glob loader).
- `frontend/src/game/scenariosData.js` — deleted after conversion.
- `frontend/src/game/mapEditorStorage.js` — override helpers retired; copy-migration + flag; entry `source` marker.
- `frontend/src/game/mapStorage.js` — rename helper (save new + delete old) if not composed in the page.
- `frontend/src/components/editor/MapEditorListPage.vue` — tabs, shared controls, Test, `.ldm` export/import.
- `frontend/src/components/editor/MapEditorCanvasPage.vue` — dual save routing, hidden description for saved maps.
- `frontend/src/components/game/ScenariosPage.vue` — folder-loader import, no overrides.
- `frontend/src/components/game/SavedMapsPage.vue` — local sources in pick mode + scenarios tab; `enableScoutMode: true`.
- `frontend/src/components/game/DinoGame.vue` — snapshot skip for `initialMap` games.
- `frontend/src/components/game/MultiplayerDinoGame.vue` — `canSaveMap` from `fromInitialMap`; `map_saved` → localStorage write.
- `frontend/src/game/websocket/gameWebSocket.js` / `lobbyWebSocket.js` — `map_saved` payload; picked-map broadcast.
- `frontend/src/components/pages/LobbyPage.vue`, `frontend/src/App.vue` — picker wiring, picked-map sync/label, join/start error surfacing.

**Backend**
- `backend/game/views.py` — `start_game`: validate + reconcile + capacity net + `fromInitialMap`; `join_game`: capacity block; picked-map endpoint (or consumer message).
- `backend/game/services/map_snapshot.py` — `reconcile_seats()` (new), explicit-speed parity, `validate_map` wiring.
- `backend/game/consumers.py` — `map_saved` reply payload; lobby picked-map broadcast.
- `backend/game/models.py` — picked-map fields on `Game` (name + seats) if not folded into `settings`. **No removals.**

**Tests**
- Frontend: folder loader, override copy-migration, tabs + Test + dual save routing, save gating per launch type, `.ldm` import back-compat, `map_saved` localStorage write.
- Backend: `start_game` validation / reconciliation / capacity, `join_game` blocking, explicit-speed hydration parity, `map_saved` payload, picked-map sync.

**Docs**
- `docs/scenarios.md` (built-ins/override/editor sections rewritten), `docs/plans/save-map.md` (superseded note), `docs/architecture.md` (flow updates), this plan's status.

## Implementation phases

1. **Built-ins → JSON folder + editor cleanup** — §A (incl. copy-migration).
2. **Save-map gating** — §B.
3. **MP save → localStorage (additive)** — §C.
4. **Editor tabs + editable saved maps + Test + `.ldm`** — §D, §G.
5. **MP custom maps** — §F (picked-map sync + join block + validation + reconciliation + speed parity + local picker), §E's `enableScoutMode` fix rides along.

Each phase ships independently. Per phase: `npm run format && npm run lint:fix && npm run lint && npm run test` (frontend), backend test suite, docs in the same change.

## Risks / Considerations

- **Nothing is deleted server-side or in user storage** — the override
  bucket and `SavedMap` rows stay; only read-paths change.
- **Schema stays v1**; `metadata`'s human/bot split is advisory in MP
  (seats = joined count) but authoritative in SP (Decision 4).
- **Two mirrors to keep in sync**: `SETTINGS_FIELDS` and hydration logic
  in `mapSchema.js` ↔ `map_snapshot.py`.
- Picked-map sync introduces the first lobby-phase mutable game field —
  keep it creator-writable only, cleared on game start.
