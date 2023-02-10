<template>
  <GameGrid :field="field" :currentPlayer="currentPlayer" @moveUnit="moveUnit"/>
  <span class="curPlayerLabel">Current player:
    <!-- TODO: Fix it. Make images for players (not units) -->
    <img class="curPlayerImage" :src="`/images/dino${currentPlayer + 1}.png`">
  </span>
  <EndTurnBtn @click="processEndTurn"/>
</template>

<script>
import GameGrid from './components/GameGrid.vue'
import EndTurnBtn from './components/EndTurnBtn.vue'
import Engine from "@/game/engine";

export default {
  name: 'App',
  components: {
    GameGrid,
    EndTurnBtn,
  },
  data() {
    const playersNum = 2;
    let currentPlayer = 0;
    const width = 18;
    const height = 12;
    let field = null;
    return {
      playersNum,
      currentPlayer,
      width,
      height,
      field,
    }
  },
  created() {
    this.field = this.generateField();
  },
  methods: {
    generateField() {
      const field = [];
      // const terrainTypesArr = Object.values(Engine.TerrainTypes);
      for (let x = 0; x < this.width; x++) {
        const col = [];
        for (let y = 0; y < this.height; y++) {
          const r = Math.random();
          // const terrain = terrainTypesArr[Math.floor(r * terrainTypesArr.length)];
          // TODO: Make a fair terrain generation
          const terrain = r > 0.75 ? Engine.TerrainTypes.MOUNTAIN : Engine.TerrainTypes.EMPTY
          const cell = {
            terrain: terrain,
          }
          // Set units
          if (r < 0.05) cell.unit = new Engine.Unit(0, 'dino1', Math.round(r * 1000) % 10 + 1);
          else if (r < 0.1) cell.unit = new Engine.Unit(1, 'dino2', Math.round(r * 1000) % 10 + 1);
          // Set buildings
          else if (r < 0.12) cell.building = new Engine.Building(null, Engine.BuildingTypes.BASE);
          col.push(cell);
        }
        field.push(col);
      }
      // console.log(field);
      return field;
    },
    moveUnit(fromCoords, toCoords) {
      const [x0, y0] = fromCoords;
      const [x1, y1] = toCoords;
      const unit = this.field[x0][y0].unit;
      unit.hasMoved = true;
      delete(this.field[x0][y0].unit);
      this.field[x1][y1].unit = unit;
      if (this.field[x1][y1].building) this.field[x1][y1].building.player = unit.player;
      console.log(this.field[x1][y1]);
      this.killNeighbours(x1, y1, unit.player);
    },
    killNeighbours(x, y, player) {
      console.log('Kill')
      const neighbours = this.getNeighbours(x, y);
      for (const neighbour of neighbours) {
        const [curX, curY] = neighbour;
        if (this.field[curX][curY].unit && this.field[curX][curY].unit.player !== player) {
          delete(this.field[curX][curY].unit);
        }
      }
    },
    getNeighbours(x, y) {
      const neighbours = [];
      if (x > 0 && this.field[x - 1][y].terrain !== Engine.TerrainTypes.MOUNTAIN)
        neighbours.push([x - 1, y]);
      if (x < this.width - 1 && this.field[x + 1][y].terrain !== Engine.TerrainTypes.MOUNTAIN)
        neighbours.push([x + 1, y]);
      if (y > 0 && this.field[x][y - 1].terrain !== Engine.TerrainTypes.MOUNTAIN)
        neighbours.push([x, y - 1]);
      if (y < this.height - 1 && this.field[x][y + 1].terrain !== Engine.TerrainTypes.MOUNTAIN)
        neighbours.push([x, y + 1]);
      return neighbours;
    },
    processEndTurn() {
      this.currentPlayer += 1;
      this.currentPlayer %= this.playersNum;
      // Restore all unit's move points and produce new units
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          if (this.field[x][y].unit) {
            this.field[x][y].unit.hasMoved = false;
          }
          else if (this.field[x][y].building && this.field[x][y].building.player === this.currentPlayer) {
            this.field[x][y].unit = new Engine.Unit(
              this.currentPlayer,
              // TODO: make fair dict with images
              `dino${this.currentPlayer + 1}`,
              Math.ceil(Math.random() * 10),
            )
          }
        }
      }
    }
  },
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}

span.curPlayerLabel {
  margin-right: 30px;
}

img.curPlayerImage {
  width: 30px;
  height: 30px;
  vertical-align: bottom;
}
</style>
