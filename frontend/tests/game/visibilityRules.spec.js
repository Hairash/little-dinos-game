import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DinoGame from '@/components/game/DinoGame.vue'
import MapPreview from '@/components/game/MapPreview.vue'
import { FieldEngine } from '@/game/fieldEngine.js'
import Models from '@/game/models.js'

// "Take it back" settings: fog radius 2, speed/visibility threshold 5,
// game minSpeed 1. On that scale a speed-3 unit sees 2 (the average) —
// see docs/scenarios.md, "Speed ↔ visibility".
const FOG = 2
const THRESHOLD = 5
const MIN_SPEED = 1

function mapWithUnits(units) {
  const field = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => ({
      terrain: { kind: 'empty', idx: 1 },
      building: null,
      unit: null,
    }))
  )
  units.forEach(({ x, y, player, movePoints }) => {
    field[x][y].unit = { player, _type: `dino${player + 1}`, movePoints }
  })
  field[0][0].building = { player: 0, _type: 'base' }
  return {
    version: 1,
    name: 'Speed Map',
    metadata: {
      playersNum: 2,
      humanPlayersNum: 1,
      botPlayersNum: 1,
      width: 8,
      height: 8,
    },
    settings: {
      minSpeed: MIN_SPEED,
      maxSpeed: 5,
      enableFogOfWar: true,
      fogOfWarRadius: FOG,
      visibilitySpeedRelation: true,
      speedMinVisibility: THRESHOLD,
      maxUnitsNum: 5,
      maxBasesNum: 3,
      unitModifier: 3,
      baseModifier: 3,
      killAtBirth: false,
      hideEnemySpeed: false,
      enableUndo: true,
    },
    field,
    players: [{ _type: 'human' }, { _type: 'bot' }],
  }
}

function launch(map) {
  DinoGame.methods.initPlayersScrollCoords = vi.fn()
  return mount(DinoGame, {
    props: {
      humanPlayersNum: 1,
      botPlayersNum: 1,
      width: 8,
      height: 8,
      scoresToWin: 0,
      sectorsNum: 1,
      enableFogOfWar: true,
      fogOfWarRadius: FOG,
      enableScoutMode: true,
      visibilitySpeedRelation: true,
      minSpeed: MIN_SPEED,
      speedMinVisibility: THRESHOLD,
      maxSpeed: 5,
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

describe('explicitly placed units are scaled against the game minSpeed', () => {
  it('a placed speed-3 dino sees 2, not the slowest-unit maximum', () => {
    const vm = launch(mapWithUnits([{ x: 2, y: 2, player: 0, movePoints: 3 }]))
    expect(vm.localField[2][2].unit.movePoints).toBe(3)
    expect(vm.localField[2][2].unit.visibility).toBe(2)
  })

  it('a placed speed-1 dino still sees the slowest-unit maximum (3)', () => {
    const vm = launch(mapWithUnits([{ x: 2, y: 2, player: 0, movePoints: 1 }]))
    expect(vm.localField[2][2].unit.visibility).toBe(3)
  })

  it('a placed speed-5 dino bottoms out at 1', () => {
    const vm = launch(mapWithUnits([{ x: 2, y: 2, player: 0, movePoints: 5 }]))
    expect(vm.localField[2][2].unit.visibility).toBe(1)
  })

  it('an immobile speed-0 dino still sees as far as the slowest mover', () => {
    const vm = launch(mapWithUnits([{ x: 2, y: 2, player: 0, movePoints: 0 }]))
    expect(vm.localField[2][2].unit.movePoints).toBe(0)
    expect(vm.localField[2][2].unit.visibility).toBe(3)
  })

  it('an explicit per-unit visibility still wins', () => {
    const map = mapWithUnits([{ x: 2, y: 2, player: 0, movePoints: 3 }])
    map.field[2][2].unit.visibility = 7
    expect(launch(map).localField[2][2].unit.visibility).toBe(7)
  })

  it('the map preview agrees with the game', () => {
    const map = mapWithUnits([{ x: 4, y: 4, player: 0, movePoints: 3 }])
    // Preview masks to seat 0; a speed-3 unit reaches 2 cells, not 3.
    const wrapper = mount(MapPreview, {
      props: { map, maxSize: 320, viewingPlayer: 0 },
    })
    const visible = wrapper.vm.visibleSet
    expect(visible.has('6,4')).toBe(true) // 2 cells away
    expect(visible.has('7,4')).toBe(false) // 3 cells away — was wrongly lit
  })
})

describe('visibility ownership on shared cells', () => {
  // A cell counts toward a player's sight only through the objects that
  // player actually owns — an enemy unit parked on your tower must not
  // lend you its radius, and your unit on an enemy tower must not borrow
  // the tower's.
  function engineWith(cellSetup) {
    const field = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () =>
        Models.Cell.fromJSON({
          terrain: { kind: 'empty', idx: 1 },
          building: null,
          unit: null,
          isHidden: true,
        })
      )
    )
    cellSetup(field)
    return new FieldEngine(field, 9, 9, FOG, [], MIN_SPEED, 5, THRESHOLD, 99, 99, 0, 0, true, true)
  }

  function radiusSeen(engine, player, x, y) {
    // Largest Chebyshev distance from (x, y) that the player can see.
    const coords = [...engine.getCurrentVisibilitySet(player)]
    let max = -1
    for (const [cx, cy] of coords) {
      max = Math.max(max, Math.max(Math.abs(cx - x), Math.abs(cy - y)))
    }
    return max
  }

  it('an enemy unit on my tower does not extend my sight', () => {
    // My base (radius 2) with an enemy far-seeing unit (radius 4) on it.
    const engine = engineWith(field => {
      field[4][4].building = Models.Building.fromJSON({ player: 0, _type: 'base' })
      field[4][4].unit = Models.Unit.fromJSON({ player: 1, _type: 'dino2', movePoints: 1 })
      field[4][4].unit.visibility = 4
    })
    expect(radiusSeen(engine, 0, 4, 4)).toBe(FOG)
  })

  it('my unit on an enemy tower sees only its own radius', () => {
    // Enemy base with my short-sighted unit (radius 1) standing on it.
    const engine = engineWith(field => {
      field[4][4].building = Models.Building.fromJSON({ player: 1, _type: 'base' })
      field[4][4].unit = Models.Unit.fromJSON({ player: 0, _type: 'dino1', movePoints: 5 })
      field[4][4].unit.visibility = 1
    })
    expect(radiusSeen(engine, 0, 4, 4)).toBe(1)
  })

  it('my own unit on my own tower still takes the larger radius', () => {
    const engine = engineWith(field => {
      field[4][4].building = Models.Building.fromJSON({ player: 0, _type: 'base' })
      field[4][4].unit = Models.Unit.fromJSON({ player: 0, _type: 'dino1', movePoints: 1 })
      field[4][4].unit.visibility = 3
    })
    expect(radiusSeen(engine, 0, 4, 4)).toBe(3)
  })

  it('my tower alone still sees the fog radius', () => {
    const engine = engineWith(field => {
      field[4][4].building = Models.Building.fromJSON({ player: 0, _type: 'base' })
    })
    expect(radiusSeen(engine, 0, 4, 4)).toBe(FOG)
  })
})
