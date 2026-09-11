import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { getOccupiedSeats, getActualPlayerCounts } from '@/game/mapSchema'
import DinoGame from '@/components/game/DinoGame.vue'
import GameMenuOverlay from '@/components/game/GameMenuOverlay.vue'
import Models from '@/game/models.js'

// `metadata.playersNum` is the map's colour capacity. Only slots that
// actually own something on the field are playable seats — the rest
// would seat a player with nothing, eliminated on their first turn.

// A map with `capacity` colour slots where only `placed` seats carry
// something. Seats are deliberately sparse (blue 0, yellow 3, purple 6)
// to match how a designer picks colours.
function mapWithSeats(placed, capacity = 7, humans = 1) {
  const field = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => ({
      terrain: { kind: 'empty', idx: 1 },
      building: null,
      unit: null,
    }))
  )
  placed.forEach((seat, i) => {
    field[i][0].building = { player: seat, _type: 'base' }
    field[i][1].unit = { player: seat, _type: `dino${seat + 1}` }
  })
  // A neutral building must never count as a seat.
  field[7][7].building = { player: null, _type: 'temple' }
  return {
    version: 1,
    name: 'Sparse Map',
    metadata: {
      playersNum: capacity,
      humanPlayersNum: humans,
      botPlayersNum: capacity - humans,
      width: 8,
      height: 8,
    },
    settings: { minSpeed: 1, maxSpeed: 3, enableFogOfWar: false, fogOfWarRadius: 2 },
    field,
    players: Array.from({ length: capacity }, (_, i) => ({
      _type: i < humans ? 'human' : 'bot',
    })),
  }
}

describe('getOccupiedSeats', () => {
  it('returns the sparse seats that own something, ascending', () => {
    expect(getOccupiedSeats(mapWithSeats([0, 3, 6]))).toEqual([0, 3, 6])
  })

  it('counts a seat that owns only a base', () => {
    const map = mapWithSeats([0])
    map.field[1][1].unit = null
    map.field[2][0].building = { player: 5, _type: 'base' }
    expect(getOccupiedSeats(map)).toEqual([0, 5])
  })

  it('counts a seat that owns only a unit', () => {
    const map = mapWithSeats([0])
    map.field[3][3].unit = { player: 4, _type: 'dino5' }
    expect(getOccupiedSeats(map)).toEqual([0, 4])
  })

  it('ignores neutral buildings', () => {
    const map = mapWithSeats([0])
    map.field[5][5].building = { player: null, _type: 'habitation' }
    expect(getOccupiedSeats(map)).toEqual([0])
  })

  it('returns an empty list for a blank map', () => {
    const map = mapWithSeats([])
    expect(getOccupiedSeats(map)).toEqual([])
  })
})

describe('getActualPlayerCounts', () => {
  it('splits the placed seats into humans and bots', () => {
    // 7 slots, 1 declared human, three colours placed (0 human, 3 + 6 bots)
    expect(getActualPlayerCounts(mapWithSeats([0, 3, 6]))).toMatchObject({
      total: 3,
      humans: 1,
      bots: 2,
      seats: [0, 3, 6],
    })
  })

  it('reports a full map unchanged', () => {
    expect(getActualPlayerCounts(mapWithSeats([0, 1], 2))).toMatchObject({
      total: 2,
      humans: 1,
      bots: 1,
    })
  })
})

describe('single-player seating from a map', () => {
  function launch(map) {
    DinoGame.methods.initPlayersScrollCoords = vi.fn()
    return mount(DinoGame, {
      props: {
        humanPlayersNum: map.metadata.humanPlayersNum,
        botPlayersNum: map.metadata.botPlayersNum,
        width: map.metadata.width,
        height: map.metadata.height,
        scoresToWin: 0,
        sectorsNum: 1,
        enableFogOfWar: false,
        fogOfWarRadius: 2,
        enableScoutMode: true,
        visibilitySpeedRelation: false,
        minSpeed: 1,
        maxSpeed: 3,
        maxUnitsNum: 5,
        maxBasesNum: 3,
        buildingRates: { base: 3, habitation: 0, temple: 0, well: 0, storage: 0, obelisk: 0 },
        hideEnemySpeed: false,
        killAtBirth: false,
        enableUndo: true,
        loadGame: false,
        initialMap: map,
      },
      shallow: true,
    }).vm
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('seats only the placed colours; empty slots never play', () => {
    const vm = launch(mapWithSeats([0, 3, 6]))
    expect(vm.players).toHaveLength(7)
    const participating = vm.players
      .map((p, seat) => ({ p, seat }))
      .filter(({ p }) => p.participating)
      .map(({ seat }) => seat)
    expect(participating).toEqual([0, 3, 6])
  })

  it('marks empty slots inactive so the turn rotation skips them', () => {
    const vm = launch(mapWithSeats([0, 3, 6]))
    expect(vm.players[1].active).toBe(false)
    expect(vm.players[2].active).toBe(false)
    expect(vm.players[0].active).toBe(true)
    expect(vm.players[3].active).toBe(true)
  })

  it('keeps the map’s colours — seat 3 stays seat 3', () => {
    const vm = launch(mapWithSeats([0, 3, 6]))
    // The yellow player's units still carry player: 3, and the players
    // array is indexed by seat, so colours are unchanged.
    expect(vm.players[3].participating).toBe(true)
    expect(vm.players[6].participating).toBe(true)
  })

  it('rotation lands only on placed seats', () => {
    const vm = launch(mapWithSeats([0, 3, 6]))
    vm.currentPlayer = 0
    vm.selectNextPlayerAndCheckPhases()
    expect(vm.currentPlayer).toBe(3)
    vm.selectNextPlayerAndCheckPhases()
    expect(vm.currentPlayer).toBe(6)
  })
})

describe('in-game menu player table', () => {
  function mountOverlay(players) {
    return mount(GameMenuOverlay, {
      props: {
        players,
        currentPlayer: 0,
        field: [],
        enableFogOfWar: false,
        currentStats: { towers: { total: 0, max: 0 } },
      },
      shallow: true,
    }).vm
  }

  it('lists only participating seats', () => {
    const players = Array.from({ length: 7 }, (_, seat) => {
      const p = new Models.Player(seat === 0 ? Models.PlayerTypes.HUMAN : Models.PlayerTypes.BOT)
      if (![0, 3, 6].includes(seat)) {
        p.participating = false
        p.active = false
      }
      return p
    })
    expect(mountOverlay(players).playerRows.map(r => r.seat)).toEqual([0, 3, 6])
  })

  it('keeps every seat when nothing is flagged (older saves)', () => {
    const players = Array.from({ length: 3 }, () => new Models.Player(Models.PlayerTypes.BOT))
    expect(mountOverlay(players).playerRows.map(r => r.seat)).toEqual([0, 1, 2])
  })
})
