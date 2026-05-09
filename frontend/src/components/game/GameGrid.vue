<template>
  <ActionHint v-if="selectedAction" :action="selectedAction" />
  <!--  <div class="main-wrapper">-->
  <div ref="gameGridContainer" class="game-grid-container">
    <div
      class="board-wrapper-container"
      :style="{
        '--board-width': boardWrapperWidth,
        '--board-height': boardWrapperHeight,
      }"
    >
      <div class="board-wrapper" :style="{ width: boardWrapperWidth, height: boardWrapperHeight }">
        <div class="board" :style="{ width: boardWidth, height: boardHeight }">
          <div
            class="cell_line"
            v-for="(line, y) in fieldT"
            :key="`row-${y}`"
            :style="{ width: lineWidth, height: lineHeight }"
          >
            <template v-for="(cellData, x) in line" :key="`cell-${x}-${y}`">
              <!-- TODO: Why do we have isHidden applied to field and not to fieldOutput? -->
              <GameCell
                :hidden="
                  displayVisibilityCoords
                    ? !displayVisibilityCoords.has(`${x},${y}`)
                    : field[x][y].isHidden
                "
                :dying="dyingCells ? dyingCells.has(`${x},${y}`) : false"
                :borning="borningCells ? borningCells.has(`${x},${y}`) : false"
                :pending-birth="pendingBirthCells ? pendingBirthCells.has(`${x},${y}`) : false"
                :width="cellSize"
                :height="cellSize"
                :terrain="cellData.terrain"
                :unit="cellData.unit"
                :building="cellData.building"
                :selected="selectedCoords && selectedCoords[0] === x && selectedCoords[1] === y"
                :highlighted="fieldOutput[x][y].isHighlighted"
                :current-player="currentPlayer"
                :my-player-order="myPlayerOrder"
                :hide-enemy-speed="hideEnemySpeed"
                :cell-x="x"
                :cell-y="y"
                :has-selected-unit="selectedCoords !== null"
                :current-stats="currentStats"
                :base-modifier="baseModifier"
                :selected-unit-on-storage="selectedUnitOnStorage"
                @click="processClick($event, x, y)"
                @context-menu="handleContextMenu"
                @mouse-enter="handleCellMouseEnter"
                @mouse-leave="handleCellMouseLeave"
              />
            </template>
          </div>
        </div>
        <VisibilityFrame
          v-if="visibilityFrameUnit"
          :x="visibilityFrameUnit.x"
          :y="visibilityFrameUnit.y"
          :radius="visibilityFrameUnit.visibility"
          :cell-size="cellSize"
          :player-index="visibilityFrameUnit.player"
          :field-width="width"
          :field-height="height"
        />
        <VisibilityFrame
          v-if="scoutPreviewFrame"
          :x="scoutPreviewFrame.x"
          :y="scoutPreviewFrame.y"
          :radius="scoutPreviewFrame.radius"
          :cell-size="cellSize"
          :player-index="scoutPreviewFrame.player"
          :field-width="width"
          :field-height="height"
          :show-center-marker="true"
        />
        <CellContextHelp
          :visible="contextHelpVisible"
          :x="contextHelpX"
          :y="contextHelpY"
          :cell-size="cellSize"
          :field-width="width"
          :field-height="height"
          :cell="contextHelpCell"
          :unit-modifier="unitModifier"
          :base-modifier="baseModifier"
          :fog-of-war-radius="fogOfWarRadius"
          :has-selected-unit="selectedCoords !== null"
          :current-stats="currentStats"
          :current-player="currentPlayer"
          :selected-unit-on-storage="selectedUnitOnStorage"
        />
      </div>
    </div>
  </div>
  <!--  </div>-->
</template>

<script>
import GameCell from '@/components/game/GameCell.vue'
import Models from '@/game/models'
import { WaveEngine } from '@/game/waveEngine'
import { FieldEngine } from '@/game/fieldEngine'
import { ACTIONS } from '@/game/const'

