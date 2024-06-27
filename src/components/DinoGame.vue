<template>
  <ReadyLabel
    v-if="state === STATES.ready"
    :on-click-action="readyBtnClick"
    :current-player="currentPlayer"
    :is-active-player="players[currentPlayer].active"
    :is-player-informed-lose="players[currentPlayer].informed_lose"
    :are-all-human-players-eliminated="humanPhase === HUMAN_PHASES.all_eliminated"
    :winner="prepareWinner()"
    :last-player="prepareLastPlayer()"
  />
  <GameGrid
    ref="gameGridRef"
    :is-hidden="state === STATES.ready"
    :fog-of-war-radius="fogOfWarRadius"
    :enable-fog-of-war="enableFogOfWar"
    :enable-scout-mode="enableScoutMode"
    :hide-enemy-speed="hideEnemySpeed"
    :field="field"
    :current-player="currentPlayer"
    @moveUnit="moveUnit"
  />
  <InfoLabel
    v-if="state === STATES.play"
    :current-player="currentPlayer"
    :players="players"
    :get-current-active-units="getCurrentActiveUnits"
    :handle-end-turn-btn-click="processEndTurn"
    :handle-img-click="findNextUnit"
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
import { FIELDS_TO_SAVE, GAME_STATUS_FIELDS, SCORE_MOD } from "@/game/const";

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
      this.minSpeed,
      this.maxSpeed,
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
      this.storeStateIfNeeded();

      const [x0, y0] = fromCoords;
      const [x1, y1] = toCoords;
      const unit = this.field[x0][y0].unit;

      this.fieldEngine.moveUnit(x0, y0, x1, y1, unit);
      this.fieldEngine.captureBuildingIfNeeded(x1, y1, unit.player);
      this.fieldEngine.killNeighbours(x1, y1, unit.player);

      this.checkEndOfGame();
      this.setVisibilityAfterMove(x0, y0, x1, y1);
    },
    processEndTurn() {
      if (this.state === this.STATES.ready) return;
      this.state = this.STATES.ready;
      this.storeStateIfNeeded();
      this.selectNextPlayerAndCheckPhases();
      emitter.emit('startTurn');
    },
    startTurn() {
      const killedBefore = this.players[this.currentPlayer].killed;
      const counters = this.fieldEngine.restoreAndProduceUnits(this.currentPlayer);
      this.updatePlayerScore(
        killedBefore,
        counters.buildingsNum,
        counters.unitsNum,
        counters.producedNum,
      );

      if (counters.buildingsNum === 0 && counters.unitsNum === 0) {
        this.players[this.currentPlayer].active = false;
      }

      this.setVisibilityStartTurn();

      if (this.players[this.currentPlayer]._type === Models.PlayerTypes.BOT) {
        emitter.emit('makeBotMove');
      }
      else {
        emitter.emit('initTurn');
        if (this.checkSkipReadyLabel()) {
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
    updatePlayerScore(killedBefore, buildingsNum, unitsNum, producedNum) {
      this.fieldEngine.changeScore(this.currentPlayer, SCORE_MOD.building * buildingsNum);
      this.fieldEngine.changeScore(this.currentPlayer, SCORE_MOD.unit * unitsNum);
      this.checkEndOfGame();
      this.fieldEngine.changeScore(this.currentPlayer, SCORE_MOD.produce * producedNum);
      this.checkEndOfGame();
      const killed = this.players[this.currentPlayer].killed - killedBefore;
      this.fieldEngine.changeScore(this.currentPlayer, SCORE_MOD.kill * killed);
      this.checkEndOfGame();
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
    selectNextPlayerAndCheckPhases() {
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
            // TODO: ? Check it in the end of turn (not only for the first player)
            if (lastPlayerIdx !== null) {
              this.lastPlayerPhase = this.LAST_PLAYER_PHASES.last_player;
              this.lastPlayer = lastPlayerIdx;
            }
          }
          // If all human players eliminated, they may observe bot fight
          if (this.humanPhase !== this.HUMAN_PHASES.progress) {
            break;
          }
        }
      }
      while (!this.players[this.currentPlayer].active);
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
      console.log('setVisibility start')

      this.removeVisibility();
      const visibilitySet = this.fieldEngine.getCurrentVisibilitySet(this.currentPlayer);
      for (const [curX, curY] of visibilitySet) {
        this.field[curX][curY].isHidden = false;
      }
      console.log('setVisibility finish')
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
    setVisibilityAfterMove(x0, y0, x1, y1) {
      if (this.doesVisibilityMakeSense()) {
        // Recalculate visibility in area unit moved from
        this.setVisibilityForArea(x0, y0, this.fogOfWarRadius);
        // Add visibility to area unit moved to
        this.addVisibilityForCoords(x1, y1);
      }
    },
    setVisibilityStartTurn() {
      if (this.doesVisibilityMakeSense()) {
        this.setVisibility();
      }
      else {
        this.showField();
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
    checkSkipReadyLabel() {
      return (
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
      )
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
    },
    storeStateIfNeeded() {
      if (this.enableUndo) {
        this.prevField = structuredClone(this.field);
        this.prevPlayer = this.currentPlayer;
      }
    }
  },
}
</script>

<style>
</style>
