import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DinoGame from '@/components/game/DinoGame.vue'
import { FieldEngine } from '@/game/fieldEngine.js'
import { WaveEngine } from '@/game/waveEngine.js'
import Models from '@/game/models.js'
import {
  BIRTH_ANIMATION_DELAY,
  DEATH_ANIMATION_DELAY,
  MOVE_ANIMATION_DELAY,
} from '@/game/const'

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

  it('calls centerOnCell exactly once per bot move (with the start cell)', async () => {
    vi.useFakeTimers()
    const vm = makeWrapper(5, 5, true)
    vm.players = [
      { _type: Models.PlayerTypes.HUMAN, active: true },
      { _type: Models.PlayerTypes.BOT, active: true },
    ]
    vm.currentPlayer = 1 // bot's turn
    vm.fieldEngine.players = vm.players
    // Human's unit at (4, 4) with visibility 4 — sees the whole 5x5 board.
    vm.localField[4][4].unit = new Models.Unit(0, 'dino', 1, 4)
    vm.localField[0][0].unit = new Models.Unit(1, 'dino', 5, 1)

    // Camera-already-centred → no scroll, no per-step calls.
    const spy = vi.spyOn(vm, 'centerOnCell').mockResolvedValue(false)

    const promise = vm.moveUnit([0, 0], [2, 0])
    await vi.advanceTimersByTimeAsync(1000)
    await promise

    // ONE call only — at the start of the move, with the unit's starting
    // (and first visible) cell. The camera does NOT follow per step.
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toEqual([0, 0])
    vi.useRealTimers()
  })

  it('calls centerOnCell for the human player\'s own move too', async () => {
    // Always-scroll: every action (own or enemy) goes through
    // centerOnCell. The method is a no-op when the cell is already
    // in the viewport, so own clicks won't actually move the camera —
    // but the call itself happens.
    vi.useFakeTimers()
    const vm = makeWrapper(5, 5, true)
    vm.players = [
      { _type: Models.PlayerTypes.HUMAN, active: true },
      { _type: Models.PlayerTypes.BOT, active: true },
    ]
    vm.currentPlayer = 0 // human's turn
    vm.fieldEngine.players = vm.players
    vm.localField[0][0].unit = new Models.Unit(0, 'dino', 5, 4)

    const spy = vi.spyOn(vm, 'centerOnCell').mockResolvedValue(false)

    const promise = vm.moveUnit([0, 0], [2, 0])
    await vi.advanceTimersByTimeAsync(1000)
    await promise

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toEqual([0, 0])
    vi.useRealTimers()
  })

  it('waits for the pre-animation scroll to finish before the unit starts walking', async () => {
    vi.useFakeTimers()
    const vm = makeWrapper(5, 5, true)
    vm.players = [
      { _type: Models.PlayerTypes.HUMAN, active: true },
      { _type: Models.PlayerTypes.BOT, active: true },
    ]
    vm.currentPlayer = 1
    vm.fieldEngine.players = vm.players
    vm.localField[4][4].unit = new Models.Unit(0, 'dino', 1, 4)
    vm.localField[0][0].unit = new Models.Unit(1, 'dino', 5, 1)

    // Hold the scroll Promise open for 200ms — simulates a slow smooth
    // scroll. The animator should NOT start hopping until this resolves.
    vi.spyOn(vm, 'centerOnCell').mockImplementation(
      () => new Promise(r => setTimeout(() => r(true), 200))
    )

    const promise = vm.moveUnit([0, 0], [1, 0])

    // Mid-scroll: bot unit must still be at its starting cell, NOT at the
    // destination.
    await vi.advanceTimersByTimeAsync(100)
    expect(vm.localField[0][0].unit).not.toBeNull()
    expect(vm.localField[1][0].unit).toBeNull()
    expect(vm.isAnimating).toBe(false) // animation hasn't started yet

    // After the scroll resolves, the animation runs.
    await vi.advanceTimersByTimeAsync(100 + MOVE_ANIMATION_DELAY)
    await promise
    expect(vm.localField[1][0].unit).not.toBeNull()
    vi.useRealTimers()
  })

  it('picks the first visible cell of the path when the start is in fog', async () => {
    vi.useFakeTimers()
    const vm = makeWrapper(5, 5, true)
    vm.players = [
      { _type: Models.PlayerTypes.HUMAN, active: true },
      { _type: Models.PlayerTypes.BOT, active: true },
    ]
    vm.currentPlayer = 1
    vm.fieldEngine.players = vm.players
    // Human's unit at (3, 0) with visibility 2 — sees (1..4, 0..2). The
    // bot's start cell (0, 0) is in fog; the path enters visibility at (1, 0).
    vm.localField[3][0].unit = new Models.Unit(0, 'dino', 1, 2)
    vm.localField[0][0].unit = new Models.Unit(1, 'dino', 5, 1)

    const spy = vi.spyOn(vm, 'centerOnCell').mockResolvedValue(false)

    const promise = vm.moveUnit([0, 0], [2, 0])
    await vi.advanceTimersByTimeAsync(1000)
    await promise

    // Path (0,0)→(1,0)→(2,0). First visible cell is (1,0) — that's where
    // we should pre-scroll, not the fogged start.
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toEqual([1, 0])
    vi.useRealTimers()
  })

  it('marks killed neighbours as dying for DEATH_ANIMATION_DELAY before removing them', async () => {
    vi.useFakeTimers()
    const vm = makeWrapper(5, 5, true)
    vm.players = [
      { _type: Models.PlayerTypes.HUMAN, active: true, killed: 0, lost: 0, score: 0 },
      { _type: Models.PlayerTypes.BOT, active: true, killed: 0, lost: 0, score: 0 },
    ]
    vm.currentPlayer = 1
    vm.fieldEngine.players = vm.players
    // Bot at (0, 0) walks to (1, 0). Human's unit at (1, 1) is adjacent to
    // the destination, so it dies.
    vm.localField[0][0].unit = new Models.Unit(1, 'dino', 5, 4)
    vm.localField[1][1].unit = new Models.Unit(0, 'dino', 1, 1)

    vi.spyOn(vm, 'centerOnCell').mockResolvedValue(false)

    const promise = vm.moveUnit([0, 0], [1, 0])
    // Advance past the move walk (1 step → MOVE_ANIMATION_DELAY).
    await vi.advanceTimersByTimeAsync(MOVE_ANIMATION_DELAY)
    await Promise.resolve()
    // We're inside the death-animation hold (DEATH_ANIMATION_DELAY). The
    // killed cell is marked dying and the unit is still in the field —
    // Vue is rendering the damage flash + fade-out.
    expect(vm.dyingCells.has('1,1')).toBe(true)
    expect(vm.localField[1][1].unit).not.toBeNull()

    // After the death-animation delay completes, dyingCells is cleared and
    // the unit is actually removed from the field.
    await vi.advanceTimersByTimeAsync(DEATH_ANIMATION_DELAY)
    await promise
    expect(vm.dyingCells.has('1,1')).toBe(false)
    expect(vm.localField[1][1].unit).toBeFalsy()
    vi.useRealTimers()
  })

  it('scrolls to each enemy birth and waits BIRTH_ANIMATION_DELAY per birth', async () => {
    vi.useFakeTimers()
    const vm = makeWrapper(5, 5, true)
    vm.players = [
      { _type: Models.PlayerTypes.HUMAN, active: true, killed: 0, lost: 0, score: 0 },
      { _type: Models.PlayerTypes.BOT, active: true, killed: 0, lost: 0, score: 0 },
    ]
    vm.fieldEngine.players = vm.players
    // Human's unit at (4, 4) with visibility 4 — sees the whole 5x5 board,
    // so both bot spawns are in the human's view.
    vm.localField[4][4].unit = new Models.Unit(0, 'dino', 1, 4)
    vm.currentPlayer = 1 // bot's turn — sequential branch fires

    const ensureSpy = vi.spyOn(vm, 'centerOnCell').mockResolvedValue(false)

    const births = [
      { coords: [0, 0], killedCoords: [] },
      { coords: [2, 2], killedCoords: [] },
    ]
    const promise = vm.runBirthSequence(births)

    // Microtask flush: 1st birth's centerOnCell has been awaited
    // (resolved synchronously by the mock) — we're now inside the sleep.
    await Promise.resolve()
    await Promise.resolve()
    expect(ensureSpy).toHaveBeenCalledTimes(1)
    expect(ensureSpy.mock.calls[0][0]).toEqual([0, 0])

    // Past the first birth's hold → second scroll fires.
    await vi.advanceTimersByTimeAsync(BIRTH_ANIMATION_DELAY)
    await Promise.resolve()
    expect(ensureSpy).toHaveBeenCalledTimes(2)
    expect(ensureSpy.mock.calls[1][0]).toEqual([2, 2])

    await vi.advanceTimersByTimeAsync(BIRTH_ANIMATION_DELAY)
    await promise
    vi.useRealTimers()
  })

  it('marks each spawn cell borning sequentially during the fade-in', async () => {
    vi.useFakeTimers()
    const vm = makeWrapper(5, 5, true)
    vm.players = [
      { _type: Models.PlayerTypes.HUMAN, active: true, killed: 0, lost: 0, score: 0 },
      { _type: Models.PlayerTypes.BOT, active: true, killed: 0, lost: 0, score: 0 },
    ]
    vm.fieldEngine.players = vm.players
    // Human's unit at (4, 4) with visibility 4 — sees the whole 5x5 board.
    vm.localField[4][4].unit = new Models.Unit(0, 'dino', 1, 4)
    vm.currentPlayer = 1 // enemy turn → wantScroll = true
    vi.spyOn(vm, 'centerOnCell').mockResolvedValue(false)

    const births = [
      { coords: [0, 0], killedCoords: [] },
      { coords: [2, 2], killedCoords: [] },
    ]
    const promise = vm.runBirthSequence(births)

    // Mid-first-birth: only (0, 0) is borning; (2, 2) hasn't started yet.
    await Promise.resolve()
    await Promise.resolve()
    expect(vm.borningCells.has('0,0')).toBe(true)
    expect(vm.borningCells.has('2,2')).toBe(false)

    // After the first birth's window: first unmarks, second marks.
    await vi.advanceTimersByTimeAsync(BIRTH_ANIMATION_DELAY)
    await Promise.resolve()
    expect(vm.borningCells.has('0,0')).toBe(false)
    expect(vm.borningCells.has('2,2')).toBe(true)

    // After the second birth's window: borningCells is empty.
    await vi.advanceTimersByTimeAsync(BIRTH_ANIMATION_DELAY)
    await promise
    expect(vm.borningCells.size).toBe(0)
    vi.useRealTimers()
  })

  it('skips enemy births that are in the human player\'s fog', async () => {
    vi.useFakeTimers()
    const vm = makeWrapper(5, 5, true)
    vm.players = [
      { _type: Models.PlayerTypes.HUMAN, active: true, killed: 0, lost: 0, score: 0 },
      { _type: Models.PlayerTypes.BOT, active: true, killed: 0, lost: 0, score: 0 },
    ]
    vm.fieldEngine.players = vm.players
    // Human's unit at (0, 0) with visibility 1 — sees only (0..1, 0..1).
    vm.localField[0][0].unit = new Models.Unit(0, 'dino', 1, 1)
    vm.currentPlayer = 1

    const ensureSpy = vi.spyOn(vm, 'centerOnCell').mockResolvedValue(false)

    const births = [
      { coords: [0, 1], killedCoords: [] }, // visible
      { coords: [3, 3], killedCoords: [] }, // in fog
    ]
    const promise = vm.runBirthSequence(births)
    await vi.advanceTimersByTimeAsync(2 * BIRTH_ANIMATION_DELAY)
    await promise

    expect(ensureSpy).toHaveBeenCalledTimes(1)
    expect(ensureSpy.mock.calls[0][0]).toEqual([0, 1])
    vi.useRealTimers()
  })

  it('plays the same death animation for kill-at-birth at start of turn', async () => {
    vi.useFakeTimers()
    const vm = makeWrapper(5, 5, true)
    // Human player owns a base at (1, 0); a bot unit sits adjacent at (1, 1).
    // When the human's turn starts, a fresh unit spawns at (1, 0) and (with
    // killAtBirth) kills the bot unit. Same animation path as a move-kill.
    vm.players = [
      { _type: Models.PlayerTypes.HUMAN, active: true, killed: 0, lost: 0, score: 0 },
      { _type: Models.PlayerTypes.BOT, active: true, killed: 0, lost: 0, score: 0 },
    ]
    vm.fieldEngine.killAtBirth = true
    vm.fieldEngine.players = vm.players
    vm.localField[1][0].building = { _type: 'base', player: 0 }
    vm.localField[1][1].unit = new Models.Unit(1, 'dino', 1, 1)
    vm.currentPlayer = 0

    const promise = vm.startTurn()
    await Promise.resolve()
    // Mid-birth: spawn cell is in `borningCells`, victim is dying — both
    // are still rendered while the fade-in / damage-flash play.
    expect(vm.borningCells.has('1,0')).toBe(true)
    expect(vm.dyingCells.has('1,1')).toBe(true)
    expect(vm.localField[1][0].unit).not.toBeNull()
    expect(vm.localField[1][1].unit).not.toBeNull()

    // After BIRTH_ANIMATION_DELAY (the per-birth window) the victim is
    // removed, both flags clear, and the spawned unit stays.
    await vi.advanceTimersByTimeAsync(BIRTH_ANIMATION_DELAY)
    await promise
    expect(vm.borningCells.size).toBe(0)
    expect(vm.dyingCells.has('1,1')).toBe(false)
    expect(vm.localField[1][1].unit).toBeFalsy()
    expect(vm.localField[1][0].unit).not.toBeNull()
    vi.useRealTimers()
  })

  it('does not animate dying when the move kills no one', async () => {
    vi.useFakeTimers()
    const vm = makeWrapper(5, 5, true)
    vm.players = [
      { _type: Models.PlayerTypes.HUMAN, active: true, killed: 0, lost: 0, score: 0 },
      { _type: Models.PlayerTypes.BOT, active: true, killed: 0, lost: 0, score: 0 },
    ]
    vm.currentPlayer = 1
    vm.fieldEngine.players = vm.players
    vm.localField[4][4].unit = new Models.Unit(0, 'dino', 1, 4)
    vm.localField[0][0].unit = new Models.Unit(1, 'dino', 5, 1)
    vi.spyOn(vm, 'centerOnCell').mockResolvedValue(false)

    const promise = vm.moveUnit([0, 0], [1, 0])
    await vi.advanceTimersByTimeAsync(MOVE_ANIMATION_DELAY + DEATH_ANIMATION_DELAY)
    await promise

    expect(vm.dyingCells.size).toBe(0)
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

    await vi.advanceTimersByTimeAsync(MOVE_ANIMATION_DELAY)
    expect(vm.localField[2][0].unit).not.toBeNull()
    expect(vm.localField[2][0].unit._type).toBe('dino')

    await vi.advanceTimersByTimeAsync(MOVE_ANIMATION_DELAY)
    await promise
    // Side-effects after walk completes.
    expect(unit.hasMoved).toBe(true)
    expect(vm.isAnimating).toBe(false)
    vi.useRealTimers()
  })
})