import emitter from '@/game/eventBus'
import ActionHint from '@/components/game/ActionHint.vue'
import CellContextHelp from '@/components/game/CellContextHelp.vue'
import VisibilityFrame from '@/components/game/VisibilityFrame.vue'

// `centerOnCell` skips scrolling when the cell is already this close to
// the viewport centre. Bigger than 1px so a unit that's slightly off-
// centre doesn't trigger a scroll for every move/birth — only really-
// off-centre cells pull the camera.
const CENTER_TOLERANCE_PX = 10

export default {
  name: 'GameGrid',
  components: {
    ActionHint,
    GameCell,
    CellContextHelp,
    VisibilityFrame,
  },
  props: {
    isHidden: Boolean,
    enableFogOfWar: Boolean,
    fogOfWarRadius: Number,
    enableScoutMode: Boolean,
    hideEnemySpeed: Boolean,
    field: Array[Array[Models.Cell]],
    currentPlayer: Number,
    myPlayerOrder: {
      type: Number,
      default: null, // null for single-player mode
    },
    cellSize: Number,
    isMyTurn: {
      type: Boolean,
      default: true, // Default to true for single-player mode compatibility
    },
    unitModifier: {
      type: Number,
      default: 3,
    },
    baseModifier: {
      type: Number,
      default: 3,
    },
    currentStats: {
      type: Object,
      default: () => ({
        towers: { total: 0, max: 0 },
      }),
    },
    menuOpen: {
      type: Boolean,
      default: false,
    },
    // Display-only visibility override. When provided, cells outside the set
    // render as hidden regardless of `cell.isHidden`. Used in single-player
    // bot turns so the human keeps their own fog while the field's
    // `isHidden` (kept consistent with `currentPlayer`) drives bot AI.
    displayVisibilityCoords: {
      type: Set,
      default: null,
    },
    // Cells whose unit is mid-death-animation. The controller adds the
    // killed coords here when a move's neighbour-kills land, holds for
    // `MOVE_ANIMATION_DELAY`, then actually removes the units and clears
    // the set. Forwarded to GameCell → GameUnit which renders the damage
    // overlay + fade-out.
    dyingCells: {
      type: Set,
      default: null,
    },
    // Cells whose unit is mid-birth-animation. The controller marks each
    // freshly-spawned cell as `borning` for `BIRTH_ANIMATION_DELAY` while
    // GameUnit fades the image in. Same Set-identity-changes-on-mutation
    // pattern as `dyingCells`.
    borningCells: {
      type: Set,
      default: null,
    },
    // Spawn cells whose fade-in hasn't started yet. The controller fills
    // this on turn-start so all spawn cells render at opacity 0 from the
    // first frame, then moves cells one by one out of the set into
    // `borningCells` to play their fade-in.
    pendingBirthCells: {
      type: Set,
      default: null,
    },
  },
  data() {
    return {
      selectedCoords: null,
      selectedAction: null,
      waveEngine: null,
      fieldEngine: null,
      fieldOutput: null, // Will be initialized in created()
      contextHelpVisible: false,
      contextHelpX: 0,
      contextHelpY: 0,
      contextHelpCell: null,
      infoPanelContextHelpVisible: false,
      // Visibility frame state: {x, y, visibility, player} or null (shown on right-click)
      visibilityFrameUnit: null,
      // Scout preview state: {x, y} or null (shown on hover/right-click in scout mode)
      scoutPreviewCoords: null,
    }
  },
  computed: {
    width() {
      return this.field && this.field.length > 0 ? this.field.length : 0
    },
    height() {
      return this.field && this.field.length > 0 && this.field[0] ? this.field[0].length : 0
    },
    fieldT() {
      // Transpose field for rendering (convert from [x][y] to [y][x])
      if (!this.field || this.field.length === 0 || !this.field[0]) {
        return []
      }
      return this.field[0].map((x, i) => this.field.map(x => x[i]))
    },
    lineHeight() {
      return `${this.cellSize}px`
    },
    lineWidth() {
      return `${this.cellSize * this.width}px`
    },
    boardHeight() {
      return `${this.cellSize * this.height}px`
    },
    boardWidth() {
      return `${this.cellSize * this.width}px`
    },
    boardWrapperHeight() {
      return `${this.cellSize * this.height + 50}px`
    },
    boardWrapperWidth() {
      return `${this.cellSize * this.width}px`
    },
    selectedUnitOnStorage() {
      // Check if the selected unit is standing on a storage building
      if (!this.selectedCoords) {
        return false
      }
      const [x, y] = this.selectedCoords
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
        return false
      }
      const cell = this.field[x][y]
      if (!cell || !cell.building) {
        return false
      }
      return cell.building._type === Models.BuildingTypes.STORAGE
    },
    scoutPreviewFrame() {
      // Returns scout preview frame config when in scout mode and coords are set
      if (this.selectedAction !== ACTIONS.scouting || !this.scoutPreviewCoords) {
        return null
      }
      return {
        x: this.scoutPreviewCoords.x,
        y: this.scoutPreviewCoords.y,
        radius: this.fogOfWarRadius,
        player: this.currentPlayer,
      }
    },
  },
  created() {
    // Initialize fieldOutput
    if (this.field && this.field.length > 0 && this.field[0]) {
      const width = this.field.length
      const height = this.field[0].length
      this.fieldOutput = Array.from({ length: width }, () =>
        Array.from({ length: height }, () => ({ isHidden: false, isHighlighted: false }))
      )
    }

    this.waveEngine = new WaveEngine(
      this.field,
      this.width,
      this.height,
      this.fogOfWarRadius,
      this.enableScoutMode
    )
    this.fieldEngine = new FieldEngine(this.field, this.width, this.height, this.fogOfWarRadius)
  },
  watch: {
    field: {
      handler(newField, oldField) {
        // Update engines when field prop changes
        if (newField && newField.length > 0 && newField[0]) {
          const width = newField.length
          const height = newField[0].length

          // Check if dimensions changed (more significant change requiring engine recreation)
          const oldWidth = oldField?.length || 0
          const oldHeight = oldField?.[0]?.length || 0
          const dimensionsChanged = width !== oldWidth || height !== oldHeight

          // Update fieldOutput dimensions if needed
          if (
            !this.fieldOutput ||
            this.fieldOutput.length !== width ||
            (this.fieldOutput[0] && this.fieldOutput[0].length !== height)
          ) {
            this.fieldOutput = Array.from({ length: width }, () =>
              Array.from({ length: height }, () => ({ isHidden: false, isHighlighted: false }))
            )
          }

          // Only recreate engines if dimensions changed or field reference changed
          // Note: Using reference equality check as a proxy for "significant" changes
          // This avoids expensive deep comparisons while still handling most cases
          if (dimensionsChanged || newField !== oldField) {
            // Update engines with new field reference
            this.waveEngine = new WaveEngine(
              newField,
              width,
              height,
              this.fogOfWarRadius,
              this.enableScoutMode
            )
            this.fieldEngine = new FieldEngine(newField, width, height, this.fogOfWarRadius)
          } else {
            // Just update the field reference in existing engines
            this.waveEngine.field = newField
            this.fieldEngine.field = newField
          }
        }
      },
      // Use shallow watch instead of deep - more performant
      // The watcher will still trigger on field reference changes and Vue's reactivity
      deep: false,
      immediate: false,
    },
  },
  mounted() {
    emitter.on('initTurn', this.initTurn)
    emitter.on('selectNextUnit', this.selectNextUnit)
    emitter.on('infoPanelContextHelpChanged', this.onInfoPanelContextHelpChanged)
    emitter.on('closeGameGridContextHelp', this.hideContextHelp)
    emitter.on('setAction', this.setAction)
    emitter.on('saveCoords', this.saveCoords)
    emitter.on('getScrollCoordsByCell', this.getScrollCoordsByCell)
    // Hide context help when clicking outside
    document.addEventListener('click', this.hideContextHelpOnOutsideClick)
  },
  beforeUnmount() {
    emitter.off('initTurn', this.initTurn)
    emitter.off('selectNextUnit', this.selectNextUnit)
    emitter.off('infoPanelContextHelpChanged', this.onInfoPanelContextHelpChanged)
    emitter.off('closeGameGridContextHelp', this.hideContextHelp)
    emitter.off('setAction', this.setAction)
    emitter.off('saveCoords', this.saveCoords)
    emitter.off('getScrollCoordsByCell', this.getScrollCoordsByCell)
    document.removeEventListener('click', this.hideContextHelpOnOutsideClick)
  },
  methods: {
    initTurn(scrollCoords = null) {
      // console.log(scrollCoords);
      this.selectedCoords = null
      this.selectedAction = null
      this.visibilityFrameUnit = null
      this.scoutPreviewCoords = null
      this.removeHighlights()
      if (scrollCoords) {
        this.$refs.gameGridContainer.scrollTo(...scrollCoords)
      }
    },
    selectNextUnit(unitCoordsArr) {
      if (unitCoordsArr.length === 0) return

      let coords = unitCoordsArr[0]

      if (this.selectedCoords) {
        const curIdx = unitCoordsArr.findIndex(
          el => el[0] === this.selectedCoords[0] && el[1] === this.selectedCoords[1]
        )
        if (curIdx !== -1 && curIdx + 1 < unitCoordsArr.length) {
          // Selected unit is still in the array, select next one
          coords = unitCoordsArr[curIdx + 1]
        } else if (curIdx === -1) {
          // Selected unit was moved (no longer in array), continue with next unit
          // Find the first unit that comes after the previously selected position
          // If no such unit exists, wrap around to the first unit
          const nextIdx = unitCoordsArr.findIndex(el => {
            // Compare by position: find first unit that is "after" the selected one
            return (
              el[0] > this.selectedCoords[0] ||
              (el[0] === this.selectedCoords[0] && el[1] > this.selectedCoords[1])
            )
          })
          coords = nextIdx !== -1 ? unitCoordsArr[nextIdx] : unitCoordsArr[0]
        }
        // If curIdx is the last element, it will wrap to the first (coords already set to unitCoordsArr[0])
      }
      const [x, y] = coords
      const unit = this.field[x][y].unit
      if (unit) {
        this.selectUnit(x, y, unit.movePoints)
        const scrollCoords = this.getScrollCoordsByCell([x, y])
        this.$refs.gameGridContainer.scrollTo(...scrollCoords)
      }
    },
    selectUnit(x, y, movePoints) {
      this.selectedCoords = [x, y]
      this.removeHighlights()
      this.setHighlights(x, y, movePoints)
    },
    processClick(event, x, y) {
      // Don't process clicks if menu is open
      if (this.menuOpen) {
        return
      }

      // Check if any context window is open
      const wasContextHelpVisible = this.contextHelpVisible || this.infoPanelContextHelpVisible

      // Hide context help on any click
      this.hideContextHelp()

      // If a context window was open, just close it and don't perform any action
      if (wasContextHelpVisible) {
        return
      }

      // In multiplayer mode, only process clicks if it's the player's turn
      if (!this.isMyTurn) {
        console.log('Not my turn')
        return
      }

      if (this.selectedAction === ACTIONS.scouting) {
        // In multiplayer, send scout message to server
        emitter.emit('scoutArea', { x: x, y: y, fogRadius: this.fogOfWarRadius })
        this.selectedAction = null
        this.scoutPreviewCoords = null
        return
      }
      const unit = this.field[x][y].unit
      if (unit) {
        // Select unit if it belongs to current player and hasn't moved
        if (unit.player === this.currentPlayer && !unit.hasMoved) {
          // If clicking on already selected unit, deselect it
          if (this.selectedCoords && this.selectedCoords[0] === x && this.selectedCoords[1] === y) {
            this.selectedCoords = null
            this.removeHighlights()
          } else {
            this.selectUnit(x, y, unit.movePoints)
          }
        }
      } else if (this.selectedCoords && this.waveEngine.canMove(this.selectedCoords, [x, y])) {
        // Move unit to clicked cell - this will emit 'moveUnit' event
        // which will be handled by MultiplayerDinoGame to send to server
        this.moveUnit(this.selectedCoords, [x, y])
      }
    },
    moveUnit(fromCoords, toCoords) {
      let [x, y] = fromCoords
      // Save movePoints value for the further remove highlights
      const movePoints = this.field[x][y].unit.movePoints
      // Call game moveUnit function to change field
      emitter.emit('moveUnit', { fromCoords: fromCoords, toCoords: toCoords })
      this.selectedCoords = null
      this.removeHighlightsForArea(x, y, movePoints)
    },
    setAction(action) {
      this.selectedAction = action
      // Clear scout preview when action is cleared
      if (!action) {
        this.scoutPreviewCoords = null
      }
    },
    saveCoords(player) {
      const container = this.$refs.gameGridContainer
      player.scrollCoords = [container.scrollLeft, container.scrollTop]
    },
    getScrollCoordsByCell(coords) {
      const [x, y] = coords
      const container = this.$refs.gameGridContainer
      const scrollX = x * this.cellSize - container.clientWidth / 2 + this.cellSize / 2
      const scrollY = y * this.cellSize - container.clientHeight / 2 + this.cellSize / 2
      return [scrollX, scrollY]
    },
    // Centre the viewport on a cell with a smooth scroll. Returns a Promise
    // that resolves to `true` once the smooth-scroll has actually finished
    // (via the browser's `scrollend` event, with a timeout fallback), or
    // `false` immediately if the cell is already centred to within
    // CENTER_TOLERANCE_PX (no-op). The browser clamps the scroll to the
    // container's bounds, so edge cells land as close to centre as possible.
    //
    // The tolerance is intentionally generous (a few cells of slop on a
    // typical zoom level): if the unit is already comfortably near the
    // middle of the screen, the camera stays still rather than nudging by
    // a few pixels every step. Cuts down on unnecessary scrolls.
    //
    // Used by the move animator and the birth-sequencer to make the user
    // look at the action's cell before the animation begins.
    centerOnCell(coords) {
      const container = this.$refs.gameGridContainer
      if (!container) return Promise.resolve(false)
      const [tx, ty] = this.getScrollCoordsByCell(coords)
      // Clamp the ideal centre to the container's real scroll range
      // before measuring the delta. Without this, edge cells (e.g. last
      // column) ask for a `tx` beyond `scrollWidth - clientWidth`; the
      // browser clamps the actual scroll, so `scrollLeft` lands at the
      // max but `tx` doesn't — `dx` stays large forever and every
      // subsequent call kicks off a scrollTo that does nothing, then
      // burns the 800 ms `scrollend` fallback timeout waiting for an
      // event that never fires.
      const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth)
      const maxTop = Math.max(0, container.scrollHeight - container.clientHeight)
      const clampedTx = Math.max(0, Math.min(maxLeft, tx))
      const clampedTy = Math.max(0, Math.min(maxTop, ty))
      const dx = Math.abs(container.scrollLeft - clampedTx)
      const dy = Math.abs(container.scrollTop - clampedTy)
      if (dx <= CENTER_TOLERANCE_PX && dy <= CENTER_TOLERANCE_PX) {
        return Promise.resolve(false)
      }
      return new Promise(resolve => {
        let settled = false
        let timeoutId = null
        const finish = () => {
          if (settled) return
          settled = true
          container.removeEventListener('scrollend', finish)
          if (timeoutId !== null) clearTimeout(timeoutId)
          resolve(true)
        }
        container.addEventListener('scrollend', finish, { once: true })
        // Fallback for browsers without `scrollend` support, or for cases
        // where the event doesn't fire (e.g. user-initiated scroll cancels
        // the smooth animation). Generous bound — the animation only starts
        // after this resolves, so being late is fine; never resolving is not.
        timeoutId = setTimeout(finish, 800)
        container.scrollTo({ left: tx, top: ty, behavior: 'smooth' })
      })
    },

    // Highlights helpers
    removeHighlights() {
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.fieldOutput[curX][curY].isHighlighted = false
        }
      }
    },
    removeHighlightsForArea(x, y, radius) {
      for (let curX = x - radius; curX <= x + radius; curX++) {
        for (let curY = y - radius; curY <= y + radius; curY++) {
          if (this.fieldEngine.areExistingCoords(curX, curY))
            this.fieldOutput[curX][curY].isHighlighted = false
        }
      }
    },
    setHighlights(x, y, radius) {
      const highlightedCoordsArr = this.waveEngine.getReachableCoordsArr(x, y, radius)

      for (const coords of highlightedCoordsArr) {
        const curX = coords[0]
        const curY = coords[1]
        this.fieldOutput[curX][curY].isHighlighted = true
      }
    },
    handleContextMenu(coords) {
      const { x, y } = coords
      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        const cell = this.field[x][y]
        // Only show context help for visible cells
        if (!cell.isHidden) {
          // Close InfoPanel context help if open
          if (this.infoPanelContextHelpVisible) {
            emitter.emit('infoPanelContextHelpChanged', false)
          }
          this.contextHelpX = x
          this.contextHelpY = y
          this.contextHelpCell = cell
          this.contextHelpVisible = true

          // In scout mode: show scout preview instead of unit visibility
          if (this.selectedAction === ACTIONS.scouting) {
            this.scoutPreviewCoords = { x, y }
            this.visibilityFrameUnit = null
          } else {
            // Show visibility frame if fog of war is enabled and the cell has a unit
            if (this.enableFogOfWar && cell.unit) {
              this.visibilityFrameUnit = {
                x,
                y,
                visibility: cell.unit.visibility,
                player: cell.unit.player,
              }
            } else {
              this.visibilityFrameUnit = null
            }
          }
        }
      }
    },
    hideContextHelp() {
      this.contextHelpVisible = false
      // Clear visibility frame (only shown via right-click context menu)
      this.visibilityFrameUnit = null
    },
    hideContextHelpOnOutsideClick(event) {
      // Hide context help if clicking outside the board
      if (this.contextHelpVisible && this.$refs.gameGridContainer) {
        if (!this.$refs.gameGridContainer.contains(event.target)) {
          this.hideContextHelp()
        }
      }
    },
    onInfoPanelContextHelpChanged(visible) {
      this.infoPanelContextHelpVisible = visible
    },
    handleCellMouseEnter(coords) {
      // Show scout preview on hover when in scout mode
      if (this.selectedAction === ACTIONS.scouting) {
        this.scoutPreviewCoords = { x: coords.x, y: coords.y }
      }
    },
    handleCellMouseLeave() {
      // Clear scout preview on mouse leave (only if set via hover, not right-click)
      // We clear it on any leave since right-click will re-set it anyway
      if (this.selectedAction === ACTIONS.scouting) {
        this.scoutPreviewCoords = null
      }
    },
  },
}
</script>

<style scoped>
.main-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  width: 100vw;
}

.game-grid-container {
  width: 100vw; /* Full viewport width */
  height: 100vh; /* Full viewport height */
  overflow: auto; /* Enables scroll when the content overflows */
  position: relative;
  /* Hide scrollbars but keep scrolling */
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
  background-image: url('/images/background.png');
  background-size: cover;
}

.board-wrapper-container {
  display: flex;
  justify-content: center; /* Centers horizontally */
  align-items: center; /* Centers vertically when content fits */
  position: relative;
  /* Use max() to ensure container is at least viewport size OR board size, whichever is larger */
  min-width: max(100vw, var(--board-width, 100vw));
  min-height: max(100vh, var(--board-height, 100vh));
}

.game-grid-container::-webkit-scrollbar {
  display: none; /* Safari and Chrome */
}

div.board-wrapper {
  position: relative;
  display: inline-block;
  flex-shrink: 0; /* Prevents shrinking, ensures container expands to fit */
}

div.board {
  position: relative;
  border: solid 2px;
  color: #2c3e50;
}
</style>
