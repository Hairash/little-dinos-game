// localStorage-backed CRUD for user-authored scenarios (the Map Editor).
//
// Storage shape: `mapEditor.scenarios.v1` is a JSON array of
//   { id, description, map }
// entries, where `map` is a canonical Map JSON (mapSchema v1) — the same
// shape used by built-in scenarios in `src/game/scenarios/`. That symmetry
// matters: the play path (ScenariosPage → startGame → DinoGame.initialMap)
// is identical for built-in and user scenarios.
//
// User-authored maps may carry extra per-unit fields the canonical
// stripper would drop (notably `movePoints` so the speed picker in the
// editor survives a round trip). `validateMap` only checks the shape,
// not cell-level fields, so this is safe.
//
// The editor also edits SAVED MAPS (the `savedMaps` bucket owned by
// `mapStorage.js`). The unified accessors below route on an entry-level
// `source` marker ('scenario' | 'savedMap') so the canvas page doesn't
// care which bucket it is writing into.

import { MAP_SCHEMA_VERSION, validateMap } from '@/game/mapSchema'
import {
  getSavedMap,
  saveMap as saveMapToStorage,
  deleteSavedMap,
  mapNameExists,
} from '@/game/mapStorage'

const STORAGE_KEY = 'mapEditor.scenarios.v1'

// Editor cells get a fresh random texture per cell on map create /
// resize-grow, so every map breaks the looped-pattern look the
// deterministic formula used to produce. Matches the random roll
// `createFieldEngine.js` does when generating a random map. Built-in
// scenarios keep deterministic indices baked into their JSON files so
// each scenario looks identical every load.
function emptyIdx() {
  return 1 + Math.floor(Math.random() * 9)
}

export function listEditorScenarios() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (_e) {
    return []
  }
}

function writeAll(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function getEditorScenarioById(id) {
  return listEditorScenarios().find(s => s.id === id) || null
}

export function saveEditorScenario(entry) {
  // Editor scenarios always have undo enabled — the gear menu no longer
  // exposes a toggle for it ("not an option, always allowed"). Force the
  // flag here so older entries authored before the toggle was removed
  // also pick up the rule the moment they're re-saved.
  if (entry.map?.settings) entry.map.settings.enableUndo = true
  // Validate the canonical-map shape; cell-level fields (extra movePoints
  // on a unit, etc.) are not checked and are intentionally allowed.
  validateMap(entry.map)
  const all = listEditorScenarios()
  const idx = all.findIndex(s => s.id === entry.id)
  if (idx >= 0) all[idx] = entry
  else all.push(entry)
  writeAll(all)
  return entry
}

export function deleteEditorScenario(id) {
  writeAll(listEditorScenarios().filter(s => s.id !== id))
}

// ---- Legacy built-in overrides migration -----------------------------------
//
// Built-ins used to be editable through an override bucket
// (`mapEditor.builtinOverrides.v1`). Built-ins are read-only now, so any
// existing override is COPIED into the user-scenarios bucket once (named
// "<Name> (edited)") and the legacy bucket is left untouched — nothing is
// deleted, it just stops being read. The one-time flag keeps repeat page
// loads from re-copying.

const LEGACY_OVERRIDES_KEY = 'mapEditor.builtinOverrides.v1'
const OVERRIDES_MIGRATED_KEY = 'mapEditor.overridesMigrated.v1'

export function migrateLegacyBuiltinOverrides() {
  try {
    if (localStorage.getItem(OVERRIDES_MIGRATED_KEY)) return
    const raw = localStorage.getItem(LEGACY_OVERRIDES_KEY)
    const overrides = raw ? JSON.parse(raw) : {}
    if (overrides && typeof overrides === 'object') {
      for (const override of Object.values(overrides)) {
        if (!override || !override.map) continue
        try {
          saveEditorScenario({
            id: genId(),
            description: override.description || '',
            map: { ...override.map, name: `${override.map.name || override.id} (edited)` },
          })
        } catch (_e) {
          // A malformed override is skipped rather than blocking the rest.
        }
      }
    }
    localStorage.setItem(OVERRIDES_MIGRATED_KEY, '1')
  } catch (_e) {
    // Never block a page load on migration problems.
  }
}

// ---- Import / export ------------------------------------------------------

// File format for export/import. Wraps the canonical map JSON in a
// thin envelope so we can spot non-scenario files on import (`kind`
// check) and so future format additions have a place to live without
// breaking the `validateMap` shape. `description` lives at this level
// because it's editor metadata — the engine doesn't read it.
// Exported files use the `.ldm` extension (Little Dinos Map); the
// content is plain JSON and legacy `.json` exports import fine.
export const SCENARIO_FILE_KIND = 'little-dinos-scenario'
export const SCENARIO_FILE_VERSION = 1
export const SCENARIO_FILE_EXTENSION = 'ldm'

export function buildScenarioFile(entry) {
  return {
    kind: SCENARIO_FILE_KIND,
    version: SCENARIO_FILE_VERSION,
    description: entry.description || '',
    map: entry.map,
  }
}

// Parse + validate a file's parsed JSON, then persist it as a fresh
// user scenario. A new id is minted so re-imports never collide with
// whatever id the original entry had.
export function importEditorScenario(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('File is not a JSON object')
  }
  if (parsed.kind && parsed.kind !== SCENARIO_FILE_KIND) {
    throw new Error(`Unsupported file kind: ${parsed.kind}`)
  }
  if (!parsed.map) {
    throw new Error('Missing "map" field in file')
  }
  // Defensive: validateMap throws on any schema mismatch.
  validateMap(parsed.map)
  const entry = {
    id: genId(),
    description: parsed.description || '',
    map: parsed.map,
  }
  saveEditorScenario(entry)
  return entry
}

