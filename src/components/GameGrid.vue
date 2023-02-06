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
    currentPlayer: Number,
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
          if (r < 0.05) cell.unit = new Engine.Unit(0, 'dino1');
          else if (r < 0.1) cell.unit = new Engine.Unit(1, 'dino2');
          col.push(cell);
        }
        field.push(col);
      }
      console.log(field);
      return field;
    },
    processClick(event, x, y) {
      // console.log(x, y);
      if (this.field[x][y].unit) {
        if (this.field[x][y].unit.player === this.currentPlayer) {
          this.selectedCoords = [x, y];
        }
      }
      else if (this.selectedCoords) {
        this.moveUnit(this.selectedCoords, [x, y]);
      }
    },
    moveUnit(fromCoords, toCoords) {
      let [x0, y0] = fromCoords;
      let [x1, y1] = toCoords;
      let unit = this.field[x0][y0].unit;
      delete(this.field[x0][y0].unit);
      this.field[x1][y1].unit = unit;
      this.selectedCoords = null;
    },
  }
}
</script>

<style scoped>
.cell_line {
  height: v-bind('cssProps.cellHeight');
}

</style>
