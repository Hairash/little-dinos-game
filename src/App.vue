<template>
  <GameGrid :field="field" :currentPlayer="currentPlayer" @moveUnit="moveUnit" />
  <div class="infoLabel">
    <span class="curPlayerLabel">Current player:
      <!-- TODO: Fix it. Make images for players (not units) -->
      <img class="curPlayerImage" :src="`/images/dino${currentPlayer + 1}.png`">
    </span>
    <span class="curActiveUnitsLabel">Active units: {{ getCurrentActiveUnits() }}</span>
    <EndTurnBtn @click="processEndTurn" />
  </div>
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
    const playersNum = 4;
    let currentPlayer = 0;
    const width = 26;
    const height = 16;
    let field = null;
    let prevField = null;
    return {
      playersNum,
      currentPlayer,
      width,
      height,
      field,
      prevField,
    }
  },
  created() {
    this.field = this.generateField();
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') this.processEndTurn();
    });
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.processEndTurn();
    });
    window.addEventListener('mouseup', (e) => {
      e.preventDefault();
      if (e.button === 1 && this.prevField) {
        // console.log('Revert');
        // console.log(this.prevField);
        // TODO: What a hell?!
        for (let x = 0; x < this.width; x++) {
          for (let y = 0; y < this.height; y++) {
            const prevCell = this.prevField[x][y];
            const cell = this.field[x][y];
            cell.unit = prevCell.unit;
            cell.building = prevCell.building;
          }
        }
        // this.field = structuredClone(this.prevField);
        // console.log(this.field);
      }
    });
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
          // if (r < 0.05) cell.unit = new Engine.Unit(0, 'dino1', Math.round(r * 1000) % 10 + 1);
          // else if (r < 0.1) cell.unit = new Engine.Unit(1, 'dino2', Math.round(r * 1000) % 10 + 1);
          // Set buildings
          if (r < 0.05) cell.building = new Engine.Building(null, Engine.BuildingTypes.BASE);
          col.push(cell);
        }
        field.push(col);
      }
      // Set units
      for (let player = 0; player < this.playersNum; player++) {
        let x = Math.floor(Math.random() * this.width);
        let y = Math.floor(Math.random() * this.height);
        while (field[x][y].terrain === Engine.TerrainTypes.MOUNTAIN) {
          x = Math.floor(Math.random() * this.width);
          y = Math.floor(Math.random() * this.height);
        }
        field[x][y].building = new Engine.Building(
          player,
          Engine.BuildingTypes.BASE,
        );
        field[x][y].unit = new Engine.Unit(
          player,
          `dino${player + 1}`,
          Math.ceil(Math.random() * 10),
        );
      }
      // console.log(field);
      return field;
    },
    moveUnit(fromCoords, toCoords) {
      this.prevField = structuredClone(this.field);
      // console.log(this.prevField);
      const [x0, y0] = fromCoords;
      const [x1, y1] = toCoords;
      const unit = this.field[x0][y0].unit;
      unit.hasMoved = true;
      delete(this.field[x0][y0].unit);
      this.field[x1][y1].unit = unit;
      if (this.field[x1][y1].building) this.field[x1][y1].building.player = unit.player;
      // console.log(this.field[x1][y1]);
      this.killNeighbours(x1, y1, unit.player);
    },
    killNeighbours(x, y, player) {
      // console.log('Kill')
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
      this.prevField = null;
    },
    getCurrentActiveUnits() {
      let ctr = 0;
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          const unit = this.field[x][y].unit;
          if (unit && unit.player === this.currentPlayer && !unit.hasMoved) {
            ctr++;
          }
        }
      }
      return ctr;
    },
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

div.infoLabel {
  color: white;
}

span.curPlayerLabel {
  margin-right: 30px;
}

img.curPlayerImage {
  width: 30px;
  height: 30px;
  vertical-align: bottom;
}

span.curActiveUnitsLabel {
  margin-right: 30px;
}
</style>
