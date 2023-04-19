<template>
  <div class="game-grid-wrapper">
    <div class="board">
      <div class="cell_line" v-for="(line, y) in fieldT" :key=y>
        <template v-for="(cellData, x) in line" :key=x>
          <GameCell
            :hidden="isCellHidden(x, y)"
            :width=cellWidth
            :height=cellHeight
            :terrain=cellData.terrain
            :unit=cellData.unit
            :building=cellData.building
            :selected="(selectedCoords && selectedCoords[0] === x && selectedCoords[1] === y)"
            :highlighted="isCellHighlighted(x, y)"
            @click="processClick($event, x, y)"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import Models from '../game/models'
import GameCell from './GameCell.vue'

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
    const fieldT = (m => m[0].map((x,i) => m.map(x => x[i])))(this.field)
    const cellWidth = 50;
    const cellHeight = 50;
    let selectedCoords = null;
    let highlightedCoords = null;
    return {
      width,
      height,
      fieldT,
      cellWidth,
      cellHeight,
      selectedCoords,
      highlightedCoords,
      cssProps: {
        cellHeight: `${cellHeight}px`,
        lineWidth: `${(cellWidth + 2) * width}px`,
      },
    }
  },
  watch: {
    currentPlayer() {
      this.selectedCoords = null;
      this.highlightedCoords = null;
    }
  },
  methods: {
    processClick(event, x, y) {
      // console.log(x, y);
      const unit = this.field[x][y].unit;
      if (unit) {
        if (unit.player === this.currentPlayer && !unit.hasMoved) {
          this.selectedCoords = [x, y];
          this.highlightedCoords = [];
          for (let curX = 0; curX < this.width; curX++) {
            for (let curY = 0; curY < this.height; curY++) {
              if (curX === x && curY === y) continue;
              if (this.canMove(this.selectedCoords, [curX, curY])) this.highlightedCoords.push([curX, curY]);
            }
          }
        }
      }
      else if (this.selectedCoords && this.canMove(this.selectedCoords, [x, y])) {
        this.moveUnit(this.selectedCoords, [x, y]);
      }
    },
    moveUnit(fromCoords, toCoords) {
      this.$emit('moveUnit', fromCoords, toCoords);
      this.selectedCoords = null;
      this.highlightedCoords = null;
    },
    canMove(fromCoords, toCoords) {
      const [x0, y0] = fromCoords;
      const [x1, y1] = toCoords;
      const unit = this.field[x0][y0].unit;
      if (this.field[x1][y1].terrain !== Models.TerrainTypes.EMPTY) return false;

      // TODO: Refactor it. Make the function for the wave algorithm
      const waveField = [];
      for (let x = 0; x < this.width; x++) {
        let col = [];
        for (let y = 0; y < this.height; y++) {
          if (this.field[x][y].terrain === Models.TerrainTypes.EMPTY && !this.field[x][y].unit)
            col.push(null);
          else
            col.push(-1);
        }
        waveField.push(col);
      }

      waveField[x0][y0] = 0;
      const wave = [[x0, y0]];
      while (wave.length > 0) {
        const curCell = wave.shift();
        const [x, y] = curCell;
        const s = waveField[x][y] + 1;
        if (s > unit.movePoints) return false;
        for (const neighbour of this.getNeighbours(waveField, x, y)) {
          const [curX, curY] = neighbour;
          if (curX === x1 && curY === y1) return true;
          if (waveField[curX][curY] === null || waveField[curX][curY] > s) {
            waveField[curX][curY] = s;
            wave.push([curX, curY]);
          }
        }
      }
      return false;
    },
    getNeighbours(field, x, y) {
      const neighbours = [];
      if (x > 0 && field[x - 1][y] !== -1)
        neighbours.push([x - 1, y]);
      if (x < field.length - 1 && field[x + 1][y] !== -1)
        neighbours.push([x + 1, y]);
      if (y > 0 && field[x][y - 1] !== -1)
        neighbours.push([x, y - 1]);
      if (y < field[0].length - 1 && field[x][y + 1] !== -1)
        neighbours.push([x, y + 1]);
      return neighbours;
    },
    isCellHidden(x, y) {
      if (this.isHidden) return true;
      for (let curX = Math.max(x - this.fogOfWarRadius, 0); curX <= Math.min(x + this.fogOfWarRadius, this.width - 1); curX++)
        for (let curY = Math.max(y - this.fogOfWarRadius, 0); curY <= Math.min(y + this.fogOfWarRadius, this.height - 1); curY++)
          if (
              this.field[curX][curY].unit && this.field[curX][curY].unit.player === this.currentPlayer ||
              this.field[curX][curY].building && this.field[curX][curY].building.player === this.currentPlayer
          ) return false
      return true
    },
    isCellHighlighted(x, y) {
      if (!this.highlightedCoords) return false;
      for (let coord of this.highlightedCoords) {
        if (coord[0] === x && coord[1] === y) return true;
      }
      return false;
    },
  }
}
</script>

<style scoped>
div.board {
  position: relative;
  /* TODO: count it fair */
  width: 1350px;
  height: 865px;  /* Board height + bottom info label height */
  color: #2c3e50;
}

div.game-grid-wrapper {
  overflow: auto;
  position: relative;
  width: 100%;
  height: 100%;
  max-height: 100%;
}

div.cell_line {
  width: v-bind('cssProps.lineWidth');
  height: v-bind('cssProps.cellHeight');
}

</style>
