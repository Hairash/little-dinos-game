import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import GameGrid from '@/components/game/GameGrid.vue'
import Models from '@/game/models.js'
import { ACTIONS } from '@/game/const.js'

function makeGrid(w = 5, h = 5, hidden = false) {
  // GameGrid uses field[x][y] indexing
  const field = Array.from({ length: w }, () =>
    Array.from(
      { length: h },
      () => {
        const cell = new Models.Cell({ kind: 'empty', idx: 0 })
        cell.isHidden = hidden
        return cell
      }
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

    it('still allows a scout action to target a hidden cell', () => {
      field[2][2].isHidden = true
      wrapper = mountGameGrid({ enableFogOfWar: true, enableScoutMode: true })
      const vm = wrapper.vm
      vm.selectedAction = ACTIONS.scouting

      vm.processClick({}, 2, 2)

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

    it('cannot select while an animation is in flight', async () => {
      field[2][2].unit = createUnit(0, 3, false)

      wrapper = mountGameGrid({ isAnimating: true })
      const vm = wrapper.vm

      // Animation lock active — left click is swallowed before selection.
      vm.processClick({}, 2, 2)
      expect(vm.selectedCoords).toBeNull()
    })
  })

  describe('enemy movement preview', () => {
    it('only marks destinations visible to the viewer', () => {
      field[2][2].unit = createUnit(1, 1)
      wrapper = mountGameGrid({ displayVisibilityCoords: new Set(['2,2', '1,2']) })
      const vm = wrapper.vm

      vm.processClick({}, 2, 2)

      expect(vm.enemyPreviewCoords).toEqual([2, 2])
      expect(vm.enemyReachableCoords).toEqual(new Set(['1,2']))
    })

    it('ignores an enemy hidden by the cell fog without changing a friendly selection', () => {
      field[0][0].unit = createUnit(0, 1)
      field[2][2].unit = createUnit(1, 3)
      field[2][2].isHidden = true
      wrapper = mountGameGrid({ enableFogOfWar: true })
      const vm = wrapper.vm
      vm.processClick({}, 0, 0)
      const selected = vm.selectedCoords

      vm.processClick({}, 2, 2)

      expect(vm.selectedCoords).toEqual(selected)
      expect(vm.enemyPreviewCoords).toBeNull()
      expect(vm.enemyReachableCoords.size).toBe(0)
    })

    it('uses the displayed fog mask when deciding whether an enemy can be inspected', async () => {
      field[2][2].unit = createUnit(1, 1)
      wrapper = mountGameGrid({ displayVisibilityCoords: new Set(['0,0']) })
      const vm = wrapper.vm

      vm.processClick({}, 2, 2)
      expect(vm.enemyPreviewCoords).toBeNull()

      // The field's isHidden flag may reflect a bot's view instead of the
      // human's; the displayed mask is the authority for this interaction.
      field[2][2].isHidden = true
      await wrapper.setProps({ displayVisibilityCoords: new Set(['2,2']) })
      vm.processClick({}, 2, 2)
      expect(vm.enemyPreviewCoords).toEqual([2, 2])
    })

    it('clears an enemy preview when the enemy becomes hidden by the display mask', async () => {
      field[2][2].unit = createUnit(1, 1)
      wrapper = mountGameGrid({ displayVisibilityCoords: new Set(['2,2']) })
      const vm = wrapper.vm
      vm.processClick({}, 2, 2)
      expect(vm.enemyPreviewCoords).toEqual([2, 2])

      await wrapper.setProps({ displayVisibilityCoords: new Set() })

      expect(vm.enemyPreviewCoords).toBeNull()
      expect(vm.enemyReachableCoords.size).toBe(0)
    })

    it('leaves the current preview untouched when another hidden cell is clicked', () => {
      field[2][2].unit = createUnit(1, 1)
      field[3][3].unit = createUnit(1, 1)
      field[3][3].isHidden = true
      wrapper = mountGameGrid({ enableFogOfWar: true })
      const vm = wrapper.vm
      vm.processClick({}, 2, 2)

      vm.processClick({}, 3, 3)

      expect(vm.enemyPreviewCoords).toEqual([2, 2])
      expect(vm.enemyReachableCoords.size).toBeGreaterThan(0)
    })

    it('shows an enemy unit\'s legal destinations on left-click without cancelling a friendly selection', () => {
      field[2][2].unit = createUnit(1, 1, false)
      field[0][0].unit = createUnit(0, 1, false)

      wrapper = mountGameGrid()
      const vm = wrapper.vm
      vm.processClick({}, 0, 0)
      vm.processClick({}, 2, 2)

      expect(vm.selectedCoords).toEqual([0, 0])
      expect(vm.enemyPreviewCoords).toEqual([2, 2])
      expect(vm.enemyReachableCoords).toEqual(
        new Set([
          '1,2',
          '3,2',
          '2,1',
          '2,3',
        ])
      )
      expect(vm.fieldOutput[1][2].isHighlighted).toBe(false)
    })

    it('toggles the current enemy preview off and replaces it when another enemy is clicked', () => {
      field[2][2].unit = createUnit(1, 1, false)
      field[0][0].unit = createUnit(1, 1, false)

      wrapper = mountGameGrid()
      const vm = wrapper.vm
      vm.processClick({}, 2, 2)
      vm.processClick({}, 2, 2)

      expect(vm.enemyReachableCoords).toEqual(new Set())
      expect(vm.enemyPreviewCoords).toBeNull()
      vm.processClick({}, 2, 2)
      vm.processClick({}, 0, 0)
      expect(vm.enemyPreviewCoords).toEqual([0, 0])
      expect(vm.enemyReachableCoords).toEqual(new Set(['1,0', '0,1']))
    })

    it('clears the red preview when the highlighted enemy is killed in place', async () => {
      field = reactive(field)
      field[2][2].unit = createUnit(1, 1, false)
      field[0][0].unit = createUnit(0, 1, false)

      wrapper = mountGameGrid()
      const vm = wrapper.vm
      vm.processClick({}, 0, 0)
      vm.processClick({}, 2, 2)

      field[2][2].unit = null
      await nextTick()

      expect(vm.enemyReachableCoords).toEqual(new Set())
      expect(vm.enemyPreviewCoords).toBeNull()
      expect(vm.selectedCoords).toEqual([0, 0])
    })

    it('clears the red preview when the highlighted enemy starts dying', async () => {
      field[2][2].unit = createUnit(1, 1, false)
      wrapper = mountGameGrid()
      const vm = wrapper.vm
      vm.processClick({}, 2, 2)

      await wrapper.setProps({ dyingCells: new Set(['2,2']) })

      expect(vm.enemyReachableCoords).toEqual(new Set())
      expect(vm.enemyPreviewCoords).toBeNull()
    })
  })

  describe('right-click inspection', () => {
    it('does not inspect a cell hidden by the viewer mask even when the field marks it visible', () => {
      field[2][2].unit = createUnit(1, 1)
      field[2][2].building = new Models.Building(1, Models.BuildingTypes.BASE)
      wrapper = mountGameGrid({
        enableFogOfWar: true,
        displayVisibilityCoords: new Set(['0,0']),
      })
      const vm = wrapper.vm

      vm.handleContextMenu({ x: 2, y: 2 })

      expect(vm.contextHelpVisible).toBe(false)
      expect(vm.visibilityFrameUnit).toBeNull()
    })

    it('inspects a cell revealed by the viewer mask even when the field marks it hidden', () => {
      field[2][2].unit = createUnit(1, 1)
      field[2][2].building = new Models.Building(1, Models.BuildingTypes.BASE)
      field[2][2].isHidden = true
      wrapper = mountGameGrid({
        enableFogOfWar: true,
        displayVisibilityCoords: new Set(['2,2']),
      })
      const vm = wrapper.vm

      vm.handleContextMenu({ x: 2, y: 2 })

      expect(vm.contextHelpVisible).toBe(true)
      expect(vm.visibilityFrameUnit).toMatchObject({ x: 2, y: 2 })
    })

    it('shows a unit’s visibility frame together with a building hint', () => {
      field[2][2].unit = createUnit(0, 1, false)
      field[2][2].building = new Models.Building(0, Models.BuildingTypes.BASE)

      wrapper = mountGameGrid({ enableFogOfWar: true })
      const vm = wrapper.vm
      vm.handleContextMenu({ x: 2, y: 2 })

      expect(vm.contextHelpVisible).toBe(true)
      expect(vm.visibilityFrameUnit).toMatchObject({ x: 2, y: 2, visibility: 2 })
      expect(vm.contextHelpCell.building._type).toBe(Models.BuildingTypes.BASE)
    })

    it('does not show a hint for ordinary empty terrain', () => {
      wrapper = mountGameGrid()
      const vm = wrapper.vm
      vm.handleContextMenu({ x: 2, y: 2 })

      expect(vm.contextHelpVisible).toBe(false)
    })
  })
})
