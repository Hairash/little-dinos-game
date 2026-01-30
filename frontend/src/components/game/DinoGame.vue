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
    :field="localField"
    :current-player="currentPlayer"
    :cellSize="cellSize"
    :unitModifier="unitModifier"
    :baseModifier="baseModifier"
    :current-stats="getCurrentStats()"
    :menu-open="menuOpen"
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
    :field="localField"
    :field-engine="fieldEngine"
    :enable-fog-of-war="enableFogOfWar"
    :min-speed="minSpeed"
    :max-speed="maxSpeed"
    @menuOpen="handleMenuOpen"
  />
  <ExitDialog
    v-if="state === STATES.exitDialog"
    :handle-cancel="() => state = STATES.play"
    :handle-confirm="exitGame"
  />
  <!-- Notifications -->
  <div id="notifications-container">
    <div
      v-for="notification in notifications"
      :key="notification.id"
      :class="['notification', `notification-${notification.type}`]"
      :style="notification.type === 'turn' ? { '--player-color': getPlayerColor(notification.playerOrder) } : {}"
      @click="dismissNotification(notification.id)"
    >
      {{ notification.message }}
    </div>
  </div>
</template>

<script>
/* eslint-disable vue/no-mutating-props */
// Note: In single-player mode, the field is generated locally and stored in localField.
// The field prop is used in multiplayer mode when field comes from the backend.
import ReadyLabel from '@/components/game/ReadyLabel.vue';
import GameGrid from '@/components/game/GameGrid.vue';
import InfoPanel from '@/components/game/InfoPanel.vue';
import ExitDialog from '@/components/dialogs/ExitDialog.vue';
import Models from "@/game/models";
import { CreateFieldEngine } from "@/game/createFieldEngine";
import { WaveEngine } from "@/game/waveEngine";
import { FieldEngine } from "@/game/fieldEngine";
import { BotEngine } from "@/game/botEngine";
import { createPlayers, getPlayerColor, normalizeField } from "@/game/helpers";
import { FIELDS_TO_SAVE, GAME_STATUS_FIELDS, SCORE_MOD } from "@/game/const";
import { gameCoreMixin } from "@/game/mixins/gameCoreMixin";

import emitter from '@/game/eventBus';

