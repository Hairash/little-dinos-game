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
    :cell-size="cellSize"
    :unit-modifier="unitModifier"
    :base-modifier="baseModifier"
    :current-stats="getCurrentStats()"
    :menu-open="menuOpen"
    :display-visibility-coords="displayVisibilityCoords"
    :dying-cells="dyingCells"
    :borning-cells="borningCells"
    :pending-birth-cells="pendingBirthCells"
  />
  <InfoPanel
    v-if="state === STATES.play"
    :current-player="currentPlayer"
    :players="players"
    :current-stats="getCurrentStats()"
    :handle-end-turn-btn-click="processEndTurn"
    :handle-unit-click="findNextUnit"
    :cell-size="cellSize"
    :handle-change-cell-size="changeCellSize"
    :handle-exit-btn-click="() => (this.state = this.STATES.exitDialog)"
    :are-all-units-on-buildings="this.fieldEngine.areAllUnitsOnBuildings(this.currentPlayer)"
    :field="localField"
    :field-engine="fieldEngine"
    :enable-fog-of-war="enableFogOfWar"
    :min-speed="minSpeed"
    :max-speed="maxSpeed"
    :can-undo="canUndo"
    :handle-undo-click="undoLastMove"
    @menu-open="handleMenuOpen"
  />
  <ExitDialog
    v-if="state === STATES.exitDialog"
    :handle-cancel="() => (state = STATES.play)"
    :handle-confirm="exitGame"
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
import Models from '@/game/models'
import { CreateFieldEngine } from '@/game/createFieldEngine'
import { WaveEngine } from '@/game/waveEngine'
import { FieldEngine } from '@/game/fieldEngine'
import { BotEngine } from '@/game/botEngine'
import { createPlayers, getPlayerColor, normalizeField } from '@/game/helpers'
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
import { computeFieldDiff, applyFieldDiff } from '@/game/fieldDiff'
import { animateMovePath } from '@/game/moveAnimator'

