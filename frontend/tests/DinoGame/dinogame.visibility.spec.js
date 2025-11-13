import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DinoGame from '@/components/DinoGame.vue'
import { FieldEngine } from '@/game/fieldEngine.js'
import Models from '@/game/models.js'

function makeGrid(w = 5, h = 5, hidden = true) {
  // DinoGame uses field[x][y] indexing
  const field = Array.from({ length: w }, () =>
    Array.from({ length: h }, () => ({
      terrain: { kind: 'empty', idx: 0 },
      building: null,
      unit: null,
      isHidden: hidden,
    })),
  )
  return field
}

function makeFieldEngine(field, width, height, fogOfWarRadius, minSpeed, maxSpeed) {
  return new FieldEngine(
    field,
    width,
    height,
    fogOfWarRadius,
    [], // players
    minSpeed,
    maxSpeed,
    0, // speedMinVisibility - not used in these tests
    99, // maxUnitsNum - not used in these tests
    99, // maxBasesNum - not used in these tests
    0, // unitModifier - not used in these tests
    0, // baseModifier - not used in these tests
    true, // killAtBirth
    true, // visibilitySpeedRelation
  )
}

describe('DinoGame.setVisibilityForArea', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no objects on the field', async () => {
    const width = 5
    const height = 5
    const fogOfWarRadius = 2
    const minSpeed = 1
    const maxSpeed = 1

    DinoGame.methods.initPlayersScrollCoords = vi.fn()
    
    const wrapper = mount(DinoGame, {
      props: {
        humanPlayersNum: 1,
        botPlayersNum: 0,
        width,
        height,
        scoresToWin: 0,
        sectorsNum: 1,
      },
      shallow: true,
    })
    const vm = wrapper.vm
    vm.field = makeGrid(width, height, true)
    vm.fieldEngine = makeFieldEngine(vm.field, width, height, fogOfWarRadius, minSpeed, maxSpeed)
    vm.setVisibilityForArea(2, 2, fogOfWarRadius)

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        expect(vm.field[x][y].isHidden).toBe(true)
      }
    }
  })
  
  it.each([
    { fogOfWarRadius: 1, description: 'with fogOfWarRadius 1' },
    { fogOfWarRadius: 2, description: 'with fogOfWarRadius 2' },
    { fogOfWarRadius: 3, description: 'with fogOfWarRadius 3' },
  ])('1 unit in the corner on the hidden field $description', async ({ fogOfWarRadius }) => {
    const width = 5
    const height = 5
    const minSpeed = 1
    const maxSpeed = 1
    
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
        enableScoutMode: false,
        visibilitySpeedRelation: false,
        minSpeed: 1,
        maxSpeed,
        maxUnitsNum: 99,
        maxBasesNum: 99,
        buildingRates: { base: 3, habitation: 0, temple: 3, well: 0, storage: 0, obelisk: 1 },
        hideEnemySpeed: false,
        killAtBirth: false,
        enableUndo: false,
        loadGame: false,
      },
      // we don't need to render children
      shallow: true,
    })

    const vm = wrapper.vm
    vm.field = makeGrid(width, height, true)

    vm.field[0][0].unit = new Models.Unit(0, 'dino1', 1, 1)

    vm.fieldEngine = makeFieldEngine(
      vm.field,
      width,
      height,
      fogOfWarRadius,
      minSpeed,
      maxSpeed,
    )

    vm.setVisibilityForArea(2, 2, fogOfWarRadius)

    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        if (x < 2 && y < 2) {
          expect(vm.field[x][y].isHidden).toBe(false)
        } else {
          expect(vm.field[x][y].isHidden).toBe(true)
        }
      }
    }
  })

  it.each([
    { fogOfWarRadius: 1, description: 'with fogOfWarRadius 1' },
    { fogOfWarRadius: 2, description: 'with fogOfWarRadius 2' },
    { fogOfWarRadius: 3, description: 'with fogOfWarRadius 3' },
  ])('1 unit in the corner on the visible field $description', async ({ fogOfWarRadius }) => {
    const width = 5
    const height = 5
    const minSpeed = 1
    const maxSpeed = 1
    
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
        enableScoutMode: false,
        visibilitySpeedRelation: false,
        minSpeed: 1,
        maxSpeed,
        maxUnitsNum: 99,
        maxBasesNum: 99,
        buildingRates: { base: 3, habitation: 0, temple: 3, well: 0, storage: 0, obelisk: 1 },
        hideEnemySpeed: false,
        killAtBirth: false,
        enableUndo: false,
        loadGame: false,
      },
      shallow: true,
    })

    const vm = wrapper.vm
    vm.field = makeGrid(width, height, false)
    vm.field[0][0].unit = new Models.Unit(0, 'dino1', 1, 1)
    vm.fieldEngine = makeFieldEngine(vm.field, width, height, fogOfWarRadius, minSpeed, maxSpeed)
    vm.setVisibilityForArea(2, 2, fogOfWarRadius)

    for (let x = 2 - fogOfWarRadius; x < 2 + fogOfWarRadius; x++) {
      for (let y = 2 - fogOfWarRadius; y < 2 + fogOfWarRadius; y++) {
        if (x < 0 || y < 0 || x >= width || y >= height) {
          continue;
        }
        if (x < 2 && y < 2) {
          expect(vm.field[x][y].isHidden).toBe(false)
        } else {
          expect(vm.field[x][y].isHidden).toBe(true)
        }
      }
    }
  })

  // TODO: Add more cases
})
