// localStorage-backed CRUD for user-authored scenarios (the Map Editor).
//
// Storage shape: `mapEditor.scenarios.v1` is a JSON array of
//   { id, description, map }
// entries, where `map` is a canonical Map JSON (mapSchema v1) — the same
// shape used by built-in scenarios in scenariosData.js. That symmetry
// matters: the play path (ScenariosPage → startGame → DinoGame.initialMap)
// is identical for built-in and user scenarios.
//
// User-authored maps may carry extra per-unit fields the canonical
// stripper would drop (notably `movePoints` so the speed picker in the
// editor survives a round trip). `validateMap` only checks the shape,
// not cell-level fields, so this is safe.

import { MAP_SCHEMA_VERSION, validateMap } from '@/game/mapSchema'
import { SCENARIOS } from '@/game/scenariosData'

const STORAGE_KEY = 'mapEditor.scenarios.v1'

// Edits to built-in scenarios persist as overrides keyed by the
// built-in's `id`. The original entries in `scenariosData.js` stay
// untouched — overrides win when present and a "reset" simply removes
// the override. Lets us ship updates to built-ins without clobbering
// user tweaks, and lets the user back out of a destructive edit.
const BUILTIN_OVERRIDES_KEY = 'mapEditor.builtinOverrides.v1'

// Editor cells get a fresh random texture per cell on map create /
// resize-grow, so every map breaks the looped-pattern look the
// deterministic formula used to produce. Matches the random roll
// `createFieldEngine.js` does when generating a random map. Built-in
// scenarios still use a deterministic formula by design (see
// scenariosData.js) so each scenario looks identical every load.
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

// ---- Import / export ------------------------------------------------------

// File format for export/import. Wraps the canonical map JSON in a
// thin envelope so we can spot non-scenario files on import (`kind`
// check) and so future format additions have a place to live without
// breaking the `validateMap` shape. `description` lives at this level
// because it's editor metadata — the engine doesn't read it.
export const SCENARIO_FILE_KIND = 'little-dinos-scenario'
export const SCENARIO_FILE_VERSION = 1

export function buildScenarioFile(entry) {
  return {
    kind: SCENARIO_FILE_KIND,
    version: SCENARIO_FILE_VERSION,
    description: entry.description || '',
    map: entry.map,
  }
}

// Parse + validate a file's parsed JSON, then persist it as a fresh
// user scenario (always — never as an override of a built-in). A new
// id is minted so re-imports never collide with whatever id the
// original entry had.
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

// ---- Built-in overrides ---------------------------------------------------

export function listBuiltinOverrides() {
  try {
    const raw = localStorage.getItem(BUILTIN_OVERRIDES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (_e) {
    return {}
  }
}

function writeBuiltinOverrides(obj) {
  localStorage.setItem(BUILTIN_OVERRIDES_KEY, JSON.stringify(obj))
}

export function getBuiltinOverride(id) {
  return listBuiltinOverrides()[id] || null
}

export function saveBuiltinOverride(entry) {
  if (entry.map?.settings) entry.map.settings.enableUndo = true
  validateMap(entry.map)
  const all = listBuiltinOverrides()
  all[entry.id] = { id: entry.id, description: entry.description, map: entry.map }
  writeBuiltinOverrides(all)
  return entry
}

export function deleteBuiltinOverride(id) {
  const all = listBuiltinOverrides()
  delete all[id]
  writeBuiltinOverrides(all)
}

// ---- Unified accessors used by the editor ---------------------------------
//
// Both built-ins (`SCENARIOS`, with overrides applied) and user scenarios
// surface to the editor as the same `{ id, description, map, isBuiltin }`
// shape. The canvas page uses `isBuiltin` to decide which storage to
// write into on save.

function withBuiltinFlag(entry, isBuiltin) {
  return {
    id: entry.id,
    description: entry.description,
    map: entry.map,
    isBuiltin,
  }
}

export function listAllEditorEntries() {
  const overrides = listBuiltinOverrides()
  const builtins = SCENARIOS.map(s => withBuiltinFlag(overrides[s.id] || s, true))
  const users = listEditorScenarios().map(s => withBuiltinFlag(s, false))
  return [...builtins, ...users]
}

export function getAnyEditorEntry(id) {
  const builtin = SCENARIOS.find(s => s.id === id)
  if (builtin) {
    return withBuiltinFlag(getBuiltinOverride(id) || builtin, true)
  }
  const user = getEditorScenarioById(id)
  return user ? withBuiltinFlag(user, false) : null
}

export function saveAnyEditorEntry(entry) {
  // Strip the in-memory `isBuiltin` flag before persisting — storage
  // already knows which bucket the entry lives in via the function it's
  // written through.
  const clean = { id: entry.id, description: entry.description, map: entry.map }
  if (entry.isBuiltin) return saveBuiltinOverride(clean)
  return saveEditorScenario(clean)
}

export function deleteAnyEditorEntry(entry) {
  if (entry.isBuiltin) return deleteBuiltinOverride(entry.id)
  return deleteEditorScenario(entry.id)
}

export function builtinHasOverride(id) {
  return Object.prototype.hasOwnProperty.call(listBuiltinOverrides(), id)
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
