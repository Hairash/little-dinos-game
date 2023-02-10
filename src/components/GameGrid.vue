<template>
  <div class="board">
    <div class="cell_line" v-for="(line, y) in fieldT" :key=y>
      <template v-for="(cellData, x) in line" :key=x>
        <GameCell
          :width=cellWidth
          :height=cellHeight
          :terrain=cellData.terrain
          :unit=cellData.unit
          :selected="(selectedCoords && selectedCoords[0] === x && selectedCoords[1] === y)"
          @click="processClick($event, x, y)"
        />
      </template>
    </div>
  </div>
</template>

<script>
import Engine from '../game/engine'
import GameCell from './GameCell.vue'

export default {
  name: "GameGrid",
  components: {
    GameCell,
  },
  props: {
    field: Array[Array[Engine.Cell]],
    currentPlayer: Number,
  },
  data() {
    const width = this.field.length;
    const height = this.field[0].length;
    const fieldT = (m => m[0].map((x,i) => m.map(x => x[i])))(this.field)
    const cellWidth = 50;
    const cellHeight = 50;
    let selectedCoords = null;
    return {
      width,
      height,
      fieldT,
      cellWidth,
      cellHeight,
      selectedCoords,
      cssProps: {
        cellHeight: `${cellHeight}px`,
      },
    }
  },
  watch: {
    currentPlayer() {
      this.selectedCoords = null;
    }
  },
  methods: {
    processClick(event, x, y) {
      // console.log(x, y);
      const unit = this.field[x][y].unit;
      if (unit) {
        if (unit.player === this.currentPlayer && !unit.hasMoved) {
          this.selectedCoords = [x, y];
        }
      }
      else if (this.selectedCoords && this.canMove(this.selectedCoords, [x, y])) {
        this.moveUnit(this.selectedCoords, [x, y]);
      }
    },
    moveUnit(fromCoords, toCoords) {
      this.$emit('moveUnit', fromCoords, toCoords);
      this.selectedCoords = null;
    },
    canMove(fromCoords, toCoords) {
      const [x0, y0] = fromCoords;
      const [x1, y1] = toCoords;
      const unit = this.field[x0][y0].unit;
      if (this.field[x1][y1].terrain !== Engine.TerrainTypes.EMPTY) return false;

      // TODO: Refactor it. Make the function for the wave algorithm
      const waveField = [];
      for (let x = 0; x < this.width; x++) {
        let col = [];
        for (let y = 0; y < this.height; y++) {
          if (this.field[x][y].terrain === Engine.TerrainTypes.EMPTY && !this.field[x][y].unit)
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
    // showWave(wave) {
    //   let waveS = '';
    //   for (const el of wave) {
    //     waveS += '(' + el + ')' + ', ';
    //   }
    //   console.log(waveS);
    // },
    // showField(field) {
    //   const fieldT = (m => m[0].map((x,i) => m.map(x => x[i])))(field)
    //   let fieldS = '';
    //   for (let x = 0; x < fieldT.length; x++) {
    //     const col = fieldT[x];
    //     for (let y = 0; y < col.length; y++) {
    //       let el = fieldT[x][y];
    //       if (el === null) el = '.';
    //       if (el === -1) el = '█'
    //       fieldS += el + ' ';
    //     }
    //     fieldS += '\n'
    //   }
    //   console.log(fieldS);
    // },
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
  }
}
</script>

<style scoped>
.cell_line {
  height: v-bind('cssProps.cellHeight');
}

</style>
