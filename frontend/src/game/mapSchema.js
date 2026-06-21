// Canonical Map JSON schema (v1).
//
// Shared between single-player (localStorage), multiplayer (server table),
// and the future map editor. Mirrors `backend/game/services/map_snapshot.py`.
//
// The schema captures only the *starting* state of a game — terrain,
// buildings, units, player seat types, and the settings that drive
// generation/play. Per-game runtime fields (fog, scores, hasMoved, …)
// are deliberately stripped at the canonical boundary so a saved map
// is a portable "map", not a save game.

import Models from './models'

export const MAP_SCHEMA_VERSION = 1

// Settings fields that belong in canonical maps. Stays in sync with
// the backend `SETTINGS_FIELDS` list in `map_snapshot.py`. Excludes
// dimensions (width/height) and player counts, which live in metadata,
// and excludes any runtime/game-status fields.
//
// `sectorsNum` is intentionally NOT here: it controls how
// `CreateFieldEngine` picks player start sectors during *random* map
// generation, which never runs for a saved map or scenario (the field
// is fully baked in `initialMap`). Carrying it on canonical maps would
// expose an internal generation knob with no in-game effect.
export const SETTINGS_FIELDS = [
  'enableFogOfWar',
  'fogOfWarRadius',
  'visibilitySpeedRelation',
  'speedMinVisibility',
  'minSpeed',
  'maxSpeed',
  'maxUnitsNum',
  'maxBasesNum',
  'unitModifier',
  'baseModifier',
  'buildingRates',
  'hideEnemySpeed',
  'killAtBirth',
  'enableUndo',
]

function stripUnit(unit) {
  if (!unit) return null
  return { player: unit.player, _type: unit._type }
}

function stripBuilding(building) {
  if (!building) return null
  return { player: building.player, _type: building._type }
}

function stripCell(cell) {
  if (!cell) return null
  return {
    terrain: { kind: cell.terrain.kind, idx: cell.terrain.idx },
    building: stripBuilding(cell.building),
    unit: stripUnit(cell.unit),
  }
}

function stripPlayer(player) {
  return { _type: player._type }
}

function pickSettings(settings) {
  const out = {}
  for (const key of SETTINGS_FIELDS) {
    if (settings[key] !== undefined) out[key] = settings[key]
  }
  return out
}

// Build a canonical Map JSON from in-memory game state.
//
//   toCanonicalMap({
//     field,             // Cell[][] — current game field (start state assumed)
//     players,           // Player[] — one per seat
//     settings,          // gameplay settings dict (humanPlayersNum, …, buildingRates, …)
//     name,              // string  — saved-map name
//     savedAt,           // ISO string — caller passes a stamp (we don't read clock)
//   })
export function toCanonicalMap({ field, players, settings, name, savedAt }) {
  const width = field.length
  const height = field[0]?.length ?? 0
  const humanPlayersNum = settings.humanPlayersNum ?? 0
  const botPlayersNum = settings.botPlayersNum ?? 0

  const canonicalField = []
  for (let x = 0; x < width; x++) {
    const col = []
    for (let y = 0; y < height; y++) {
      col.push(stripCell(field[x][y]))
    }
    canonicalField.push(col)
  }

  return {
    version: MAP_SCHEMA_VERSION,
    name,
    metadata: {
      playersNum: humanPlayersNum + botPlayersNum,
      humanPlayersNum,
      botPlayersNum,
      width,
      height,
      savedAt,
    },
    settings: pickSettings(settings),
    field: canonicalField,
    players: players.map(stripPlayer),
  }
}

// Rehydrate model instances from a canonical Map JSON.
//
// Returns:
//   {
//     field,     // Cell[][] (Models.Cell instances, isHidden defaults to true)
//     players,   // Models.Player[]
//     settings,  // merged: { ...mapJson.settings, width, height, humanPlayersNum, botPlayersNum }
//     metadata,  // the original metadata block (for display)
//   }
//
// Throws if the JSON fails validation.
export function fromCanonicalMap(mapJson) {
  validateMap(mapJson)

  const { width, height, humanPlayersNum, botPlayersNum } = mapJson.metadata

  const field = []
  for (let x = 0; x < width; x++) {
    const col = []
    for (let y = 0; y < height; y++) {
      const src = mapJson.field[x][y]
      const cell = new Models.Cell({ kind: src.terrain.kind, idx: src.terrain.idx })
      if (src.building) {
        cell.building = new Models.Building(src.building.player, src.building._type)
      }
      if (src.unit) {
        // movePoints/visibility get recomputed at game start; pass defaults
        // here and let the engine reseed them. hasMoved defaults to false.
        cell.unit = new Models.Unit(src.unit.player, src.unit._type, 0, 0)
      }
      // isHidden defaults true on construction — fog reset, like a fresh game.
      col.push(cell)
    }
    field.push(col)
  }

  const players = mapJson.players.map(p => new Models.Player(p._type))

  const settings = {
    ...mapJson.settings,
    width,
    height,
    humanPlayersNum,
    botPlayersNum,
  }

  return { field, players, settings, metadata: mapJson.metadata }
}

// Validate the shape of a canonical Map JSON. Throws on mismatch.
// Loud-fail on unknown version: a v2 client must hard-reject v1 only if
// it has no v1 reader (we keep one), and a v1 reader must hard-reject v2.
export function validateMap(mapJson) {
  if (!mapJson || typeof mapJson !== 'object') {
    throw new Error('Invalid map: not an object')
  }
  if (mapJson.version !== MAP_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported map schema version: ${mapJson.version} (this reader supports v${MAP_SCHEMA_VERSION})`
    )
  }
  if (typeof mapJson.name !== 'string' || !mapJson.name) {
    throw new Error('Invalid map: missing name')
  }
  const m = mapJson.metadata
  if (!m || typeof m !== 'object') {
    throw new Error('Invalid map: missing metadata')
  }
  if (!Number.isInteger(m.width) || !Number.isInteger(m.height) || m.width <= 0 || m.height <= 0) {
    throw new Error('Invalid map: bad dimensions')
  }
  if (!Number.isInteger(m.playersNum) || m.playersNum <= 0) {
    throw new Error('Invalid map: bad playersNum')
  }
  if (m.humanPlayersNum + m.botPlayersNum !== m.playersNum) {
    throw new Error('Invalid map: human+bot != playersNum')
  }
  if (!Array.isArray(mapJson.field) || mapJson.field.length !== m.width) {
    throw new Error('Invalid map: field width mismatch')
  }
  for (let x = 0; x < m.width; x++) {
    const col = mapJson.field[x]
    if (!Array.isArray(col) || col.length !== m.height) {
      throw new Error(`Invalid map: field height mismatch at x=${x}`)
    }
  }
  if (!Array.isArray(mapJson.players) || mapJson.players.length !== m.playersNum) {
    throw new Error('Invalid map: players[] length != playersNum')
  }
  if (!mapJson.settings || typeof mapJson.settings !== 'object') {
    throw new Error('Invalid map: missing settings')
  }
}
