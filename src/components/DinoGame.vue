<template>
  <ReadyLabel
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

export default {
  name: 'DinoGame',
  components: {
    ReadyLabel,
    GameGrid,
    InfoLabel,
  },
  props: {
    playersNum: Number,
    width: Number,
    height: Number,
  },
  data() {
    const STATES = {
      ready: 'ready',
      play: 'play',
    }
    // TODO: Move to props
    // Game settings
    const sectorsNum = 4;
    const enableFogOfWar = true;
    let fogOfWarRadius = 3;
    const enableUndo = true;
    // Initial state
    let currentPlayer = 0;
    let field = null;
    let state = STATES.ready;
    // TODO: Make prevState object
    let prevField = null;
    let prevPlayer = 0;
    let engine = null;
    return {
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
      engine,
    }
  },
  created() {
    this.engine = new FieldEngine(
      this.playersNum,
      this.width,
      this.height,
      this.sectorsNum,
    );
    this.field = this.engine.generateField();
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
        this.restoreField();
      }
    });
  },
  methods: {
    moveUnit(fromCoords, toCoords) {
      // Store state before move
      this.prevField = structuredClone(this.field);
      this.prevPlayer = this.currentPlayer;
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
            this.field[x][y].unit = new Models.Unit(
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
