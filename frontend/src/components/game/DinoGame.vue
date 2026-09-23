<template>
  <!-- [tutorial] The `!tutorialScenario` guard + the tutorial-prefixed
       props below (input-blocked, end-turn-blocked) + the
       <TutorialController> mount are the only template-level
       tutorial touchpoints. Full reference: docs/tutorial.md -->
  <ReadyLabel
    v-if="state === STATES.ready && !tutorialScenario"
    :on-click-action="readyBtnClick"
    :current-player="currentPlayer"
    :is-active-player="players[currentPlayer].active"
    :is-player-informed-lose="players[currentPlayer].informed_lose"
    :are-all-human-players-eliminated="humanPhase === HUMAN_PHASES.all_eliminated"
    :winner="prepareWinner()"
    :last-player="prepareLastPlayer()"
    :is-single-human="isSingleHumanGame"
    :can-watch-bots="!isScenario"
  />
  <!-- `is-hidden` blanks the board, which is a hotseat measure: the device
       is about to change hands. With a single human there's nobody to hide
       it from, and the ready label only appears at the end of a run, so the
       board stays visible behind its plate. -->
  <GameGrid
    ref="gameGridRef"
    :is-hidden="state === STATES.ready && !isSingleHumanGame"
    :fog-of-war-radius="fogOfWarRadius"
    :enable-fog-of-war="enableFogOfWar"
    :enable-scout-mode="enableScoutMode"
    :hide-enemy-speed="hideEnemySpeed"
    :field="localField"
    :current-player="currentPlayer"
    :viewing-player="viewingPlayer"
    :cell-size="cellSize"
    :unit-modifier="unitModifier"
    :base-modifier="baseModifier"
    :current-stats="getCurrentStats(viewingPlayer)"
    :menu-open="menuOpen"
    :display-visibility-coords="displayVisibilityCoords"
    :dying-cells="dyingCells"
    :borning-cells="borningCells"
    :pending-birth-cells="pendingBirthCells"
    :tutorial-input-blocked="tutorialInputBlocked"
    :is-animating="isAnimating"
  />
  <InfoPanel
    v-if="state === STATES.play"
    :current-player="currentPlayer"
    :viewing-player="viewingPlayer"
    :is-my-turn="isHumanTurn"
    :players="players"
    :current-stats="getCurrentStats(viewingPlayer)"
    :handle-end-turn-btn-click="processEndTurn"
    :handle-unit-click="findNextUnit"
    :cell-size="cellSize"
    :handle-change-cell-size="changeCellSize"
    :handle-exit-btn-click="() => (this.state = this.STATES.exitDialog)"
    :are-all-units-on-buildings="this.fieldEngine.areAllUnitsOnBuildings(this.viewingPlayer)"
    :field="localField"
    :field-engine="fieldEngine"
    :enable-fog-of-war="enableFogOfWar"
    :min-speed="minSpeed"
    :max-speed="maxSpeed"
    :unit-modifier="unitModifier"
    :base-modifier="baseModifier"
    :fog-of-war-radius="fogOfWarRadius"
    :can-undo="canUndo"
    :handle-undo-click="undoLastMove"
    :tutorial-input-blocked="tutorialInputBlocked"
    :tutorial-end-turn-blocked="tutorialEndTurnBlocked"
    :end-turn-blocked="lostMapGame"
    :is-animating="isAnimating"
    :can-save-map="canSaveMap"
    :bot-movement-mode="botMovementMode"
    :handle-bot-movement-mode-toggle="toggleBotMovementMode"
    :external-menu-hotkeys="true"
    @menu-open="handleMenuOpen"
  />
  <ExitDialog
    v-if="state === STATES.exitDialog"
    :handle-cancel="() => (state = STATES.play)"
    :handle-confirm="exitGame"
  />
  <SaveMapDialog
    v-if="showSaveMapDialog"
    :default-name="saveMapDefaultName"
    :exists-check="checkMapNameExists"
    @save="handleSaveMapConfirm"
    @cancel="handleSaveMapCancel"
  />
  <TutorialController
    v-if="tutorialScenario"
    :scenario="tutorialScenario"
    :get-context="getTutorialContext"
  />
  <!-- Notifications -->
  <div id="notifications-container">
    <div
      v-for="notification in notifications"
      :key="notification.id"
      :class="['notification', `notification-${notification.type}`]"
      :style="
        notification.type === 'turn'
          ? { '--player-color': getPlayerColor(notification.playerOrder) }
          : {}
      "
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
import ReadyLabel from '@/components/game/ReadyLabel.vue'
import GameGrid from '@/components/game/GameGrid.vue'
import InfoPanel from '@/components/game/InfoPanel.vue'
import ExitDialog from '@/components/dialogs/ExitDialog.vue'
import SaveMapDialog from '@/components/dialogs/SaveMapDialog.vue'
import TutorialController from '@/components/tutorial/TutorialController.vue'
import Models from '@/game/models'
import { CreateFieldEngine } from '@/game/createFieldEngine'
import { WaveEngine } from '@/game/waveEngine'
import { FieldEngine } from '@/game/fieldEngine'
import { BotEngine } from '@/game/botEngine'
import {
  createPlayers,
  createNewUnit,
  calculateUnitVisibility,
  getPlayerColor,
  normalizeField,
} from '@/game/helpers'
import { toCanonicalMap, getOccupiedSeats } from '@/game/mapSchema'
import { markMapWon } from '@/game/mapProgress'
import { mapNameExists, nextDefaultName, saveMap, todayDateStr } from '@/game/mapStorage'
import {
  ACTIONS,
  BIRTH_ANIMATION_DELAY,
  DEATH_ANIMATION_DELAY,
  FIELDS_TO_SAVE,
  GAME_STATUS_FIELDS,
  SCORE_MOD,
  SCROLL_TO_BIRTHS,
  SCROLL_TO_MOVES,
} from '@/game/const'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
import { gameCoreMixin } from '@/game/mixins/gameCoreMixin'
import { tutorialMixin } from '@/game/mixins/tutorialMixin'
import { computeFieldDiff, applyFieldDiff } from '@/game/fieldDiff'
import { animateMovePath } from '@/game/moveAnimator'

import emitter from '@/game/eventBus'

