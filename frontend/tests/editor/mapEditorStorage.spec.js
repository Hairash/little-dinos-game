import { describe, it, expect, beforeEach } from 'vitest'

import {
  listEditorScenarios,
  getEditorScenarioById,
  saveEditorScenario,
  deleteEditorScenario,
  createNewScenario,
  buildScenarioFile,
  importEditorScenario,
  SCENARIO_FILE_KIND,
  SCENARIO_FILE_VERSION,
  listBuiltinOverrides,
  getBuiltinOverride,
  saveBuiltinOverride,
  deleteBuiltinOverride,
  builtinHasOverride,
  getAnyEditorEntry,
  saveAnyEditorEntry,
  deleteAnyEditorEntry,
  listAllEditorEntries,
  updatePlayerCounts,
  playerCountChangeWouldDrop,
  resizeMap,
} from '@/game/mapEditorStorage'
import { SCENARIOS } from '@/game/scenariosData'

const clone = o => JSON.parse(JSON.stringify(o))

// A valid canonical map to reuse — captured ONCE at import so freshMap()
// has no side effects. createNewScenario persists, but the beforeEach
// localStorage.clear() below runs before every test, so this one-time
// write never leaks into a test's bucket state.
const TEMPLATE_MAP = clone(createNewScenario({ width: 6, height: 6 }).map)
function freshMap() {
  return clone(TEMPLATE_MAP)
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

  describe('two-bucket isolation', () => {
    it('user scenarios and built-in overrides live in separate buckets', () => {
      saveEditorScenario({ id: 'u1', description: '', map: freshMap() })
      saveBuiltinOverride({ id: SCENARIOS[0].id, description: '', map: freshMap() })
      expect(listEditorScenarios()).toHaveLength(1)
      expect(Object.keys(listBuiltinOverrides())).toEqual([SCENARIOS[0].id])
    })
  })

  describe('built-in overrides', () => {
    const builtinId = SCENARIOS[0].id

    it('save → getBuiltinOverride / builtinHasOverride reflect it', () => {
      expect(builtinHasOverride(builtinId)).toBe(false)
      saveBuiltinOverride({ id: builtinId, description: 'edited', map: freshMap() })
      expect(builtinHasOverride(builtinId)).toBe(true)
      expect(getBuiltinOverride(builtinId).description).toBe('edited')
    })

    it('forces enableUndo on when saving an override', () => {
      const map = freshMap()
      map.settings.enableUndo = false
      saveBuiltinOverride({ id: builtinId, description: '', map })
      expect(getBuiltinOverride(builtinId).map.settings.enableUndo).toBe(true)
    })

    it('delete (Reset) drops the override', () => {
      saveBuiltinOverride({ id: builtinId, description: '', map: freshMap() })
      deleteBuiltinOverride(builtinId)
      expect(builtinHasOverride(builtinId)).toBe(false)
    })
  })

  describe('unified accessors', () => {
    const builtinId = SCENARIOS[0].id

    it('getAnyEditorEntry returns the shipped built-in when no override', () => {
      const entry = getAnyEditorEntry(builtinId)
      expect(entry).not.toBeNull()
      expect(entry.isBuiltin).toBe(true)
    })

    it('getAnyEditorEntry returns the override once one exists', () => {
      const map = freshMap()
      map.name = 'OVERRIDDEN'
      saveBuiltinOverride({ id: builtinId, description: '', map })
      const entry = getAnyEditorEntry(builtinId)
      expect(entry.isBuiltin).toBe(true)
      expect(entry.map.name).toBe('OVERRIDDEN')
    })

    it('getAnyEditorEntry returns null for an unknown id', () => {
      expect(getAnyEditorEntry('does-not-exist')).toBeNull()
    })

    it('saveAnyEditorEntry routes by isBuiltin', () => {
      saveAnyEditorEntry({ id: builtinId, isBuiltin: true, description: '', map: freshMap() })
      saveAnyEditorEntry({ id: 'u1', isBuiltin: false, description: '', map: freshMap() })
      expect(builtinHasOverride(builtinId)).toBe(true)
      expect(getEditorScenarioById('u1')).not.toBeNull()
      // The built-in write must NOT leak into the user bucket.
      expect(getEditorScenarioById(builtinId)).toBeNull()
    })

    it('deleteAnyEditorEntry routes by isBuiltin', () => {
      saveAnyEditorEntry({ id: 'u1', isBuiltin: false, description: '', map: freshMap() })
      deleteAnyEditorEntry({ id: 'u1', isBuiltin: false })
      expect(getEditorScenarioById('u1')).toBeNull()
    })

    it('listAllEditorEntries surfaces every built-in plus user scenarios', () => {
      saveEditorScenario({ id: 'u1', description: '', map: freshMap() })
      const all = listAllEditorEntries()
      expect(all.filter(e => e.isBuiltin)).toHaveLength(SCENARIOS.length)
      expect(all.filter(e => !e.isBuiltin)).toHaveLength(1)
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
