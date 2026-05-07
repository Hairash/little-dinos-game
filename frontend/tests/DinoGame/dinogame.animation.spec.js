import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DinoGame from '@/components/game/DinoGame.vue'
import { FieldEngine } from '@/game/fieldEngine.js'
import { WaveEngine } from '@/game/waveEngine.js'
import Models from '@/game/models.js'

function makeGrid(w, h, hidden = false) {
  return Array.from({ length: w }, () =>
    Array.from({ length: h }, () => ({
      terrain: { kind: 'empty', idx: 0 },
      building: null,
      unit: null,
      isHidden: hidden,
    }))
  )
}

function makeWrapper(width = 5, height = 5, enableFogOfWar = false) {
  DinoGame.methods.initPlayersScrollCoords = vi.fn()
  const wrapper = mount(DinoGame, {
    props: {
      humanPlayersNum: 1,
      botPlayersNum: 0,
      width,
      height,
      scoresToWin: 0,
      sectorsNum: 1,
      enableFogOfWar,
      fogOfWarRadius: 1,
      enableScoutMode: true,
      visibilitySpeedRelation: false,
      minSpeed: 1,
      maxSpeed: 1,
      maxUnitsNum: 99,
      maxBasesNum: 99,
      buildingRates: { base: 3, habitation: 0, temple: 3, well: 0, storage: 0, obelisk: 1 },
      hideEnemySpeed: false,
      killAtBirth: false,
      enableUndo: true,
      loadGame: false,
    },
    shallow: true,
  })
  const vm = wrapper.vm
  vm.localField = makeGrid(width, height, false)
  vm.fieldEngine = new FieldEngine(
    vm.localField,
    width,
    height,
    1,
    [],
    1,
    1,
    0,
    99,
    99,
    0,
    0,
    true,
    true
  )
  vm.waveEngine = new WaveEngine(vm.localField, width, height, 1, true)
  vm.players = [{ _type: Models.PlayerTypes.HUMAN, active: true }]
  vm.currentPlayer = 0
  return vm
}

describe('DinoGame animation input gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emitMoveUnit is a no-op while a move is animating', () => {
    const vm = makeWrapper()
    const spy = vi.spyOn(vm, 'moveUnit')
    vm.isAnimating = true
    vm.emitMoveUnit({ fromCoords: [0, 0], toCoords: [1, 0] })
    expect(spy).not.toHaveBeenCalled()
  })

  it('canUndo is false while a move is animating, even with valid undo state', () => {
    const vm = makeWrapper()
    vm.moveUndoState = { diff: [], canUndo: true }
    expect(vm.canUndo).toBe(true)
    vm.isAnimating = true
    expect(vm.canUndo).toBe(false)
  })

  it('processEndTurn is a no-op while animating', () => {
    const vm = makeWrapper()
    vm.state = vm.STATES.play
    const before = vm.state
    vm.isAnimating = true
    vm.processEndTurn()
    expect(vm.state).toBe(before)
  })

  it('displayVisibilityCoords is null on a human turn (use cell.isHidden directly)', () => {
    const vm = makeWrapper(5, 5, true)
    vm.players = [{ _type: Models.PlayerTypes.HUMAN, active: true }]
    vm.currentPlayer = 0
    expect(vm.displayVisibilityCoords).toBeNull()
  })

  it('displayVisibilityCoords reflects the human player on a bot turn', () => {
    const vm = makeWrapper(5, 5, true)
    vm.players = [
      { _type: Models.PlayerTypes.HUMAN, active: true },
      { _type: Models.PlayerTypes.BOT, active: true },
    ]
    vm.currentPlayer = 1
    // Place a human unit; that's what fieldEngine.getCurrentVisibilitySet keys off.
    vm.localField[2][2].unit = new Models.Unit(0, 'dino', 1, 1)
    vm.fieldEngine.players = vm.players
    const set = vm.displayVisibilityCoords
    expect(set).not.toBeNull()
    // Visibility 1 reveals a 3x3 around (2,2).
    expect(set.has('2,2')).toBe(true)
    expect(set.has('3,3')).toBe(true)
    expect(set.has('4,4')).toBe(false)
  })

  it('freezes displayVisibilityCoords during a move so a kill mid-walk does not erase the path', async () => {
    vi.useFakeTimers()
    const vm = makeWrapper(5, 5, true)
    vm.players = [
      { _type: Models.PlayerTypes.HUMAN, active: true },
      { _type: Models.PlayerTypes.BOT, active: true },
    ]
    vm.currentPlayer = 1 // bot's turn
    vm.fieldEngine.players = vm.players
    // Human's only unit at (4, 4); bot's unit at (0, 0). Bot will walk to (3, 4).
    // Walking onto (3, 4) lands adjacent to the human's unit at (4, 4), so
    // killNeighbours kills it — shrinking the live human visibility to empty.
    const humanUnit = new Models.Unit(0, 'dino', 1, 1)
    const botUnit = new Models.Unit(1, 'dino', 5, 1)
    vm.localField[4][4].unit = humanUnit
    vm.localField[0][0].unit = botUnit

    // Visibility before the move: human's unit at (4,4) reveals (3..4, 3..4).
    expect(vm.displayVisibilityCoords.has('3,4')).toBe(true)

    const promise = vm.moveUnit([0, 0], [3, 4])

    // Snapshot taken at move-start; displayVisibilityCoords is frozen.
    await Promise.resolve()
    expect(vm.displayVisibilitySnapshot).not.toBeNull()
    expect(vm.displayVisibilityCoords.has('3,4')).toBe(true)

    // Advance through the entire animation.
    await vi.advanceTimersByTimeAsync(1000)
    await promise

    // After the move resolves: snapshot cleared, human unit dead, live
    // visibility shrinks to empty.
    expect(vm.displayVisibilitySnapshot).toBeNull()
    expect(vm.displayVisibilityCoords.size).toBe(0)
    vi.useRealTimers()
  })

  it('moveUnit walks the unit cell-by-cell along the BFS path', async () => {
    vi.useFakeTimers()
    const vm = makeWrapper(5, 5)
    const unit = new Models.Unit(0, 'dino', 3, 0)
    vm.localField[0][0].unit = unit

    const promise = vm.moveUnit([0, 0], [2, 0])

    // First step is synchronous-ish (before the first sleep).
    // Vue reactivity wraps stored objects in proxies, so identity (toBe)
    // breaks; assert via the unit's identifying fields instead.
    await Promise.resolve()
    expect(vm.localField[1][0].unit).not.toBeNull()
    expect(vm.localField[1][0].unit._type).toBe('dino')
    expect(vm.localField[0][0].unit).toBeNull()

    await vi.advanceTimersByTimeAsync(100)
    expect(vm.localField[2][0].unit).not.toBeNull()
    expect(vm.localField[2][0].unit._type).toBe('dino')

    await vi.advanceTimersByTimeAsync(100)
    await promise
    // Side-effects after walk completes.
    expect(unit.hasMoved).toBe(true)
    expect(vm.isAnimating).toBe(false)
    vi.useRealTimers()
  })
})
