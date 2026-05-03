import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DinoGame from '@/components/game/DinoGame.vue'
import { FieldEngine } from '@/game/fieldEngine.js'
import { ACTIONS } from '@/game/const.js'
import emitter from '@/game/eventBus'
import Models from '@/game/models.js'

function makeGrid(w, h, hidden = true) {
  return Array.from({ length: w }, () =>
    Array.from({ length: h }, () => ({
      terrain: { kind: 'empty', idx: 0 },
      building: null,
      unit: null,
      isHidden: hidden,
    })),
  )
}

function makeWrapper(width = 5, height = 5, fogOfWarRadius = 1) {
  DinoGame.methods.initPlayersScrollCoords = vi.fn()
  const wrapper = mount(DinoGame, {
    props: {
      humanPlayersNum: 1,
      botPlayersNum: 0,
      width,
      height,
      scoresToWin: 0,
      sectorsNum: 1,
      enableFogOfWar: true,
      fogOfWarRadius,
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
  vm.localField = makeGrid(width, height, true)
  vm.fieldEngine = new FieldEngine(
    vm.localField, width, height, fogOfWarRadius, [],
    1, 1, 0, 99, 99, 0, 0, true, true,
  )
  vm.players = [{ _type: Models.PlayerTypes.HUMAN, active: true }]
  vm.currentPlayer = 0
  return vm
}

describe('DinoGame stacked undo (move + scout)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('picking a scout target commits the move (drops moveUndoState)', () => {
    const vm = makeWrapper()
    vm.moveUndoState = { diff: [], canUndo: true } // pretend a move was just made
    // No hidden cells in scout patch → scout reveals nothing.
    for (let x = 1; x <= 3; x++) for (let y = 1; y <= 3; y++) vm.localField[x][y].isHidden = false

    vm.handleScoutArea({ x: 2, y: 2, fogRadius: 1 })

    expect(vm.scoutUndoState).not.toBeNull()
    expect(vm.scoutUndoState.canUndo).toBe(true)
    expect(vm.moveUndoState).toBeNull() // committed by the scout
    expect(vm.canUndo).toBe(true)
  })

  it('scout-undo deselects the unit and re-arms scout-pick mode', () => {
    const vm = makeWrapper()
    vm.scoutUndoState = { revealedCoords: [], canUndo: true }

    const events = []
    const initTurn = () => events.push(['initTurn'])
    const setAction = (a) => events.push(['setAction', a])
    emitter.on('initTurn', initTurn)
    emitter.on('setAction', setAction)
    try {
      vm.undoLastMove()
    } finally {
      emitter.off('initTurn', initTurn)
      emitter.off('setAction', setAction)
    }

    expect(vm.scoutUndoState).toBeNull()
    // initTurn must come before setAction — initTurn wipes selectedAction.
    expect(events).toEqual([['initTurn'], ['setAction', ACTIONS.scouting]])
    expect(vm.canUndo).toBe(false)
  })

  it('move revealed new + scout revealed nothing → undo reverts only the scout', () => {
    const vm = makeWrapper()
    // Pretend the move-to-obelisk revealed new cells. moveUndoState is set with
    // canUndo=false. Then a scout is picked that reveals nothing.
    vm.moveUndoState = { diff: [], canUndo: false }
    for (let x = 1; x <= 3; x++) for (let y = 1; y <= 3; y++) vm.localField[x][y].isHidden = false

    vm.handleScoutArea({ x: 2, y: 2, fogRadius: 1 })
    expect(vm.canUndo).toBe(true)             // scout flag wins, ignores move
    expect(vm.moveUndoState).toBeNull()       // scout commit dropped move

    vm.undoLastMove()
    expect(vm.scoutUndoState).toBeNull()
    expect(vm.canUndo).toBe(false)            // move is committed, no chained undo
  })

  it('scout that reveals new cells → undo button disabled', () => {
    const vm = makeWrapper()
    vm.moveUndoState = { diff: [], canUndo: true }
    // Cells inside scout patch are still hidden → scouting will reveal them.
    vm.handleScoutArea({ x: 2, y: 2, fogRadius: 1 })

    expect(vm.scoutUndoState.revealedCoords.length).toBeGreaterThan(0)
    expect(vm.scoutUndoState.canUndo).toBe(false)
    expect(vm.canUndo).toBe(false)
    expect(vm.moveUndoState).toBeNull()        // scout still commits the move
  })

  it('scout-undo re-hides exactly the cells the scout revealed', () => {
    const vm = makeWrapper()
    vm.localField[2][2].isHidden = false       // already visible — should stay visible
    vm.localField[3][3].isHidden = true        // hidden — scout will reveal it

    vm.handleScoutArea({ x: 3, y: 3, fogRadius: 0 })
    expect(vm.scoutUndoState.revealedCoords).toEqual([[3, 3]])
    expect(vm.localField[3][3].isHidden).toBe(false)
    expect(vm.scoutUndoState.canUndo).toBe(false)

    // Force-allow the undo to exercise the re-hide path in isolation.
    vm.scoutUndoState.canUndo = true
    vm.undoLastMove()
    expect(vm.localField[3][3].isHidden).toBe(true)
    expect(vm.localField[2][2].isHidden).toBe(false)
    expect(vm.scoutUndoState).toBeNull()
  })

  it('processEndTurn clears both undo layers', () => {
    const vm = makeWrapper()
    vm.state = vm.STATES.play
    vm.moveUndoState = { diff: [], canUndo: true }
    vm.scoutUndoState = { revealedCoords: [], canUndo: true }
    vm.selectNextPlayerAndCheckPhases = vi.fn()

    vm.processEndTurn()

    expect(vm.moveUndoState).toBeNull()
    expect(vm.scoutUndoState).toBeNull()
    expect(vm.canUndo).toBe(false)
  })
})
