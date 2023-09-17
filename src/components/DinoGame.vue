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
    :enable-scout-mode="enableScoutMode"
    :field="field"
    :currentPlayer="currentPlayer"
    @moveUnit="moveUnit"
  />
  <InfoLabel
    v-if="state === STATES.play"
    :currentPlayer="currentPlayer"
    :player="this.players[currentPlayer]"
    :getCurrentActiveUnits="getCurrentActiveUnits"
    :handleEndTurnBtnClick="processEndTurn"
    :handleImgClick="findNextUnit"
  />
</template>

<script>
import ReadyLabel from './ReadyLabel.vue'
import GameGrid from './GameGrid.vue'
import InfoLabel from './InfoLabel.vue'
import Models from "@/game/models";
import { CreateFieldEngine } from "@/game/createFieldEngine";
import { WaveEngine } from "@/game/waveEngine";
import { FieldEngine } from "@/game/fieldEngine";
import { BotEngine } from "@/game/botEngine";
import { createPlayers } from "@/game/helpers";
import { FIELDS_TO_SAVE } from "@/game/const";

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
    enableScoutMode: Boolean,
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
      unitCoordsArr: [],
    }
  },
  created() {
    this.engine = new CreateFieldEngine(
      this.playersNum,
      this.width,
      this.height,
      this.sectorsNum,
    );
    this.loadFieldOrGenerateNewField();
    this.waveEngine = new WaveEngine(
      this.field,
      this.width,
      this.height,
      this.fogOfWarRadius,
      this.enableScoutMode,
    );
    this.loadOrCreatePlayers();
    this.fieldEngine = new FieldEngine(
      this.field,
      this.width,
      this.height,
      this.fogOfWarRadius,
      this.players,
    );
    this.setVisibility();
    this.botEngine = new BotEngine(
      this.field,
      this.width,
      this.height,
      this.enableFogOfWar,
      this.fieldEngine,
      this.waveEngine,
    );
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
    // Change field after unit's move
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
      this.fieldEngine.killNeighbours(this.field, x1, y1, unit.player);
      // Recalculate visibility in area unit moved from
      this.setVisibilityForArea(x0, y0, this.fogOfWarRadius);
      // Add visibility to area unit moved to
      this.addVisibilityForCoords(x1, y1);
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
    findNextUnit() {
      const coordsArr = this.getCurrentActiveUnits().coordsArr;
      if (coordsArr.length === 0) return;
      this.$refs.gameGridRef.selectNextUnit(coordsArr);
    },

    // Visibility helpers
    addVisibilityForCoords(x, y) {
      if (!this.enableFogOfWar) return;
      for (let curX = x - this.fogOfWarRadius; curX <= x + this.fogOfWarRadius; curX++) {
        for (let curY = y - this.fogOfWarRadius; curY <= y + this.fogOfWarRadius; curY++) {
          if (this.fieldEngine.areExistingCoords(curX, curY))
            this.field[curX][curY].isHidden = false;
        }
      }
    },
    removeVisibility() {
      if (!this.enableFogOfWar) return;
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.field[curX][curY].isHidden = true;
        }
      }
    },
    setVisibility() {
      if (!this.enableFogOfWar) return;

      this.removeVisibility();
      const visibilitySet = this.fieldEngine.getCurrentVisibilitySet(this.currentPlayer);
      for (const coords of visibilitySet) {
        // TODO: Refactor it
        const curX = coords[0];
        const curY = coords[1];
        this.field[curX][curY].isHidden = false;
      }
    },
    setVisibilityForArea(x, y, r) {
      if (!this.enableFogOfWar) return;

      // Make all area ivisible
      for (let curX = x - r; curX <= x + r; curX++) {
        for (let curY = y - r; curY <= y + r; curY++) {
          if (this.fieldEngine.areExistingCoords(curX, curY)) {
            this.field[curX][curY].isHidden = true;
          }
        }
      }
      // Set visibility
      for (let curX = x - r - this.fogOfWarRadius; curX <= x + r + this.fogOfWarRadius; curX++) {
          for (let curY = y - r - this.fogOfWarRadius; curY <= y + r + this.fogOfWarRadius; curY++) {
            if (
              this.fieldEngine.areExistingCoords(curX, curY) &&
              this.fieldEngine.isVisibleObj(curX, curY, this.currentPlayer)
            ) {
              this.addVisibilityForCoords(curX, curY);
            }
          }
        }
    },

    // Save-load operations
    saveState() {
      console.log('Save state');
      for (const field of FIELDS_TO_SAVE) {
        localStorage.setItem(field, JSON.stringify(this[field]));
      }
    },
    loadFieldOrGenerateNewField() {
      if (this.loadGame) {
        const fieldFromStorage = localStorage.getItem('field');
        // TODO: Fix JSON.parse to avoid warning - convert units and buildings to the correct type
        this.field = JSON.parse(fieldFromStorage);
        console.log(this.field);
      }
      else {
        this.field = this.engine.generateField();
      }
    },
    loadOrCreatePlayers() {
      if (this.loadGame) {
        const players = localStorage.getItem('players');
        // TODO: Fix JSON.parse to avoid warning - convert units and buildings to the correct type
        this.players = JSON.parse(players);
      }
      else {
        this.players = createPlayers(this.humanPlayersNum, this.botPlayersNum);
      }
    },

    // Process bot moves
    startTurn() {
      this.setVisibility();
      if (this.players[this.currentPlayer]._type === Models.PlayerTypes.BOT) {
        this.makeBotMove();
      }
      else {
        // TODO: Refactor it
        this.$refs.gameGridRef.initTurn();
        if (this.humanPlayersNum === 1) {
          this.state = this.STATES.play;
        }
      }
    },
    // Bot move high level logic
    makeBotMove() {
      this.state = this.STATES.play;
      console.log(`Player ${this.currentPlayer + 1} turn start`);
      this.unitCoordsArr = this.getCurrentUnitCoords();
      // TODO: Choose order of moves (calculate, which move is more profitable) - ideal algorhytm
      while (this.unitCoordsArr.length > 0)
        this.botEngine.makeBotUnitMove(this.unitCoordsArr, this.currentPlayer, this.moveUnit);
      this.processEndTurn();
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
      let totalCtr = 0;
      let activeCtr = 0;
      const coordsArr = [];
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          const unit = this.field[x][y].unit;
          if (unit && unit.player === this.currentPlayer) {
            totalCtr++;
            if (!unit.hasMoved) {
              coordsArr.push([x, y]);
              activeCtr++;
            }
          }
        }
      }
      console.log('getCurrentActiveUnits finish');
      return {active: activeCtr, total: totalCtr, coordsArr: coordsArr};
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
</style>
