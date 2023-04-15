<template>
  <FixedLabel
    v-if="state === STATES.ready"
    :onClickAction="() => this.state = this.STATES.play"
    :currentPlayer="currentPlayer"
  />
  <GameGrid
      :is-hidden="state === STATES.ready"
      :fog-of-war-radius="fogOfWarRadius"
      :field="field"
      :currentPlayer="currentPlayer"
      @moveUnit="moveUnit"
  />
  <div class="infoLabel" v-if="state === STATES.play">
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
import FixedLabel from './components/FixedLabel.vue'
import EndTurnBtn from './components/EndTurnBtn.vue'
import Engine from "@/game/engine";

export default {
  name: 'App',
  components: {
    GameGrid,
    EndTurnBtn,
    FixedLabel,
  },
  data() {
    const STATES = {
      ready: 'ready',
      play: 'play',
    }
    const playersNum = 2;
    const width = 26;
    const height = 16;
    const sectorsNum = 4;
    const enableFogOfWar = true;
    let fogOfWarRadius = 3;
    const enableUndo = false;
    // Initial state
    let currentPlayer = 0;
    let field = null;
    let state = STATES.ready;
    // TODO: Make prevState object
    let prevField = null;
    let prevPlayer = 0;
    return {
      playersNum,
      width,
      height,
      sectorsNum,
      enableUndo,
      enableFogOfWar,
      fogOfWarRadius,
      STATES,
      currentPlayer,
      field,
      state,
      prevField,
      prevPlayer,
    }
  },
  created() {
    this.field = this.generateField();
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') this.state = this.STATES.play;
    });
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.processEndTurn();
    });
    window.addEventListener('mouseup', (e) => {
      e.preventDefault();
      if (this.enableUndo && e.button === 1 && this.prevField) {
        // console.log('Revert');
        // console.log(this.prevField);
        // TODO: Make restore state function
        this.currentPlayer = this.prevPlayer;
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
          col.push(cell);
        }
        field.push(col);
      }
      // Set units
      const sectors = [];
      for (let player = 0; player < this.playersNum; player++) {
        let x = Math.floor(Math.random() * this.width);
        let y = Math.floor(Math.random() * this.height);
        let [sectorX, sectorY] = this.getSector(x, y);
        while (field[x][y].terrain === Engine.TerrainTypes.MOUNTAIN || !this.validateSector(sectorX, sectorY, sectors)) {
          x = Math.floor(Math.random() * this.width);
          y = Math.floor(Math.random() * this.height);
          [sectorX, sectorY] = this.getSector(x, y);
        }
        // console.log(sectorX, sectorY);
        sectors.push([sectorX, sectorY]);
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
      // Set buildings
      let failCtr = 0;
      for (let building = 0; building < this.width * this.height * 0.03; building++) {
        let x = Math.floor(Math.random() * this.width);
        let y = Math.floor(Math.random() * this.height);
        while (field[x][y].terrain === Engine.TerrainTypes.MOUNTAIN || !this.noBuildingsInDistance(field, x, y, 5)) {
          x = Math.floor(Math.random() * this.width);
          y = Math.floor(Math.random() * this.height);
          failCtr++;
          if (failCtr > 100) {
            x = null;
            y = null;
            break;
          }
        }
        if (x !== null && y !== null)
          field[x][y].building = new Engine.Building(null, Engine.BuildingTypes.BASE);
      }
      // console.log(field);
      return field;
    },
    moveUnit(fromCoords, toCoords) {
      this.prevField = structuredClone(this.field);
      this.prevPlayer = this.currentPlayer;
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
      if (this.state === this.STATES.ready) return;
      this.state = this.STATES.ready;
      // TODO: Make save state function
      this.prevField = structuredClone(this.field);
      this.prevPlayer = this.currentPlayer;
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
    getSector(x, y) {
      return [Math.floor(x * this.sectorsNum / this.width), Math.floor(y * this.sectorsNum / this.height)]
    },
    validateSector(x, y, sectors) {
      // console.log(x, y, sectors);
      if (!(x === 0 || x === this.sectorsNum - 1 || y === 0 || y === this.sectorsNum - 1)) return false;
      for (let sector of sectors) {
        if (this.sectorsDistance([x, y], sector) < 2) return false;
      }
      return true;
    },
    sectorsDistance(s1, s2) {
      const [s1X, s1Y] = s1;
      const [s2X, s2Y] = s2;
      return Math.max(Math.abs(s1X - s2X), Math.abs(s1Y - s2Y));
    },
    noBuildingsInDistance(field, x, y, r) {
      console.log(x, y, r);
      for (let curX = x - r; curX <= x + r; curX++) {
        if (curX < 0 || curX >= this.width) continue;
        for (let curY = y - r; curY <= y + r; curY++) {
          if (curY < 0 || curY >= this.height) continue;
          if (Math.abs(curX - x) + Math.abs(curY - y) > r) continue;
          console.log(curX, curY);
          console.log(field[curX][curY]);
          if (field[curX][curY].building) return false;
        }
      }
      return true;
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
  color: white;
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

span.curActiveUnitsLabel {
  margin-right: 30px;
}

div.readyLabel {
  position: fixed;
  z-index: 100;
  left: 0;
  right: 0;
  top: 50%;
}

div.infoLabel {
  position: fixed;
  padding-bottom: 28px;
  bottom: 0;
  left: 0;
  right: 0;
  background: black;
}
</style>
