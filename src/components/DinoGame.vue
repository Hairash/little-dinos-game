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
import ReadyLabel from '@/components/ReadyLabel.vue';
import GameGrid from '@/components/GameGrid.vue';
import InfoLabel from '@/components/InfoLabel.vue';
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
    visibilitySpeedRelation: Boolean,
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
      this.fogOfWarRadius,
      this.visibilitySpeedRelation,
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
      this.maxUnitsNum,
      this.killAtBirth,
      this.visibilitySpeedRelation,
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
    emitter.on('moveUnit', this.emitMoveUnit);

    this.startTurn();
  },
  beforeUnmount() {
    emitter.off('makeBotMove', this.makeBotMove);
    emitter.off('processEndTurn', this.processEndTurn);
    emitter.off('startTurn', this.startTurn);
    emitter.off('moveUnit', this.moveUnit);
  },
  methods: {
    // Main events
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
    emitMoveUnit(coordsDict) {
      this.moveUnit(coordsDict.fromCoords, coordsDict.toCoords);
    },
    // Change field after unit's move
    moveUnit(fromCoords, toCoords) {
      this.storeStateIfNeeded();

      const [x0, y0] = fromCoords;
      const [x1, y1] = toCoords;
      const unit = this.field[x0][y0].unit;

      this.fieldEngine.moveUnit(x0, y0, x1, y1, unit);
      const buildingCaptured = this.fieldEngine.captureBuildingIfNeeded(x1, y1, unit.player);
      this.fieldEngine.killNeighbours(x1, y1, unit.player);

      this.checkEndOfGame();
      if (this.doesVisibilityMakeSense()) {
        // Recalculate visibility in area unit moved from
        this.setVisibilityForArea(x0, y0, unit.visibility);
        const visibility = buildingCaptured ? Math.max(unit.visibility, this.fogOfWarRadius): unit.visibility;
        // Add visibility to area unit moved to
        this.addVisibilityForCoords(x1, y1, visibility);
      }
      console.log('moveUnit finish');
    },
    processEndTurn() {
      if (this.state === this.STATES.ready) return;
      this.state = this.STATES.ready;
      this.storeStateIfNeeded();
      this.selectNextPlayerAndCheckPhases();
      emitter.emit('startTurn');
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

    // Global helpers
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
      if (
        this.getLastPlayerIdx() === this.currentPlayer ||
        this.scoresToWin > 0 && this.players[this.currentPlayer].score >= this.scoresToWin
      ) {
        this.winPhase = this.WIN_PHASES.has_winner;
        this.winner = this.currentPlayer;
        if (this.players[this.currentPlayer]._type === Models.PlayerTypes.HUMAN) {
          this.state = this.STATES.ready;
        }
      }
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
    addVisibilityForCoords(x, y, fogRadius) {
      // TODO: Think about common naming (visibility instead of fogRadius)
      for (let curX = x - fogRadius; curX <= x + fogRadius; curX++) {
        for (let curY = y - fogRadius; curY <= y + fogRadius; curY++) {
          if (this.fieldEngine.areExistingCoords(curX, curY))
            this.field[curX][curY].isHidden = false;
        }
      }
    },
    removeVisibility() {
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.field[curX][curY].isHidden = true;
        }
      }
    },
    showField() {
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.field[curX][curY].isHidden = false;
        }
      }
    },
    setVisibility() {
      this.removeVisibility();
      const visibilitySet = this.fieldEngine.getCurrentVisibilitySet(this.currentPlayer);
      for (const [curX, curY] of visibilitySet) {
        // console.log('setVisibility', curX, curY);
        this.field[curX][curY].isHidden = false;
      }
    },
    setVisibilityForArea(x, y, r) {
      // console.log(`setVisibilityForArea (${x}, ${y})  r: ${r}`)
      // Make all area invisible
      for (let curX = x - r; curX <= x + r; curX++) {
        for (let curY = y - r; curY <= y + r; curY++) {
          if (this.fieldEngine.areExistingCoords(curX, curY)) {
            this.field[curX][curY].isHidden = true;
          }
        }
      }
      // Set visibility
      // TODO: Change 10 -> maxSpeed
      for (let curX = x - r - this.maxSpeed; curX <= x + r + this.maxSpeed; curX++) {
          for (let curY = y - r - this.maxSpeed; curY <= y + r + this.maxSpeed; curY++) {
            let curR = 0;
            // console.log(`Current check: (${curX}, ${curY})`)
            if (
              this.fieldEngine.areExistingCoords(curX, curY) &&
              (curR = this.fieldEngine.getVisibleObjRadius(curX, curY, this.currentPlayer, x, y, r))
            ) {
              // console.log(`Visible object: (${curX}, ${curY})  r: ${curR}`)
              this.addVisibilityForCoords(curX, curY, curR);
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

    // Unit helpers
    findNextUnit() {
      const coordsArr = this.getCurrentActiveUnits().coordsArr;
      if (coordsArr.length === 0) return;
      emitter.emit('selectNextUnit', coordsArr);
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
      return {active: activeCtr, total: totalCtr, coordsArr: coordsArr};
    },

    // State helpers
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
  },
}
</script>
