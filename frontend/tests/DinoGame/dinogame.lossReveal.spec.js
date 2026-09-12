import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DinoGame from '@/components/game/DinoGame.vue'
import Models from '@/game/models.js'
import { FIELDS_TO_SAVE } from '@/game/const.js'

// Losing reveals the whole field so the player can watch the rest play
// out. A SCENARIO is the exception: it's a puzzle meant to be replayed,
// so its layout stays under fog. A saved map behaves like the random game
// it was saved from — revealed, and the bots can still be watched.

function makeMap() {
  const field = Array.from({ length: 6 }, () =>
    Array.from({ length: 6 }, () => ({
      terrain: { kind: 'empty', idx: 1 },
      building: null,
      unit: null,
    }))
  )
  field[0][0].building = { player: 0, _type: 'base' }
  field[0][1].unit = { player: 0, _type: 'dino1' }
  field[5][5].building = { player: 1, _type: 'base' }
  field[5][4].unit = { player: 1, _type: 'dino2' }
  return {
    version: 1,
    name: 'Fog Map',
    metadata: { playersNum: 2, humanPlayersNum: 1, botPlayersNum: 1, width: 6, height: 6 },
    settings: {
      minSpeed: 1,
      maxSpeed: 3,
      enableFogOfWar: true,
      fogOfWarRadius: 1,
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

function launch({ initialMap = null, enableFogOfWar = true, isScenario = !!initialMap } = {}) {
  DinoGame.methods.initPlayersScrollCoords = vi.fn()
  const vm = mount(DinoGame, {
    props: {
      humanPlayersNum: 1,
      botPlayersNum: 1,
      width: 6,
      height: 6,
      scoresToWin: 0,
      sectorsNum: 1,
      enableFogOfWar,
      fogOfWarRadius: 1,
      enableScoutMode: true,
      visibilitySpeedRelation: false,
      minSpeed: 1,
      speedMinVisibility: 5,
      maxSpeed: 3,
      maxUnitsNum: 5,
      maxBasesNum: 3,
      buildingRates: { base: 3, habitation: 0, temple: 0, well: 0, storage: 0, obelisk: 0 },
      hideEnemySpeed: false,
      killAtBirth: false,
      enableUndo: true,
      loadGame: false,
      initialMap,
      isScenario,
    },
    shallow: true,
  }).vm
  return vm
}

// Simulate "this player has just been eliminated and their turn slot came
// up": that is exactly when startTurn calls setVisibilityStartTurn. A
// player is eliminated precisely because nothing of theirs is left on the
// field, so strip their objects too — otherwise they'd still see through
// units that in a real game are gone.
function eliminateAndStartTurn(vm) {
  const player = vm.currentPlayer
  vm.players[player].active = false
  for (let x = 0; x < vm.width; x++) {
    for (let y = 0; y < vm.height; y++) {
      const cell = vm.localField[x][y]
      if (cell.unit?.player === player) cell.unit = null
      if (cell.building?.player === player) cell.building.player = null
    }
  }
  // `startTurn` pairs the deactivation with a phase refresh — that's what
  // tells the rest of the app every human is out.
  vm.updateEndgamePhases()
  vm.setVisibilityStartTurn()
}

function hiddenCellCount(vm) {
  let hidden = 0
  for (let x = 0; x < vm.width; x++) {
    for (let y = 0; y < vm.height; y++) if (vm.localField[x][y].isHidden) hidden++
  }
  return hidden
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('revealing the field after a loss', () => {
  it('random map: losing reveals the whole field', () => {
    const vm = launch()
    vm.players = [
      Object.assign(new Models.Player(Models.PlayerTypes.HUMAN), { active: true }),
      Object.assign(new Models.Player(Models.PlayerTypes.BOT), { active: true }),
    ]
    vm.currentPlayer = 0
    eliminateAndStartTurn(vm)
    expect(hiddenCellCount(vm)).toBe(0)
  })

  it('scenario: losing keeps the field hidden', () => {
    const vm = launch({ initialMap: makeMap() })
    vm.currentPlayer = 0
    eliminateAndStartTurn(vm)
    // Nothing is revealed — an eliminated player sees no cells at all.
    expect(hiddenCellCount(vm)).toBe(vm.width * vm.height)
  })

  it('scenario with fog off: still reveals (there is nothing to hide)', () => {
    const map = makeMap()
    map.settings.enableFogOfWar = false
    const vm = launch({ initialMap: map, enableFogOfWar: false })
    vm.currentPlayer = 0
    eliminateAndStartTurn(vm)
    expect(hiddenCellCount(vm)).toBe(0)
  })

  it('keepsFogAfterLoss only applies to fog-of-war SCENARIOS', () => {
    expect(launch().keepsFogAfterLoss()).toBe(false)
    expect(launch({ initialMap: makeMap() }).keepsFogAfterLoss()).toBe(true)
    expect(launch({ initialMap: makeMap(), enableFogOfWar: false }).keepsFogAfterLoss()).toBe(false)
    // A saved map is launched with the same canonical map but no scenario
    // flag — it reveals like a random game.
    expect(launch({ initialMap: makeMap(), isScenario: false }).keepsFogAfterLoss()).toBe(false)
  })

  it('saved map: losing reveals the field, exactly like a random game', () => {
    const vm = launch({ initialMap: makeMap(), isScenario: false })
    vm.currentPlayer = 0
    eliminateAndStartTurn(vm)
    expect(hiddenCellCount(vm)).toBe(0)
    // ...and the bots can still be watched.
    expect(vm.lostMapGame).toBe(false)
  })

  it('scenario: End turn is blocked once lost — Exit is the only way on', () => {
    const vm = launch({ initialMap: makeMap() })
    vm.currentPlayer = 0
    expect(vm.lostMapGame).toBe(false)
    eliminateAndStartTurn(vm)
    expect(vm.lostMapGame).toBe(true)
    // The button's guard and the 'e' shortcut share `processEndTurn`.
    const spy = vi.spyOn(vm, 'selectNextPlayerAndCheckPhases')
    vm.state = vm.STATES.play
    vm.processEndTurn()
    expect(spy).not.toHaveBeenCalled()
  })

  it('random map: End turn still works after losing, to watch the bots', () => {
    const vm = launch()
    vm.players = [
      Object.assign(new Models.Player(Models.PlayerTypes.HUMAN), { active: true }),
      Object.assign(new Models.Player(Models.PlayerTypes.BOT), { active: true }),
    ]
    vm.currentPlayer = 0
    eliminateAndStartTurn(vm)
    expect(vm.lostMapGame).toBe(false)
  })

  it('spectating a revealed field: bot turns do not re-fog the board', () => {
    const vm = launch()
    vm.players = [
      Object.assign(new Models.Player(Models.PlayerTypes.HUMAN), { active: true }),
      Object.assign(new Models.Player(Models.PlayerTypes.BOT), { active: true }),
    ]
    vm.currentPlayer = 0
    eliminateAndStartTurn(vm)
    // Bot's turn: its own setVisibility re-hides cells for its AI, so the
    // display override has to re-assert the reveal.
    vm.currentPlayer = 1
    vm.setVisibilityStartTurn()
    const override = vm.displayVisibilityCoords
    expect(override).not.toBeNull()
    expect(override.size).toBe(vm.width * vm.height)
  })

  it('spectating a fogged scenario: the board stays dark on bot turns', () => {
    const vm = launch({ initialMap: makeMap() })
    vm.currentPlayer = 0
    eliminateAndStartTurn(vm)
    vm.currentPlayer = 1
    const override = vm.displayVisibilityCoords
    expect(override).not.toBeNull()
    expect(override.size).toBe(0)
  })

  it('a living player is unaffected — normal visibility still applies', () => {
    const vm = launch({ initialMap: makeMap() })
    vm.currentPlayer = 0
    vm.setVisibilityStartTurn()
    const hidden = hiddenCellCount(vm)
    // Some cells visible (around the player's base/unit), but not all.
    expect(hidden).toBeGreaterThan(0)
    expect(hidden).toBeLessThan(vm.width * vm.height)
  })
})

describe('resuming a lost game', () => {
  // The lose rules key off `isScenario`, which arrives as a prop. A
  // resumed game rebuilds its settings from localStorage, so the flag has
  // to survive the round trip — otherwise a reloaded scenario is treated
  // as a random game and hands over the map it had been hiding.
  it('persists the scenario flag so a reloaded scenario keeps its fog', () => {
    expect(FIELDS_TO_SAVE).toContain('isScenario')
  })

  it('a resumed scenario still hides the map after a loss', () => {
    const vm = launch({ initialMap: makeMap(), isScenario: true })
    vm.currentPlayer = 0
    eliminateAndStartTurn(vm)
    expect(vm.keepsFogAfterLoss()).toBe(true)
    expect(hiddenCellCount(vm)).toBe(vm.width * vm.height)
  })

  it('a resumed run that lost the flag would reveal — the regression guard', () => {
    // Same state, flag missing (what a pre-fix save produced).
    const vm = launch({ initialMap: makeMap(), isScenario: false })
    vm.currentPlayer = 0
    eliminateAndStartTurn(vm)
    expect(hiddenCellCount(vm)).toBe(0)
  })
})
