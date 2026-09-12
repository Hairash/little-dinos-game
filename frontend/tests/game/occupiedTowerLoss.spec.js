import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DinoGame from '@/components/game/DinoGame.vue'
import { FieldEngine } from '@/game/fieldEngine.js'
import Models from '@/game/models.js'

// Single-player: losing every unit while every tower you own is occupied
// by an opponent is a defeat — the tower can't produce and you have
// nothing left to drive them off with. (Multiplayer deliberately keeps
// you in the game there; see backend get_active_players.)

function makeField(w = 5, h = 5) {
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

function engineFor(field) {
  return new FieldEngine(field, 5, 5, 2, [], 1, 3, 5, 99, 99, 0, 0, false, false)
}

function unitOf(player) {
  return Models.Unit.fromJSON({
    player,
    _type: `dino${player + 1}`,
    movePoints: 2,
    visibility: 2,
  })
}

function base(player) {
  return Models.Building.fromJSON({ player, _type: 'base' })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('FieldEngine.hasPlayableAssets', () => {
  it('a unit keeps you in', () => {
    const field = makeField()
    field[1][1].unit = unitOf(0)
    expect(engineFor(field).hasPlayableAssets(0)).toBe(true)
  })

  it('a free tower keeps you in', () => {
    const field = makeField()
    field[1][1].building = base(0)
    expect(engineFor(field).hasPlayableAssets(0)).toBe(true)
  })

  it('your own unit standing on your tower keeps you in', () => {
    const field = makeField()
    field[1][1].building = base(0)
    field[1][1].unit = unitOf(0)
    expect(engineFor(field).hasPlayableAssets(0)).toBe(true)
  })

  it('a tower occupied by an enemy does NOT keep you in', () => {
    const field = makeField()
    field[1][1].building = base(0)
    field[1][1].unit = unitOf(1)
    expect(engineFor(field).hasPlayableAssets(0)).toBe(false)
  })

  it('every tower occupied and no units left is a loss', () => {
    const field = makeField()
    field[1][1].building = base(0)
    field[1][1].unit = unitOf(1)
    field[3][3].building = base(0)
    field[3][3].unit = unitOf(1)
    expect(engineFor(field).hasPlayableAssets(0)).toBe(false)
    // The occupier is fine, of course.
    expect(engineFor(field).hasPlayableAssets(1)).toBe(true)
  })

  it('one free tower among occupied ones still keeps you in', () => {
    const field = makeField()
    field[1][1].building = base(0)
    field[1][1].unit = unitOf(1)
    field[3][3].building = base(0)
    expect(engineFor(field).hasPlayableAssets(0)).toBe(true)
  })

  it('a neutral tower belongs to nobody', () => {
    const field = makeField()
    field[1][1].building = base(null)
    expect(engineFor(field).hasPlayableAssets(0)).toBe(false)
  })
})

describe('single-player turn start marks the player out', () => {
  function launch() {
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
      },
      shallow: true,
    }).vm
    vm.localField = makeField()
    vm.fieldEngine = engineFor(vm.localField)
    vm.players = [
      Object.assign(new Models.Player(Models.PlayerTypes.HUMAN), { active: true }),
      Object.assign(new Models.Player(Models.PlayerTypes.BOT), { active: true }),
    ]
    vm.currentPlayer = 0
    vm.showTurnNotification = vi.fn()
    vm.setVisibilityStartTurn = vi.fn()
    vm.applyTutorialFirstProductionOverride = vi.fn()
    return vm
  }

  it('all towers occupied and no units → eliminated on turn start', async () => {
    const vm = launch()
    vm.localField[1][1].building = base(0)
    vm.localField[1][1].unit = unitOf(1) // enemy parked on the last tower
    await vm.startTurn()
    expect(vm.players[0].active).toBe(false)
  })

  it('a free tower spawns a defender, so the player survives', async () => {
    const vm = launch()
    vm.localField[1][1].building = base(0)
    await vm.startTurn()
    expect(vm.players[0].active).toBe(true)
    expect(vm.localField[1][1].unit).not.toBeNull()
  })

  it('a surviving unit elsewhere keeps the player in', async () => {
    const vm = launch()
    vm.localField[1][1].building = base(0)
    vm.localField[1][1].unit = unitOf(1)
    vm.localField[4][4].unit = unitOf(0)
    await vm.startTurn()
    expect(vm.players[0].active).toBe(true)
  })
})

describe('single-player: winning by occupying every rival tower', () => {
  // The mirror of the loss rule. `areAllPlayersOccupied` already encodes
  // it — no enemy units left and every enemy tower sat on — so this pins
  // the behaviour rather than adding it.
  it('wins once no enemy unit is left and every enemy tower is occupied', () => {
    const field = makeField()
    field[1][1].building = base(0)
    field[1][1].unit = unitOf(0)
    field[3][3].building = base(1) // rival tower...
    field[3][3].unit = unitOf(0) // ...with my dino standing on it
    expect(engineFor(field).areAllPlayersOccupied(0)).toBe(true)
  })

  it('does not win while a rival tower stands free', () => {
    const field = makeField()
    field[1][1].building = base(0)
    field[1][1].unit = unitOf(0)
    field[3][3].building = base(1) // rival tower, nobody on it
    expect(engineFor(field).areAllPlayersOccupied(0)).toBe(false)
  })

  it('does not win while a rival dino is still alive', () => {
    const field = makeField()
    field[1][1].building = base(0)
    field[1][1].unit = unitOf(0)
    field[3][3].building = base(1)
    field[3][3].unit = unitOf(0)
    field[4][0].unit = unitOf(1) // rival dino still out there
    expect(engineFor(field).areAllPlayersOccupied(0)).toBe(false)
  })

  it('the occupied rival is also out by the single-player loss rule', () => {
    const field = makeField()
    field[3][3].building = base(1)
    field[3][3].unit = unitOf(0)
    // Same position, read from the rival's side: nothing playable left.
    expect(engineFor(field).hasPlayableAssets(1)).toBe(false)
  })
})
