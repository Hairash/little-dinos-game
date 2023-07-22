<template>
  <ReadyLabel
    v-if="state === STATES.ready"
    :onClickAction="() => this.state = this.STATES.play"
    :currentPlayer="currentPlayer"
    :player="players[currentPlayer]"
  />
  <GameGrid
    ref="gameGridRef"
    :is-hidden="state === STATES.ready"
    :fog-of-war-radius="fogOfWarRadius"
    :enable-fog-of-war="enableFogOfWar"
    :field="field"
    :currentPlayer="currentPlayer"
    @moveUnit="moveUnit"
  />
  <InfoLabel
    v-if="state === STATES.play"
    :currentPlayer="currentPlayer"
    :getCurrentActiveUnits="getCurrentActiveUnits"
    :handleEndTurnBtnClick="processEndTurn"
  />
</template>

<script>
import ReadyLabel from './ReadyLabel.vue'
import GameGrid from './GameGrid.vue'
import InfoLabel from './InfoLabel.vue'
import Models from "@/game/models";
import { FieldEngine } from "@/game/fieldEngine";
import { WaveEngine } from "@/game/waveEngine";

export default {
  name: 'DinoGame',
  components: {
    ReadyLabel,
    GameGrid,
    InfoLabel,
  },
  props: {
    humanPlayersNum: Number,
    botPlayersNum: Number,
    width: Number,
    height: Number,
    sectorsNum: Number,
    enableFogOfWar: Boolean,
    fogOfWarRadius: Number,
    enableUndo: Boolean,
    loadGame: Boolean,
  },
  data() {
    // Game states
    const STATES = {
      ready: 'ready',
      play: 'play',
    }
    const playersNum = this.humanPlayersNum + this.botPlayersNum;
    return {
      STATES,
      playersNum,
      players: [],
      currentPlayer: 0,
      field: null,
      state: STATES.ready,
      // TODO: Make prevState object
      prevField: null,
      prevPlayer: 0,
      engine: null,
      unitCoordsArr: [],
    }
  },
  created() {
    this.engine = new FieldEngine(
      this.playersNum,
      this.width,
      this.height,
      this.sectorsNum,
    );
    this.loadField();
    this.waveEngine = new WaveEngine(
      this.field,
      this.width,
      this.height,
      this.fogOfWarRadius,
    )
    this.createPlayers();
    console.log(this.players);
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') this.state = this.STATES.play;
      // TODO: Add test mode
      // if (e.key === 'Enter') this.makeBotUnitMove();
    });
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.processEndTurn();
    });
    window.addEventListener('mouseup', (e) => {
      e.preventDefault();
      if (this.enableUndo && e.button === 1 && this.prevField) {
        this.restoreField();
      }
    });
  },
  methods: {
    createPlayers() {
      console.log(this.humanPlayersNum);
      let players = Array.from({ length: this.humanPlayersNum }, () => new Models.Player(Models.PlayerTypes.HUMAN));
      players = players.concat(Array.from({ length: this.botPlayersNum }, () => new Models.Player(Models.PlayerTypes.BOT)));
      console.log(players);
      // TODO: Shuffle it
      this.players = players;
    },
    moveUnit(fromCoords, toCoords) {
      console.log('moveUnit start');
      // Store state before move
      if (this.enableUndo) {
        this.prevField = structuredClone(this.field);
        this.prevPlayer = this.currentPlayer;
      }
      // console.log(this.prevField);
      const [x0, y0] = fromCoords;
      const [x1, y1] = toCoords;
      const unit = this.field[x0][y0].unit;
      unit.hasMoved = true;
      delete(this.field[x0][y0].unit);
      this.field[x1][y1].unit = unit;
      // capture the building
      if (this.field[x1][y1].building) this.field[x1][y1].building.player = unit.player;
      // console.log(this.field[x1][y1]);
      // kill neighbours
      this.engine.killNeighbours(this.field, x1, y1, unit.player);
      console.log('moveUnit finish');
    },
    processEndTurn() {
      if (this.state === this.STATES.ready) return;
      this.state = this.STATES.ready;
      // TODO: Make save state function
      if (this.enableUndo) {
        this.prevField = structuredClone(this.field);
        this.prevPlayer = this.currentPlayer;
      }
      this.currentPlayer += 1;
      this.currentPlayer %= this.playersNum;
      // Restore all unit's move points and produce new units
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          if (this.field[x][y].unit) {
            this.field[x][y].unit.hasMoved = false;
          }
          else if (this.field[x][y].building && this.field[x][y].building.player === this.currentPlayer) {
            this.field[x][y].unit = new Models.Unit(
              this.currentPlayer,
              // TODO: make fair dict with images
              `dino${this.currentPlayer + 1}`,
              Math.ceil(Math.random() * 10),
            )
          }
        }
      }
      if (this.currentPlayer === 0)
        this.saveState();
      this.startTurn();
    },
    saveState() {
      console.log('Save state');
      localStorage.setItem('field', JSON.stringify(this.field));
      localStorage.setItem('humanPlayersNum', JSON.stringify(this.humanPlayersNum));
      localStorage.setItem('botPlayersNum', JSON.stringify(this.botPlayersNum));
      localStorage.setItem('width', JSON.stringify(this.width));
      localStorage.setItem('height', JSON.stringify(this.height));
      localStorage.setItem('sectorsNum', JSON.stringify(this.sectorsNum));
      localStorage.setItem('enableFogOfWar', JSON.stringify(this.enableFogOfWar));
      localStorage.setItem('fogOfWarRadius', JSON.stringify(this.fogOfWarRadius));
      localStorage.setItem('enableUndo', JSON.stringify(this.enableUndo));
    },
    loadField() {
      if (this.loadGame) {
        console.log('getItem');
        const fieldFromStorage = localStorage.getItem('field');
        // TODO: Fix JSON.parse to avoid warning - convert units and buildings to the correct type
        this.field = JSON.parse(fieldFromStorage);
        console.log(this.field);
      }
      else {
        this.field = this.engine.generateField();
      }
    },
    startTurn() {
      if (this.players[this.currentPlayer]._type === Models.PlayerTypes.BOT) {
        this.makeBotMove();
      }
      else {
        this.$refs.gameGridRef.initMove();
      }
    },
    makeBotMove() {
      this.state = this.STATES.play;
      console.log(`Player ${this.currentPlayer + 1} turn start`);
      this.unitCoordsArr = this.getCurrentUnitCoords();
      // TODO: Choose order of moves (calculate, which move is more profitable)
      // Ideal algorhytm
      while (this.unitCoordsArr.length > 0)
        this.makeBotUnitMove();
      this.processEndTurn();
    },
    makeBotUnitMove() {
      if (this.players[this.currentPlayer]._type !== Models.PlayerTypes.BOT) return;
      if (this.state !== this.STATES.play) return;
      if (this.unitCoordsArr.length === 0) {
        this.processEndTurn();
        return;
      }
      const coords = this.unitCoordsArr.shift();
      let visibilitySet = this.enableFogOfWar ?
        this.waveEngine.getCurrentVisibilitySet(this.currentPlayer) :
        new Set();
      visibilitySet = new Set(Array.from(visibilitySet).map(coords => JSON.stringify(coords)));
      console.log(visibilitySet);

      const [x, y] = coords;
      const unit = this.field[x][y].unit;
      const reachableCoordsArr = this.waveEngine.getReachableCoordsArr(x, y, unit.movePoints);
      if (reachableCoordsArr.length === 0) return;
      // Capture the building
      const reachableVisibleCoordsArr = this.enableFogOfWar ?
        this.getReachableVisibleCoordsArr(reachableCoordsArr, visibilitySet) :
        reachableCoordsArr;

      const buildingCoords = this.findFreeBuilding(reachableVisibleCoordsArr);
      console.log(`reachableVisibleCoordsArr: ${reachableVisibleCoordsArr}`);
      console.log(buildingCoords);
      if (buildingCoords) {
        this.moveUnit(coords, buildingCoords);
        return;
      }
      // Atack enemy
      // TODO: Add max kill
      const enemyCoords = this.findEnemy(reachableVisibleCoordsArr, visibilitySet);
      console.log(enemyCoords);
      if (enemyCoords) {
        this.moveUnit(coords, enemyCoords);
        return;
      }
      // TODO: Move to the building
      // Random move
      // TODO: Random long move, avoid own buildings
      const idx = Math.floor(Math.random() * reachableCoordsArr.length);
      const toCoords = reachableCoordsArr[idx];
      console.log(coords);
      console.log(unit.movePoints);
      console.log(toCoords);
      this.moveUnit(coords, toCoords);
      // this.$refs.gameGridRef.setVisibility();
    },
    getReachableVisibleCoordsArr(reachableCoordsArr, visibilitySet) {
      return reachableCoordsArr.filter(coords => visibilitySet.has(JSON.stringify(coords)));
    },
    findEnemy(coordsArr, visibilitySet) {
      return coordsArr.find(([x, y]) =>
        this.isEnemyNeighbour(visibilitySet, x, y)
      );
    },
    isEnemyNeighbour(visibilitySet, x, y) {
      const neighbours = this.engine.getNeighbours(this.field, x, y);
      console.log(`neighbours: ${neighbours}`);
      const res = neighbours.find(([curX, curY]) =>
        (!this.enableFogOfWar || visibilitySet.has(JSON.stringify([curX, curY]))) &&
        this.field[curX][curY].unit &&
        this.field[curX][curY].unit.player !== this.currentPlayer
      )
      console.log(res);
      return res;
    },
    findFreeBuilding(coordsArr) {
      return coordsArr.find(([x, y]) =>
        this.field[x][y].building &&
        this.field[x][y].building.player !== this.currentPlayer
      );
    },
    getCurrentUnitCoords() {
      const coordsArr = [];
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          const unit = this.field[x][y].unit;
          if (unit && unit.player === this.currentPlayer && !unit.hasMoved) {
            coordsArr.push([x, y]);
          }
        }
      }
      return coordsArr;
    },
    getCurrentActiveUnits() {
      console.log('getCurrentActiveUnits start');
      let ctr = 0;
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          const unit = this.field[x][y].unit;
          if (unit && unit.player === this.currentPlayer && !unit.hasMoved) {
            ctr++;
          }
        }
      }
      console.log('getCurrentActiveUnits finish');
      return ctr;
    },
    restoreField() {
      this.currentPlayer = this.prevPlayer;
      // TODO: What a hell?!
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          const prevCell = this.prevField[x][y];
          const cell = this.field[x][y];
          // TODO: Some problem here with units and buildings - they are undefined
          cell.unit = prevCell.unit;
          cell.building = prevCell.building;
        }
      }
      // this.field = structuredClone(this.prevField);
      // console.log(this.field);
    }
  },
}
</script>

<style>
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
