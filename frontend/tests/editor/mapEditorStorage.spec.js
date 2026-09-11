import { describe, it, expect, beforeEach } from 'vitest'

import {
  listEditorScenarios,
  getEditorScenarioById,
  saveEditorScenario,
  deleteEditorScenario,
  createNewScenario,
  buildScenarioFile,
  importEditorScenario,
  migrateLegacyBuiltinOverrides,
  SCENARIO_FILE_KIND,
  SCENARIO_FILE_VERSION,
  ENTRY_SOURCES,
  getAnyEditorEntry,
  saveAnyEditorEntry,
  deleteAnyEditorEntry,
  updatePlayerCounts,
  playerCountChangeWouldDrop,
  resizeMap,
} from '@/game/mapEditorStorage'
import { saveMap, getSavedMap, listSavedMaps } from '@/game/mapStorage'

const clone = o => JSON.parse(JSON.stringify(o))

// A valid canonical map to reuse — captured ONCE at import so freshMap()
// has no side effects. createNewScenario persists, but the beforeEach
// localStorage.clear() below runs before every test, so this one-time
// write never leaks into a test's bucket state.
const TEMPLATE_MAP = clone(createNewScenario({ width: 6, height: 6 }).map)
function freshMap(name) {
  const map = clone(TEMPLATE_MAP)
  if (name) map.name = name
  return map
}

beforeEach(() => {
  localStorage.clear()
})

