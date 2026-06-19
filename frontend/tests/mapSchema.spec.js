import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import Models from '../src/game/models'
import {
  MAP_SCHEMA_VERSION,
  SETTINGS_FIELDS,
  toCanonicalMap,
  fromCanonicalMap,
  validateMap,
} from '../src/game/mapSchema'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = path.resolve(__dirname, '../../backend/game/tests/fixtures/map_v1_sample.json')

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
}

// Build a live-game-shaped field with the runtime fields (isHidden,
// movePoints/visibility/hasMoved) so the strip logic gets exercised.
function makeField(width, height) {
  const field = []
  for (let x = 0; x < width; x++) {
    const col = []
    for (let y = 0; y < height; y++) {
      const cell = new Models.Cell({ kind: 'empty', idx: ((x * width + y) % 9) + 1 })
      cell.isHidden = true
      col.push(cell)
    }
    field.push(col)
  }
  field[0][0].building = new Models.Building(0, 'base')
  field[0][0].unit = new Models.Unit(0, 'dino1', 5, 2)
  field[0][0].unit.hasMoved = true
  field[width - 1][height - 1].building = new Models.Building(1, 'base')
  field[width - 1][height - 1].unit = new Models.Unit(1, 'dino2', 4, 3)
  return field
}

function makeSettings({ human = 1, bot = 1 } = {}) {
  return {
    humanPlayersNum: human,
    botPlayersNum: bot,
    sectorsNum: 2,
    enableFogOfWar: true,
    fogOfWarRadius: 2,
    visibilitySpeedRelation: false,
    speedMinVisibility: 2,
    minSpeed: 3,
    maxSpeed: 6,
    maxUnitsNum: 10,
    maxBasesNum: 3,
    unitModifier: 3,
    baseModifier: 3,
    buildingRates: { base: 1 },
    hideEnemySpeed: false,
    killAtBirth: true,
    enableUndo: false,
    // Runtime fields that must NOT leak into the canonical map:
    winPhase: 'playing',
    winner: null,
  }
}

describe('toCanonicalMap', () => {
  it('emits version and metadata', () => {
    const result = toCanonicalMap({
      field: makeField(2, 2),
      players: [new Models.Player('human'), new Models.Player('bot')],
      settings: makeSettings(),
      name: 'map-a',
      savedAt: '2026-06-18T00:00:00Z',
    })
    expect(result.version).toBe(MAP_SCHEMA_VERSION)
    expect(result.name).toBe('map-a')
    expect(result.metadata).toEqual({
      playersNum: 2,
      humanPlayersNum: 1,
      botPlayersNum: 1,
      width: 2,
      height: 2,
      savedAt: '2026-06-18T00:00:00Z',
    })
  })

  it('strips runtime cell + unit + building fields', () => {
    const result = toCanonicalMap({
      field: makeField(2, 2),
      players: [new Models.Player('human'), new Models.Player('bot')],
      settings: makeSettings(),
      name: 'm',
      savedAt: '2026-06-18T00:00:00Z',
    })
    const cell = result.field[0][0]
    expect(Object.keys(cell).sort()).toEqual(['building', 'terrain', 'unit'])
    expect(Object.keys(cell.unit).sort()).toEqual(['_type', 'player'])
    expect(Object.keys(cell.building).sort()).toEqual(['_type', 'player'])
  })

  it('strips runtime player fields', () => {
    const richPlayer = new Models.Player('human')
    richPlayer.killed = 7
    richPlayer.score = 100
    richPlayer.scrollCoords = [5, 5]
    const result = toCanonicalMap({
      field: makeField(1, 1),
      players: [richPlayer],
      settings: { ...makeSettings(), humanPlayersNum: 1, botPlayersNum: 0 },
      name: 'm',
      savedAt: '2026-06-18T00:00:00Z',
    })
    expect(result.players).toEqual([{ _type: 'human' }])
  })

  it('settings exclude runtime fields', () => {
    const result = toCanonicalMap({
      field: makeField(2, 2),
      players: [new Models.Player('human'), new Models.Player('bot')],
      settings: makeSettings(),
      name: 'm',
      savedAt: '2026-06-18T00:00:00Z',
    })
    const allowed = new Set(SETTINGS_FIELDS)
    for (const key of Object.keys(result.settings)) {
      expect(allowed.has(key)).toBe(true)
    }
    expect(result.settings.winPhase).toBeUndefined()
    expect(result.settings.winner).toBeUndefined()
  })
})

