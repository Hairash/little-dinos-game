import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MapEditorCanvasPage from '@/components/editor/MapEditorCanvasPage.vue'
import { createNewScenario } from '@/game/mapEditorStorage'

let wrapper = null

function makeWrapper() {
  const entry = createNewScenario({ width: 20, height: 20 })
  wrapper = mount(MapEditorCanvasPage, {
    props: { scenarioId: entry.id },
    shallow: true,
  })
  return wrapper
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  if (wrapper) {
    wrapper.unmount()
    wrapper = null
  }
})

describe('MapEditorCanvasPage', () => {
  it('loads the scenario into the component', () => {
    const w = makeWrapper()
    expect(w.vm.map).not.toBeNull()
    expect(w.vm.map.metadata.width).toBe(20)
  })

  describe('placement', () => {
    it('places a speed-0 dino with movePoints 0 (not blank)', () => {
      const w = makeWrapper()
      w.vm.activeTool = 'dino'
      w.vm.toolConfig.dino = { player: 0, speed: 0 }
      w.vm.applyTool(2, 2)
      const unit = w.vm.map.field[2][2].unit
      expect(unit).not.toBeNull()
      expect(unit.movePoints).toBe(0)
      expect(unit.player).toBe(0)
    })

    it('a click with no active tool is a no-op (no undo armed)', () => {
      const w = makeWrapper()
      w.vm.activeTool = null
      w.vm.onPaintStart(4, 4)
      expect(w.vm.undoSnapshot).toBeNull()
      expect(w.vm.isPainting).toBe(false)
      expect(w.vm.map.field[4][4].unit).toBeNull()
    })
  })

  describe('single-step undo', () => {
    it('captures before a paint and restores on undo', () => {
      const w = makeWrapper()
      w.vm.activeTool = 'dino'
      w.vm.toolConfig.dino = { player: 0, speed: 2 }
      w.vm.onPaintStart(3, 3)
      expect(w.vm.map.field[3][3].unit).not.toBeNull()
      expect(w.vm.undoSnapshot).not.toBeNull()

      w.vm.undo()
      expect(w.vm.map.field[3][3].unit).toBeNull()
      expect(w.vm.undoSnapshot).toBeNull() // button re-disabled
    })
  })

  describe('move tool', () => {
    it('performMove relocates an area (source wiped, destination filled)', () => {
      const w = makeWrapper()
      w.vm.map.field[1][1].building = { player: 0, _type: 'base' }
      w.vm.moveState = { stage: 'destination', x1: 1, y1: 1, x2: 1, y2: 1 }
      w.vm.performMove(5, 5)
      expect(w.vm.map.field[1][1].building).toBeNull()
      expect(w.vm.map.field[5][5].building).toMatchObject({ _type: 'base', player: 0 })
    })

    it('finishing a move clears state and deselects the tool (no mountain paint)', () => {
      const w = makeWrapper()
      w.vm.moveState = { stage: 'destination', x1: 1, y1: 1, x2: 2, y2: 2 }
      w.vm.moveHoverDest = { x: 5, y: 5 }
      w.vm.advanceMoveStage(5, 5)
      expect(w.vm.moveState).toBeNull()
      expect(w.vm.activeTool).toBeNull()
      expect(w.vm.moveHoverDest).toBeNull()
    })

    it('PC drag-select: a real drag jumps straight to the destination stage', () => {
      const w = makeWrapper()
      w.vm.moveState = { stage: 'corner1' }
      w.vm.onPaintStart(1, 1)
      expect(w.vm.moveDrag).toEqual({ x1: 1, y1: 1, x2: 1, y2: 1 })
      w.vm.onPaintMove(4, 3)
      expect(w.vm.moveDrag).toMatchObject({ x2: 4, y2: 3 })
      w.vm.onPaintEnd()
      expect(w.vm.moveDrag).toBeNull()
      expect(w.vm.moveState).toEqual({ stage: 'destination', x1: 1, y1: 1, x2: 4, y2: 3 })
    })

    it('PC drag-select: a same-cell press falls back to the two-click flow', () => {
      const w = makeWrapper()
      w.vm.moveState = { stage: 'corner1' }
      w.vm.onPaintStart(2, 2)
      w.vm.onPaintEnd()
      expect(w.vm.moveState).toEqual({ stage: 'corner2', x1: 2, y1: 2 })
    })

    it('Esc cancels an in-progress move; other keys do not', () => {
      const w = makeWrapper()
      w.vm.moveState = { stage: 'corner1' }
      w.vm.handleKeydown({ key: 'Escape' })
      expect(w.vm.moveState).toBeNull()

      w.vm.moveState = { stage: 'corner2', x1: 1, y1: 1 }
      w.vm.handleKeydown({ key: 'a' })
      expect(w.vm.moveState).not.toBeNull()
    })
  })

  describe('destination preview (desktop hover)', () => {
    it('onPaintMove tracks the hovered cell during the destination stage', () => {
      const w = makeWrapper()
      w.vm.moveState = { stage: 'destination', x1: 0, y1: 0, x2: 0, y2: 0 }
      w.vm.onPaintMove(4, 4)
      expect(w.vm.moveHoverDest).toEqual({ x: 4, y: 4 })
    })

    it('previews the landing rect, sized to the selection and clamped to the map', () => {
      const w = makeWrapper()
      const cs = w.vm.cellSize
      w.vm.moveState = { stage: 'destination', x1: 0, y1: 0, x2: 1, y2: 1 } // 2×2
      w.vm.moveHoverDest = { x: 5, y: 5 }
      expect(w.vm.moveDestPreviewRect).toMatchObject({
        left: `${5 * cs}px`,
        width: `${2 * cs}px`,
      })
      // Hovering at the far edge clamps so the 2-wide area stays on a 20-wide map.
      w.vm.moveHoverDest = { x: 19, y: 19 }
      expect(w.vm.moveDestPreviewRect).toMatchObject({
        left: `${18 * cs}px`,
        top: `${18 * cs}px`,
      })
    })

    it('no preview outside the destination stage', () => {
      const w = makeWrapper()
      w.vm.moveState = { stage: 'corner1' }
      w.vm.moveHoverDest = { x: 5, y: 5 }
      expect(w.vm.moveDestPreviewRect).toBeNull()
    })
  })
})
