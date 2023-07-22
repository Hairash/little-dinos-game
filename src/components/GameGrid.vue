<template>
  <div class="game-grid-wrapper">
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
</template>

<script>
import GameCell from './GameCell.vue'
import Models from '@/game/models'
import { WaveEngine } from '@/game/waveEngine'

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
    const cellSize = 30;
    let selectedCoords = null;
    const waveEngine = null;
    const fieldOutput = Array.from({ length: width }, () =>
      Array.from({ length: height }, () => ({ isHidden: false, isHighlighted: false }))
    );
    // console.log((cellWidth + 2) * width);
    // console.log((cellHeight + 2) * height + 35);
    return {
      width,
      height,
      fieldT,
      cellSize,
      selectedCoords,
      waveEngine,
      fieldOutput,
      cssProps: {
        cellHeight: `${cellSize}px`,
        lineWidth: `${(cellSize + 2) * width}px`,
        boardHeight: `${(cellSize + 2) * height + 35}px`,  // Board height + bottom info label height
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
    // this.calculateCellSize();
    this.setVisibility();
  },
  watch: {
    currentPlayer() {
      // TODO: Refactor it
      this.initTurn();
    }
  },
  methods: {
    initTurn() {
      this.selectedCoords = null;
      this.removeHighlights();
      this.setVisibility();
    },
    // Needed for scale in future
    // calculateCellSize() {
    //   const windowWidth = window.innerWidth;
    //   const windowHeight = window.innerHeight;
    //   const maxWidth = windowWidth / this.width;
    //   const maxHeight = windowHeight / this.height;
    //   this.cellSize = Math.floor(Math.min(maxWidth, maxHeight));
    //   this.cssProps = {
    //     cellHeight: `${this.cellSize}px`,
    //     lineWidth: `${(this.cellSize + 2) * this.width}px`,
    //     boardHeight: `${(this.cellSize + 2) * this.height + 35}px`,  // Board height + bottom info label height
    //   };
    // },
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
      const visibilitySet = this.waveEngine.getCurrentVisibilitySet(this.currentPlayer);
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
          if (this.areExistingCoords(curX, curY)) {
            this.fieldOutput[curX][curY].isHidden = true;
          }
        }
      }
      // Set visibility
      for (let curX = x - r - this.fogOfWarRadius; curX <= x + r + this.fogOfWarRadius; curX++) {
          for (let curY = y - r - this.fogOfWarRadius; curY <= y + r + this.fogOfWarRadius; curY++) {
            if (this.areExistingCoords(curX, curY) && this.isVisibleObj(curX, curY)) {
              this.addVisibilityForArea(curX, curY);
            }
          }
        }
    },
    addVisibilityForArea(x, y) {
      if (!this.enableFogOfWar) return;
      for (let curX = x - this.fogOfWarRadius; curX <= x + this.fogOfWarRadius; curX++) {
        for (let curY = y - this.fogOfWarRadius; curY <= y + this.fogOfWarRadius; curY++) {
          if (this.areExistingCoords(curX, curY))
            this.fieldOutput[curX][curY].isHidden = false;
        }
      }
    },

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
          if (this.areExistingCoords(curX, curY))
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
      else if (this.selectedCoords && this.canMove(this.selectedCoords, [x, y])) {
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
      this.addVisibilityForArea(x, y);
    },

    
    // TODO: move to engine
    canMove(fromCoords, toCoords) {
      console.log('canMove start');
      const [x0, y0] = fromCoords;
      const [x1, y1] = toCoords;
      const unit = this.field[x0][y0].unit;
      if (this.field[x1][y1].terrain !== Models.TerrainTypes.EMPTY) return false;

      const res = this.waveEngine.canReach(x0, y0, x1, y1, unit.movePoints);
      console.log('canMove finish');
      return res;
    },
    // TODO: Move to engine
    isVisibleObj(x, y) {
      return (
        this.field[x][y].unit && this.field[x][y].unit.player === this.currentPlayer ||
        this.field[x][y].building && this.field[x][y].building.player === this.currentPlayer
      )
    },
    // TODO: Move to utils
    areExistingCoords(curX, curY) {
      return curX >= 0 && curX < this.width && curY >= 0 && curY < this.height;
    },
    // TODO: move to engine
    getPlayerObjectCoords(player) {
      const coords = [];
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          if (
            (this.field[curX][curY].unit && this.field[curX][curY].unit.player === player) ||
            (this.field[curX][curY].building && this.field[curX][curY].building.player === player)
          )
            coords.push([curX, curY]);
        }
      }
      return coords;
    },
  }
}
</script>

<style scoped>
div.board {
  position: relative;
  width: v-bind('cssProps.lineWidth');
  height: v-bind('cssProps.boardHeight');
  color: #2c3e50;
}

div.game-grid-wrapper {
  overflow: auto;
  position: relative;
  width: 100%;
  height: 100%;
}

div.cell_line {
  width: v-bind('cssProps.lineWidth');
  height: v-bind('cssProps.cellHeight');
}

</style>
