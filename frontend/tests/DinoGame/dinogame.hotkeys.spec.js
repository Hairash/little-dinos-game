import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DinoGame from '@/components/game/DinoGame.vue'
import Models from '@/game/models.js'
import emitter from '@/game/eventBus'

// The in-game hotkeys ('e' ends the turn, Enter dismisses the ready
// label) act on the board, so they must stay quiet while the player is
// typing (Save-map name) or an overlay covers the board.

function makeVm() {
  DinoGame.methods.initPlayersScrollCoords = vi.fn()
  const vm = mount(DinoGame, {
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
    },
    shallow: true,
  }).vm
  vm.players = [
    Object.assign(new Models.Player(Models.PlayerTypes.HUMAN), { active: true }),
    Object.assign(new Models.Player(Models.PlayerTypes.BOT), { active: true }),
  ]
  vm.currentPlayer = 0
  vm.state = vm.STATES.play
  return vm
}

function keyEvent(key, target = {}, modifiers = {}) {
  return { key, target, ...modifiers }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('in-game hotkey suppression', () => {
  it('ends the turn on "e" during normal play', () => {
    const vm = makeVm()
    const spy = vi.spyOn(vm, 'processEndTurn').mockImplementation(() => {})
    vm.keyupHandlerRef(keyEvent('e', { tagName: 'DIV' }))
    expect(spy).toHaveBeenCalled()
  })

  it('does not end a bot turn when the player presses "e"', () => {
    const vm = makeVm()
    vm.currentPlayer = 1
    const spy = vi.spyOn(vm, 'processEndTurn').mockImplementation(() => {})

    vm.keyupHandlerRef(keyEvent('e', { tagName: 'DIV' }))

    expect(spy).not.toHaveBeenCalled()
  })

  it('supports the game action hotkeys during normal play', () => {
    const vm = makeVm()
    vm.moveUndoState = { diff: [], canUndo: true }
    vm.initialMapSnapshot = { metadata: {} }
    const undo = vi.spyOn(vm, 'undoLastMove').mockImplementation(() => {})
    const next = vi.spyOn(vm, 'findNextUnit').mockImplementation(() => {})
    const zoom = vi.spyOn(vm, 'changeCellSize').mockImplementation(() => {})
    const save = vi.spyOn(vm, 'openSaveMapDialog').mockImplementation(() => {})

    vm.keyupHandlerRef(keyEvent('u', { tagName: 'DIV' }))
    vm.keyupHandlerRef(keyEvent('n', { tagName: 'DIV' }))
    vm.keyupHandlerRef(keyEvent('=', { tagName: 'DIV' }))
    vm.keyupHandlerRef(keyEvent('-', { tagName: 'DIV' }))
    vm.keyupHandlerRef(keyEvent('s', { tagName: 'DIV' }))
    vm.keyupHandlerRef(keyEvent('q', { tagName: 'DIV' }))

    expect(undo).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledOnce()
    expect(zoom).toHaveBeenNthCalledWith(1, 10)
    expect(zoom).toHaveBeenNthCalledWith(2, -10)
    expect(save).toHaveBeenCalledOnce()
    expect(vm.state).toBe(vm.STATES.exitDialog)
  })

  it('toggles fast-forward and announces its new state on "f"', () => {
    const vm = makeVm()

    vm.keyupHandlerRef(keyEvent('f', { tagName: 'DIV' }))

    expect(vm.botMovementMode).toBe('fast_forward')
    expect(vm.notifications.at(-1).message).toBe('Fast-forward bot moves turned on')
  })

  it('uses Escape to ask the info panel to toggle the game menu', () => {
    const vm = makeVm()
    const emit = vi.spyOn(emitter, 'emit')

    vm.keyupHandlerRef(keyEvent('Escape', { tagName: 'DIV' }))

    expect(emit).toHaveBeenCalledWith('toggleGameMenu')
  })

  it('ignores keys typed into a text input (Save-map name)', () => {
    const vm = makeVm()
    const spy = vi.spyOn(vm, 'processEndTurn').mockImplementation(() => {})
    vm.keyupHandlerRef(keyEvent('e', { tagName: 'INPUT' }))
    expect(spy).not.toHaveBeenCalled()
  })

  it('ignores keys typed into a textarea', () => {
    const vm = makeVm()
    const spy = vi.spyOn(vm, 'processEndTurn').mockImplementation(() => {})
    vm.keyupHandlerRef(keyEvent('e', { tagName: 'TEXTAREA' }))
    expect(spy).not.toHaveBeenCalled()
  })

  it('ignores modifier combos so browser shortcuts still work', () => {
    const vm = makeVm()
    const spy = vi.spyOn(vm, 'processEndTurn').mockImplementation(() => {})
    vm.keyupHandlerRef(keyEvent('e', { tagName: 'DIV' }, { metaKey: true }))
    expect(spy).not.toHaveBeenCalled()
  })

  it('ignores keys while the in-game menu is open', () => {
    const vm = makeVm()
    vm.menuOpen = true
    const spy = vi.spyOn(vm, 'processEndTurn').mockImplementation(() => {})
    vm.keyupHandlerRef(keyEvent('e', { tagName: 'DIV' }))
    expect(spy).not.toHaveBeenCalled()
  })

  it('ignores keys while the Save-map dialog is open', () => {
    const vm = makeVm()
    vm.showSaveMapDialog = true
    const spy = vi.spyOn(vm, 'processEndTurn').mockImplementation(() => {})
    vm.keyupHandlerRef(keyEvent('e', { tagName: 'DIV' }))
    expect(spy).not.toHaveBeenCalled()
  })

  it('Enter does not dismiss the exit confirmation', () => {
    const vm = makeVm()
    vm.state = vm.STATES.exitDialog
    vm.keyupHandlerRef(keyEvent('Enter', { tagName: 'DIV' }))
    expect(vm.state).toBe(vm.STATES.exitDialog)
  })

  it('Enter still dismisses the ready label', () => {
    const vm = makeVm()
    vm.state = vm.STATES.ready
    vm.keyupHandlerRef(keyEvent('Enter', { tagName: 'DIV' }))
    expect(vm.state).toBe(vm.STATES.play)
  })
})
