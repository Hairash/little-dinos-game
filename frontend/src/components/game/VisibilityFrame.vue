<template>
  <div class="visibility-frame" :style="frameStyle">
    <div v-if="showCenterMarker" class="center-marker" :style="centerMarkerStyle"></div>
  </div>
</template>

<script>
import { getPlayerColor } from '@/game/helpers'
import { DEFAULT_CELL_SIZE, DEFAULT_BORDER_WIDTH } from '@/game/const'

export default {
  name: 'VisibilityFrame',
  props: {
    x: {
      type: Number,
      required: true,
    },
    y: {
      type: Number,
      required: true,
    },
    radius: {
      type: Number,
      required: true,
    },
    cellSize: {
      type: Number,
      required: true,
    },
    playerIndex: {
      type: Number,
      required: true,
    },
    fieldWidth: {
      type: Number,
      required: true,
    },
    fieldHeight: {
      type: Number,
      required: true,
    },
    showCenterMarker: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    borderWidth() {
      // Scale border width based on cell size ratio
      // At 10px cells -> 1px, at 30px -> 3px, at 70px -> 7px
      return Math.max(1, Math.round((this.cellSize / DEFAULT_CELL_SIZE) * DEFAULT_BORDER_WIDTH))
    },
    playerColor() {
      return getPlayerColor(this.playerIndex)
    },
    frameStyle() {
      // Calculate raw frame bounds (before clipping)
      const rawLeft = (this.x - this.radius) * this.cellSize + 2
      const rawTop = (this.y - this.radius) * this.cellSize + 2
      const rawRight = (this.x + this.radius + 1) * this.cellSize + 2
      const rawBottom = (this.y + this.radius + 1) * this.cellSize + 2

      // Clip to map bounds
      const left = Math.max(2, rawLeft)
      const top = Math.max(2, rawTop)
      const right = Math.min(this.fieldWidth * this.cellSize + 2, rawRight)
      const bottom = Math.min(this.fieldHeight * this.cellSize + 2, rawBottom)

      // Calculate final dimensions
      const width = right - left
      const height = bottom - top

      return {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        borderWidth: `${this.borderWidth}px`,
        borderColor: this.playerColor,
      }
    },
    centerMarkerStyle() {
      // Position the cross marker at the center cell of the frame
      // The center cell is at (radius, radius) within the frame's coordinate system
      const frameLeft = Math.max(0, this.x - this.radius)
      const frameTop = Math.max(0, this.y - this.radius)

      // Calculate offset from frame's top-left to the center cell
      const offsetX = (this.x - frameLeft) * this.cellSize
      const offsetY = (this.y - frameTop) * this.cellSize

      // Cross line length: 60% of cell diagonal (cellSize * sqrt(2) * 0.6)
      const lineLength = Math.round(this.cellSize * 1.414 * 0.6)
      // Line thickness scales with cell size (minimum 2px)
      const lineThickness = Math.max(1, Math.round(this.cellSize / 10))

      return {
        left: `${offsetX}px`,
        top: `${offsetY}px`,
        width: `${this.cellSize}px`,
        height: `${this.cellSize}px`,
        '--cross-color': this.playerColor,
        '--cross-length': `${lineLength}px`,
        '--cross-thickness': `${lineThickness}px`,
      }
    },
  },
}
</script>

<style scoped>
.visibility-frame {
  position: absolute;
  box-sizing: border-box;
  border-style: solid;
  background-color: transparent;
  pointer-events: none;
  z-index: 5;
}

.center-marker {
  position: absolute;
  pointer-events: none;
}

.center-marker::before,
.center-marker::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--cross-length);
  height: var(--cross-thickness);
  margin-left: calc(var(--cross-length) / -2 - var(--cross-thickness));
  margin-top: calc(var(--cross-thickness) / -2 - var(--cross-thickness));
  background-color: var(--cross-color);
}

.center-marker::before {
  transform: rotate(45deg);
}

.center-marker::after {
  transform: rotate(-45deg);
}
</style>