// ---- Unified accessors used by the editor ---------------------------------
//
// Both user scenarios and saved maps surface to the editor as the same
// `{ id, description, map, source }` shape. The canvas page uses `source`
// to decide which storage to write into on save:
//   - 'scenario' → `mapEditor.scenarios.v1` (this module)
//   - 'savedMap' → `savedMaps` (mapStorage.js; entry id = map name)

export const ENTRY_SOURCES = {
  scenario: 'scenario',
  savedMap: 'savedMap',
}

export function getAnyEditorEntry(id, source = ENTRY_SOURCES.scenario) {
  if (source === ENTRY_SOURCES.savedMap) {
    const map = getSavedMap(id)
    return map ? { id, description: '', map, source } : null
  }
  const user = getEditorScenarioById(id)
  return user ? { ...user, source: ENTRY_SOURCES.scenario } : null
}

export function saveAnyEditorEntry(entry) {
  if (entry.source === ENTRY_SOURCES.savedMap) {
    validateMap(entry.map)
    const newName = entry.map.name
    // The map name IS the storage key for saved maps. A rename must not
    // silently clobber a different existing map — surface the conflict
    // to the gear menu instead.
    if (newName !== entry.id && mapNameExists(newName)) {
      throw new Error(`Map "${newName}" already exists`)
    }
    saveMapToStorage(entry.map, { overwrite: true })
    if (newName !== entry.id) {
      deleteSavedMap(entry.id)
      entry.id = newName
    }
    return entry
  }
  return saveEditorScenario({ id: entry.id, description: entry.description, map: entry.map })
}

export function deleteAnyEditorEntry(entry) {
  if (entry.source === ENTRY_SOURCES.savedMap) return deleteSavedMap(entry.id)
  return deleteEditorScenario(entry.id)
}