export default {
  name: 'DinoGame',
  mixins: [gameCoreMixin, tutorialMixin],
  components: {
    ReadyLabel,
    GameGrid,
    InfoPanel,
    ExitDialog,
    SaveMapDialog,
    TutorialController,
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
    // Canonical Map JSON used to seed the starting field/players/
    // settings when launching from a saved map. Mutually exclusive with
    // `loadGame` (which restores autosave instead) and with `field`
    // (which comes from the multiplayer server). When provided, the
    // engines are still constructed locally — only the initial state
    // differs from a random roll.
    initialMap: { type: Object, default: null },
    // True when `initialMap` is a SCENARIO (default or custom) rather than
    // a saved map. Both arrive as the same canonical map, so the launching
    // page has to say which it is: scenarios are puzzles to be replayed and
    // keep their fog on a loss, while a saved map behaves like the random
    // game it was saved from.
    isScenario: { type: Boolean, default: false },
    // eslint-disable-next-line vue/no-dupe-keys
    // Note: field is intentionally both a prop and data property - the data property shadows the prop
    // when in single-player mode (generates field locally), but uses the prop in multiplayer mode
    field: Array, // Optional: pre-generated field from backend (for multiplayer)
    // [tutorial] When provided, DinoGame uses the scenario's field +
    // players (bypassing CreateFieldEngine and createPlayers) and mounts
    // the TutorialController overlay that drives the scripted hints.
    // tutorialMixin owns the lock state and first-production override.
    // Full reference: docs/tutorial.md
    tutorialScenario: { type: Object, default: null },
  },
  data() {
    // Phase constants (single-player specific)
    const WIN_PHASES = {
      progress: 'progress', // Play
      has_winner: 'has_winner', // Somebody won
      informed: 'informed', // Message was output
    }
    const HUMAN_PHASES = {
      progress: 'progress', // Play
      all_eliminated: 'all_eliminated', // All human players eliminated
      informed: 'informed', // Message was output
    }
    const LAST_PLAYER_PHASES = {
      progress: 'progress', // Play
      last_player: 'last_player', // The only player left in the game
      informed: 'informed', // Message was output
    }
    const playersNum = this.humanPlayersNum + this.botPlayersNum
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
      state: 'ready', // Initial state (STATES.ready)
      winPhase: WIN_PHASES.progress,
      winner: null,
      humanPhase: HUMAN_PHASES.progress,
      lastPlayerPhase: LAST_PLAYER_PHASES.progress,
      lastPlayer: null,
      // Undo states. Two independent stacked actions:
      //   moveUndoState  — { diff, canUndo }: set on every move, cleared by undo or by next move
      //   scoutUndoState — { revealedCoords, addedTempCoords, canUndo }: set on every scout
      // The undo button reverts whichever is on top (scout first), preserving the layer underneath.
      moveUndoState: null,
      scoutUndoState: null,
      unitCoordsArr: [],
      tempVisibilityCoords: new Set(), // Obelisk-revealed "x,y" cells kept visible for the current turn
      // Handler references for cleanup (to prevent memory leaks)
      keyupHandlerRef: null,
      contextmenuHandlerRef: null,
      mouseupHandlerRef: null,
      menuOpen: false,
      // An enum rather than a boolean so later movement speeds can add
      // values without changing the menu/controller contract.
      botMovementMode: 'normal',
      notifications: [], // Array of notification objects: { id, message, type, playerOrder }
      // True while a unit is animating between cells. Gates new player input
      // (moves, scout, end-turn, undo) so we never start a second action mid-walk.
      isAnimating: false,
      // Frozen "human player visibility" Set used for both the animator's
      // sleep predicate and the display override during a move. While non-
      // null, displayVisibilityCoords returns this snapshot — keeping fog
      // stable through animation + post-walk side-effects (capture, kill,
      // visibility recompute). Without this, killing the human's last unit
      // would shrink the live visibility mid-animation and hide the path
      // the moving unit took before the user could see it.
      displayVisibilitySnapshot: null,
      // Cells whose unit is mid-death-animation. Populated by every cause
      // of death (neighbour-kill at end of move, kill-at-birth at start of
      // turn) and cleared after `DEATH_ANIMATION_DELAY` once the units are
      // actually removed from the field. The Set's identity changes on
      // every mutation so Vue's reactivity picks it up.
      dyingCells: new Set(),
      // Cells whose unit is mid-birth-animation (fade-in). Populated by
      // the per-birth loop in `runBirthSequence`, one cell at a time, and
      // cleared after `BIRTH_ANIMATION_DELAY`.
      borningCells: new Set(),
      // Spawn cells whose fade-in hasn't started yet — held at opacity 0.
      // Filled with every visible spawn at the start of the turn (so the
      // user opens the turn looking at empty bases) and drained one cell
      // at a time as `runBirthSequence` advances.
      pendingBirthCells: new Set(),
      // Per-birth records captured at start of turn but whose animation
      // was deferred — used when the ready-label is shown. The animation
      // runs in `readyBtnClick` once the player dismisses the label, so
      // the flash + fade-out is visible on the field instead of hidden
      // behind the label. Each entry is `{ coords, killedCoords }`.
      pendingBirths: [],
      // Set in beforeUnmount; the animator checks it to abort cleanly.
      wasUnmounted: false,
      // Latched index of the most recently active human player. Used to
      // hold the bottom panel on the user's own color/stats while bot
      // turns play out — without this the panel would flicker through
      // each bot's stats between human turns. Initialised to the first
      // human once players are created.
      lastHumanPlayer: null,
      // [tutorial] Lock + first-production state lives in
      // tutorialMixin: tutorialInputBlocked, tutorialEndTurnBlocked,
      // tutorialUndoBlocked, tutorialFirstProductionDone.
      //
      // Canonical Map snapshot taken at the start of the game (before
      // any move). Persisted via FIELDS_TO_SAVE so it survives autosave
      // and resume. Stays null for tutorial sessions (we don't expose
      // Save map in tutorials). Used by the SaveMapDialog to write a
      // saved map to localStorage.
      initialMapSnapshot: null,
      // Set true while the SaveMapDialog is mounted. The dialog is
      // teleported above the in-game menu; closing the menu before
      // showing the dialog mirrors the Exit-confirmation flow.
      showSaveMapDialog: false,
    }
  },
  computed: {
    // Whose color / stats the bottom info panel reflects. During a
    // human's turn this is just `currentPlayer`. During bot turns it
    // stays on the most recently active human (so the player keeps
    // seeing their own side while bots move). Falls back to the first
    // human or `currentPlayer` before any human has played.
    viewingPlayer() {
      if (!this.players || this.players.length === 0) return this.currentPlayer
      const cur = this.players[this.currentPlayer]
      if (cur && cur._type === Models.PlayerTypes.HUMAN) return this.currentPlayer
      if (this.lastHumanPlayer !== null) return this.lastHumanPlayer
      const firstHuman = this.findHumanPlayerOrder()
      return firstHuman !== null ? firstHuman : this.currentPlayer
    },
    // True when the game has exactly one human seat. Derived from the
    // players array (not the humanPlayersNum prop) so it stays correct
    // for resumed games and saved-map launches, where seats come from
    // storage. Drives the "You win/lose" vs "Player N…" label phrasing.
    isSingleHumanGame() {
      return this.players.filter(p => p._type === Models.PlayerTypes.HUMAN).length === 1
    },
    // True once a SCENARIO (default or custom) has been lost. The turn can
    // no longer be passed: with fog on there is nothing to watch (the map
    // keeps its fog), and with fog off the board is already revealed —
    // either way the run is over and Exit from the menu is the way on.
    // Random games and saved maps keep the button so the bot fight can
    // still be watched.
    //
    // Only ever true when every human is out: the rotation skips
    // eliminated players and stops on one only after `humanPhase` leaves
    // `progress`, so this can't strand a hotseat rival mid-game.
    lostMapGame() {
      const player = this.players?.[this.currentPlayer]
      return (
        this.isScenario &&
        !!player &&
        // Bots pass through this state constantly: elimination is detected
        // lazily, at the start of the dead player's own turn, so the
        // rotation lands on them and `startTurn` deactivates them there.
        // Blocking `processEndTurn` for them would stall the game on that
        // seat forever — which is exactly what it used to do.
        player._type === Models.PlayerTypes.HUMAN &&
        !player.active &&
        // And only once EVERY human is out. A hotseat player who loses
        // while others play on still has to hand the turn over.
        this.humanPhase !== this.HUMAN_PHASES.progress
      )
    },
    // Drives the "Next unit" button. Enabled only on human turns —
    // there's no UI to click during bot moves anyway, but explicitly
    // gating keeps the cursor and disabled state consistent.
    isHumanTurn() {
      if (!this.players || !this.players[this.currentPlayer]) return false
      return this.players[this.currentPlayer]._type === Models.PlayerTypes.HUMAN
    },
    // Display-only visibility override. During a bot's turn, `cell.isHidden`
    // reflects the BOT's view (so AI/pathfinding sees the right thing), but
    // the human player should keep seeing only their own visibility — otherwise
    // the move animation would expose bot units outside the human's fog.
    // Returns null on human turns (use `cell.isHidden` directly), or a Set of
    // "x,y" strings for cells the human currently sees.
    displayVisibilityCoords() {
      // While a move is in flight, return the snapshot taken at move-start.
      // This keeps fog frozen across the animation and any post-walk
      // side-effects (kills, visibility recompute) so the user sees the move
      // — and its consequences — consistently rather than watching cells
      // disappear ahead of the animator.
      if (this.displayVisibilitySnapshot !== null) return this.displayVisibilitySnapshot
      if (!this.players || !this.players[this.currentPlayer]) return null
      if (!this.enableFogOfWar) return null
      if (this.players[this.currentPlayer]._type === Models.PlayerTypes.HUMAN) return null
      const human = this.findHumanPlayerOrder()
      if (human === null || !this.fieldEngine) return null
      // Spectating after a loss: the field was revealed once on the
      // losing turn, but every bot turn recomputes `cell.isHidden` for
      // the bot's own AI, which would re-fog the board between moves.
      // Re-assert the reveal here so it stays put.
      //
      // A lost map-launched game keeps its fog instead (see
      // `keepsFogAfterLoss`) and falls through: an eliminated player owns
      // nothing, so the set below comes out empty and the board stays
      // dark rather than exposing the bot's view.
      if (!this.players[human].active && !this.keepsFogAfterLoss()) {
        const all = new Set()
        for (let x = 0; x < this.width; x++) {
          for (let y = 0; y < this.height; y++) all.add(`${x},${y}`)
        }
        return all
      }
      const set = new Set()
      for (const [x, y] of this.fieldEngine.getCurrentVisibilitySet(human)) {
        set.add(`${x},${y}`)
      }
      // Scout-revealed coords stay visible until end of turn — fold them
      // into the override so bot turns don't re-hide an area the human
      // just scouted with an obelisk.
      for (const key of this.tempVisibilityCoords) {
        set.add(key)
      }
      return set
    },
    // Save map button shows iff we have an initial snapshot AND this
    // isn't a tutorial session. Resumed games keep the snapshot via
    // localStorage so they can save too.
    canSaveMap() {
      return !!this.initialMapSnapshot && !this.tutorialScenario
    },
    saveMapDefaultName() {
      if (!this.initialMapSnapshot) return ''
      const m = this.initialMapSnapshot.metadata
      return nextDefaultName(m.playersNum, m.width, m.height, todayDateStr())
    },
    canUndo() {
      // Game-over states lock undo: a player must not be able to revert the
      // winning/losing move (or anything else once the game has been decided).
      if (this.winPhase !== this.WIN_PHASES.progress) return false
      if (this.humanPhase !== this.HUMAN_PHASES.progress) return false
      if (this.players[this.currentPlayer]._type === Models.PlayerTypes.BOT) return false
      // Don't expose the undo button while a move is animating.
      if (this.isAnimating) return false
      // [tutorial] Separate undo gate (owned by tutorialMixin) so a
      // forceUndo step can keep Undo enabled while everything else
      // (cells, Next-unit, End turn) is locked.
      if (this.tutorialUndoBlocked) return false
      if (this.scoutUndoState) return this.scoutUndoState.canUndo
      if (this.moveUndoState) return this.moveUndoState.canUndo
      return false
    },
    isFastForwardBotMovement() {
      return this.botMovementMode === 'fast_forward'
    },
    isFastForwardBotTurn() {
      return (
        this.isFastForwardBotMovement &&
        this.players[this.currentPlayer]?._type === Models.PlayerTypes.BOT
      )
    },
  },
  watch: {
    // Latch the last human seen so the panel can hold their identity
    // while bot turns play out.
    currentPlayer: {
      immediate: true,
      handler(newVal) {
        if (!this.players || !this.players[newVal]) return
        if (this.players[newVal]._type === Models.PlayerTypes.HUMAN) {
          this.lastHumanPlayer = newVal
        }
      },
    },
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
      this.buildingRates
    )
    this.loadFieldOrGenerateNewField()
    this.waveEngine = new WaveEngine(
      this.localField,
      this.width,
      this.height,
      this.fogOfWarRadius,
      this.enableScoutMode
    )
    this.loadOrCreatePlayers()
    if (this.loadGame) {
      this.loadGameStatus()
      // Restore the snapshot from autosave so a resumed game can still
      // be saved as a map (the snapshot was captured before any move on
      // the original session).
      const stored = localStorage.getItem('initialMapSnapshot')
      if (stored) {
        try {
          this.initialMapSnapshot = JSON.parse(stored)
        } catch {
          this.initialMapSnapshot = null
        }
      }
    } else if (!this.tutorialScenario && !this.initialMap) {
      // Fresh RANDOM game (not a tutorial, not a resume, not a launch
      // from a scenario/saved map): capture the canonical Map *now*,
      // before the first turn starts. Per-cell `isHidden` / per-unit
      // runtime fields are stripped by toCanonicalMap, so this matches
      // what saving from mid-game would later produce.
      //
      // Games started from `initialMap` intentionally skip the capture —
      // only random maps are saveable (`canSaveMap` keys off the
      // snapshot, so the Save-map button never shows for them, and
      // resumed map-games follow automatically since no snapshot was
      // persisted).
      this.initialMapSnapshot = toCanonicalMap({
        field: this.localField,
        players: this.players,
        settings: {
          humanPlayersNum: this.humanPlayersNum,
          botPlayersNum: this.botPlayersNum,
          sectorsNum: this.sectorsNum,
          enableFogOfWar: this.enableFogOfWar,
          fogOfWarRadius: this.fogOfWarRadius,
          visibilitySpeedRelation: this.visibilitySpeedRelation,
          speedMinVisibility: this.speedMinVisibility,
          minSpeed: this.minSpeed,
          maxSpeed: this.maxSpeed,
          maxUnitsNum: this.maxUnitsNum,
          maxBasesNum: this.maxBasesNum,
          unitModifier: this.unitModifier,
          baseModifier: this.baseModifier,
          buildingRates: this.buildingRates,
          hideEnemySpeed: this.hideEnemySpeed,
          killAtBirth: this.killAtBirth,
          enableUndo: this.enableUndo,
        },
        // `name` is filled in by the SaveMapDialog at save time.
        name: '',
        // `savedAt` is filled in at save time so the snapshot itself
        // stays clock-free and tests can pin it.
        savedAt: '',
      })
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
      this.visibilitySpeedRelation
    )
    // [tutorial] Per-player FieldEngine setting overrides (e.g. enemy
    // uses a slower speed range and a tighter unit cap than the
    // human).
    if (this.tutorialScenario?.playerOverrides) {
      this.fieldEngine.setPlayerOverrides(this.tutorialScenario.playerOverrides)
    }
    this.botEngine = new BotEngine(
      this.localField,
      this.width,
      this.height,
      this.enableFogOfWar,
      this.fieldEngine,
      this.waveEngine
    )
    // console.log(this.players);
    // Store handler references for cleanup in beforeUnmount
    this.keyupHandlerRef = e => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      // Esc is the in-game menu toggle. It deliberately bypasses the
      // regular menu-overlay guard so a second press can close the menu.
      if (key === 'Escape') {
        if (this.canToggleMenuWithHotkey(e)) emitter.emit('toggleGameMenu')
        return
      }
      if (this.areHotkeysBlocked(e)) return

      if (key === 'Enter') {
        this.state = this.STATES.play
      } else if (
        key === 'e' &&
        this.state === this.STATES.play &&
        this.isHumanTurn &&
        !this.tutorialEndTurnBlocked
      ) {
        this.processEndTurn()
      } else if (key === 'u' && this.canUndo) {
        this.undoLastMove()
      } else if (key === 'n' && this.isHumanTurn && !this.tutorialInputBlocked) {
        this.findNextUnit()
      } else if (key === '=' || key === '+') {
        this.changeCellSize(10)
      } else if (key === '-') {
        this.changeCellSize(-10)
      } else if (key === 'f') {
        this.toggleBotMovementMode()
      } else if (key === 's' && this.canSaveMap) {
        this.openSaveMapDialog()
      } else if (key === 'q') {
        this.handleExitClick()
      }
    }
    this.contextmenuHandlerRef = e => {
      e.preventDefault()
      // this.processEndTurn();
    }
    this.mouseupHandlerRef = e => {
      e.preventDefault()
      if (e.button === 1 && this.canUndo) {
        this.undoLastMove()
      }
    }
    window.addEventListener('keyup', this.keyupHandlerRef)
    window.addEventListener('contextmenu', this.contextmenuHandlerRef)
    window.addEventListener('mouseup', this.mouseupHandlerRef)
    // [tutorial] Subscriptions for `tutorial:inputBlockChanged` /
    // `endTurnBlockChanged` / `undoBlockChanged` are wired up by
    // tutorialMixin (also in `created`, for the same "child-watcher-
    // fires-before-parent-mounted" reason).
  },
  mounted() {
    emitter.on('makeBotMove', this.makeBotMove)
    emitter.on('processEndTurn', this.processEndTurn)
    emitter.on('startTurn', this.startTurn)
    emitter.on('moveUnit', this.emitMoveUnit)
    emitter.on('scoutArea', this.handleScoutArea)
    emitter.on('openSaveMapDialog', this.openSaveMapDialog)

    if (!this.loadGame) {
      this.initPlayersScrollCoords()
    }
    this.startTurn()
  },
  beforeUnmount() {
    // Tell any in-flight animation to bail out before mutating a torn-down field.
    this.wasUnmounted = true
    emitter.off('makeBotMove', this.makeBotMove)
    emitter.off('processEndTurn', this.processEndTurn)
    emitter.off('startTurn', this.startTurn)
    emitter.off('moveUnit', this.emitMoveUnit)
    emitter.off('scoutArea', this.handleScoutArea)
    emitter.off('openSaveMapDialog', this.openSaveMapDialog)
    // [tutorial] tutorialMixin handles tutorial:*BlockChanged cleanup.
    // Clean up window event listeners to prevent memory leaks
    if (this.keyupHandlerRef) {
      window.removeEventListener('keyup', this.keyupHandlerRef)
    }
    if (this.contextmenuHandlerRef) {
      window.removeEventListener('contextmenu', this.contextmenuHandlerRef)
    }
    if (this.mouseupHandlerRef) {
      window.removeEventListener('mouseup', this.mouseupHandlerRef)
    }
  },
  methods: {
    // Main events
    handleMenuOpen(isOpen) {
      this.menuOpen = isOpen
    },
    // True when board-changing in-game hotkeys must stay out of the way.
    // Mirrors the map editor's
    // `handleKeydown` guard:
    //   - a text field has focus — typing a map name in the Save-map
    //     dialog must never end the turn on the "e" in "desert";
    //   - a modifier is held, so browser/OS combos stay intact;
    //   - an overlay is up (menu, Save-map dialog, exit confirmation) —
    //     the keys act on the board, which the overlay has covered.
    areHotkeysBlocked(e) {
      const tag = (e.target && e.target.tagName) || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return true
      if (e.ctrlKey || e.metaKey || e.altKey) return true
      return this.menuOpen || this.showSaveMapDialog || this.state === this.STATES.exitDialog
    },
    canToggleMenuWithHotkey(e) {
      const tag = (e.target && e.target.tagName) || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return false
      if (e.ctrlKey || e.metaKey || e.altKey) return false
      return this.state === this.STATES.play && !this.showSaveMapDialog
    },
    handleExitClick() {
      this.state = this.STATES.exitDialog
    },
    async startTurn() {
      // Show turn notification for all players (human and bot). The
      // toast is now persistent — it stays on screen until the next
      // startTurn replaces it, so the user keeps a steady "who's playing
      // now" cue through long bot rotations.
      this.showTurnNotification(this.currentPlayer)

      // Defer the kill-at-birth pass so we can play the death animation
      // first — same flash + fade-out as for neighbour-kills at end of
      // move. `restoreAndProduceUnits({ deferKills: true })` places freshly-
      // spawned units on the field but returns the coords whose unit
      // *would* die instead of removing them; we then animate and call
      // `applyKillsAtCoords` to actually remove them.
      const counters = this.fieldEngine.restoreAndProduceUnits(this.currentPlayer, {
        deferKills: true,
      })
      const births = counters.births || []

      // [tutorial] Re-roll / force the speed of the very first
      // produced batch when the scenario sets firstProducedSpeed or
      // firstProducedSpeedForbidden. Latched inside the mixin so this
      // call is a no-op for subsequent turns. No-op outside tutorial.
      this.applyTutorialFirstProductionOverride(births)

      // Elimination is checked AFTER production: a free base has just
      // spawned a defender, so only a player left with nothing — no units
      // and no base an opponent isn't sitting on — is actually out. The
      // counters above can't answer this: `buildingsNum` counts owned
      // bases whether or not an enemy occupies them (it feeds scoring).
      if (!this.fieldEngine.hasPlayableAssets(this.currentPlayer)) {
        this.players[this.currentPlayer].active = false
        // Recompute endgame phases in the same move as the elimination —
        // the ready-label about to render must already combine "you lose"
        // with "all humans defeated" / the watch-bots note, instead of
        // splitting them across two labels a full rotation apart.
        this.updateEndgamePhases()
      }

      this.setVisibilityStartTurn()
      // [tutorial] Announce turn start AFTER production so passive
      // checks (e.g. scenario 2's "reach 10 dinos" goal) see the new
      // headcount immediately, instead of having to wait for the
      // next turn cycle.
      emitter.emit('tutorial:turnStarted', this.currentPlayer)

      // Decide whether the field is about to be visible. The animation
      // only makes sense to play once the field is — otherwise the ready-
      // label (which renders when `state === STATES.ready`) covers the
      // cells we're trying to animate. Bots always show the field
      // directly; humans only do so when `checkSkipReadyLabel` (typical
      // single-human game) returns true.
      const isBot = this.players[this.currentPlayer]._type === Models.PlayerTypes.BOT
      const fieldVisibleNow = isBot || this.checkSkipReadyLabel()

      if (fieldVisibleNow) {
        // Drop out of `STATES.ready` (which `processEndTurn` set) before
        // awaiting the animation, so the ready-label doesn't sit on top
        // of the dying-unit flash. `makeBotMove` would have set this for
        // bots anyway; we just do it earlier so the animation is visible.
        this.state = this.STATES.play
        if (births.length > 0) {
          await this.runBirthSequence(births)
          if (this.wasUnmounted) return
        }
        if (isBot) {
          emitter.emit('makeBotMove')
        } else {
          // When births just ran, the camera is parked on the last birth
          // cell — that's a more useful resting point than the saved
          // pre-end-turn coords, so don't pass scrollCoords back to
          // initTurn (which would yank the viewport back).
          const restoreCoords =
            births.length > 0 ? null : this.players[this.currentPlayer].scrollCoords
          emitter.emit('initTurn', restoreCoords)
        }
      } else {
        // Multi-human flow: ready-label is up until the player dismisses
        // it. Stash the births and run the animation in `readyBtnClick`
        // once the field is uncovered.
        this.pendingBirths = births
        emitter.emit('initTurn', this.players[this.currentPlayer].scrollCoords)
      }
    },
    // Drive the start-of-turn birth animation.
    //
    // The whole sequence runs synchronously up to its first await, so
    // Vue's first render after this method is called already has every
    // visible spawn cell flagged `pendingBirth` — the user opens the turn
    // looking at empty bases everywhere, and the freshly-spawned units
    // appear one at a time as we drain the pending set.
    //
    //   - all visible spawn cells are pre-marked `pendingBirth` (held at
    //     opacity 0)
    //   - we iterate the births in order: pull this birth's cell out of
    //     `pendingBirthCells`, scroll to it (no-op if already on screen),
    //     mark it `borning` (CSS fades 0 → 1)
    //   - for births that triggered kill-at-birth, mark those cells
    //     `dying` for the same window — death + birth animate together
    //   - after the window, unmark borning + dying and commit kills
    //
    // Births in the local player's fog are skipped entirely.
    async runBirthSequence(births) {
      if (!births || births.length === 0) return

      // Fast-forward applies the already-produced units' pending kills in
      // one pass. No camera movement, fade-in, damage flash, or timer is
      // involved, but tutorial event consumers still receive the same facts.
      if (this.isFastForwardBotTurn) {
        for (const birth of births) {
          this.fieldEngine.applyKillsAtCoords(this.currentPlayer, birth.killedCoords)
          if (birth.killedCoords.length > 0) {
            emitter.emit('tutorial:unitKilled', {
              coords: birth.killedCoords,
              killerPlayer: this.currentPlayer,
              count: birth.killedCoords.length,
              cause: 'birth',
            })
          }
        }
        this.checkEndOfGame()
        if (this.doesVisibilityMakeSense()) this.setVisibility()
        return
      }

      this.isAnimating = true
      try {
        const humanPlayer = this.findHumanPlayerOrder()
        const humanIsPlaying = humanPlayer !== null && !!this.players[humanPlayer]?.active
        // null means "don't filter": fog is off, or the viewer is a
        // spectator watching a revealed field and should see every birth.
        // A spectator whose map keeps its fog (a lost map game) sees none.
        let humanVisibility = null
        if (this.doesVisibilityMakeSense() && humanIsPlaying) {
          humanVisibility = new Set(
            Array.from(this.fieldEngine.getCurrentVisibilitySet(humanPlayer)).map(
              ([hx, hy]) => `${hx},${hy}`
            )
          )
        } else if (!humanIsPlaying && this.keepsFogAfterLoss()) {
          humanVisibility = new Set()
        }

        // Filter to births visible to the local player and pre-mark them
        // all as `pendingBirth` BEFORE any await so they render at opacity
        // 0 from the very first frame.
        const visibleBirths = births.filter(b => {
          const [bx, by] = b.coords
          return humanVisibility === null || humanVisibility.has(`${bx},${by}`)
        })
        const pendingCoords = visibleBirths.map(b => b.coords)
        this._setPendingBirth(pendingCoords, true)

        for (const birth of visibleBirths) {
          if (this.wasUnmounted) return
          // Scroll first so the user is looking at the cell before its
          // fade-in starts. Smooth-centre — no-op when the cell is
          // already centred.
          if (SCROLL_TO_BIRTHS) {
            await this.centerOnCell(birth.coords)
            if (this.wasUnmounted) return
          }
          // Pull this cell out of pending and into borning. Both writes
          // happen synchronously in the same tick, so Vue renders the
          // transition cleanly (no frame where neither flag is set).
          this._setPendingBirth([birth.coords], false)
          this._setBorning([birth.coords], true)
          this._setDying(birth.killedCoords, true)
          await sleep(BIRTH_ANIMATION_DELAY)
          if (this.wasUnmounted) return
          this._setBorning([birth.coords], false)
          this._setDying(birth.killedCoords, false)
          this.fieldEngine.applyKillsAtCoords(this.currentPlayer, birth.killedCoords)
          // [tutorial] Surface kill-at-birth victims so scenarios can
          // gate hints on them (e.g. scenario 3's spawn-kill lesson).
          if (birth.killedCoords.length > 0) {
            emitter.emit('tutorial:unitKilled', {
              coords: birth.killedCoords,
              killerPlayer: this.currentPlayer,
              count: birth.killedCoords.length,
              cause: 'birth',
            })
          }
        }

        // Defensive: clear any residual pending flags (e.g. cancelled
        // mid-sequence the cleanup might be partial).
        this._setPendingBirth(pendingCoords, false)

        this.checkEndOfGame()
        // Visibility may have shrunk if a kill-at-birth removed a unit at
        // a cell the player was seeing through.
        if (this.doesVisibilityMakeSense()) this.setVisibility()
      } finally {
        this.isAnimating = false
      }
    },
    // Toggle the `dying` flag for a list of cells. The Set's identity has
    // to change for Vue's reactivity to pick the mutation up.
    _setDying(coords, on) {
      if (!coords || coords.length === 0) return
      const next = new Set(this.dyingCells)
      for (const [x, y] of coords) {
        if (on) next.add(`${x},${y}`)
        else next.delete(`${x},${y}`)
      }
      this.dyingCells = next
    },
    // Same shape as _setDying, for the birth fade-in flag.
    _setBorning(coords, on) {
      if (!coords || coords.length === 0) return
      const next = new Set(this.borningCells)
      for (const [x, y] of coords) {
        if (on) next.add(`${x},${y}`)
        else next.delete(`${x},${y}`)
      }
      this.borningCells = next
    },
    // Same shape as _setBorning, for the "queued, opacity 0" flag.
    _setPendingBirth(coords, on) {
      if (!coords || coords.length === 0) return
      const next = new Set(this.pendingBirthCells)
      for (const [x, y] of coords) {
        if (on) next.add(`${x},${y}`)
        else next.delete(`${x},${y}`)
      }
      this.pendingBirthCells = next
    },
    emitMoveUnit(coordsDict) {
      // Don't accept a new move while one is animating.
      if (this.isAnimating) return
      this.moveUnit(coordsDict.fromCoords, coordsDict.toCoords)
    },
    toggleBotMovementMode() {
      this.botMovementMode = this.isFastForwardBotMovement ? 'normal' : 'fast_forward'
      const status = this.isFastForwardBotMovement ? 'on' : 'off'
      this.showNotification(`Fast-forward bot moves turned ${status}`)
    },
    // Change field after unit's move. Async because we walk the unit
    // cell-by-cell along the path before applying side-effects.
    async moveUnit(fromCoords, toCoords) {
      // Capture field state BEFORE the move (for undo diff)
      // Note: Use JSON.parse/stringify instead of structuredClone because Vue reactive proxies cannot be cloned
      const fieldSnapshot = JSON.parse(JSON.stringify(this.localField))

      // Capture visibility BEFORE the move (if fog of war enabled)
      // Convert to Set of strings for proper comparison (arrays use reference equality)
      let visibleCoordsBefore = null
      if (
        this.doesVisibilityMakeSense() &&
        this.players[this.currentPlayer]?._type === Models.PlayerTypes.HUMAN
      ) {
        const rawSet = this.fieldEngine.getCurrentVisibilitySet(this.currentPlayer)
        visibleCoordsBefore = new Set(Array.from(rawSet).map(coords => JSON.stringify(coords)))
      }

      const [x0, y0] = fromCoords
      const [x1, y1] = toCoords
      const unit = this.localField[x0][y0].unit
      const isFastForwardBotMove =
        this.isFastForwardBotMovement &&
        this.players[unit.player]?._type === Models.PlayerTypes.BOT

      // Snapshot the human player's visibility for the duration of this move.
      // The same Set drives both the animator's sleep predicate (which steps
      // get a real 100ms delay) and the display override on GameGrid (which
      // cells render as visible). Freezing both means the rendered fog can't
      // shift mid-animation — important when the move ends in killing the
      // human's last unit, otherwise the post-walk kill would shrink live
      // visibility and hide the cells the bot just walked through.
      const humanPlayer = this.findHumanPlayerOrder()
      // An eliminated human owns nothing, so their live visibility is
      // empty — freezing it here would black the board out for the whole
      // move animation. Leave the snapshot null instead and let
      // `displayVisibilityCoords` decide what a spectator sees (the
      // revealed field, or fog for a lost map game).
      const humanIsPlaying = humanPlayer !== null && !!this.players[humanPlayer]?.active
      let humanVisibility =
        this.doesVisibilityMakeSense() && humanIsPlaying
          ? new Set(
              Array.from(this.fieldEngine.getCurrentVisibilitySet(humanPlayer)).map(
                ([hx, hy]) => `${hx},${hy}`
              )
            )
          : null
      // A defeated viewer of a scenario still sees fog. In a random game
      // the field is revealed after defeat, so null correctly means all
      // moves remain visible to that spectator.
      if (!humanIsPlaying && this.keepsFogAfterLoss()) humanVisibility = new Set()
      // Fold in scout-revealed coords so areas the human revealed with an
      // obelisk this turn stay visible through the move animation (and
      // any subsequent bot move) — otherwise the snapshot overrides
      // cell.isHidden=false on those cells and they blink to fog.
      if (humanVisibility !== null) {
        for (const key of this.tempVisibilityCoords) {
          humanVisibility.add(key)
        }
      }
      this.displayVisibilitySnapshot = isFastForwardBotMove ? null : humanVisibility

      // Walk the unit along the BFS path. fieldEngine.moveUnit is bypassed
      // because the animator already places the unit on the destination cell;
      // we only need to set hasMoved here.
      const path = this.waveEngine.getPath(x0, y0, x1, y1, unit.movePoints) || [
        [x0, y0],
        [x1, y1],
      ]
      const pathIsVisible =
        humanVisibility === null ||
        path.some(([cx, cy]) => humanVisibility.has(`${cx},${cy}`))
      // Centre the camera on the unit's starting cell (or the first
      // visible cell of its path, if it begins in fog) before the walk
      // begins. Smooth-centre awaits scrollend, so the user is looking at
      // the action when it starts.
      //
      // Skipped when the moving unit belongs to the local human player:
      // they're driving the move themselves, so the camera shouldn't
      // jerk away from where they clicked.
      const isOwnMove = humanPlayer !== null && unit.player === humanPlayer
      if (SCROLL_TO_MOVES && !isOwnMove && !isFastForwardBotMove && pathIsVisible) {
        const firstVisibleCell = path.find(
          ([cx, cy]) => humanVisibility === null || humanVisibility.has(`${cx},${cy}`)
        )
        if (firstVisibleCell) {
          await this.centerOnCell(firstVisibleCell)
          if (this.wasUnmounted) {
            this.displayVisibilitySnapshot = null
            return
          }
        }
      }
      this.isAnimating = true
      try {
        if (isFastForwardBotMove || (!isOwnMove && !pathIsVisible)) {
          // Neither fast-forward nor a wholly hidden move needs a walk.
          this.localField[x1][y1].unit = unit
          this.localField[x0][y0].unit = null
        } else {
          await animateMovePath(this.localField, path, unit, {
            isVisible: ([cx, cy]) => humanVisibility === null || humanVisibility.has(`${cx},${cy}`),
            isCancelled: () => this.wasUnmounted,
          })
        }
        if (this.wasUnmounted) return
        unit.hasMoved = true

        // [tutorial] Snapshot the destination tower's previous owner
        // so we can tell a real ownership transfer from a no-op step
        // onto our own base. Used to gate the `towerCaptured` trigger.
        const destBuilding = this.localField[x1][y1].building
        const prevBaseOwner =
          destBuilding && destBuilding._type === Models.BuildingTypes.BASE
            ? destBuilding.player
            : undefined
        const buildingCaptured = this.fieldEngine.captureBuildingIfNeeded(x1, y1, unit.player)
        if (buildingCaptured && prevBaseOwner !== unit.player) {
          emitter.emit('tutorial:towerCaptured', { x: x1, y: y1, player: unit.player })
        }
        // Triggered actions (e.g. obelisk → scouting) belong to the moving
        // player. Only surface the prompt to a human player; otherwise a bot
        // landing on an obelisk would flash "Select area for scouting" UI to
        // the human.
        // Triggered actions only matter with fog of war on — scouting an
        // obelisk reveals fog, and with no fog there's nothing to reveal.
        if (this.enableFogOfWar && this.players[unit.player]?._type === Models.PlayerTypes.HUMAN) {
          const action = this.fieldEngine.getActionTriggered(x1, y1)
          if (action) {
            emitter.emit('setAction', action)
          }
        }
        // Death animation for cells about to be killed by the move's
        // neighbour-pass. Fast-forward skips its visual delay and removes
        // the victims immediately; normal movement still flashes damage
        // before applying the exact same kill operation.
        const killedCoords = this.fieldEngine.findKillNeighbours(x1, y1, unit.player)
        if (!isFastForwardBotMove) {
          const visibleKills =
            isOwnMove || humanVisibility === null
              ? killedCoords
              : killedCoords.filter(([kx, ky]) => humanVisibility.has(`${kx},${ky}`))
          await this.playDeathAnimation(visibleKills)
          if (this.wasUnmounted) return
        }
        this.fieldEngine.killNeighbours(x1, y1, unit.player)
        // [tutorial] Mirror of the birth-kill emit in runBirthSequence —
        // lets scenarios gate hints on the player's own kills.
        if (killedCoords.length > 0) {
          emitter.emit('tutorial:unitKilled', {
            coords: killedCoords,
            killerPlayer: unit.player,
            count: killedCoords.length,
          })
        }

        this.checkEndOfGame()
        if (this.doesVisibilityMakeSense()) {
          // Recalculate visibility in area unit moved from
          this.setVisibilityForArea(x0, y0, unit.visibility)
          const visibility = buildingCaptured
            ? Math.max(unit.visibility, this.fogOfWarRadius)
            : unit.visibility
          // Add visibility to area unit moved to
          this.addVisibilityForCoords(x1, y1, visibility)
        }

        // Compute diff (what changed) for undo functionality
        const diff = computeFieldDiff(fieldSnapshot, this.localField, this.width, this.height)

        // Check if new cells were revealed (undo is not allowed if so)
        let canUndo = true
        if (visibleCoordsBefore) {
          const visibleCoordsAfter = this.fieldEngine.getCurrentVisibilitySet(this.currentPlayer)
          // If any new coords are visible, undo is not allowed
          // Convert each coord to string for proper comparison (Set.has uses reference equality for arrays)
          for (const coord of visibleCoordsAfter) {
            if (!visibleCoordsBefore.has(JSON.stringify(coord))) {
              canUndo = false
              break
            }
          }
        }

        // A new move replaces the move-undo layer and invalidates any pending scout-undo.
        this.moveUndoState = { diff, canUndo }
        this.scoutUndoState = null
        // [tutorial] Announce a fully-applied move so the controller
        // can re-check `unitReached` / `check` predicates against the
        // post-move field state.
        emitter.emit('tutorial:moveFinished', { fromCoords: [x0, y0], toCoords: [x1, y1] })
      } finally {
        this.isAnimating = false
        // Release the snapshot so displayVisibilityCoords falls back to the
        // reactive computation reflecting the post-move state. The next bot
        // move will take its own fresh snapshot.
        this.displayVisibilitySnapshot = null
      }
    },
    // Mark every coord in `coords` as dying (damage flash + fade-out via
    // GameUnit), hold for DEATH_ANIMATION_DELAY, then clear the set. The
    // caller is responsible for actually removing the units from the
    // field after this resolves; the helper just drives the visual.
    // No-op when `coords` is empty so callers don't need to guard.
    async playDeathAnimation(coords) {
      if (!coords || coords.length === 0) return
      const next = new Set(this.dyingCells)
      for (const [kx, ky] of coords) next.add(`${kx},${ky}`)
      this.dyingCells = next
      await sleep(DEATH_ANIMATION_DELAY)
      if (this.wasUnmounted) return
      const after = new Set(this.dyingCells)
      for (const [kx, ky] of coords) after.delete(`${kx},${ky}`)
      this.dyingCells = after
    },
    // Forward a "centre on this cell" request to the grid. Returns a
    // Promise that resolves to `true` once the smooth-scroll has finished
    // (via `scrollend`), or `false` immediately when the cell was already
    // centred (or the grid isn't mounted yet). Factored out so tests can
    // spy on it without mocking the GameGrid ref directly.
    centerOnCell(coord) {
      return this.$refs.gameGridRef?.centerOnCell?.(coord) ?? Promise.resolve(false)
    },
    // Pick the player whose visibility gates animations. With a single human
    // player (most common case) it's that player; otherwise we fall back to
    // the current player (bot vs bot — invisible anyway when fog is off).
    // True when losing must NOT reveal the field: a fog-of-war game that
    // was launched from a map (default scenario, custom scenario or saved
    // map), all of which can be replayed. Random games reveal as before,
    // and a game with fog off has nothing to hide either way.
    keepsFogAfterLoss() {
      return this.isScenario && this.enableFogOfWar
    },
    // Tick the scenario or saved map the player just beat, so the picker
    // can show it as won (same idea as the tutorial's completion marks).
    // Cosmetic only — nothing gates on it. Random games have no entry to
    // tick, and tutorials keep their own store.
    recordMapWin() {
      if (this.tutorialScenario || !this.initialMap) return
      const winnerPlayer = this.players?.[this.winner]
      if (winnerPlayer?._type !== Models.PlayerTypes.HUMAN) return
      markMapWon(this.initialMap.name, this.isScenario)
    },
    findHumanPlayerOrder() {
      for (let i = 0; i < this.players.length; i++) {
        if (this.players[i]._type === Models.PlayerTypes.HUMAN) return i
      }
      return null
    },
    // [tutorial] handleTutorial{Input,EndTurn,Undo}Block live in
    // tutorialMixin and own the matching data flags above.
    processEndTurn() {
      if (this.isAnimating) return
      if (this.state === this.STATES.ready) return
      // A lost map-launched game has no next turn — see `lostMapGame`.
      // Guards the 'e' shortcut as well as the button.
      if (this.lostMapGame) return
      // [tutorial] Block the button + 'e' path while the End-turn
      // lock is engaged (forceUndo / lockAll / OK step).
      if (this.tutorialEndTurnBlocked) return
      // Clear unit selection and move highlights before transitioning —
      // otherwise they bleed into the ready-label / next turn.
      emitter.emit('initTurn')
      this.state = this.STATES.ready
      emitter.emit('saveCoords', this.players[this.currentPlayer])
      this.moveUndoState = null
      this.scoutUndoState = null
      this.selectNextPlayerAndCheckPhases()
      emitter.emit('startTurn')
      // [tutorial] The button click path invokes this method
      // directly (no 'processEndTurn' emit), so announce the end of
      // turn explicitly for the controller's `turnEnded` waitFor.
      emitter.emit('tutorial:turnEnded', this.currentPlayer)
    },
    async readyBtnClick() {
      this.state = this.STATES.play
      if (this.humanPhase === this.HUMAN_PHASES.all_eliminated) {
        this.humanPhase = this.HUMAN_PHASES.informed
      }
      if (this.winPhase === this.WIN_PHASES.has_winner) {
        this.winPhase = this.WIN_PHASES.informed
      }
      if (this.lastPlayerPhase === this.LAST_PLAYER_PHASES.last_player) {
        this.lastPlayerPhase = this.LAST_PLAYER_PHASES.informed
      }
      if (
        !this.players[this.currentPlayer].active &&
        !this.players[this.currentPlayer].informed_lose
      ) {
        this.players[this.currentPlayer].informed_lose = true
      }
      // Multi-human flow: `startTurn` deferred the birth animation because
      // the ready-label was hiding the field. Now that the player has
      // dismissed the label, run the per-birth sequence (which also plays
      // any kill-at-birth death animation).
      if (this.pendingBirths && this.pendingBirths.length > 0) {
        const births = this.pendingBirths
        this.pendingBirths = []
        await this.runBirthSequence(births)
      }
    },

    // Global helpers
    updatePlayerScore(killedBefore, buildingsNum, unitsNum, producedNum) {
      this.fieldEngine.changeScore(this.currentPlayer, SCORE_MOD.building * buildingsNum)
      this.fieldEngine.changeScore(this.currentPlayer, SCORE_MOD.unit * unitsNum)
      this.checkEndOfGame()
      this.fieldEngine.changeScore(this.currentPlayer, SCORE_MOD.produce * producedNum)
      this.checkEndOfGame()
      const killed = this.players[this.currentPlayer].killed - killedBefore
      this.fieldEngine.changeScore(this.currentPlayer, SCORE_MOD.kill * killed)
      this.checkEndOfGame()
    },
    checkEndOfGame() {
      if (this.winPhase !== this.WIN_PHASES.progress) return
      // [tutorial] Scenarios opt in to the elimination win check via
      // `useEliminationWin: true`. Without this guard, single-human
      // scenarios would auto-end on the first move because
      // getLastPlayerIdx() === currentPlayer.
      if (this.tutorialScenario && !this.tutorialScenario.useEliminationWin) return
      if (
        this.getLastPlayerIdx() === this.currentPlayer ||
        (this.scoresToWin > 0 && this.players[this.currentPlayer].score >= this.scoresToWin) ||
        this.fieldEngine.areAllPlayersOccupied(this.currentPlayer)
      ) {
        this.winPhase = this.WIN_PHASES.has_winner
        this.winner = this.currentPlayer
        this.recordMapWin()
        // [tutorial] Scenarios drive their own end-of-game UI via the
        // controller's `win` step + the scenario completion overlay,
        // so we never drop into the "Player X wins!" ReadyLabel.
        if (
          !this.tutorialScenario &&
          this.players[this.currentPlayer]._type === Models.PlayerTypes.HUMAN
        ) {
          this.state = this.STATES.ready
        }
        // [tutorial] Surface the win event regardless of mode (no-op
        // outside tutorial — nobody listens).
        emitter.emit('tutorial:gameWon', this.currentPlayer)
      }
    },
    selectNextPlayerAndCheckPhases() {
      do {
        this.currentPlayer += 1
        this.currentPlayer %= this.playersNum
        if (this.currentPlayer === 0) {
          this.saveState()
          this.updateEndgamePhases()
          // If all human players eliminated, they may observe bot fight
          if (this.humanPhase !== this.HUMAN_PHASES.progress) {
            break
          }
        }
      } while (!this.players[this.currentPlayer].active)
    },
    // Recompute the endgame phase machines from the current `active`
    // flags. Called from the rotation wrap AND right after a player is
    // eliminated in `startTurn`, so the endgame labels fire in the same
    // move as the elimination rather than one rotation later.
    updateEndgamePhases() {
      if (this.humanPhase === this.HUMAN_PHASES.progress && this.areAllHumanPlayersEliminated()) {
        this.humanPhase = this.HUMAN_PHASES.all_eliminated
      }
      // [tutorial] Skip the "only player left" phase entirely
      // for tutorials — scenarios often have a single human
      // player or end via a custom goal/win step, so this label
      // would either flash on every turn or pre-empt the
      // scenario's own end message.
      if (!this.tutorialScenario && this.lastPlayerPhase === this.LAST_PLAYER_PHASES.progress) {
        const lastPlayerIdx = this.getLastPlayerIdx()
        if (lastPlayerIdx !== null) {
          if (
            this.players[lastPlayerIdx]._type === Models.PlayerTypes.HUMAN &&
            this.winPhase === this.WIN_PHASES.progress
          ) {
            // A lone human left standing is a win — announce "you win" on
            // their ready screen instead of the "only player left" notice
            // (which is reserved for the watched bot fight's endpoint).
            this.winPhase = this.WIN_PHASES.has_winner
            this.winner = lastPlayerIdx
            this.recordMapWin()
          } else if (this.players[lastPlayerIdx]._type === Models.PlayerTypes.BOT) {
            this.lastPlayerPhase = this.LAST_PLAYER_PHASES.last_player
            this.lastPlayer = lastPlayerIdx
          }
        }
      }
    },
    // changeCellSize comes from gameCoreMixin
    initPlayersScrollCoords() {
      for (let playerNum = 0; playerNum < this.players.length; playerNum++) {
        // Map-editor scenarios are permissive — a player may start with
        // no units on the field (and even no base). Fall back through
        // unit → base → map centre so the mount never blows up trying
        // to destructure `undefined` inside `getScrollCoordsByCell`.
        const coords = this.getCurrentUnitCoords(playerNum)[0] ??
          this.findFirstBaseCoords(playerNum) ?? [
            Math.floor(this.width / 2),
            Math.floor(this.height / 2),
          ]
        this.players[playerNum].scrollCoords = this.$refs.gameGridRef.getScrollCoordsByCell(coords)
      }
    },
    // Helper for `initPlayersScrollCoords` — returns `[x, y]` of the
    // first base owned by `playerNum`, or `null` if the player has no
    // owned base on the field.
    findFirstBaseCoords(playerNum) {
      const field = this.localField
      if (!field) return null
      for (let x = 0; x < this.width; x++) {
        if (!field[x]) continue
        for (let y = 0; y < this.height; y++) {
          const b = field[x][y]?.building
          if (b && b._type === 'base' && b.player === playerNum) return [x, y]
        }
      }
      return null
    },

    // Visibility helpers
    // doesVisibilityMakeSense comes from gameCoreMixin
    handleScoutArea(data) {
      if (this.isAnimating) return
      // Capture which cells the scout will reveal so undo can re-hide exactly those.
      // Scout-undo is independent of move-undo: a scout that reveals nothing is
      // always undoable, even when the preceding move-to-obelisk revealed new cells.
      const revealedCoords = []
      if (this.doesVisibilityMakeSense()) {
        const { x, y, fogRadius } = data
        for (let curX = x - fogRadius; curX <= x + fogRadius; curX++) {
          for (let curY = y - fogRadius; curY <= y + fogRadius; curY++) {
            if (
              this.fieldEngine.areExistingCoords(curX, curY) &&
              this.localField[curX][curY].isHidden
            ) {
              revealedCoords.push([curX, curY])
            }
          }
        }
      }

      const previousTempCoords = new Set(this.tempVisibilityCoords)
      this.addTempVisibilityForCoords(data.x, data.y, data.fogRadius)
      const addedTempCoords = [...this.tempVisibilityCoords].filter(
        key => !previousTempCoords.has(key)
      )

      // Picking a scout target commits the move: from now on the only thing
      // undo can revert is the scout choice itself.
      this.scoutUndoState = {
        revealedCoords,
        addedTempCoords,
        canUndo: revealedCoords.length === 0,
      }
      this.moveUndoState = null
    },
    addVisibilityForCoords(x, y, fogRadius) {
      // TODO: Think about common naming (visibility instead of fogRadius)
      for (let curX = x - fogRadius; curX <= x + fogRadius; curX++) {
        for (let curY = y - fogRadius; curY <= y + fogRadius; curY++) {
          if (this.fieldEngine.areExistingCoords(curX, curY))
            this.localField[curX][curY].isHidden = false
        }
      }
    },
    addTempVisibilityForCoords(x, y, fogRadius) {
      for (let curX = x - fogRadius; curX <= x + fogRadius; curX++) {
        for (let curY = y - fogRadius; curY <= y + fogRadius; curY++) {
          if (this.fieldEngine.areExistingCoords(curX, curY)) {
            this.localField[curX][curY].isHidden = false
            this.tempVisibilityCoords.add(`${curX},${curY}`)
          }
        }
      }
    },
    removeVisibility() {
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.localField[curX][curY].isHidden = true
        }
      }
    },
    showField() {
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.localField[curX][curY].isHidden = false
        }
      }
    },
    setVisibility() {
      this.removeVisibility()
      const visibilitySet = this.fieldEngine.getCurrentVisibilitySet(this.currentPlayer)
      for (const [curX, curY] of visibilitySet) {
        // console.log('setVisibility', curX, curY);
        this.localField[curX][curY].isHidden = false
      }
      // Recalculating unit visibility (including after move undo) must not
      // discard obelisk reveals made earlier in this turn.
      for (const key of this.tempVisibilityCoords) {
        const [x, y] = key.split(',').map(Number)
        if (this.fieldEngine.areExistingCoords(x, y)) this.localField[x][y].isHidden = false
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
            this.localField[curX][curY].isHidden = true
          }
        }
      }
      // Set visibility
      const maxVisibility = 2 * this.fogOfWarRadius - 1
      // console.log(`maxVisibility: ${maxVisibility}`);
      for (let curX = x - r - maxVisibility; curX <= x + r + maxVisibility; curX++) {
        for (let curY = y - r - maxVisibility; curY <= y + r + maxVisibility; curY++) {
          let curR = 0
          // console.log(`Current check: (${curX}, ${curY})`)
          if (
            this.fieldEngine.areExistingCoords(curX, curY) &&
            (curR = this.fieldEngine.getVisibleObjRadius(curX, curY, this.currentPlayer, x, y, r))
          ) {
            // console.log(`Visible object: (${curX}, ${curY})  r: ${curR}`)
            this.addVisibilityForCoords(curX, curY, curR)
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
      this.tempVisibilityCoords = new Set()
      // `doesVisibilityMakeSense()` goes false either because fog is off
      // for this game, or because the player is eliminated — the second
      // case is what hands a loser the whole map.
      //
      // Games launched from a map keep their fog after a loss: the layout
      // of a scenario or saved map is the puzzle, and it can be replayed,
      // so handing it over on defeat spoils it. A freshly generated random
      // map is one-off, so revealing it there stays. Recomputing for an
      // eliminated player yields an empty visibility set, i.e. the field
      // simply stays hidden.
      if (this.doesVisibilityMakeSense() || this.keepsFogAfterLoss()) {
        this.setVisibility()
      } else {
        this.showField()
      }
    },

    // Save-map dialog flow (single-player). Multiplayer's controller
    // overrides the save path; the dialog open/cancel is the same.
    openSaveMapDialog() {
      if (!this.canSaveMap) return
      this.showSaveMapDialog = true
    },
    handleSaveMapCancel() {
      this.showSaveMapDialog = false
    },
    checkMapNameExists(name) {
      return mapNameExists(name)
    },
    handleSaveMapConfirm(finalName) {
      const map = {
        ...this.initialMapSnapshot,
        name: finalName,
        savedAt: new Date().toISOString(),
      }
      try {
        saveMap(map)
        this.showSaveMapDialog = false
      } catch (e) {
        // Surface the storage error to the dialog. The dialog's
        // existsCheck should normally catch the collision first, but
        // keep this as a defense in depth.
        console.warn('saveMap failed:', e)
        this.showSaveMapDialog = false
      }
    },
    // Save-load operations
    saveState() {
      // [tutorial] Throwaway sessions — skip persistence so a
      // tutorial run doesn't clobber the player's regular saved game.
      if (this.tutorialScenario) return
      // TODO: Save only game situation, not game settings
      for (const field of FIELDS_TO_SAVE) {
        if (field === 'field') {
          const _field = this.localField.map(row => row.map(cell => ({ ...cell, isHidden: true })))
          localStorage.setItem(field, JSON.stringify(_field))
        } else if (this[field] !== undefined) {
          localStorage.setItem(field, JSON.stringify(this[field]))
        }
      }
    },
    // Safe JSON parse helper with validation
    safeParseJSON(jsonString, fallback = null) {
      if (!jsonString) return fallback
      try {
        return JSON.parse(jsonString)
      } catch (e) {
        console.warn('Failed to parse JSON from localStorage:', e)
        return fallback
      }
    },
    loadFieldOrGenerateNewField() {
      // [tutorial] Scenario hands us a fully prepared field (skips
      // CreateFieldEngine + random generation).
      if (this.tutorialScenario && typeof this.tutorialScenario.buildField === 'function') {
        this.localField = this.tutorialScenario.buildField()
        return
      }
      if (this.field) {
        // Field provided as prop (from backend in multiplayer mode)
        // Make a deep copy and normalize to model instances to avoid mutating the prop
        this.localField = normalizeField(JSON.parse(JSON.stringify(this.field)))
        return
      }
      if (this.initialMap) {
        // Saved-map launch: rehydrate the canonical Map into model
        // instances. Canonical units carry only {player, _type} — the
        // engine expects starting movePoints + visibility on the field
        // (those are pre-game runtime values, not "map" data), so we
        // reseed them here using the same helper that createFieldEngine
        // uses for a random roll. Without this the unit reads
        // `movePoints = undefined`, which silently breaks the wave
        // engine (any distance "valid") and the fog calc (nothing
        // visible).
        this.localField = this.initialMap.field.map(row =>
          row.map(cellData => Models.Cell.fromJSON(cellData))
        )
        for (let x = 0; x < this.localField.length; x++) {
          for (let y = 0; y < this.localField[x].length; y++) {
            const cell = this.localField[x][y]
            if (!cell?.unit) continue
            const saved = this.initialMap.field[x][y]?.unit
            // Map-editor scenarios can stamp an explicit `movePoints`
            // (and optional `visibility`) on a starting unit so the
            // designer can place "fast" or "slow" dinos at will. If
            // present, honour it as the unit's speed. Built-in/random
            // maps don't ship this field, so they keep the original
            // "reseed to minSpeed" behaviour.
            //
            // `>= 0` (not `> 0`): speed 0 is a valid explicit choice —
            // an immobile dino, same as tutorial scenarios place.
            const explicitSpeed =
              typeof saved?.movePoints === 'number' && saved.movePoints >= 0
                ? saved.movePoints
                : null
            const minForRoll = explicitSpeed ?? this.minSpeed
            const maxForRoll = explicitSpeed ?? this.minSpeed
            cell.unit = createNewUnit(
              cell.unit.player,
              minForRoll,
              maxForRoll,
              this.speedMinVisibility,
              this.fogOfWarRadius,
              this.visibilitySpeedRelation,
              0
            )
            // `createNewUnit` uses its min bound for BOTH the speed roll
            // and the visibility scale, so passing the explicit speed as
            // the min would place every such unit at the bottom of the
            // scale — i.e. maximum visibility, whatever its speed. Rescale
            // against the game's own minSpeed so an explicitly placed
            // speed-3 dino sees exactly what a rolled speed-3 dino sees.
            // Speed-0 units see as far as speed-1 units, while remaining
            // immobile. Use the game's visibility scale for both.
            if (explicitSpeed !== null && this.visibilitySpeedRelation) {
              cell.unit.visibility = calculateUnitVisibility(
                Math.max(explicitSpeed, this.minSpeed, 1),
                this.minSpeed,
                this.speedMinVisibility,
                this.fogOfWarRadius
              )
            }
            if (saved?.visibility) cell.unit.visibility = saved.visibility
            if (saved?._type) cell.unit._type = saved._type
          }
        }
        return
      }
      if (this.loadGame) {
        const fieldFromStorage = localStorage.getItem('field')
        const parsedField = this.safeParseJSON(fieldFromStorage)
        // Validate field structure - must be a non-empty 2D array
        if (parsedField && Array.isArray(parsedField) && parsedField.length > 0) {
          // Reconstruct Cell instances (with nested Building/Unit) from plain objects
          this.localField = parsedField.map(row =>
            row.map(cellData => Models.Cell.fromJSON(cellData))
          )
        } else {
          console.warn('Invalid field data in localStorage, generating new field')
          this.loadGame = false // Fall back to new game
          this.localField = this.engine.generateField()
        }
      } else {
        this.localField = this.engine.generateField()
      }
    },
    loadOrCreatePlayers() {
      // [tutorial] Scenario builds its own players (skips
      // createPlayers — used to pin types and counts per scenario).
      if (this.tutorialScenario && typeof this.tutorialScenario.buildPlayers === 'function') {
        this.players = this.tutorialScenario.buildPlayers()
        return
      }
      if (this.initialMap) {
        // Saved-map / scenario launch: honour the seat types stored in
        // the map, but only seats that actually have something on the
        // field are played. A 7-slot map with three colours placed is a
        // 3-player game — the four empty slots used to be seated anyway
        // and were eliminated on their first turn.
        //
        // Empty seats stay in the array as inactive, non-participating
        // placeholders: `players` is indexed by seat everywhere (a unit
        // carries `player: <seat>`, colours come from the index), so
        // collapsing it would repaint everyone. Turn rotation skips them
        // for being inactive.
        const playable = new Set(getOccupiedSeats(this.initialMap))
        this.players = this.initialMap.players.map((p, seat) => {
          const player = Models.Player.fromJSON({ ...p })
          if (!playable.has(seat)) {
            player.participating = false
            player.active = false
          }
          return player
        })
        // The turn starts on the first playable seat — seat 0 may be one
        // of the empty ones in a hand-built map.
        const firstPlayable = this.players.findIndex(p => p.participating)
        if (firstPlayable > 0) this.currentPlayer = firstPlayable
        return
      }
      if (this.loadGame) {
        const players = localStorage.getItem('players')
        const parsedPlayers = this.safeParseJSON(players)
        // Validate players structure - must be a non-empty array
        if (parsedPlayers && Array.isArray(parsedPlayers) && parsedPlayers.length > 0) {
          // Reconstruct Player instances from plain objects
          this.players = parsedPlayers.map(p => Models.Player.fromJSON(p))
          // Choose current player
          for (let idx = 0; idx < this.players.length; idx++) {
            if (this.players[idx].active) {
              this.currentPlayer = idx
              break
            }
          }
          for (let player of this.players) {
            player.informed_lose = false
          }
        } else {
          console.warn('Invalid players data in localStorage, creating new players')
          this.loadGame = false // Fall back to new game
          this.players = createPlayers(this.humanPlayersNum, this.botPlayersNum)
        }
      } else {
        this.players = createPlayers(this.humanPlayersNum, this.botPlayersNum)
      }
    },
    loadGameStatus() {
      for (const field of GAME_STATUS_FIELDS) {
        this[field] = this.safeParseJSON(localStorage.getItem(field))
      }
      if (this.humanPhase === this.HUMAN_PHASES.informed) {
        this.humanPhase = this.HUMAN_PHASES.all_eliminated
      }
      if (this.winPhase === this.WIN_PHASES.informed) {
        this.winPhase = this.WIN_PHASES.has_winner
      }
      if (this.lastPlayerPhase === this.LAST_PLAYER_PHASES.informed) {
        this.lastPlayerPhase = this.LAST_PLAYER_PHASES.last_player
      }
    },
    undoLastMove() {
      if (this.isAnimating) return
      // [tutorial] Independent gate so a non-forceUndo step can lock
      // Undo (e.g. OK / forceEndTurn / lockAll steps).
      if (this.tutorialUndoBlocked) return
      // Scout-undo: revert the scout choice only and put the player back into
      // scout-target-selection mode. Move-undo is null at this point because
      // committing a scout target locked the move.
      if (this.scoutUndoState) {
        for (const [x, y] of this.scoutUndoState.revealedCoords) {
          this.localField[x][y].isHidden = true
        }
        for (const key of this.scoutUndoState.addedTempCoords || []) {
          this.tempVisibilityCoords.delete(key)
        }
        this.scoutUndoState = null
        // Deselect any selected unit and clear highlights, then re-arm scout
        // mode so the player can pick another target. Order matters: initTurn
        // wipes selectedAction, so setAction must follow it.
        emitter.emit('initTurn')
        emitter.emit('setAction', ACTIONS.scouting)
        return
      }

      if (!this.moveUndoState) return

      applyFieldDiff(this.localField, this.moveUndoState.diff)
      emitter.emit('initTurn')
      if (this.doesVisibilityMakeSense()) {
        this.setVisibility()
      }
      this.moveUndoState = null
      // [tutorial] Surface a successful move-undo so scenarios can
      // gate on the `undone` waitFor.
      emitter.emit('tutorial:undone')
    },

    // Bot move high level logic
    async makeBotMove() {
      this.state = this.STATES.play
      // Yield to the browser before the AI's heavy move-selection work
      // begins. Everything from "End turn click" up to this point runs
      // synchronously (showTurnNotification, restoreAndProduceUnits,
      // setVisibilityStartTurn, this state assignment), so without this
      // yield the user wouldn't see the new "Player N turn" toast or
      // the disabled buttons until botEngine.makeBotUnitMove finally
      // hits an internal await — which on a busy turn can be ~1s. The
      // setTimeout(0) gives Vue's render cycle a paint window. Tests
      // never reach this method (humanPlayersNum=1, botPlayersNum=0),
      // so fake timers aren't affected.
      await sleep(0)
      if (this.wasUnmounted) return
      console.log(`Bot player ${this.currentPlayer + 1} turn`)
      this.unitCoordsArr = this.getCurrentUnitCoords().filter(
        ([x, y]) => this.localField[x][y].unit?.movePoints > 0
      )
      // Stationary units still provide sight; their contribution cannot change
      // during this bot turn, so cache it once for all moving units.
      if (this.unitCoordsArr.length > 0) this.botEngine.prepareTurnVisibility(this.currentPlayer)
      // TODO: Choose order of moves (calculate, which move is more profitable) - ideal algorithm
      // TODO: Get visibility here and add visibility get from obelisks on each unit's move
      while (this.unitCoordsArr.length > 0) {
        if (this.wasUnmounted) return
        await this.botEngine.makeBotUnitMove(this.unitCoordsArr, this.currentPlayer, this.moveUnit)
      }
      emitter.emit('processEndTurn')
    },

    // findNextUnit, getCurrentUnitCoords, getCurrentStats come from gameCoreMixin

    // State helpers
    areAllHumanPlayersEliminated() {
      return !this.players.filter(p => p._type === Models.PlayerTypes.HUMAN).filter(p => p.active)
        .length
    },
    getLastPlayerIdx() {
      const activePlayers = this.players.filter(p => p.active)
      if (activePlayers.length === 1) {
        for (let idx = 0; idx < this.players.length; idx++) {
          if (this.players[idx].active) {
            return idx
          }
        }
      }
      return null
    },
    prepareWinner() {
      if (this.winPhase !== this.WIN_PHASES.has_winner) return null
      return this.winner
    },
    prepareLastPlayer() {
      if (this.lastPlayerPhase !== this.LAST_PLAYER_PHASES.last_player) return null
      return this.lastPlayer
    },
    checkSkipReadyLabel() {
      // [tutorial] Scenarios never want the "get ready" / "Player N
      // wins" ReadyLabel — the controller handles intros and
      // end-of-scenario messaging itself.
      if (this.tutorialScenario) return true
      return (
        (this.humanPlayersNum === 1 &&
          this.players[this.currentPlayer].active &&
          this.winPhase !== this.WIN_PHASES.has_winner &&
          this.lastPlayerPhase !== this.LAST_PLAYER_PHASES.last_player) ||
        (this.humanPhase === this.HUMAN_PHASES.informed &&
          this.lastPlayerPhase !== this.LAST_PLAYER_PHASES.last_player)
      )
    },
    exitGame() {
      // [tutorial] Return to the scenario list instead of a full
      // page reload so the player keeps their progress ticks (already
      // saved) and doesn't see the boot flash.
      if (this.tutorialScenario) {
        emitter.emit('goToPage', 'tutorial')
        return
      }
      window.location.reload()
    },
    showNotification(message, type = 'info', playerOrder = null) {
      // Turn notifications collapse: a new one replaces any stale turn
      // notification still on screen so fast bot rotations don't stack up
      // "Player 1 turn" / "Player 2 turn" / ... Other types (info etc.)
      // coexist as before.
      if (type === 'turn') {
        this.notifications = this.notifications.filter(n => n.type !== 'turn')
      }
      const id = Date.now() + Math.random()
      this.notifications.push({ id, message, type, playerOrder })

      // Auto-dismiss after 5 seconds for all notification types.
      setTimeout(() => {
        this.dismissNotification(id)
      }, 5000)
    },
    showTurnNotification(playerOrder) {
      const isHuman = this.players[playerOrder]?._type === Models.PlayerTypes.HUMAN
      const message = isHuman ? 'Your turn!' : `Player ${playerOrder + 1} turn`
      this.showNotification(message, 'turn', playerOrder)
    },
    // [tutorial] applyTutorialFirstProductionOverride and
    // getTutorialContext live in tutorialMixin.
    dismissNotification(id) {
      const index = this.notifications.findIndex(n => n.id === id)
      if (index !== -1) {
        this.notifications.splice(index, 1)
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
  transition:
    opacity 0.3s,
    transform 0.3s;
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
