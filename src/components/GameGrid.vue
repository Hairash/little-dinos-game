<template>
  <div class="board">
    <div class="cell_line" v-for="(line, y) in field" :key=y>
      <template v-for="(cellData, x) in line" :key=x>
        <GameCell
          :width=100
          :height=100
          :terrain=cellData.terrain
          :unit=cellData.unit
        />
      </template>
    </div>
  </div>

</template>

<script>
// import Unit from '../game/engine'
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
    let field = [];
    for (let x = 0; x < this.width; x++) {
      const col = [];
      for (let y = 0; y < this.height; y++) {
        // const r = Math.random();
        col.push({
          terrain: 'wall',
          // unit: new Unit(),
        });
      }
      field.push(col);
    }
    console.log(field);
    return {
      field,
    }
  }
}
</script>

<style scoped>

</style>