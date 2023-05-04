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
    field: Array[Array[Models.Cell]],
    currentPlayer: Number,
  },
  data() {
    const width = this.field.length;
    const height = this.field[0].length;
    const fieldT = (m => m[0].map((x, i) => m.map(x => x[i])))(this.field)
    const cellSize = 30;
    let selectedCoords = null;
    let highlightedCoords = null;
    const waveEngine = null;
    const fieldOutput = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ isHidden: false, isHighlighted: false }))
    );
    // console.log((cellWidth + 2) * width);
    // console.log((cellHeight + 2) * height + 35);
    return {
      width,
      height,
      fieldT,
      cellSize,
      selectedCoords,
      highlightedCoords,
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
    );
    // this.calculateCellSize();
    this.setVisibility();
  },
  watch: {
    currentPlayer() {
      this.selectedCoords = null;
      this.highlightedCoords = null;
      // Remove highlights
      this.removeHighlights();
      // Add visibility
      this.setVisibility();
    }
  },
  methods: {
    calculateCellSize() {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const maxWidth = windowWidth / this.width;
      const maxHeight = windowHeight / this.height;
      this.cellSize = Math.floor(Math.min(maxWidth, maxHeight));
      this.cssProps = {
        cellHeight: `${this.cellSize}px`,
        lineWidth: `${(this.cellSize + 2) * this.width}px`,
        boardHeight: `${(this.cellSize + 2) * this.height + 35}px`,  // Board height + bottom info label height
      };
    },
    setVisibility() {
      // Remove all visibility
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.fieldOutput[curX][curY].isHidden = true;
        }
      }
      const playerObjectCoords = this.getPlayerObjectCoords(this.currentPlayer);
      for (const coords of playerObjectCoords) {
        const [x, y] = coords;
        for (let curX = x - this.fogOfWarRadius; curX <= x + this.fogOfWarRadius; curX++) {
          for (let curY = y - this.fogOfWarRadius; curY <= y + this.fogOfWarRadius; curY++) {
            if (this.areExistingCoords(curX, curY)) {
              this.fieldOutput[curX][curY].isHidden = false;
              // console.log(curX, curY);
            }
          }
        }
      }
    },
    setVisibilityForArea(x, y, r) {
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
              this.makeVisibleAreaAroundCoords(curX, curY);
            }
          }
        }
    },
    makeVisibleAreaAroundCoords(x, y) {
      for (let curX = x - this.fogOfWarRadius; curX <= x + this.fogOfWarRadius; curX++) {
        for (let curY = y - this.fogOfWarRadius; curY <= y + this.fogOfWarRadius; curY++) {
          if (this.areExistingCoords(curX, curY))
          // curX >= x - r && curX < x + r && curY >= y - r && curY < y + r
            this.fieldOutput[curX][curY].isHidden = false;
        }
      }
    },
    isVisibleObj(x, y) {
      return (
        this.field[x][y].unit && this.field[x][y].unit.player === this.currentPlayer ||
        this.field[x][y].building && this.field[x][y].building.player === this.currentPlayer
      )
    },
    areExistingCoords(curX, curY) {
      return curX >= 0 && curX < this.width && curY >= 0 && curY < this.height;
    },
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
    removeHighlights() {
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.fieldOutput[curX][curY].isHighlighted = false;
        }
      }
    },
    processClick(event, x, y) {
      console.log('processClick start');
      // console.log(x, y);
      const unit = this.field[x][y].unit;
      if (unit) {
        if (unit.player === this.currentPlayer && !unit.hasMoved) {
          this.selectedCoords = [x, y];
          this.highlightedCoords = [];
          this.removeHighlights();
          // TODO: refactor it
          this.setHiglightedCoords(x, y);
          for (let curX = x - unit.movePoints; curX <= x + unit.movePoints; curX++) {
            for (let curY = y - unit.movePoints; curY <= y + unit.movePoints; curY++) {
              if (this.areExistingCoords(curX, curY) && this.isCellHighlighted(curX, curY))
                this.fieldOutput[curX][curY].isHighlighted = true;
            }
          }
        }
      }
      else if (this.selectedCoords && this.canMove(this.selectedCoords, [x, y])) {
        this.moveUnit(this.selectedCoords, [x, y]);
      }
      console.log('processClick finish');
    },
    setHiglightedCoords(x, y) {
      console.log('setHiglightedCoords start');
      const unit = this.field[x][y].unit;
      this.highlightedCoords = this.waveEngine.getReachableCoordsArr(x, y, unit.movePoints);
      console.log('setHiglightedCoords finish');
    },
    moveUnit(fromCoords, toCoords) {
      let [x, y] = fromCoords;
      const movePoints = this.field[x][y].unit.movePoints;
      this.$emit('moveUnit', fromCoords, toCoords);
      this.selectedCoords = null;
      this.highlightedCoords = null;
      // Remove highlights
      for (let curX = x - movePoints; curX <= x + movePoints; curX++) {
        for (let curY = y - movePoints; curY <= y + movePoints; curY++) {
          if (this.areExistingCoords(curX, curY))
            this.fieldOutput[curX][curY].isHighlighted = false;
        }
      }
      // Remove visibility after move
      this.setVisibilityForArea(x, y, this.fogOfWarRadius);
      // Add visibility
      [x, y] = toCoords;
      for (let curX = x - this.fogOfWarRadius; curX <= x + this.fogOfWarRadius; curX++) {
        for (let curY = y - this.fogOfWarRadius; curY <= y + this.fogOfWarRadius; curY++) {
          if (this.areExistingCoords(curX, curY))
            this.fieldOutput[curX][curY].isHidden = false;
        }
      }
    },
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
    isCellHidden(x, y) {
      console.log('isCellHidden start');
      if (this.isHidden) return true;
      for (let curX = Math.max(x - this.fogOfWarRadius, 0); curX <= Math.min(x + this.fogOfWarRadius, this.width - 1); curX++)
        for (let curY = Math.max(y - this.fogOfWarRadius, 0); curY <= Math.min(y + this.fogOfWarRadius, this.height - 1); curY++)
          if (
              this.field[curX][curY].unit && this.field[curX][curY].unit.player === this.currentPlayer ||
              this.field[curX][curY].building && this.field[curX][curY].building.player === this.currentPlayer
          ) {
            console.log('isCellHidden finish');
            return false;
          }
      console.log('isCellHidden finish');
      return true
    },
    isCellHighlighted(x, y) {
      console.log('isCellHighlighted start');
      if (!this.highlightedCoords) {
        console.log('isCellHighlighted finish');
        return false;
      }
      for (let coord of this.highlightedCoords) {
        if (coord[0] === x && coord[1] === y) {
          console.log('isCellHighlighted finish');
          return true;
        }
      }
      console.log('isCellHighlighted finish');
      return false;
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