describe('mapEditorStorage', () => {
  describe('createNewScenario', () => {
    it('persists a new user scenario and returns it', () => {
      const entry = createNewScenario({ width: 8, height: 7, humanPlayersNum: 1, botPlayersNum: 2 })
      expect(entry.id).toBeTruthy()
      expect(getEditorScenarioById(entry.id)).not.toBeNull()
      expect(listEditorScenarios()).toHaveLength(1)
    })

    it('bakes the locked seat counts + dimensions into metadata', () => {
      const { map } = createNewScenario({
        width: 8,
        height: 7,
        humanPlayersNum: 1,
        botPlayersNum: 2,
      })
      expect(map.metadata).toMatchObject({
        width: 8,
        height: 7,
        humanPlayersNum: 1,
        botPlayersNum: 2,
        playersNum: 3,
      })
      expect(map.players).toHaveLength(3)
    })

    it('seeds settings with enableUndo on', () => {
      const { map } = createNewScenario()
      expect(map.settings.enableUndo).toBe(true)
    })
  })

  describe('user bucket CRUD', () => {
    it('saves, reads, and deletes a scenario', () => {
      const entry = { id: 'u1', description: 'x', map: freshMap() }
      saveEditorScenario(entry)
      expect(getEditorScenarioById('u1')).not.toBeNull()
      deleteEditorScenario('u1')
      expect(getEditorScenarioById('u1')).toBeNull()
    })

    it('re-saving the same id updates in place, not appends', () => {
      saveEditorScenario({ id: 'u1', description: 'a', map: freshMap() })
      saveEditorScenario({ id: 'u1', description: 'b', map: freshMap() })
      expect(listEditorScenarios()).toHaveLength(1)
      expect(getEditorScenarioById('u1').description).toBe('b')
    })
  })

  describe('legacy override migration', () => {
    function seedLegacyOverride(id, name) {
      const overrides = { [id]: { id, description: 'edited desc', map: freshMap(name) } }
      localStorage.setItem('mapEditor.builtinOverrides.v1', JSON.stringify(overrides))
    }

    it('copies each override into the user bucket as "<name> (edited)"', () => {
      seedLegacyOverride('ambush', 'Ambush')
      migrateLegacyBuiltinOverrides()
      const users = listEditorScenarios()
      expect(users).toHaveLength(1)
      expect(users[0].map.name).toBe('Ambush (edited)')
      expect(users[0].description).toBe('edited desc')
    })

    it('leaves the legacy bucket untouched (no data deleted)', () => {
      seedLegacyOverride('ambush', 'Ambush')
      migrateLegacyBuiltinOverrides()
      const legacy = JSON.parse(localStorage.getItem('mapEditor.builtinOverrides.v1'))
      expect(Object.keys(legacy)).toEqual(['ambush'])
    })

    it('runs only once (flag-guarded)', () => {
      seedLegacyOverride('ambush', 'Ambush')
      migrateLegacyBuiltinOverrides()
      migrateLegacyBuiltinOverrides()
      expect(listEditorScenarios()).toHaveLength(1)
    })

    it('is a no-op with no legacy data', () => {
      migrateLegacyBuiltinOverrides()
      expect(listEditorScenarios()).toHaveLength(0)
    })
  })

  describe('unified accessors (scenario source)', () => {
    it('getAnyEditorEntry returns a user scenario with source stamped', () => {
      saveEditorScenario({ id: 'u1', description: 'd', map: freshMap() })
      const entry = getAnyEditorEntry('u1')
      expect(entry.source).toBe(ENTRY_SOURCES.scenario)
      expect(entry.description).toBe('d')
    })

    it('getAnyEditorEntry returns null for an unknown id', () => {
      expect(getAnyEditorEntry('does-not-exist')).toBeNull()
    })

    it('save/delete route to the user bucket', () => {
      saveAnyEditorEntry({
        id: 'u1',
        source: ENTRY_SOURCES.scenario,
        description: '',
        map: freshMap(),
      })
      expect(getEditorScenarioById('u1')).not.toBeNull()
      deleteAnyEditorEntry({ id: 'u1', source: ENTRY_SOURCES.scenario })
      expect(getEditorScenarioById('u1')).toBeNull()
    })
  })

  describe('unified accessors (savedMap source)', () => {
    function seedSavedMap(name) {
      const map = freshMap(name)
      map.metadata.savedAt = '2026-09-11T00:00:00.000Z'
      saveMap(map)
      return map
    }

    it('getAnyEditorEntry wraps a saved map (id = name)', () => {
      seedSavedMap('my-map')
      const entry = getAnyEditorEntry('my-map', ENTRY_SOURCES.savedMap)
      expect(entry).not.toBeNull()
      expect(entry.id).toBe('my-map')
      expect(entry.source).toBe(ENTRY_SOURCES.savedMap)
      expect(entry.map.name).toBe('my-map')
    })

    it('saveAnyEditorEntry overwrites the saved map in place', () => {
      seedSavedMap('my-map')
      const entry = getAnyEditorEntry('my-map', ENTRY_SOURCES.savedMap)
      entry.map.field[0][0].terrain.kind = 'mountain'
      saveAnyEditorEntry(entry)
      expect(getSavedMap('my-map').field[0][0].terrain.kind).toBe('mountain')
      expect(listSavedMaps()).toHaveLength(1)
    })

    it('renaming moves the entry to the new key', () => {
      seedSavedMap('old-name')
      const entry = getAnyEditorEntry('old-name', ENTRY_SOURCES.savedMap)
      entry.map.name = 'new-name'
      saveAnyEditorEntry(entry)
      expect(getSavedMap('old-name')).toBeNull()
      expect(getSavedMap('new-name')).not.toBeNull()
      expect(entry.id).toBe('new-name')
    })

    it('renaming onto an existing map name throws instead of clobbering', () => {
      seedSavedMap('map-a')
      seedSavedMap('map-b')
      const entry = getAnyEditorEntry('map-a', ENTRY_SOURCES.savedMap)
      entry.map.name = 'map-b'
      expect(() => saveAnyEditorEntry(entry)).toThrow(/already exists/)
      // Nothing moved or was lost.
      expect(getSavedMap('map-a')).not.toBeNull()
      expect(getSavedMap('map-b')).not.toBeNull()
    })

    it('deleteAnyEditorEntry removes the saved map', () => {
      seedSavedMap('my-map')
      deleteAnyEditorEntry({ id: 'my-map', source: ENTRY_SOURCES.savedMap })
      expect(getSavedMap('my-map')).toBeNull()
    })

    it('does not force enableUndo on saved maps (keeps the game rules as played)', () => {
      const map = seedSavedMap('my-map')
      map.settings.enableUndo = false
      const entry = { id: 'my-map', source: ENTRY_SOURCES.savedMap, description: '', map }
      saveAnyEditorEntry(entry)
      expect(getSavedMap('my-map').settings.enableUndo).toBe(false)
    })
  })

  describe('export / import', () => {
    it('buildScenarioFile wraps the entry with kind + version', () => {
      const entry = { id: 'u1', description: 'hi', map: freshMap() }
      const file = buildScenarioFile(entry)
      expect(file.kind).toBe(SCENARIO_FILE_KIND)
      expect(file.version).toBe(SCENARIO_FILE_VERSION)
      expect(file.description).toBe('hi')
      expect(file.map).toBe(entry.map)
    })

    it('round-trips through import as a NEW user entry (fresh id)', () => {
      const original = createNewScenario({ width: 6, height: 6 })
      const file = clone(buildScenarioFile(original))
      const imported = importEditorScenario(file)
      expect(imported.id).not.toBe(original.id)
      expect(imported.map.name).toBe(original.map.name)
      // original + imported both present as user scenarios
      expect(listEditorScenarios()).toHaveLength(2)
    })

    it('rejects a non-object', () => {
      expect(() => importEditorScenario(null)).toThrow()
    })

    it('rejects a wrong file kind', () => {
      expect(() => importEditorScenario({ kind: 'something-else', map: freshMap() })).toThrow()
    })

    it('rejects a file with no map', () => {
      expect(() => importEditorScenario({ kind: SCENARIO_FILE_KIND })).toThrow()
    })
  })

  describe('resizeMap', () => {
    it('grows: pads bottom/right with empty cells and updates metadata', () => {
      const map = freshMap() // 6x6
      resizeMap(map, 8, 7)
      expect(map.metadata.width).toBe(8)
      expect(map.metadata.height).toBe(7)
      expect(map.field).toHaveLength(8)
      expect(map.field[0]).toHaveLength(7)
      // A padded cell is empty terrain with nothing on it.
      expect(map.field[7][6]).toMatchObject({ building: null, unit: null })
      expect(map.field[7][6].terrain.kind).toBe('empty')
    })

    it('shrinks: truncates from bottom/right', () => {
      const map = freshMap() // 6x6
      resizeMap(map, 4, 4)
      expect(map.field).toHaveLength(4)
      expect(map.field[0]).toHaveLength(4)
      expect(map.metadata.width).toBe(4)
      expect(map.metadata.height).toBe(4)
    })
  })

  describe('updatePlayerCounts', () => {
    function mapWithOwners() {
      const map = freshMap()
      // player-1 unit + player-1 base at distinct cells
      map.field[0][0].unit = { player: 1, _type: 'dino2', movePoints: 3 }
      map.field[1][1].building = { player: 1, _type: 'base' }
      map.field[2][2].building = { player: 0, _type: 'base' }
      return map
    }

    it('reducing to 1 player drops the removed player’s unit and demotes its base', () => {
      const map = mapWithOwners()
      updatePlayerCounts(map, 1, 0)
      expect(map.metadata.playersNum).toBe(1)
      expect(map.players).toHaveLength(1)
      expect(map.field[0][0].unit).toBeNull() // player-1 unit dropped
      expect(map.field[1][1].building.player).toBeNull() // player-1 base → neutral
      expect(map.field[2][2].building.player).toBe(0) // player-0 base kept
    })

    it('playerCountChangeWouldDrop flags an orphaning reduction', () => {
      const map = mapWithOwners()
      expect(playerCountChangeWouldDrop(map, 1, 0)).toBe(true)
      expect(playerCountChangeWouldDrop(map, 1, 1)).toBe(false)
    })
  })
})