describe('fromCanonicalMap', () => {
  it('rehydrates structure from the shared cross-language fixture', () => {
    const m = loadFixture()
    const { field, settings, players } = fromCanonicalMap(m)
    expect(field).toHaveLength(3)
    expect(field[0]).toHaveLength(3)
    expect(field[0][0]).toBeInstanceOf(Models.Cell)
    expect(field[0][0].terrain).toEqual({ kind: 'empty', idx: 1 })
    expect(field[0][0].building).toBeInstanceOf(Models.Building)
    expect(field[0][0].building.player).toBe(0)
    expect(field[0][0].building._type).toBe('base')
    expect(field[0][0].unit).toBeInstanceOf(Models.Unit)
    expect(field[0][0].unit.player).toBe(0)
    expect(field[0][0].unit._type).toBe('dino1')
    // Fog reset on load.
    expect(field[0][0].isHidden).toBe(true)
    expect(players).toHaveLength(2)
    expect(players[0]).toBeInstanceOf(Models.Player)
    expect(players[0]._type).toBe('human')
    expect(players[1]._type).toBe('bot')
    expect(settings.width).toBe(3)
    expect(settings.height).toBe(3)
    expect(settings.humanPlayersNum).toBe(1)
    expect(settings.botPlayersNum).toBe(1)
  })

  it('to-then-from preserves structural fields', () => {
    const field = makeField(2, 2)
    const settings = makeSettings()
    const players = [new Models.Player('human'), new Models.Player('bot')]
    const canonical = toCanonicalMap({
      field,
      players,
      settings,
      name: 'rt',
      savedAt: '2026-06-18T00:00:00Z',
    })
    const rehydrated = fromCanonicalMap(canonical)
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        const src = field[x][y]
        const got = rehydrated.field[x][y]
        expect(got.terrain).toEqual(src.terrain)
        if (src.building) {
          expect(got.building.player).toBe(src.building.player)
          expect(got.building._type).toBe(src.building._type)
        } else {
          expect(got.building).toBeNull()
        }
        if (src.unit) {
          expect(got.unit.player).toBe(src.unit.player)
          expect(got.unit._type).toBe(src.unit._type)
        } else {
          expect(got.unit).toBeNull()
        }
      }
    }
  })
})

describe('validateMap', () => {
  it('rejects unknown version', () => {
    const m = loadFixture()
    m.version = 2
    expect(() => validateMap(m)).toThrow(/Unsupported map schema version/)
  })

  it('rejects missing metadata', () => {
    const m = loadFixture()
    delete m.metadata
    expect(() => validateMap(m)).toThrow(/missing metadata/)
  })

  it('rejects wrong field dimensions', () => {
    const m = loadFixture()
    m.metadata.width = 99
    expect(() => validateMap(m)).toThrow(/field width mismatch/)
  })

  it('rejects mismatched player counts', () => {
    const m = loadFixture()
    m.metadata.humanPlayersNum = 5
    expect(() => validateMap(m)).toThrow(/human\+bot != playersNum/)
  })

  it('rejects players[] length mismatch', () => {
    const m = loadFixture()
    m.players = [{ _type: 'human' }]
    expect(() => validateMap(m)).toThrow(/players\[\] length/)
  })

  it('accepts the canonical fixture', () => {
    expect(() => validateMap(loadFixture())).not.toThrow()
  })
})
