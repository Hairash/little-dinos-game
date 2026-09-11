import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import LobbyPage from '@/components/pages/LobbyPage.vue'

// LobbyPage talks to the network on mount (username + active games) and
// opens a lobby WebSocket when it has a game code. Stub both so these
// tests stay focused on the lobby's own display logic.
vi.mock('@/services/auth', () => ({
  whoami: vi.fn(async () => ({ auth: false })),
  signout: vi.fn(async () => {}),
}))
vi.mock('@/game/service', () => ({
  getActiveGames: vi.fn(async () => ({ games: [], hasMore: false })),
  setGameMap: vi.fn(async () => ({})),
}))
vi.mock('@/game/websocket/lobbyWebSocket', () => ({
  LobbyWebSocket: class {
    connect() {}
    disconnect() {}
  },
}))

function mountLobby(props = {}) {
  return mount(LobbyPage, {
    props: { gameCode: 'abc12345', ...props },
    shallow: true,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LobbyPage map selection label', () => {
  it('says "Random map" when no map is picked', () => {
    expect(mountLobby().vm.selectionLabel).toBe('Random map')
  })

  it('shows the creator’s local pick immediately', async () => {
    const wrapper = mountLobby()
    wrapper.vm.pickedMap = { name: 'My Map', metadata: { playersNum: 4 }, players: [] }
    expect(wrapper.vm.selectionLabel).toBe('My Map')
  })

  it('falls back to the server-synced name (what joiners see)', () => {
    const wrapper = mountLobby()
    wrapper.vm.pickedMapName = 'Shared Map'
    expect(wrapper.vm.selectionLabel).toBe('Shared Map')
  })
})

describe('LobbyPage game-code copy', () => {
  it('writes the code to the clipboard and flags "Copied!"', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const vm = mountLobby().vm

    await vm.copyGameCode()

    expect(writeText).toHaveBeenCalledWith('abc12345')
    expect(vm.copied).toBe(true)
  })

  it('falls back to execCommand when the clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    const execCommand = vi.fn(() => true)
    document.execCommand = execCommand
    const vm = mountLobby().vm

    await vm.copyGameCode()

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(vm.copied).toBe(true)
  })

  it('stays quiet when the clipboard rejects', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error('denied')
        }),
      },
    })
    const vm = mountLobby().vm

    await vm.copyGameCode()

    expect(vm.copied).toBe(false)
  })

  it('does nothing without a game code', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const vm = mountLobby({ gameCode: null }).vm

    await vm.copyGameCode()

    expect(writeText).not.toHaveBeenCalled()
  })
})
