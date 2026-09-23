import { describe, expect, it, vi } from 'vitest'
import MultiplayerDinoGame from '@/components/game/MultiplayerDinoGame.vue'
import emitter from '@/game/eventBus'

const handleKey = MultiplayerDinoGame.methods.handleGameHotkey

function context(overrides = {}) {
  return {
    STATES: { ready: 'ready', play: 'play', exitDialog: 'exitDialog' },
    state: 'play',
    menuOpen: false,
    showSaveMapDialog: false,
    showReadyLabel: false,
    canUndo: true,
    canSaveMap: true,
    isMyTurn: true,
    isAnimating: false,
    winner: null,
    processEndTurn: vi.fn(),
    undoLastMove: vi.fn(),
    findNextUnit: vi.fn(),
    changeCellSize: vi.fn(),
    openSaveMapDialog: vi.fn(),
    handleReadyLabelClose: vi.fn(),
    ...overrides,
  }
}

function press(vm, key, target = { tagName: 'DIV' }, modifiers = {}) {
  handleKey.call(vm, { key, target, ...modifiers })
}

describe('multiplayer game hotkeys', () => {
  it('registers and removes the global keyboard listener', () => {
    const vm = context({
      handleGameHotkey: vi.fn(),
      emitMoveUnit: vi.fn(),
      emitAddTempVisibilityForCoords: vi.fn(),
      emitScoutArea: vi.fn(),
      startTurn: vi.fn(),
      setupActivityTracking: vi.fn(),
      clearInactivityTimer: vi.fn(),
      activityEventHandlers: [],
      gameWs: null,
    })
    const on = vi.spyOn(emitter, 'on').mockImplementation(() => {})
    const off = vi.spyOn(emitter, 'off').mockImplementation(() => {})
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    try {
      MultiplayerDinoGame.mounted.call(vm)
      expect(add).toHaveBeenCalledWith('keyup', vm.handleGameHotkey)

      MultiplayerDinoGame.beforeUnmount.call(vm)
      expect(remove).toHaveBeenCalledWith('keyup', vm.handleGameHotkey)
    } finally {
      on.mockRestore()
      off.mockRestore()
      add.mockRestore()
      remove.mockRestore()
    }
  })

  it('uses the same action keys as single-player, except fast-forward', () => {
    const vm = context()
    for (const key of ['E', 'u', 'N', '=', '+', '-', 's', 'f']) press(vm, key)

    expect(vm.processEndTurn).toHaveBeenCalledOnce()
    expect(vm.undoLastMove).toHaveBeenCalledOnce()
    expect(vm.findNextUnit).toHaveBeenCalledOnce()
    expect(vm.changeCellSize.mock.calls).toEqual([[10], [10], [-10]])
    expect(vm.openSaveMapDialog).toHaveBeenCalledOnce()
    expect(vm.state).toBe('play')

    press(vm, 'q')
    expect(vm.state).toBe('exitDialog')
  })

  it('toggles the menu with Escape and closes the ready label with Enter', () => {
    const vm = context()
    const emit = vi.spyOn(emitter, 'emit').mockImplementation(() => {})
    try {
      press(vm, 'Escape')
      vm.menuOpen = true
      press(vm, 'Escape')
      expect(emit).toHaveBeenCalledTimes(2)
      expect(emit).toHaveBeenNthCalledWith(1, 'toggleGameMenu')
      expect(emit).toHaveBeenNthCalledWith(2, 'toggleGameMenu')

      vm.menuOpen = false
      vm.showReadyLabel = true
      vm.state = 'ready'
      press(vm, 'Enter')
      expect(vm.handleReadyLabelClose).toHaveBeenCalledOnce()
    } finally {
      emit.mockRestore()
    }
  })

  it('saves only random maps and blocks turn actions outside the active turn', () => {
    const mapSeeded = MultiplayerDinoGame.computed.canSaveMap.call({
      localSettings: { fromInitialMap: true },
    })
    const vm = context({ canSaveMap: mapSeeded, isMyTurn: false })
    for (const key of ['e', 'u', 'n', 's']) press(vm, key)
    expect(vm.processEndTurn).not.toHaveBeenCalled()
    expect(vm.undoLastMove).not.toHaveBeenCalled()
    expect(vm.findNextUnit).not.toHaveBeenCalled()
    expect(vm.openSaveMapDialog).not.toHaveBeenCalled()

    vm.isMyTurn = true
    vm.winner = 1
    for (const key of ['e', 'u', 'n']) press(vm, key)
    expect(vm.processEndTurn).not.toHaveBeenCalled()
    expect(vm.undoLastMove).not.toHaveBeenCalled()
    expect(vm.findNextUnit).not.toHaveBeenCalled()

    vm.winner = null
    vm.isAnimating = true
    for (const key of ['e', 'u', 'n']) press(vm, key)
    expect(vm.processEndTurn).not.toHaveBeenCalled()
    expect(vm.undoLastMove).not.toHaveBeenCalled()
    expect(vm.findNextUnit).not.toHaveBeenCalled()
  })

  it('ignores typing, modifier shortcuts, and keys behind overlays', () => {
    const vm = context()
    const emit = vi.spyOn(emitter, 'emit').mockImplementation(() => {})
    try {
      press(vm, 'e', { tagName: 'INPUT' })
      press(vm, 'u', { tagName: 'TEXTAREA' })
      press(vm, 'n', { isContentEditable: true })
      press(vm, 'Escape', { tagName: 'INPUT' })
      press(vm, 'e', { tagName: 'DIV' }, { ctrlKey: true })
      press(vm, 'Escape', { tagName: 'DIV' }, { metaKey: true })
      expect(vm.processEndTurn).not.toHaveBeenCalled()
      expect(vm.undoLastMove).not.toHaveBeenCalled()
      expect(vm.findNextUnit).not.toHaveBeenCalled()
      expect(emit).not.toHaveBeenCalled()

      for (const overlay of ['menuOpen', 'showSaveMapDialog', 'showReadyLabel']) {
        vm[overlay] = true
        for (const key of ['e', 'u', 'n', 's', 'q']) press(vm, key)
        vm[overlay] = false
      }
      vm.state = 'exitDialog'
      for (const key of ['e', 'u', 'n', 's', 'q', 'Escape']) press(vm, key)
      expect(vm.processEndTurn).not.toHaveBeenCalled()
      expect(vm.undoLastMove).not.toHaveBeenCalled()
      expect(vm.findNextUnit).not.toHaveBeenCalled()
      expect(vm.openSaveMapDialog).not.toHaveBeenCalled()
      expect(vm.state).toBe('exitDialog')
      expect(emit).not.toHaveBeenCalled()
    } finally {
      emit.mockRestore()
    }
  })
})
