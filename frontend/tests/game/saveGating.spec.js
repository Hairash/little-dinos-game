import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DinoGame from '@/components/game/DinoGame.vue'
import MultiplayerDinoGame from '@/components/game/MultiplayerDinoGame.vue'
import { createNewScenario } from '@/game/mapEditorStorage'
import { getSavedMap, saveMap } from '@/game/mapStorage'

// Only random maps are saveable. SP games launched from `initialMap`
// (scenario or saved map) must not capture the canonical snapshot the
// Save-map button keys off; MP games get the equivalent via the
// server-stamped `fromInitialMap` settings flag.

function mountDinoGame(extraProps = {}) {
  DinoGame.methods.initPlayersScrollCoords = vi.fn()
  return mount(DinoGame, {
    props: {
      humanPlayersNum: 1,
      botPlayersNum: 1,
      width: 6,
      height: 6,
      scoresToWin: 0,
      sectorsNum: 1,
      enableFogOfWar: false,
      fogOfWarRadius: 2,
      enableScoutMode: true,
      visibilitySpeedRelation: false,
      minSpeed: 1,
      maxSpeed: 2,
      maxUnitsNum: 5,
      maxBasesNum: 3,
      buildingRates: { base: 3, habitation: 0, temple: 0, well: 0, storage: 0, obelisk: 0 },
      hideEnemySpeed: false,
      killAtBirth: false,
      enableUndo: true,
      loadGame: false,
      ...extraProps,
    },
    shallow: true,
  }).vm
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('single-player Save-map gating', () => {
  it('random game captures the snapshot → Save map available', () => {
    const vm = mountDinoGame()
    expect(vm.initialMapSnapshot).not.toBeNull()
    expect(vm.canSaveMap).toBe(true)
  })

  it('game launched from a map skips the snapshot → Save map hidden', () => {
    const { map } = createNewScenario({ width: 6, height: 6 })
    localStorage.clear() // drop the entry the factory persisted
    const vm = mountDinoGame({ initialMap: map })
    expect(vm.initialMapSnapshot).toBeNull()
    expect(vm.canSaveMap).toBe(false)
  })
})

describe('multiplayer Save-map gating (canSaveMap computed)', () => {
  const canSaveMap = MultiplayerDinoGame.computed.canSaveMap

  it('random MP game → button shown', () => {
    expect(canSaveMap.call({ localSettings: { minSpeed: 1 } })).toBe(true)
  })

  it('map-seeded MP game (fromInitialMap) → button hidden', () => {
    expect(canSaveMap.call({ localSettings: { fromInitialMap: true } })).toBe(false)
  })
})

describe('multiplayer map_saved → localStorage (storeMapLocally)', () => {
  const storeMapLocally = MultiplayerDinoGame.methods.storeMapLocally

  function canonicalMap(name) {
    const { map } = createNewScenario({ width: 6, height: 6 })
    localStorage.clear()
    map.name = name
    map.metadata.savedAt = '2026-09-11T00:00:00.000Z'
    return map
  }

  it('stores the returned map in the savedMaps bucket', () => {
    const map = canonicalMap('mp-map')
    const name = storeMapLocally.call({}, { name: 'mp-map', map })
    expect(name).toBe('mp-map')
    expect(getSavedMap('mp-map')).not.toBeNull()
  })

  it('suffixes on a local name collision instead of overwriting', () => {
    // Build both maps first — the helper clears localStorage.
    const existing = canonicalMap('mp-map')
    const incoming = canonicalMap('mp-map')
    saveMap(existing)
    const name = storeMapLocally.call({}, { name: 'mp-map', map: incoming })
    expect(name).toBe('mp-map-1')
    expect(getSavedMap('mp-map')).not.toBeNull()
    expect(getSavedMap('mp-map-1')).not.toBeNull()
  })

  it('returns null when the payload has no map (older server)', () => {
    expect(storeMapLocally.call({}, { name: 'x' })).toBeNull()
  })
})