function genId() {
  // ID format: stable for the lifetime of the entry, never shown to the
  // user. Combines wall-clock + a small random suffix to avoid collisions
  // if two entries are created in the same ms (e.g. via fast clicks).
  return `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

// Default name shape: `{seq}-{W}x{H}-{date}-{rev}` — seq is the 1-based
// ordinal of the entry after creation, rev increments to avoid clashes
// when many maps share the same date+size on the same day.
export function buildDefaultName(seq, width, height) {
  const date = todayIsoDate()
  const existing = new Set(listEditorScenarios().map(s => s.map.name))
  let rev = 1
  while (existing.has(`${seq}-${width}x${height}-${date}-${rev}`)) rev++
  return `${seq}-${width}x${height}-${date}-${rev}`
}

function emptyFieldData(width, height) {
  const field = []
  for (let x = 0; x < width; x++) {
    const col = []
    for (let y = 0; y < height; y++) {
      col.push({
        terrain: { kind: 'empty', idx: emptyIdx() },
        building: null,
        unit: null,
      })
    }
    field.push(col)
  }
  return field
}

export const EDITOR_DEFAULT_SETTINGS = {
  enableFogOfWar: true,
  fogOfWarRadius: 3,
  visibilitySpeedRelation: true,
  minSpeed: 1,
  maxSpeed: 5,
  speedMinVisibility: 7,
  maxUnitsNum: 5,
  maxBasesNum: 3,
  unitModifier: 3,
  baseModifier: 3,
  buildingRates: { base: 0, habitation: 0, temple: 0, well: 0, storage: 0, obelisk: 0 },
  hideEnemySpeed: false,
  killAtBirth: true,
  enableUndo: true,
}

// Build a fresh blank scenario, persist it, and return it. The seat
// counts and dimensions are LOCKED after this call — change them by
// deleting and recreating. (Width/height can still be resized later
// via the canvas editor's resize panel; player counts cannot.)
export function createNewScenario({
  width = 20,
  height = 20,
  humanPlayersNum = 1,
  botPlayersNum = 1,
} = {}) {
  const all = listEditorScenarios()
  const seq = all.length + 1
  const id = genId()
  const playersNum = humanPlayersNum + botPlayersNum
  const players = []
  for (let i = 0; i < humanPlayersNum; i++) players.push({ _type: 'human' })
  for (let i = 0; i < botPlayersNum; i++) players.push({ _type: 'bot' })

  const entry = {
    id,
    description: '',
    map: {
      version: MAP_SCHEMA_VERSION,
      name: buildDefaultName(seq, width, height),
      metadata: { playersNum, humanPlayersNum, botPlayersNum, width, height },
      settings: { ...EDITOR_DEFAULT_SETTINGS },
      field: emptyFieldData(width, height),
      players,
    },
  }
  saveEditorScenario(entry)
  return entry
}

// Adjust seat counts in-place. Rebuilds `players[]`, updates the three
// metadata counters, and reconciles the field:
//   - Units owned by removed players are dropped (no in-place re-owner).
//   - Bases owned by removed players are demoted to neutral (kept on
//     the field as capturable towers — matches the "neutral base"
//     concept the engine already understands; non-base buildings are
//     always neutral and untouched).
// Caller should confirm with the user before SHRINKING seat counts
// since orphan units are silently dropped here.
// The backend mirrors this drop/demote rule in
// `backend/game/services/map_snapshot.py#reconcile_seats` for the
// multiplayer "map supports more players than joined" trim — keep the
// two in sync.
export function updatePlayerCounts(map, humanPlayersNum, botPlayersNum) {
  const newTotal = humanPlayersNum + botPlayersNum
  map.metadata.humanPlayersNum = humanPlayersNum
  map.metadata.botPlayersNum = botPlayersNum
  map.metadata.playersNum = newTotal

  const players = []
  for (let i = 0; i < humanPlayersNum; i++) players.push({ _type: 'human' })
  for (let i = 0; i < botPlayersNum; i++) players.push({ _type: 'bot' })
  map.players = players

  for (let x = 0; x < map.field.length; x++) {
    for (let y = 0; y < map.field[x].length; y++) {
      const cell = map.field[x][y]
      if (cell.unit && cell.unit.player >= newTotal) cell.unit = null
      if (
        cell.building &&
        cell.building._type === 'base' &&
        cell.building.player !== null &&
        cell.building.player >= newTotal
      ) {
        cell.building.player = null
      }
    }
  }
  return map
}

// True when reducing player counts would orphan at least one unit or
// player-owned base. UI callers use this to gate a confirm dialog.
export function playerCountChangeWouldDrop(map, humanPlayersNum, botPlayersNum) {
  const newTotal = humanPlayersNum + botPlayersNum
  for (let x = 0; x < map.field.length; x++) {
    for (let y = 0; y < map.field[x].length; y++) {
      const cell = map.field[x][y]
      if (cell.unit && cell.unit.player >= newTotal) return true
      if (
        cell.building &&
        cell.building._type === 'base' &&
        cell.building.player !== null &&
        cell.building.player >= newTotal
      ) {
        return true
      }
    }
  }
  return false
}

// Resize the map in-place: pad bottom/right with empty cells when
// growing, truncate when shrinking. Buildings/units in dropped cells
// are lost — callers that care about that should confirm with the
// user before calling this.
export function resizeMap(map, newWidth, newHeight) {
  const out = []
  for (let x = 0; x < newWidth; x++) {
    const col = []
    for (let y = 0; y < newHeight; y++) {
      if (x < map.field.length && y < map.field[0].length) {
        col.push(map.field[x][y])
      } else {
        col.push({
          terrain: { kind: 'empty', idx: emptyIdx() },
          building: null,
          unit: null,
        })
      }
    }
    out.push(col)
  }
  map.field = out
  map.metadata.width = newWidth
  map.metadata.height = newHeight
  return map
}
