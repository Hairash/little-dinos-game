<template>
  <div class="board">
    <div class="cell_line" v-for="(line, y) in field" :key=y>
      <template v-for="(cellData, x) in line" :key=x>
        <GameCell
          :width=cellWidth
          :height=cellHeight
          :terrain=cellData.terrain
          :unit=cellData.unit
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
  },
  data() {
    const field = this.generateField();
    const cellWidth = 100;
    const cellHeight = 100;
    return {
      field,
      cellWidth,
      cellHeight,
      cssProps: {
        cellHeight: `${cellHeight}px`,
      },
    }
  },
  methods: {
    generateField() {
      const field = [];
      const terrainTypesArr = Array.from(Engine.TerrainTypes);
      for (let y = 0; y < this.height; y++) {
        const col = [];
        for (let x = 0; x < this.width; x++) {
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
    }
  }
}
</script>

<style scoped>
.cell_line {
  height: v-bind('cssProps.cellHeight');
}

</style>