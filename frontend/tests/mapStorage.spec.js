import { describe, it, expect, beforeEach } from 'vitest'

import {
  listSavedMaps,
  getSavedMap,
  saveMap,
  deleteSavedMap,
  mapNameExists,
  nextDefaultName,
} from '../src/game/mapStorage'

function makeMap(name, savedAt = '2026-06-18T00:00:00Z') {
  return {
    version: 1,
    name,
    metadata: {
      playersNum: 2,
      humanPlayersNum: 1,
      botPlayersNum: 1,
      width: 5,
      height: 5,
      savedAt,
    },
    settings: {},
    field: [],
    players: [{ _type: 'human' }, { _type: 'bot' }],
  }
}

beforeEach(() => {
  // Vitest's jsdom env carries localStorage state across files; reset it.
  localStorage.clear()
})

describe('mapStorage', () => {
  it('saves and retrieves by name', () => {
    saveMap(makeMap('alpha'))
    const got = getSavedMap('alpha')
    expect(got).not.toBeNull()
    expect(got.name).toBe('alpha')
  })

  it('mapNameExists returns true only after a save', () => {
    expect(mapNameExists('beta')).toBe(false)
    saveMap(makeMap('beta'))
    expect(mapNameExists('beta')).toBe(true)
  })

  it('refuses to overwrite by default', () => {
    saveMap(makeMap('gamma'))
    expect(() => saveMap(makeMap('gamma'))).toThrow(/already exists/)
  })

  it('overwrites when explicitly asked', () => {
    saveMap(makeMap('delta', '2026-01-01T00:00:00Z'))
    saveMap(makeMap('delta', '2026-12-31T00:00:00Z'), { overwrite: true })
    expect(getSavedMap('delta').metadata.savedAt).toBe('2026-12-31T00:00:00Z')
  })

  it('lists newest-first by savedAt', () => {
    saveMap(makeMap('old', '2026-01-01T00:00:00Z'))
    saveMap(makeMap('new', '2026-06-01T00:00:00Z'))
    saveMap(makeMap('mid', '2026-04-01T00:00:00Z'))
    const list = listSavedMaps()
    expect(list.map(m => m.name)).toEqual(['new', 'mid', 'old'])
  })

  it('deletes by name', () => {
    saveMap(makeMap('epsilon'))
    expect(mapNameExists('epsilon')).toBe(true)
    deleteSavedMap('epsilon')
    expect(mapNameExists('epsilon')).toBe(false)
  })

  it('deleteSavedMap is a no-op on unknown name', () => {
    expect(() => deleteSavedMap('never-existed')).not.toThrow()
  })

  describe('nextDefaultName', () => {
    it('returns base name when free', () => {
      expect(nextDefaultName(6, 20, 20, '2026-07-01')).toBe('6-20x20-2026-07-01')
    })

    it('appends -1 when base is taken', () => {
      saveMap(makeMap('6-20x20-2026-07-01'))
      expect(nextDefaultName(6, 20, 20, '2026-07-01')).toBe('6-20x20-2026-07-01-1')
    })

    it('walks the postfix until free', () => {
      saveMap(makeMap('6-20x20-2026-07-01'))
      saveMap(makeMap('6-20x20-2026-07-01-1'))
      saveMap(makeMap('6-20x20-2026-07-01-2'))
      expect(nextDefaultName(6, 20, 20, '2026-07-01')).toBe('6-20x20-2026-07-01-3')
    })
  })
})
