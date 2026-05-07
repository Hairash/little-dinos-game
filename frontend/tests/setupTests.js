// Global mocks and utilities for tests
import { vi, beforeEach } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: key => store[key] || null,
    setItem: (key, value) => {
      store[key] = String(value)
    },
    removeItem: key => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: i => Object.keys(store)[i] || null,
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  constructor(url) {
    this.url = url
    this.readyState = MockWebSocket.CONNECTING
    this.onopen = null
    this.onclose = null
    this.onmessage = null
    this.onerror = null
    this._messageQueue = []

    // Auto-open after microtask
    Promise.resolve().then(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen({ type: 'open' })
      }
    })
  }

  send(data) {
    this._messageQueue.push(data)
  }

  close(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose({ code, reason, type: 'close' })
    }
  }

  // Test helper to simulate receiving a message
  _receiveMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data), type: 'message' })
    }
  }

  // Test helper to simulate an error
  _triggerError(error) {
    if (this.onerror) {
      this.onerror({ error, type: 'error' })
    }
  }
}

globalThis.WebSocket = MockWebSocket

// Mock fetch
globalThis.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    status: 200,
  })
)

// Test data factories
export function createTestUnit(overrides = {}) {
  return {
    player: 0,
    _type: 'dino1',
    movePoints: 3,
    visibility: 3,
    hasMoved: false,
    ...overrides,
  }
}

export function createTestBuilding(overrides = {}) {
  return {
    player: 0,
    _type: 'base',
    ...overrides,
  }
}

export function createTestCell(overrides = {}) {
  return {
    terrain: { kind: 'empty', idx: 1 },
    building: null,
    unit: null,
    isHidden: false,
    ...overrides,
  }
}

export function createTestPlayer(overrides = {}) {
  return {
    _type: 'human',
    killed: 0,
    lost: 0,
    score: 0,
    active: true,
    informed_lose: false,
    scrollCoords: [0, 0],
    ...overrides,
  }
}

export function createTestField(width, height, cellFactory = createTestCell) {
  const field = []
  for (let x = 0; x < width; x++) {
    const col = []
    for (let y = 0; y < height; y++) {
      col.push(cellFactory())
    }
    field.push(col)
  }
  return field
}

// Reset mocks before each test
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})
