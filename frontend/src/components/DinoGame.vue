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
    :cellSize="cellSize"
  />
  <InfoPanel
    v-if="state === STATES.play"
    :current-player="currentPlayer"
    :players="players"
    :current-stats="getCurrentStats()"
    :handle-end-turn-btn-click="processEndTurn"
    :handle-unit-click="findNextUnit"
    :cellSize="cellSize"
    :handle-change-cell-size="changeCellSize"
    :handle-exit-btn-click="() => this.state = this.STATES.exitDialog"
    :are-all-units-on-buildings="this.fieldEngine.areAllUnitsOnBuildings(this.currentPlayer)"
  />
  <ExitDialog
    v-if="state === STATES.exitDialog"
    :handle-cancel="() => state = STATES.play"
    :handle-confirm="exitGame"
  />
  <!-- Debug: Current state is {{ state }} -->
</template>

<script>
import ReadyLabel from '@/components/ReadyLabel.vue';
import GameGrid from '@/components/GameGrid.vue';
import InfoPanel from '@/components/InfoPanel.vue';
import ExitDialog from '@/components/ExitDialog.vue';
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
    InfoPanel,
    ExitDialog,
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
    speedMinVisibility: Number,
    maxUnitsNum: Number,
    maxBasesNum: Number,
    unitModifier: Number,
    baseModifier: Number,
    buildingRates: Object,
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
      exitDialog: 'exitDialog',  // Exit dialog
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
      cellSize: 30,
      tempVisibilityCoords: new Set(),  // Set of coord pairs (x, y) of obelisks that will be shown next turn
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
      this.speedMinVisibility,
      this.fogOfWarRadius,
      this.visibilitySpeedRelation,
      this.buildingRates,
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
      this.speedMinVisibility,
      this.maxUnitsNum,
      this.maxBasesNum,
      this.unitModifier,
      this.baseModifier,
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
      if (e.key === 'e' && this.state === this.STATES.play) this.processEndTurn();
      // TODO: Add test mode
      // if (e.key === 'Enter') this.makeBotUnitMove();
    });
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      // this.processEndTurn();
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
    emitter.on('addTempVisibilityForCoords', this.emitAddTempVisibilityForCoords);

    if (!this.loadGame) {
      this.initPlayersScrollCoords();
    }
    this.startTurn();
  },
  beforeUnmount() {
    emitter.off('makeBotMove', this.makeBotMove);
    emitter.off('processEndTurn', this.processEndTurn);
    emitter.off('startTurn', this.startTurn);
    emitter.off('moveUnit', this.moveUnit);
    emitter.off('addTempVisibilityForCoords', this.emitAddTempVisibilityForCoords);
  },
  methods: {
    // Main events
    handleExitClick() {
      this.state = this.STATES.exitDialog;
    },
    startTurn() {
      // const killedBefore = this.players[this.currentPlayer].killed;
      const counters = this.fieldEngine.restoreAndProduceUnits(this.currentPlayer);
      // this.updatePlayerScore(
      //   killedBefore,
      //   counters.buildingsNum,
      //   counters.unitsNum,
      //   counters.producedNum,
      // );

      if (counters.buildingsNum === 0 && counters.unitsNum === 0) {
        this.players[this.currentPlayer].active = false;
      }

      this.setVisibilityStartTurn();

      if (this.players[this.currentPlayer]._type === Models.PlayerTypes.BOT) {
        emitter.emit('makeBotMove');
      }
      else {
        emitter.emit('initTurn', this.players[this.currentPlayer].scrollCoords);
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
      const action = this.fieldEngine.getActionTriggered(x1, y1);
      if (action) {
        emitter.emit('setAction', action);
      }
      this.fieldEngine.killNeighbours(x1, y1, unit.player);

      this.checkEndOfGame();
      if (this.doesVisibilityMakeSense()) {
        // Recalculate visibility in area unit moved from
        this.setVisibilityForArea(x0, y0, unit.visibility);
        const visibility = buildingCaptured ? Math.max(unit.visibility, this.fogOfWarRadius): unit.visibility;
        // Add visibility to area unit moved to
        this.addVisibilityForCoords(x1, y1, visibility);
      }
      // console.log('moveUnit finish');
    },
    processEndTurn() {
      if (this.state === this.STATES.ready) return;
      this.state = this.STATES.ready;
      emitter.emit('saveCoords', this.players[this.currentPlayer]);
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
        this.scoresToWin > 0 && this.players[this.currentPlayer].score >= this.scoresToWin ||
        this.fieldEngine.areAllPlayersOccupied(this.currentPlayer)
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
    changeCellSize(delta) {
      this.cellSize = Math.min(Math.max(10, this.cellSize + delta), 70);
      console.log(this.cellSize);
    },
    initPlayersScrollCoords() {
      for (let playerNum = 0; playerNum < this.players.length; playerNum++) {
        const coords = this.getCurrentUnitCoords(playerNum)[0];
        // console.log('coords', coords);
        this.players[playerNum].scrollCoords = this.$refs.gameGridRef.getScrollCoordsByCell(coords);
      }
    },

    // Visibility helpers
    doesVisibilityMakeSense() {
      return this.enableFogOfWar && this.players[this.currentPlayer].active
    },
    emitAddTempVisibilityForCoords(data) {
      this.addTempVisibilityForCoords(data.x, data.y, data.fogRadius);
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
    addTempVisibilityForCoords(x, y, fogRadius) {
      for (let curX = x - fogRadius; curX <= x + fogRadius; curX++) {
        for (let curY = y - fogRadius; curY <= y + fogRadius; curY++) {
          if (this.fieldEngine.areExistingCoords(curX, curY)) {
            this.field[curX][curY].isHidden = false;
            this.tempVisibilityCoords.add(`${curX},${curY}`);
          }
        }
      }
    },
    removeVisibility() {
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.field[curX][curY].isHidden = true;
        }
      }
      this.tempVisibilityCoords = new Set();
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
          if (
            this.fieldEngine.areExistingCoords(curX, curY) &&
            !this.tempVisibilityCoords.has(`${curX},${curY}`)
          ) {
            this.field[curX][curY].isHidden = true;
          }
        }
      }
      // Set visibility
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
    // TODO: Refactor this to use after move
    // setVisibilityAfterMove(x0, y0, x1, y1) {
    //   if (this.doesVisibilityMakeSense()) {
    //     // Recalculate visibility in area unit moved from
    //     this.setVisibilityForArea(x0, y0, this.fogOfWarRadius);
    //     // Add visibility to area unit moved to
    //     this.addVisibilityForCoords(x1, y1);
    //   }
    // },
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
        if (field === 'field') {
          const _field = this.field.map(row => row.map(cell => ({ ...cell, isHidden: true })));
          localStorage.setItem(field, JSON.stringify(_field));
        }
        else if (this[field] !== undefined) {
          localStorage.setItem(field, JSON.stringify(this[field]));
        }
      }
    },
    loadFieldOrGenerateNewField() {
      if (this.loadGame) {
        const fieldFromStorage = localStorage.getItem('field');
        // TODO: Fix JSON.parse to avoid warning - convert units and buildings to the correct type
        this.field = JSON.parse(fieldFromStorage);
        // console.log(this.field);
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
      console.log(`Bot player ${this.currentPlayer + 1} turn`);
      this.unitCoordsArr = this.getCurrentUnitCoords();
      // TODO: Choose order of moves (calculate, which move is more profitable) - ideal algorithm
      // TODO: Get visibility here and add visibility get from obelisks on each unit's move
      while (this.unitCoordsArr.length > 0)
        this.botEngine.makeBotUnitMove(this.unitCoordsArr, this.currentPlayer, this.moveUnit);
      emitter.emit('processEndTurn');
    },

    // Unit helpers
    findNextUnit() {
      // TODO: Think how to refactor this
      const coordsArr = this.getCurrentStats().units.coordsArr;
      if (coordsArr.length === 0) return;
      emitter.emit('selectNextUnit', coordsArr);
    },
    getCurrentUnitCoords(playerNum=this.currentPlayer) {
      const coordsArr = [];
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          const unit = this.field[x][y].unit;
          if (unit && unit.player === playerNum && !unit.hasMoved) {
            coordsArr.push([x, y]);
          }
        }
      }
      return coordsArr;
    },
    getCurrentStats() {
      const stats = {
        units: {
          active: 0,
          total: 0,
          max: this.maxUnitsNum,
          coordsArr: [],
        },
        towers: {
          total: 0,
          max: this.maxBasesNum,
        },
      };
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          const unit = this.field[x][y].unit;
          const building = this.field[x][y].building;
          if (unit && unit.player === this.currentPlayer) {
            stats.units.total++;
            if (!unit.hasMoved) {
              stats.units.coordsArr.push([x, y]);
              stats.units.active++;
            }
            if (building && building._type === Models.BuildingTypes.HABITATION && this.maxUnitsNum > 0) {
              stats.units.max += this.unitModifier;
            }
            if (building && building._type === Models.BuildingTypes.STORAGE && this.maxBasesNum > 0) {
              stats.towers.max += this.baseModifier;
            }
          }
          if (building && building._type === Models.BuildingTypes.BASE && building.player === this.currentPlayer) {
            stats.towers.total++;
          }
        }
      }
      return stats
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
    exitGame() {
      window.location.reload();
    },
  },
}
</script>
