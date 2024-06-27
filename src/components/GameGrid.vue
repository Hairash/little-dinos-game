<template>
  <div class="game-grid-wrapper">
    <div class="board-wrapper">
      <div class="board">
        <div class="cell_line" v-for="(line, y) in fieldT" :key=y>
          <template v-for="(cellData, x) in line" :key=x>
            <GameCell
              :hidden="field[x][y].isHidden"
              :width=cellSize
              :height=cellSize
              :terrain=cellData.terrain
              :unit=cellData.unit
              :building=cellData.building
              :selected="(selectedCoords && selectedCoords[0] === x && selectedCoords[1] === y)"
              :highlighted="fieldOutput[x][y].isHighlighted"
              :currentPlayer="currentPlayer"
              :hideEnemySpeed="hideEnemySpeed"
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

import emitter from '@/game/eventBus';

export default {
  name: "GameGrid",
  components: {
    GameCell,
  },
  props: {
    isHidden: Boolean,
    enableFogOfWar: Boolean,
    fogOfWarRadius: Number,
    enableScoutMode: Boolean,
    hideEnemySpeed: Boolean,
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
      this.enableScoutMode,
    );
    this.fieldEngine = new FieldEngine(
      this.field,
      this.width,
      this.height,
      this.fogOfWarRadius,
    );
    // this.calculateCellSize();
  },
  mounted() {
    emitter.on('initTurn', this.initTurn);
    emitter.on('selectNextUnit', this.selectNextUnit);
  },
  beforeUnmount() {
    emitter.off('initTurn', this.initTurn);
    emitter.off('selectNextUnit', this.selectNextUnit);
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
    },
    selectNextUnit(unitCoordsArr) {
      let coords = unitCoordsArr[0];

      if (this.selectedCoords) {
        const curIdx = unitCoordsArr.findIndex(el => el[0] === this.selectedCoords[0] && el[1] === this.selectedCoords[1]);
        if (curIdx + 1 < unitCoordsArr.length) {
          coords = unitCoordsArr[curIdx + 1];
        }
      }
      const [x, y] = coords;
      const unit = this.field[x][y].unit;
      this.selectUnit(x, y, unit.movePoints);
    },
    selectUnit(x, y, movePoints) {
      this.selectedCoords = [x, y];
      this.removeHighlights();
      this.setHighlights(x, y, movePoints);
    },
    processClick(event, x, y) {
      console.log('processClick start');
      // console.log(x, y);
      const unit = this.field[x][y].unit;
      if (unit) {
        if (unit.player === this.currentPlayer && !unit.hasMoved) {
          this.selectUnit(x, y, unit.movePoints);
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
