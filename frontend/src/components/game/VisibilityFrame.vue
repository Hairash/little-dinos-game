<template>
  <div
    class="visibility-frame"
    :style="frameStyle"
  ></div>
</template>

<script>
import { getPlayerColor } from '@/game/helpers';
import { DEFAULT_CELL_SIZE, DEFAULT_BORDER_WIDTH } from '@/game/const';

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
  },
  computed: {
    borderWidth() {
      // Scale border width based on cell size ratio
      // At 10px cells -> 1px, at 30px -> 3px, at 70px -> 7px
      return Math.max(1, Math.round(this.cellSize / DEFAULT_CELL_SIZE * DEFAULT_BORDER_WIDTH));
    },
    playerColor() {
      return getPlayerColor(this.playerIndex);
    },
    frameStyle() {
      // Calculate raw frame bounds (before clipping)
      const rawLeft = (this.x - this.radius) * this.cellSize + 2;
      const rawTop = (this.y - this.radius) * this.cellSize + 2;
      const rawRight = (this.x + this.radius + 1) * this.cellSize + 2;
      const rawBottom = (this.y + this.radius + 1) * this.cellSize + 2;

      // Clip to map bounds
      const left = Math.max(2, rawLeft);
      const top = Math.max(2, rawTop);
      const right = Math.min(this.fieldWidth * this.cellSize + 2, rawRight);
      const bottom = Math.min(this.fieldHeight * this.cellSize + 2, rawBottom);

      // Calculate final dimensions
      const width = right - left;
      const height = bottom - top;

      return {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        borderWidth: `${this.borderWidth}px`,
        borderColor: this.playerColor,
      };
    },
  },
};
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
</style>
