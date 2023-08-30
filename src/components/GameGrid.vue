<template>
  <div class="game-grid-wrapper">
    <div class="board-wrapper">
      <div class="board">
        <div class="cell_line" v-for="(line, y) in fieldT" :key=y>
          <template v-for="(cellData, x) in line" :key=x>
            <GameCell
              :hidden="fieldOutput[x][y].isHidden"
              :width=cellSize
              :height=cellSize
              :terrain=cellData.terrain
              :unit=cellData.unit
              :building=cellData.building
              :selected="(selectedCoords && selectedCoords[0] === x && selectedCoords[1] === y)"
              :highlighted="fieldOutput[x][y].isHighlighted"
              @click="processClick($event, x, y)"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import GameCell from './GameCell.vue'
import Models from '@/game/models'
import { WaveEngine } from '@/game/waveEngine'
import { FieldEngine } from '@/game/fieldEngine'
import { CELL_SIZE } from '@/game/const'

export default {
  name: "GameGrid",
  components: {
    GameCell,
  },
  props: {
    isHidden: Boolean,
    fogOfWarRadius: Number,
    enableFogOfWar: Boolean,
    field: Array[Array[Models.Cell]],
    currentPlayer: Number,
  },
  data() {
    const width = this.field.length;
    const height = this.field[0].length;
    const fieldT = (m => m[0].map((x, i) => m.map(x => x[i])))(this.field);
    const fieldOutput = Array.from({ length: width }, () =>
      Array.from({ length: height }, () => ({ isHidden: false, isHighlighted: false }))
    );
    // console.log((cellWidth + 2) * width);
    // console.log((cellHeight + 2) * height + 35);
    return {
      width,
      height,
      fieldT,
      cellSize: CELL_SIZE,
      selectedCoords: null,
      waveEngine: null,
      fieldEngine: null,
      fieldOutput,
      cssProps: {
        lineHeight: `${CELL_SIZE + 2}px`,
        lineWidth: `${(CELL_SIZE + 2) * width}px`,
        boardHeight: `${(CELL_SIZE + 2) * height}px`,
        boardWidth: `${(CELL_SIZE + 2) * width}px`,
        boardWrapperHeight: `${(CELL_SIZE + 2) * height + 35}px`,
        boardWrapperWidth: `${(CELL_SIZE + 2) * width}px`,
      },
    }
  },
  created() {
    this.waveEngine = new WaveEngine(
      this.field,
      this.width,
      this.height,
      this.fogOfWarRadius,
    );
    this.fieldEngine = new FieldEngine(
      this.field,
      this.width,
      this.height,
      this.fogOfWarRadius,
    );
    // this.calculateCellSize();
    this.setVisibility();
  },
  watch: {
    currentPlayer() {
      this.initTurn();
    }
  },
  methods: {
    initTurn() {
      this.selectedCoords = null;
      this.removeHighlights();
      this.setVisibility();
    },
    processClick(event, x, y) {
      console.log('processClick start');
      // console.log(x, y);
      const unit = this.field[x][y].unit;
      if (unit) {
        if (unit.player === this.currentPlayer && !unit.hasMoved) {
          this.selectedCoords = [x, y];
          this.removeHighlights();
          this.setHighlights(x, y, unit.movePoints);
        }
      }
      else if (this.selectedCoords && this.waveEngine.canMove(this.selectedCoords, [x, y])) {
        this.moveUnit(this.selectedCoords, [x, y]);
      }
      console.log('processClick finish');
    },
    moveUnit(fromCoords, toCoords) {
      let [x, y] = fromCoords;
      // Save movePoints value for the futher remove highlights
      const movePoints = this.field[x][y].unit.movePoints;
      // Call game moveUnit function to change field
      this.$emit('moveUnit', fromCoords, toCoords);
      this.selectedCoords = null;
      this.removeHighlightsForArea(x, y, movePoints);
      // Recalculate visibility in area unit moved from
      this.setVisibilityForArea(x, y, this.fogOfWarRadius);
      // Add visibility to area unit moved to
      [x, y] = toCoords;
      this.addVisibilityForCoords(x, y);
    },

    // Visibility helpers
    addVisibilityForCoords(x, y) {
      if (!this.enableFogOfWar) return;
      for (let curX = x - this.fogOfWarRadius; curX <= x + this.fogOfWarRadius; curX++) {
        for (let curY = y - this.fogOfWarRadius; curY <= y + this.fogOfWarRadius; curY++) {
          if (this.fieldEngine.areExistingCoords(curX, curY))
            this.fieldOutput[curX][curY].isHidden = false;
        }
      }
    },
    removeVisibility() {
      if (!this.enableFogOfWar) return;
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.fieldOutput[curX][curY].isHidden = true;
        }
      }
    },
    setVisibility() {
      if (!this.enableFogOfWar) return;

      this.removeVisibility();
      const visibilitySet = this.fieldEngine.getCurrentVisibilitySet(this.currentPlayer);
      for (const coords of visibilitySet) {
        const curX = coords[0];
        const curY = coords[1];
        this.fieldOutput[curX][curY].isHidden = false;
      }
    },
    setVisibilityForArea(x, y, r) {
      if (!this.enableFogOfWar) return;

      // Make all area ivisible
      for (let curX = x - r; curX <= x + r; curX++) {
        for (let curY = y - r; curY <= y + r; curY++) {
          if (this.fieldEngine.areExistingCoords(curX, curY)) {
            this.fieldOutput[curX][curY].isHidden = true;
          }
        }
      }
      // Set visibility
      for (let curX = x - r - this.fogOfWarRadius; curX <= x + r + this.fogOfWarRadius; curX++) {
          for (let curY = y - r - this.fogOfWarRadius; curY <= y + r + this.fogOfWarRadius; curY++) {
            if (
              this.fieldEngine.areExistingCoords(curX, curY) &&
              this.fieldEngine.isVisibleObj(curX, curY, this.currentPlayer)
            ) {
              this.addVisibilityForCoords(curX, curY);
            }
          }
        }
    },

    // Highlights helpers
    removeHighlights() {
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.fieldOutput[curX][curY].isHighlighted = false;
        }
      }
    },
    removeHighlightsForArea(x, y, radius) {
      for (let curX = x - radius; curX <= x + radius; curX++) {
        for (let curY = y - radius; curY <= y + radius; curY++) {
          if (this.fieldEngine.areExistingCoords(curX, curY))
            this.fieldOutput[curX][curY].isHighlighted = false;
        }
      }
    },
    setHighlights(x, y, radius) {
      console.log('setHighlights start');
      const highlightedCoordsArr = this.waveEngine.getReachableCoordsArr(x, y, radius);

      for (const coords of highlightedCoordsArr) {
        const curX = coords[0];
        const curY = coords[1];
        this.fieldOutput[curX][curY].isHighlighted = true;
      }
      console.log('setHighlights finish');
    },
  }
}
</script>

<style scoped>
div.game-grid-wrapper {
  overflow: auto;
  position: relative;
  width: 100%;
  height: 100%;
}

div.board {
  position: relative;
  width: v-bind('cssProps.boardWidth');
  height: v-bind('cssProps.boardHeight');
  border: solid 2px;
  color: #2c3e50;
}

div.board-wrapper {
  position: relative;
  width: v-bind('cssProps.boardWrapperWidth');
  height: v-bind('cssProps.boardWrapperHeight');
}

div.cell_line {
  width: v-bind('cssProps.lineWidth');
  height: v-bind('cssProps.lineHeight');
}

</style>