import emitter from '@/game/eventBus'

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
    field: Array, // Optional: pre-generated field from backend (for multiplayer)
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
      //   scoutUndoState — { revealedCoords, canUndo }: set on every scout; sits on top of moveUndoState
      // The undo button reverts whichever is on top (scout first), preserving the layer underneath.
      moveUndoState: null,
      scoutUndoState: null,
      unitCoordsArr: [],
      tempVisibilityCoords: new Set(), // Set of coord pairs (x, y) of obelisks that will be shown next turn
      // Handler references for cleanup (to prevent memory leaks)
      keyupHandlerRef: null,
      contextmenuHandlerRef: null,
      mouseupHandlerRef: null,
      menuOpen: false,
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
    }
  },
  computed: {
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
      const set = new Set()
      for (const [x, y] of this.fieldEngine.getCurrentVisibilitySet(human)) {
        set.add(`${x},${y}`)
      }
      return set
    },
    canUndo() {
      // Game-over states lock undo: a player must not be able to revert the
      // winning/losing move (or anything else once the game has been decided).
      if (this.winPhase !== this.WIN_PHASES.progress) return false
      if (this.humanPhase !== this.HUMAN_PHASES.progress) return false
      if (this.players[this.currentPlayer]._type === Models.PlayerTypes.BOT) return false
      // Don't expose the undo button while a move is animating.
      if (this.isAnimating) return false
      if (this.scoutUndoState) return this.scoutUndoState.canUndo
      if (this.moveUndoState) return this.moveUndoState.canUndo
      return false
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
      if (e.key === 'Enter') this.state = this.STATES.play
      if (e.key === 'e' && this.state === this.STATES.play) this.processEndTurn()
      // TODO: Add test mode
      // if (e.key === 'Enter') this.makeBotUnitMove();
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
  },
  mounted() {
    emitter.on('makeBotMove', this.makeBotMove)
    emitter.on('processEndTurn', this.processEndTurn)
    emitter.on('startTurn', this.startTurn)
    emitter.on('moveUnit', this.emitMoveUnit)
    emitter.on('scoutArea', this.handleScoutArea)

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
    handleExitClick() {
      this.state = this.STATES.exitDialog
    },
    async startTurn() {
      // Show turn notification for all players (human and bot)
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

      if (counters.buildingsNum === 0 && counters.unitsNum === 0) {
        this.players[this.currentPlayer].active = false
      }

      this.setVisibilityStartTurn()

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
          emitter.emit('initTurn', this.players[this.currentPlayer].scrollCoords)
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
      this.isAnimating = true
      try {
        const humanPlayer = this.findHumanPlayerOrder()
        const humanVisibility =
          this.doesVisibilityMakeSense() && humanPlayer !== null
            ? new Set(
                Array.from(this.fieldEngine.getCurrentVisibilitySet(humanPlayer)).map(
                  ([hx, hy]) => `${hx},${hy}`
                )
              )
            : null

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
    // Change field after unit's move. Async because we walk the unit
    // cell-by-cell along the path before applying side-effects.
    async moveUnit(fromCoords, toCoords) {
      // Capture field state BEFORE the move (for undo diff)
      // Note: Use JSON.parse/stringify instead of structuredClone because Vue reactive proxies cannot be cloned
      const fieldSnapshot = JSON.parse(JSON.stringify(this.localField))

      // Capture visibility BEFORE the move (if fog of war enabled)
      // Convert to Set of strings for proper comparison (arrays use reference equality)
      let visibleCoordsBefore = null
      if (this.doesVisibilityMakeSense()) {
        const rawSet = this.fieldEngine.getCurrentVisibilitySet(this.currentPlayer)
        visibleCoordsBefore = new Set(Array.from(rawSet).map(coords => JSON.stringify(coords)))
      }

      const [x0, y0] = fromCoords
      const [x1, y1] = toCoords
      const unit = this.localField[x0][y0].unit

      // Snapshot the human player's visibility for the duration of this move.
      // The same Set drives both the animator's sleep predicate (which steps
      // get a real 100ms delay) and the display override on GameGrid (which
      // cells render as visible). Freezing both means the rendered fog can't
      // shift mid-animation — important when the move ends in killing the
      // human's last unit, otherwise the post-walk kill would shrink live
      // visibility and hide the cells the bot just walked through.
      const humanPlayer = this.findHumanPlayerOrder()
      const humanVisibility =
        this.doesVisibilityMakeSense() && humanPlayer !== null
          ? new Set(
              Array.from(this.fieldEngine.getCurrentVisibilitySet(humanPlayer)).map(
                ([hx, hy]) => `${hx},${hy}`
              )
            )
          : null
      this.displayVisibilitySnapshot = humanVisibility

      // Walk the unit along the BFS path. fieldEngine.moveUnit is bypassed
      // because the animator already places the unit on the destination cell;
      // we only need to set hasMoved here.
      const path = this.waveEngine.getPath(x0, y0, x1, y1, unit.movePoints) || [
        [x0, y0],
        [x1, y1],
      ]
      // Centre the camera on the unit's starting cell (or the first
      // visible cell of its path, if it begins in fog) before the walk
      // begins. Smooth-centre awaits scrollend, so the user is looking at
      // the action when it starts.
      //
      // Skipped when the moving unit belongs to the local human player:
      // they're driving the move themselves, so the camera shouldn't
      // jerk away from where they clicked.
      const isOwnMove = humanPlayer !== null && unit.player === humanPlayer
      if (SCROLL_TO_MOVES && !isOwnMove) {
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
        await animateMovePath(this.localField, path, unit, {
          isVisible: ([cx, cy]) =>
            humanVisibility === null || humanVisibility.has(`${cx},${cy}`),
          isCancelled: () => this.wasUnmounted,
        })
        if (this.wasUnmounted) return
        unit.hasMoved = true

        const buildingCaptured = this.fieldEngine.captureBuildingIfNeeded(x1, y1, unit.player)
        // Triggered actions (e.g. obelisk → scouting) belong to the moving
        // player. Only surface the prompt to a human player; otherwise a bot
        // landing on an obelisk would flash "Select area for scouting" UI to
        // the human.
        if (this.players[unit.player]?._type === Models.PlayerTypes.HUMAN) {
          const action = this.fieldEngine.getActionTriggered(x1, y1)
          if (action) {
            emitter.emit('setAction', action)
          }
        }
        // Death animation for cells about to be killed by the move's
        // neighbour-pass. `playDeathAnimation` flashes damage + fades the
        // unit images, then we actually remove them. Same helper drives
        // kill-at-birth in `startTurn` so every death uses one cadence.
        const killedCoords = this.fieldEngine.findKillNeighbours(x1, y1, unit.player)
        await this.playDeathAnimation(killedCoords)
        if (this.wasUnmounted) return
        this.fieldEngine.killNeighbours(x1, y1, unit.player)

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
        if (this.doesVisibilityMakeSense()) {
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
    findHumanPlayerOrder() {
      for (let i = 0; i < this.players.length; i++) {
        if (this.players[i]._type === Models.PlayerTypes.HUMAN) return i
      }
      return null
    },
    processEndTurn() {
      if (this.isAnimating) return
      if (this.state === this.STATES.ready) return
      this.state = this.STATES.ready
      emitter.emit('saveCoords', this.players[this.currentPlayer])
      this.moveUndoState = null
      this.scoutUndoState = null
      this.selectNextPlayerAndCheckPhases()
      emitter.emit('startTurn')
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
      if (
        this.getLastPlayerIdx() === this.currentPlayer ||
        (this.scoresToWin > 0 && this.players[this.currentPlayer].score >= this.scoresToWin) ||
        this.fieldEngine.areAllPlayersOccupied(this.currentPlayer)
      ) {
        this.winPhase = this.WIN_PHASES.has_winner
        this.winner = this.currentPlayer
        if (this.players[this.currentPlayer]._type === Models.PlayerTypes.HUMAN) {
          this.state = this.STATES.ready
        }
      }
    },
    selectNextPlayerAndCheckPhases() {
      do {
        this.currentPlayer += 1
        this.currentPlayer %= this.playersNum
        if (this.currentPlayer === 0) {
          this.saveState()
          if (
            this.humanPhase === this.HUMAN_PHASES.progress &&
            this.areAllHumanPlayersEliminated()
          ) {
            this.humanPhase = this.HUMAN_PHASES.all_eliminated
          }
          if (this.lastPlayerPhase === this.LAST_PLAYER_PHASES.progress) {
            const lastPlayerIdx = this.getLastPlayerIdx()
            if (lastPlayerIdx !== null) {
              this.lastPlayerPhase = this.LAST_PLAYER_PHASES.last_player
              this.lastPlayer = lastPlayerIdx
            }
          }
          // If all human players eliminated, they may observe bot fight
          if (this.humanPhase !== this.HUMAN_PHASES.progress) {
            break
          }
        }
      } while (!this.players[this.currentPlayer].active)
    },
    // changeCellSize comes from gameCoreMixin
    initPlayersScrollCoords() {
      for (let playerNum = 0; playerNum < this.players.length; playerNum++) {
        const coords = this.getCurrentUnitCoords(playerNum)[0]
        // console.log('coords', coords);
        this.players[playerNum].scrollCoords = this.$refs.gameGridRef.getScrollCoordsByCell(coords)
      }
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

      this.addTempVisibilityForCoords(data.x, data.y, data.fogRadius)

      // Picking a scout target commits the move: from now on the only thing
      // undo can revert is the scout choice itself.
      this.scoutUndoState = { revealedCoords, canUndo: revealedCoords.length === 0 }
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
      this.tempVisibilityCoords = new Set()
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
      if (this.doesVisibilityMakeSense()) {
        this.setVisibility()
      } else {
        this.showField()
      }
    },

    // Save-load operations
    saveState() {
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
      if (this.field) {
        // Field provided as prop (from backend in multiplayer mode)
        // Make a deep copy and normalize to model instances to avoid mutating the prop
        this.localField = normalizeField(JSON.parse(JSON.stringify(this.field)))
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
      // Scout-undo: revert the scout choice only and put the player back into
      // scout-target-selection mode. Move-undo is null at this point because
      // committing a scout target locked the move.
      if (this.scoutUndoState) {
        for (const [x, y] of this.scoutUndoState.revealedCoords) {
          this.localField[x][y].isHidden = true
          this.tempVisibilityCoords.delete(`${x},${y}`)
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
    },

    // Bot move high level logic
    async makeBotMove() {
      this.state = this.STATES.play
      console.log(`Bot player ${this.currentPlayer + 1} turn`)
      this.unitCoordsArr = this.getCurrentUnitCoords()
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
      window.location.reload()
    },
    showNotification(message, type = 'info', playerOrder = null) {
      const id = Date.now() + Math.random()
      this.notifications.push({ id, message, type, playerOrder })

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        this.dismissNotification(id)
      }, 5000)
    },
    showTurnNotification(playerOrder) {
      const message = `Player ${playerOrder + 1} turn`
      this.showNotification(message, 'turn', playerOrder)
    },
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
