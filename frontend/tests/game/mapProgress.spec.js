import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { loadWonMaps, markMapWon, isMapWon, wonKey } from '@/game/mapProgress'
import DinoGame from '@/components/game/DinoGame.vue'
import ScenariosPage from '@/components/game/ScenariosPage.vue'
import Models from '@/game/models.js'

// Beating a scenario or saved map in single-player ticks it in the
// picker, the same cue the tutorial list uses. Cosmetic only.

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('mapProgress store', () => {
  it('starts empty and records a win', () => {
    expect(loadWonMaps()).toEqual({})
    markMapWon('Ambush', true)
    expect(isMapWon('Ambush', true)).toBe(true)
  })

  it('keys scenarios and saved maps separately', () => {
    markMapWon('Duel', true)
    // A saved map that happens to share the name is untouched.
    expect(isMapWon('Duel', false)).toBe(false)
    expect(wonKey('Duel', true)).not.toBe(wonKey('Duel', false))
  })

  it('is idempotent and keeps earlier wins', () => {
    markMapWon('One', true)
    markMapWon('One', true)
    markMapWon('Two', false)
    expect(Object.keys(loadWonMaps())).toHaveLength(2)
  })

  it('ignores a missing name and survives unreadable storage', () => {
    markMapWon('', true)
    expect(loadWonMaps()).toEqual({})
    localStorage.setItem('mapsWon.v1', 'not json')
    expect(loadWonMaps()).toEqual({})
  })
})

describe('recording a win from the game', () => {
  function canonicalMap(name) {
    const field = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => ({
        terrain: { kind: 'empty', idx: 1 },
        building: null,
        unit: null,
      }))
    )
    field[0][0].building = { player: 0, _type: 'base' }
    field[0][1].unit = { player: 0, _type: 'dino1' }
    field[4][4].building = { player: 1, _type: 'base' }
    field[4][3].unit = { player: 1, _type: 'dino2' }
    return {
      version: 1,
      name,
      metadata: { playersNum: 2, humanPlayersNum: 1, botPlayersNum: 1, width: 5, height: 5 },
      settings: {
        minSpeed: 1,
        maxSpeed: 3,
        enableFogOfWar: false,
        fogOfWarRadius: 2,
        visibilitySpeedRelation: false,
        speedMinVisibility: 5,
        maxUnitsNum: 5,
        maxBasesNum: 3,
        unitModifier: 3,
        baseModifier: 3,
        killAtBirth: false,
        hideEnemySpeed: false,
        enableUndo: true,
      },
      field,
      players: [{ _type: 'human' }, { _type: 'bot' }],
    }
  }

  function launch({ initialMap = null, isScenario = false } = {}) {
    DinoGame.methods.initPlayersScrollCoords = vi.fn()
    const vm = mount(DinoGame, {
      props: {
        humanPlayersNum: 1,
        botPlayersNum: 1,
        width: 5,
        height: 5,
        scoresToWin: 0,
        sectorsNum: 1,
        enableFogOfWar: false,
        fogOfWarRadius: 2,
        enableScoutMode: true,
        visibilitySpeedRelation: false,
        minSpeed: 1,
        speedMinVisibility: 5,
        maxSpeed: 3,
        maxUnitsNum: 5,
        maxBasesNum: 3,
        buildingRates: { base: 0, habitation: 0, temple: 0, well: 0, storage: 0, obelisk: 0 },
        hideEnemySpeed: false,
        killAtBirth: false,
        enableUndo: true,
        loadGame: false,
        initialMap,
        isScenario,
      },
      shallow: true,
    }).vm
    vm.players = [
      Object.assign(new Models.Player(Models.PlayerTypes.HUMAN), { active: true }),
      Object.assign(new Models.Player(Models.PlayerTypes.BOT), { active: true }),
    ]
    return vm
  }

  it('ticks a scenario the human just won', () => {
    const vm = launch({ initialMap: canonicalMap('Wild world'), isScenario: true })
    vm.winner = 0
    vm.recordMapWin()
    expect(isMapWon('Wild world', true)).toBe(true)
  })

  it('ticks a saved map under the saved-map key', () => {
    const vm = launch({ initialMap: canonicalMap('my-save'), isScenario: false })
    vm.winner = 0
    vm.recordMapWin()
    expect(isMapWon('my-save', false)).toBe(true)
    expect(isMapWon('my-save', true)).toBe(false)
  })

  it('records nothing when a bot wins', () => {
    const vm = launch({ initialMap: canonicalMap('Wild world'), isScenario: true })
    vm.winner = 1 // the bot
    vm.recordMapWin()
    expect(loadWonMaps()).toEqual({})
  })

  it('records nothing for a random game — there is no entry to tick', () => {
    const vm = launch()
    vm.winner = 0
    vm.recordMapWin()
    expect(loadWonMaps()).toEqual({})
  })
})

describe('the scenarios picker shows the tick', () => {
  it('marks only the scenarios already won', () => {
    markMapWon('Ambush', true)
    const wrapper = mount(ScenariosPage, { shallow: true })
    const won = wrapper.vm.wonMaps
    expect(won[wrapper.vm.wonKey('Ambush', true)]).toBe(true)
    expect(won[wrapper.vm.wonKey('Not played', true)]).toBeUndefined()
  })
})
