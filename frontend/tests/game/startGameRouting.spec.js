import { describe, it, expect, vi } from 'vitest'
import App from '@/App.vue'
import { GAME_STATES } from '@/game/const'

// `currentGameCode` is what routes GAME_STATES.game to MultiplayerDinoGame
// instead of DinoGame. It survives leaving the lobby without pressing
// Start, so every single-player launch has to clear it first — otherwise
// the multiplayer component mounts with single-player settings (no field
// prop) and renders an empty board.

const startGame = App.methods.startGame

function context(overrides = {}) {
  return {
    GAME_STATES,
    state: GAME_STATES.menu,
    settings: {},
    gameInstanceId: 0,
    currentGameCode: null,
    currentGameState: null,
    multiplayerSettings: null,
    closeAllWebSockets: vi.fn(),
    ...overrides,
  }
}

describe('single-player start clears a pending multiplayer game', () => {
  it('drops the game code so DinoGame mounts, not MultiplayerDinoGame', () => {
    const vm = context({
      currentGameCode: 'abc12345',
      currentGameState: { status: 'ready' },
      multiplayerSettings: { width: 30 },
    })

    startGame.call(vm, { width: 20, height: 20 })

    expect(vm.currentGameCode).toBeNull()
    expect(vm.currentGameState).toBeNull()
    expect(vm.multiplayerSettings).toBeNull()
    expect(vm.state).toBe(GAME_STATES.game)
  })

  it('closes any lingering multiplayer sockets', () => {
    const vm = context({ currentGameCode: 'abc12345' })
    startGame.call(vm, {})
    expect(vm.closeAllWebSockets).toHaveBeenCalled()
  })

  it('applies the single-player settings and remounts the game', () => {
    const vm = context({ currentGameCode: 'abc12345', gameInstanceId: 3 })
    const settings = { width: 20, height: 20, initialMap: { name: 'Ambush' } }

    startGame.call(vm, settings)

    expect(vm.settings).toBe(settings)
    // Bumping the key forces a fresh DinoGame rather than reusing the
    // previous instance.
    expect(vm.gameInstanceId).toBe(4)
  })

  it('leaves the socket helper alone when no multiplayer game is pending', () => {
    const vm = context()
    startGame.call(vm, { width: 20 })
    expect(vm.closeAllWebSockets).not.toHaveBeenCalled()
    expect(vm.state).toBe(GAME_STATES.game)
  })
})