export default {
  name: 'DinoGame',
  mixins: [gameCoreMixin],
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
    // eslint-disable-next-line vue/no-dupe-keys
    // Note: field is intentionally both a prop and data property - the data property shadows the prop
    // when in single-player mode (generates field locally), but uses the prop in multiplayer mode
    field: Array,  // Optional: pre-generated field from backend (for multiplayer)
  },
  data() {
    // Phase constants (single-player specific)
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
      // STATES and cellSize come from gameCoreMixin
      WIN_PHASES,
      HUMAN_PHASES,
      LAST_PLAYER_PHASES,
      playersNum,
      players: [],
      currentPlayer: 0,
      // Local field storage (used by gameCoreMixin._getField())
      // In single-player mode, field is generated locally and stored here
      // In multiplayer mode (when field prop is provided), a copy is stored here
      // Always initialized in loadFieldOrGenerateNewField() during created()
      localField: null,
      // Mixin compatibility placeholders
      localSettings: null,
      settings: null,
      state: 'ready',  // Initial state (STATES.ready)
      winPhase: WIN_PHASES.progress,
      winner: null,
      humanPhase: HUMAN_PHASES.progress,
      lastPlayerPhase: LAST_PLAYER_PHASES.progress,
      lastPlayer: null,
      // TODO: Make prevState object
      prevField: null,
      prevPlayer: 0,
      unitCoordsArr: [],
      tempVisibilityCoords: new Set(),  // Set of coord pairs (x, y) of obelisks that will be shown next turn
      // Handler references for cleanup (to prevent memory leaks)
      keyupHandlerRef: null,
      contextmenuHandlerRef: null,
      mouseupHandlerRef: null,
      menuOpen: false,
      notifications: [],  // Array of notification objects: { id, message, type, playerOrder }
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
      this.localField,
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
      this.localField,
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
      this.localField,
      this.width,
      this.height,
      this.enableFogOfWar,
      this.fieldEngine,
      this.waveEngine,
    );
    // console.log(this.players);
    // Store handler references for cleanup in beforeUnmount
    this.keyupHandlerRef = (e) => {
      if (e.key === 'Enter') this.state = this.STATES.play;
      if (e.key === 'e' && this.state === this.STATES.play) this.processEndTurn();
      // TODO: Add test mode
      // if (e.key === 'Enter') this.makeBotUnitMove();
    };
    this.contextmenuHandlerRef = (e) => {
      e.preventDefault();
      // this.processEndTurn();
    };
    this.mouseupHandlerRef = (e) => {
      e.preventDefault();
      if (this.enableUndo && e.button === 1 && this.prevField) {
        this.restoreField();
      }
    };
    window.addEventListener('keyup', this.keyupHandlerRef);
    window.addEventListener('contextmenu', this.contextmenuHandlerRef);
    window.addEventListener('mouseup', this.mouseupHandlerRef);
  },
  mounted() {
    emitter.on('makeBotMove', this.makeBotMove);
    emitter.on('processEndTurn', this.processEndTurn);
    emitter.on('startTurn', this.startTurn);
    emitter.on('moveUnit', this.emitMoveUnit);
    emitter.on('scoutArea', this.handleScoutArea);

    if (!this.loadGame) {
      this.initPlayersScrollCoords();
    }
    this.startTurn();
  },
  beforeUnmount() {
    emitter.off('makeBotMove', this.makeBotMove);
    emitter.off('processEndTurn', this.processEndTurn);
    emitter.off('startTurn', this.startTurn);
    emitter.off('moveUnit', this.emitMoveUnit);
    emitter.off('scoutArea', this.handleScoutArea);
    // Clean up window event listeners to prevent memory leaks
    if (this.keyupHandlerRef) {
      window.removeEventListener('keyup', this.keyupHandlerRef);
    }
    if (this.contextmenuHandlerRef) {
      window.removeEventListener('contextmenu', this.contextmenuHandlerRef);
    }
    if (this.mouseupHandlerRef) {
      window.removeEventListener('mouseup', this.mouseupHandlerRef);
    }
  },
  methods: {
    // Main events
    handleMenuOpen(isOpen) {
      this.menuOpen = isOpen;
    },
    handleExitClick() {
      this.state = this.STATES.exitDialog;
    },
    startTurn() {
      // Show turn notification for all players (human and bot)
      this.showTurnNotification(this.currentPlayer);

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
      const unit = this.localField[x0][y0].unit;

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
    // changeCellSize comes from gameCoreMixin
    initPlayersScrollCoords() {
      for (let playerNum = 0; playerNum < this.players.length; playerNum++) {
        const coords = this.getCurrentUnitCoords(playerNum)[0];
        // console.log('coords', coords);
        this.players[playerNum].scrollCoords = this.$refs.gameGridRef.getScrollCoordsByCell(coords);
      }
    },

    // Visibility helpers
    // doesVisibilityMakeSense comes from gameCoreMixin
    handleScoutArea(data) {
      this.addTempVisibilityForCoords(data.x, data.y, data.fogRadius);
    },
    addVisibilityForCoords(x, y, fogRadius) {
      // TODO: Think about common naming (visibility instead of fogRadius)
      for (let curX = x - fogRadius; curX <= x + fogRadius; curX++) {
        for (let curY = y - fogRadius; curY <= y + fogRadius; curY++) {
          if (this.fieldEngine.areExistingCoords(curX, curY))
            this.localField[curX][curY].isHidden = false;
        }
      }
    },
    addTempVisibilityForCoords(x, y, fogRadius) {
      for (let curX = x - fogRadius; curX <= x + fogRadius; curX++) {
        for (let curY = y - fogRadius; curY <= y + fogRadius; curY++) {
          if (this.fieldEngine.areExistingCoords(curX, curY)) {
            this.localField[curX][curY].isHidden = false;
            this.tempVisibilityCoords.add(`${curX},${curY}`);
          }
        }
      }
    },
    removeVisibility() {
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.localField[curX][curY].isHidden = true;
        }
      }
      this.tempVisibilityCoords = new Set();
    },
    showField() {
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.localField[curX][curY].isHidden = false;
        }
      }
    },
    setVisibility() {
      this.removeVisibility();
      const visibilitySet = this.fieldEngine.getCurrentVisibilitySet(this.currentPlayer);
      for (const [curX, curY] of visibilitySet) {
        // console.log('setVisibility', curX, curY);
        this.localField[curX][curY].isHidden = false;
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
            this.localField[curX][curY].isHidden = true;
          }
        }
      }
      // Set visibility
      const maxVisibility = 2 * this.fogOfWarRadius - 1;
      // console.log(`maxVisibility: ${maxVisibility}`);
      for (let curX = x - r - maxVisibility; curX <= x + r + maxVisibility; curX++) {
          for (let curY = y - r - maxVisibility; curY <= y + r + maxVisibility; curY++) {
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
          const _field = this.localField.map(row => row.map(cell => ({ ...cell, isHidden: true })));
          localStorage.setItem(field, JSON.stringify(_field));
        }
        else if (this[field] !== undefined) {
          localStorage.setItem(field, JSON.stringify(this[field]));
        }
      }
    },
    // Safe JSON parse helper with validation
    safeParseJSON(jsonString, fallback = null) {
      if (!jsonString) return fallback;
      try {
        return JSON.parse(jsonString);
      } catch (e) {
        console.warn('Failed to parse JSON from localStorage:', e);
        return fallback;
      }
    },
    loadFieldOrGenerateNewField() {
      if (this.field) {
        // Field provided as prop (from backend in multiplayer mode)
        // Make a deep copy and normalize to model instances to avoid mutating the prop
        this.localField = normalizeField(JSON.parse(JSON.stringify(this.field)));
        return;
      }
      if (this.loadGame) {
        const fieldFromStorage = localStorage.getItem('field');
        const parsedField = this.safeParseJSON(fieldFromStorage);
        // Validate field structure - must be a non-empty 2D array
        if (parsedField && Array.isArray(parsedField) && parsedField.length > 0) {
          // Reconstruct Cell instances (with nested Building/Unit) from plain objects
          this.localField = parsedField.map(row =>
            row.map(cellData => Models.Cell.fromJSON(cellData))
          );
        } else {
          console.warn('Invalid field data in localStorage, generating new field');
          this.loadGame = false; // Fall back to new game
          this.localField = this.engine.generateField();
        }
      }
      else {
        this.localField = this.engine.generateField();
      }
    },
    loadOrCreatePlayers() {
      if (this.loadGame) {
        const players = localStorage.getItem('players');
        const parsedPlayers = this.safeParseJSON(players);
        // Validate players structure - must be a non-empty array
        if (parsedPlayers && Array.isArray(parsedPlayers) && parsedPlayers.length > 0) {
          // Reconstruct Player instances from plain objects
          this.players = parsedPlayers.map(p => Models.Player.fromJSON(p));
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
        } else {
          console.warn('Invalid players data in localStorage, creating new players');
          this.loadGame = false; // Fall back to new game
          this.players = createPlayers(this.humanPlayersNum, this.botPlayersNum);
        }
      }
      else {
        this.players = createPlayers(this.humanPlayersNum, this.botPlayersNum);
      }
    },
    loadGameStatus() {
      for (const field of GAME_STATUS_FIELDS) {
        this[field] = this.safeParseJSON(localStorage.getItem(field));
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
          const cell = this.localField[x][y];
          // TODO: Some problem here with units and buildings - they are undefined
          cell.unit = prevCell.unit;
          cell.building = prevCell.building;
        }
      }
      // this.localField = structuredClone(this.prevField);
      // console.log(this.localField);
    },
    storeStateIfNeeded() {
      if (this.enableUndo) {
        this.prevField = structuredClone(this.localField);
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

    // findNextUnit, getCurrentUnitCoords, getCurrentStats come from gameCoreMixin

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
    showNotification(message, type = 'info', playerOrder = null) {
      const id = Date.now() + Math.random();
      this.notifications.push({ id, message, type, playerOrder });

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        this.dismissNotification(id);
      }, 5000);
    },
    showTurnNotification(playerOrder) {
      const message = `Player ${playerOrder + 1} turn`;
      this.showNotification(message, 'turn', playerOrder);
    },
    dismissNotification(id) {
      const index = this.notifications.findIndex(n => n.id === id);
      if (index !== -1) {
        this.notifications.splice(index, 1);
      }
    },
    getPlayerColor,
  },
}
</script>

<style scoped>
#notifications-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-end;
  pointer-events: none;
}

.notification {
  padding: 12px 20px;
  background-color: #222222;
  border: 2px solid #d8a67e;
  border-radius: 6px;
  color: #ffffff;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  pointer-events: auto;
  min-width: 200px;
  max-width: 300px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  transition: opacity 0.3s, transform 0.3s;
  animation: slideIn 0.3s ease-out;
}

.notification:hover {
  background-color: #333333;
  border-color: #ae7b62;
}

.notification-turn {
  background-color: var(--player-color);
  border-color: var(--player-color);
  color: #000000;
}

.notification-turn:hover {
  filter: brightness(1.1);
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
