import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DinoGame from '@/components/game/DinoGame.vue'
import { FieldEngine } from '@/game/fieldEngine.js'
import emitter from '@/game/eventBus.js'
import Models from '@/game/models.js'

// Regression: a saved map with many bots (1 human + 7 bots) stalled when a
// bot was wiped out before its first move. Elimination is detected lazily,
// at the start of that player's own turn — so the rotation DOES land on a
// player who turns out to be dead, and whatever happens next has to keep
// the turn moving.

function makeField(w = 8, h = 8) {
  return Array.from({ length: w }, () =>
    Array.from({ length: h }, () =>
      Models.Cell.fromJSON({
        terrain: { kind: 'empty', idx: 1 },
        building: null,
        unit: null,
        isHidden: false,
      })
    )
  )
}

function canonicalMap() {
  const field = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => ({
      terrain: { kind: 'empty', idx: 1 },
      building: null,
      unit: null,
    }))
  )
  field[0][0].building = { player: 0, _type: 'base' }
  field[0][1].unit = { player: 0, _type: 'dino1' }
  field[7][7].building = { player: 1, _type: 'base' }
  field[7][6].unit = { player: 1, _type: 'dino2' }
  return {
    version: 1,
    name: '8-12x12-2026-06-19-1',
    metadata: { playersNum: 2, humanPlayersNum: 1, botPlayersNum: 1, width: 8, height: 8 },
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

function launch({ initialMap, isScenario = !!initialMap } = {}) {
  DinoGame.methods.initPlayersScrollCoords = vi.fn()
  const vm = mount(DinoGame, {
    props: {
      humanPlayersNum: 1,
      botPlayersNum: 2,
      width: 8,
      height: 8,
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
  // A human (seat 0) plus two bots; seat 2 is the one that gets wiped out
  // before it ever moves.
  vm.localField = makeField()
  vm.fieldEngine = new FieldEngine(vm.localField, 8, 8, 2, [], 1, 3, 5, 99, 99, 0, 0, false, false)
  vm.players = [
    Object.assign(new Models.Player(Models.PlayerTypes.HUMAN), { active: true }),
    Object.assign(new Models.Player(Models.PlayerTypes.BOT), { active: true }),
    Object.assign(new Models.Player(Models.PlayerTypes.BOT), { active: true }),
  ]
  // Seats 0 and 1 still hold something; seat 2 holds nothing at all.
  vm.localField[0][0].building = Models.Building.fromJSON({ player: 0, _type: 'base' })
  vm.localField[4][4].unit = Models.Unit.fromJSON({
    player: 1,
    _type: 'dino2',
    movePoints: 2,
    visibility: 2,
  })
  vm.showTurnNotification = vi.fn()
  vm.setVisibilityStartTurn = vi.fn()
  vm.applyTutorialFirstProductionOverride = vi.fn()
  return vm
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('a bot wiped out before its first move', () => {
  it('does not block the turn from being passed on a map launch', async () => {
    const vm = launch({ initialMap: canonicalMap() })
    vm.currentPlayer = 2
    await vm.startTurn()

    // The bot is correctly marked out...
    expect(vm.players[2].active).toBe(false)
    // ...but the End-turn lock is for a HUMAN who lost — a dead bot must
    // still be able to hand the turn on, or the game stalls here forever.
    expect(vm.lostMapGame).toBe(false)
  })

  it('the turn actually advances past the dead bot', async () => {
    const vm = launch({ initialMap: canonicalMap() })
    vm.currentPlayer = 2
    await vm.startTurn()
    vm.state = vm.STATES.play
    vm.processEndTurn()
    expect(vm.currentPlayer).not.toBe(2)
  })

  it('a human who lost a scenario still blocks End turn', async () => {
    const vm = launch({ initialMap: canonicalMap() })
    // Seat 0 (the only human) has nothing left.
    vm.localField[0][0].building = null
    vm.currentPlayer = 0
    await vm.startTurn()
    expect(vm.players[0].active).toBe(false)
    expect(vm.humanPhase).toBe(vm.HUMAN_PHASES.all_eliminated)
    expect(vm.lostMapGame).toBe(true)
  })

  it('a hotseat human who lost while others play on does not freeze the game', async () => {
    const vm = launch({ initialMap: canonicalMap() })
    // Two humans: seat 1 is out, but seat 0 is still playing.
    vm.players[1] = Object.assign(new Models.Player(Models.PlayerTypes.HUMAN), { active: true })
    vm.localField[4][4].unit = null // seat 1 now holds nothing
    vm.currentPlayer = 1
    await vm.startTurn()

    expect(vm.players[1].active).toBe(false)
    // Humans remain, so the run isn't over — the turn must still pass.
    expect(vm.humanPhase).toBe(vm.HUMAN_PHASES.progress)
    expect(vm.lostMapGame).toBe(false)
  })
})

describe('a bot with only stationary units', () => {
  it('passes the turn without calculating moves or cached sight', async () => {
    const vm = launch()
    vm.currentPlayer = 1
    vm.localField[4][4].unit.movePoints = 0
    const moveSpy = vi.spyOn(vm.botEngine, 'makeBotUnitMove')
    const sightSpy = vi.spyOn(vm.botEngine, 'prepareTurnVisibility')
    const emitSpy = vi.spyOn(emitter, 'emit').mockImplementation(() => {})

    try {
      await vm.makeBotMove()
      expect(moveSpy).not.toHaveBeenCalled()
      expect(sightSpy).not.toHaveBeenCalled()
      expect(vm.unitCoordsArr).toEqual([])
      expect(emitSpy).toHaveBeenCalledWith('processEndTurn')
    } finally {
      emitSpy.mockRestore()
    }
  })
})
