<template>
  <ReadyLabel
    v-if="state === STATES.ready"
    :onClickAction="readyBtnClick"
    :currentPlayer="currentPlayer"
    :isActivePlayer="players[currentPlayer].active"
    :isPlayerInformedLose="players[currentPlayer].informed_lose"
    :areAllHumanPlayersEliminated="humanPhase === HUMAN_PHASES.all_eliminated"
    :winner="prepareWinner()"
    :lastPlayer="prepareLastPlayer()"
  />
  <GameGrid
    ref="gameGridRef"
    :is-hidden="state === STATES.ready"
    :fog-of-war-radius="fogOfWarRadius"
    :enable-fog-of-war="enableFogOfWar"
    :enable-scout-mode="enableScoutMode"
    :hide-enemy-speed="hideEnemySpeed"
    :field="field"
    :currentPlayer="currentPlayer"
    @moveUnit="moveUnit"
  />
  <InfoLabel
    v-if="state === STATES.play"
    :currentPlayer="currentPlayer"
    :players="this.players"
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
import { createPlayers, createNewUnit } from "@/game/helpers";
import {FIELDS_TO_SAVE, GAME_STATUS_FIELDS, SCORE_MOD} from "@/game/const";

import emitter from '@/game/eventBus';

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
    scoresToWin: Number,
    sectorsNum: Number,
    enableFogOfWar: Boolean,
    fogOfWarRadius: Number,
    enableScoutMode: Boolean,
    minSpeed: Number,
    maxSpeed: Number,
    maxUnitsNum: Number,
    hideEnemySpeed: Boolean,
    killAtBirth: Boolean,
    enableUndo: Boolean,
    loadGame: Boolean,
  },
  data() {
    // Game states
    const STATES = {
      ready: 'ready',  // Show label before start of turn
      play: 'play',  // Turn
    }
    const WIN_PHASES = {
      progress: 'progress',  // Play
      has_winner: 'has_winner',  // Somebody won
      informed: 'informed',  // Message was output
    }
    const HUMAN_PHASES = {
      progress: 'progress',  // Play
      all_eliminated: 'all_eliminated',  // All human players eliminated
      informed: 'informed',  // Message was output
    }
    const LAST_PLAYER_PHASES = {
      progress: 'progress',  // Play
      last_player: 'last_player',  // The only player left in the game
      informed: 'informed',  // Message was output
    }
    const playersNum = this.humanPlayersNum + this.botPlayersNum;
    return {
      STATES,
      WIN_PHASES,
      HUMAN_PHASES,
      LAST_PLAYER_PHASES,
      playersNum,
      players: [],
      currentPlayer: 0,
      field: null,
      state: STATES.ready,
      winPhase: WIN_PHASES.progress,
      winner: null,
      humanPhase: HUMAN_PHASES.progress,
      lastPlayerPhase: LAST_PLAYER_PHASES.progress,
      lastPlayer: null,
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
      this.minSpeed,
      this.maxSpeed,
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
    if (this.loadGame) {
      this.loadGameStatus()
    }
    this.fieldEngine = new FieldEngine(
      this.field,
      this.width,
      this.height,
      this.fogOfWarRadius,
      this.players,
    );
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
  mounted() {
    emitter.on('makeBotMove', this.makeBotMove);
    emitter.on('processEndTurn', this.processEndTurn);
    emitter.on('startTurn', this.startTurn);

    this.startTurn();
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
      this.checkEndOfGame();
      if (this.doesVisibilityMakeSense()) {
        // Recalculate visibility in area unit moved from
        this.setVisibilityForArea(x0, y0, this.fogOfWarRadius);
        // Add visibility to area unit moved to
        this.addVisibilityForCoords(x1, y1);
      }
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

      do {
        this.currentPlayer += 1;
        this.currentPlayer %= this.playersNum;
        if (this.currentPlayer === 0) {
          this.saveState();
          if (this.humanPhase === this.HUMAN_PHASES.progress && this.areAllHumanPlayersEliminated()) {
            this.humanPhase = this.HUMAN_PHASES.all_eliminated;
          }
          if (this.lastPlayerPhase === this.LAST_PLAYER_PHASES.progress) {
            const lastPlayerIdx = this.getLastPlayerIdx();
            // TODO: Check it in the end of turn (not only for the first player
            if (lastPlayerIdx !== null) {
              this.lastPlayerPhase = this.LAST_PLAYER_PHASES.last_player;
              this.lastPlayer = lastPlayerIdx;
            }
          }
          if (this.humanPhase !== this.HUMAN_PHASES.progress) {
            break;
          }
        }
      }
      while (!this.players[this.currentPlayer].active);

      emitter.emit('startTurn');
    },
    startTurn() {
      // Restore all unit's move points and produce new units
      let buildingsNum = 0;
      let unitsNum = 0;
      let producedNum = 0;
      const killedBefore = this.players[this.currentPlayer].killed;
      const unitsToCreate = [];
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          if (this.field[x][y].unit) {
            this.field[x][y].unit.hasMoved = false;
            if (this.field[x][y].unit.player === this.currentPlayer) {
              unitsNum++;
              // this.fieldEngine.changeScore(this.currentPlayer, SCORE_MOD.unit);
              // console.log('~unit');
            }
          }
          if (this.field[x][y].building && this.field[x][y].building.player === this.currentPlayer) {
            buildingsNum++;
            // this.fieldEngine.changeScore(this.currentPlayer, SCORE_MOD.building);
            // console.log('~building');
            if (!this.field[x][y].unit) {
              unitsToCreate.push(this.field[x][y])
              // this.field[x][y].unit = createNewUnit(this.currentPlayer, this.minSpeed, this.maxSpeed);
              producedNum++;
              // this.fieldEngine.changeScore(this.currentPlayer, SCORE_MOD.produce);
              console.log('~produce');
              if (this.killAtBirth) {
                this.fieldEngine.killNeighbours(this.field, x, y, this.currentPlayer, false);
              }
            }
          }
        }
      }
      console.log('%', unitsNum);
      console.log('%', producedNum);
      console.log('%', this.maxUnitsNum);
      if (unitsNum + producedNum <= this.maxUnitsNum)
        for (let cell of unitsToCreate) {
          cell.unit = createNewUnit(this.currentPlayer, this.minSpeed, this.maxSpeed);
        }

      // Count score
      this.fieldEngine.changeScore(this.currentPlayer, SCORE_MOD.building * buildingsNum);
      console.log('~ buildings:', SCORE_MOD.building * buildingsNum);
      this.fieldEngine.changeScore(this.currentPlayer, SCORE_MOD.unit * unitsNum);
      console.log('~ units:', SCORE_MOD.unit * unitsNum);
      this.checkEndOfGame();
      this.fieldEngine.changeScore(this.currentPlayer, SCORE_MOD.produce * producedNum);
      console.log('~ produced:', SCORE_MOD.produce * producedNum);
      this.checkEndOfGame();
      const killed = this.players[this.currentPlayer].killed - killedBefore;
      this.fieldEngine.changeScore(this.currentPlayer, SCORE_MOD.kill * killed);
      console.log('~ killed:', SCORE_MOD.kill * killed);
      this.checkEndOfGame();
      console.log('Score:')
      for (const player of this.players) {
        console.log(player.score);
      }
      if (buildingsNum === 0 && unitsNum === 0) {
        this.players[this.currentPlayer].active = false;
      }

      if (this.doesVisibilityMakeSense()) {
        this.setVisibility();
      }
      else {
        this.showField();
      }

      if (this.players[this.currentPlayer]._type === Models.PlayerTypes.BOT) {
        emitter.emit('makeBotMove');
      }
      else {
        // TODO: Refactor it
        this.$refs.gameGridRef.initTurn();
        if (
            (
                this.humanPlayersNum === 1 &&
                this.players[this.currentPlayer].active &&
                this.winPhase !== this.WIN_PHASES.has_winner &&
                this.lastPlayerPhase !== this.LAST_PLAYER_PHASES.last_player
            ) ||
            (
                this.humanPhase === this.HUMAN_PHASES.informed &&
                this.lastPlayerPhase !== this.LAST_PLAYER_PHASES.last_player
            )
        ) {
          this.state = this.STATES.play;
        }
      }
    },
    readyBtnClick() {
      this.state = this.STATES.play;
      if (this.humanPhase === this.HUMAN_PHASES.all_eliminated) {
        this.humanPhase = this.HUMAN_PHASES.informed;
      }
      if (this.winPhase === this.WIN_PHASES.has_winner) {
        this.winPhase = this.WIN_PHASES.informed;
      }
      if (this.lastPlayerPhase === this.LAST_PLAYER_PHASES.last_player) {
        this.lastPlayerPhase = this.LAST_PLAYER_PHASES.informed;
      }
      if (!this.players[this.currentPlayer].active && !this.players[this.currentPlayer].informed_lose) {
        this.players[this.currentPlayer].informed_lose = true;
      }

    },
    checkEndOfGame() {
      if (this.winPhase !== this.WIN_PHASES.progress) return;
      let endOfGame = true;
      // TODO: Replace with last player check
      for (const playerIdx in this.players) {
        if (Number(playerIdx) === this.currentPlayer) continue;
        const player = this.players[playerIdx];
        endOfGame &= !player.active;
      }
      console.log(endOfGame);
      if (
        endOfGame ||
        this.scoresToWin > 0 && this.players[this.currentPlayer].score >= this.scoresToWin
      ) {
//         alert(
//           `Player ${this.currentPlayer + 1} wins!\n
// To start new game refresh the page.
// Or you may continue playing here.`
//         );
        console.log(`Player ${this.currentPlayer + 1} wins!`);
        this.winPhase = this.WIN_PHASES.has_winner;
        this.winner = this.currentPlayer;
      }
    },
    findNextUnit() {
      const coordsArr = this.getCurrentActiveUnits().coordsArr;
      if (coordsArr.length === 0) return;
      this.$refs.gameGridRef.selectNextUnit(coordsArr);
    },

    // Visibility helpers
    doesVisibilityMakeSense() {
      return this.enableFogOfWar && this.players[this.currentPlayer].active
    },
    addVisibilityForCoords(x, y) {
      // if (!this.enableFogOfWar) return;
      for (let curX = x - this.fogOfWarRadius; curX <= x + this.fogOfWarRadius; curX++) {
        for (let curY = y - this.fogOfWarRadius; curY <= y + this.fogOfWarRadius; curY++) {
          if (this.fieldEngine.areExistingCoords(curX, curY))
            this.field[curX][curY].isHidden = false;
        }
      }
    },
    removeVisibility() {
      // if (!this.enableFogOfWar) return;
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.field[curX][curY].isHidden = true;
        }
      }
    },
    showField() {
      // if (!this.enableFogOfWar) return;
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.field[curX][curY].isHidden = false;
        }
      }
    },
    setVisibility() {
      // if (!this.enableFogOfWar) return;

      this.removeVisibility();
      const visibilitySet = this.fieldEngine.getCurrentVisibilitySet(this.currentPlayer);
      for (const [curX, curY] of visibilitySet) {
        this.field[curX][curY].isHidden = false;
      }
    },
    setVisibilityForArea(x, y, r) {
      // if (!this.enableFogOfWar) return;

      // Make all area invisible
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
      // TODO: Save only game situation, not game settings
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
        // TODO: Fix JSON.parse to avoid warning - convert players to the correct type
        this.players = JSON.parse(players);
        // Choose current player
        for (let idx = 0; idx < this.players.length; idx++) {
          if (this.players[idx].active) {
            this.currentPlayer = idx;
            break;
          }
        }
        for (let player of this.players) {
          player.informed_lose = false;
        }
      }
      else {
        this.players = createPlayers(this.humanPlayersNum, this.botPlayersNum);
      }
    },
    loadGameStatus() {
      for (const field of GAME_STATUS_FIELDS) {
        this[field] = JSON.parse(localStorage.getItem(field));
      }
      if (this.humanPhase === this.HUMAN_PHASES.informed) {
        this.humanPhase = this.HUMAN_PHASES.all_eliminated;
      }
      if (this.winPhase === this.WIN_PHASES.informed) {
        this.winPhase = this.WIN_PHASES.has_winner;
      }
      if (this.lastPlayerPhase === this.LAST_PLAYER_PHASES.informed) {
        this.lastPlayerPhase = this.LAST_PLAYER_PHASES.last_player;
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
      emitter.emit('processEndTurn');
    },

    // Helpers
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
    areAllHumanPlayersEliminated() {
      return !this.players.filter(p => p._type === Models.PlayerTypes.HUMAN).filter(p => p.active).length
    },
    getLastPlayerIdx() {
      const activePlayers = this.players.filter(p => p.active)
      if (activePlayers.length === 1) {
        for (let idx = 0; idx < this.players.length; idx++) {
          if (this.players[idx].active) {
            return idx;
          }
        }
      }
      return null;
    },
    prepareWinner() {
      if (this.winPhase !== this.WIN_PHASES.has_winner) return null;
      return this.winner;
    },
    prepareLastPlayer() {
      if (this.lastPlayerPhase !== this.LAST_PLAYER_PHASES.last_player) return null;
      return this.lastPlayer;
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
