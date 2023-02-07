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
    width: Number,
    height: Number,
    currentPlayer: Number,  // TODO: On player change reset selectedCoords
  },
  data() {
    // TODO: move field generation outside from the component, pass it as a parameter
    const field = this.generateField();
    const fieldT = (m => m[0].map((x,i) => m.map(x => x[i])))(field)
    const cellWidth = 100;
    const cellHeight = 100;
    let selectedCoords = null;
    return {
      field,
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
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          if (this.field[x][y].unit) {
            this.field[x][y].unit.hasMoved = false;
          }
        }
      }
    }
  },
  methods: {
    generateField() {
      const field = [];
      const terrainTypesArr = Object.values(Engine.TerrainTypes);
      for (let x = 0; x < this.width; x++) {
        const col = [];
          for (let y = 0; y < this.height; y++) {
          const r = Math.random();
          const terrain = terrainTypesArr[Math.floor(r * terrainTypesArr.length)];
          const cell = {
            terrain: terrain,
          }
          if (r < 0.05) cell.unit = new Engine.Unit(0, 'dino1', Math.round(r * 100) % 10 + 1);
          else if (r < 0.1) cell.unit = new Engine.Unit(1, 'dino2', Math.round(r * 100) % 10 + 1);
          col.push(cell);
        }
        field.push(col);
      }
      console.log(field);
      return field;
    },
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
    canMove(fromCoords, toCoords) {
      const [x0, y0] = fromCoords;
      const [x1, y1] = toCoords;
      const unit = this.field[x0][y0].unit;
      return (unit.movePoints >= (Math.abs(x0 - x1) + Math.abs(y0 - y1))) &&
          this.field[x1][y1].terrain === Engine.TerrainTypes.EMPTY;
    },
    moveUnit(fromCoords, toCoords) {
      const [x0, y0] = fromCoords;
      const [x1, y1] = toCoords;
      const unit = this.field[x0][y0].unit;
      unit.hasMoved = true;
      delete(this.field[x0][y0].unit);
      this.field[x1][y1].unit = unit;
      this.selectedCoords = null;
      console.log(this.field);
    },
  }
}
</script>

<style scoped>
.cell_line {
  height: v-bind('cssProps.cellHeight');
}

</style>
