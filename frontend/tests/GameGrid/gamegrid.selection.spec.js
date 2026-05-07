import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import GameGrid from '@/components/game/GameGrid.vue'
import Models from '@/game/models.js'
import { ACTIONS } from '@/game/const.js'

function makeGrid(w = 5, h = 5, hidden = false) {
  // GameGrid uses field[x][y] indexing
  const field = Array.from({ length: w }, () =>
    Array.from(
      { length: h },
      () =>
        new Models.Cell({
          terrain: { kind: 'empty', idx: 0 },
          building: null,
          unit: null,
          isHidden: hidden,
        })
    )
  )
  return field
}

function createUnit(player, movePoints = 3, hasMoved = false) {
  const unit = new Models.Unit(player, player === 0 ? 'dino1' : 'dino2', movePoints, 2)
  unit.hasMoved = hasMoved
  return unit
}

describe('GameGrid unit selection and deselection', () => {
  let wrapper
  let field

  beforeEach(() => {
    vi.clearAllMocks()
    field = makeGrid(5, 5, false)
  })

  function mountGameGrid(propsOverrides = {}) {
    return mount(GameGrid, {
      props: {
        isHidden: false,
        enableFogOfWar: false,
        fogOfWarRadius: 2,
        enableScoutMode: false,
        hideEnemySpeed: false,
        field,
        currentPlayer: 0,
        myPlayerOrder: 0,
        cellSize: 50,
        isMyTurn: true,
        unitModifier: 3,
        baseModifier: 3,
        menuOpen: false,
        ...propsOverrides,
      },
      shallow: true,
    })
  }

  describe('deselection by clicking selected unit', () => {
    it('clicking on a selected unit deselects it (selectedCoords becomes null)', async () => {
      // Place a unit at [2, 2] belonging to player 0
      field[2][2].unit = createUnit(0, 3, false)

      wrapper = mountGameGrid()
      const vm = wrapper.vm

      // Initially no unit selected
      expect(vm.selectedCoords).toBeNull()

      // Select the unit
      vm.processClick({}, 2, 2)
      expect(vm.selectedCoords).toEqual([2, 2])

      // Click on the same unit again - should deselect
      vm.processClick({}, 2, 2)
      expect(vm.selectedCoords).toBeNull()
    })

    it('clicking on a different selectable unit selects the new unit', async () => {
      // Place two units belonging to player 0
      field[2][2].unit = createUnit(0, 3, false)
      field[3][3].unit = createUnit(0, 4, false)

      wrapper = mountGameGrid()
      const vm = wrapper.vm

      // Select first unit
      vm.processClick({}, 2, 2)
      expect(vm.selectedCoords).toEqual([2, 2])

      // Click on second unit - should select it (not deselect)
      vm.processClick({}, 3, 3)
      expect(vm.selectedCoords).toEqual([3, 3])
    })

    it('movement highlights are removed when deselecting', async () => {
      field[2][2].unit = createUnit(0, 3, false)

      wrapper = mountGameGrid()
      const vm = wrapper.vm

      // Spy on removeHighlights
      const removeHighlightsSpy = vi.spyOn(vm, 'removeHighlights')

      // Select the unit
      vm.processClick({}, 2, 2)
      expect(vm.selectedCoords).toEqual([2, 2])

      // Click on the same unit again - should call removeHighlights
      vm.processClick({}, 2, 2)
      expect(removeHighlightsSpy).toHaveBeenCalled()
      expect(vm.selectedCoords).toBeNull()
    })

    it('clicking on a unit that has already moved does nothing', async () => {
      // Place a unit that has already moved
      field[2][2].unit = createUnit(0, 3, true) // hasMoved = true

      wrapper = mountGameGrid()
      const vm = wrapper.vm

      // Try to select the moved unit
      vm.processClick({}, 2, 2)
      expect(vm.selectedCoords).toBeNull()
    })

    it('clicking on selected unit with selectedAction set does nothing (action has priority)', async () => {
      field[2][2].unit = createUnit(0, 3, false)

      wrapper = mountGameGrid({ enableScoutMode: true })
      const vm = wrapper.vm

      // Select the unit first
      vm.processClick({}, 2, 2)
      expect(vm.selectedCoords).toEqual([2, 2])

      // Set a selected action (e.g., scouting)
      vm.selectedAction = ACTIONS.scouting

      // Click on the same unit - should NOT deselect because action takes priority
      // The scouting action will be triggered instead (emits scoutArea event)
      // After scouting, selectedAction is cleared but we don't want deselection
      vm.processClick({}, 2, 2)

      // selectedAction should be cleared (scouting action was executed)
      expect(vm.selectedAction).toBeNull()
    })
  })

  describe('selection edge cases', () => {
    it('cannot select enemy unit', async () => {
      // Place an enemy unit (player 1) while current player is 0
      field[2][2].unit = createUnit(1, 3, false)

      wrapper = mountGameGrid()
      const vm = wrapper.vm

      // Try to select enemy unit
      vm.processClick({}, 2, 2)
      expect(vm.selectedCoords).toBeNull()
    })

    it('cannot select when it is not my turn', async () => {
      field[2][2].unit = createUnit(0, 3, false)

      wrapper = mountGameGrid({ isMyTurn: false })
      const vm = wrapper.vm

      // Try to select unit when not my turn
      vm.processClick({}, 2, 2)
      expect(vm.selectedCoords).toBeNull()
    })

    it('cannot select when menu is open', async () => {
      field[2][2].unit = createUnit(0, 3, false)

      wrapper = mountGameGrid({ menuOpen: true })
      const vm = wrapper.vm

      // Try to select unit when menu is open
      vm.processClick({}, 2, 2)
      expect(vm.selectedCoords).toBeNull()
    })
  })
})
