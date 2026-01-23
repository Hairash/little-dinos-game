<template>
  <ActionHint v-if="selectedAction" :action="selectedAction" />
<!--  <div class="main-wrapper">-->
    <div ref="gameGridContainer" class="game-grid-container">
      <div
        class="board-wrapper"
        :style="{ width: boardWrapperWidth, height: boardWrapperHeight }"
      >
        <div
          class="board"
          :style="{ width: boardWidth, height: boardHeight }"
        >
          <div
              class="cell_line" v-for="(line, y) in fieldT"
              :key=y
              :style="{ width: lineWidth, height: lineHeight }"
          >
            <template v-for="(cellData, x) in line" :key=x>
              <!-- TODO: Why do we have isHidden applied to field and not to fieldOutput? -->
              <GameCell
                :hidden="field[x][y].isHidden"
                :width="cellSize"
                :height="cellSize"
                :terrain=cellData.terrain
                :unit=cellData.unit
                :building=cellData.building
                :selected="(selectedCoords && selectedCoords[0] === x && selectedCoords[1] === y)"
                :highlighted="fieldOutput[x][y].isHighlighted"
                :currentPlayer="currentPlayer"
                :myPlayerOrder="myPlayerOrder"
                :hideEnemySpeed="hideEnemySpeed"
                :cellX="x"
                :cellY="y"
                :hasSelectedUnit="selectedCoords !== null"
                :currentStats="currentStats"
                :baseModifier="baseModifier"
                :selectedUnitOnStorage="selectedUnitOnStorage"
                @click="processClick($event, x, y)"
                @contextMenu="handleContextMenu"
              />
            </template>
          </div>
        </div>
        <CellContextHelp
          :visible="contextHelpVisible"
          :x="contextHelpX"
          :y="contextHelpY"
          :cellSize="cellSize"
          :fieldWidth="width"
          :fieldHeight="height"
          :cell="contextHelpCell"
          :unitModifier="unitModifier"
          :baseModifier="baseModifier"
          :fogOfWarRadius="fogOfWarRadius"
          :hasSelectedUnit="selectedCoords !== null"
          :currentStats="currentStats"
          :currentPlayer="currentPlayer"
          :selectedUnitOnStorage="selectedUnitOnStorage"
        />
      </div>
    </div>
<!--  </div>-->
</template>

<script>
import GameCell from '@/components/GameCell.vue'
import Models from '@/game/models'
import { WaveEngine } from '@/game/waveEngine'
import { FieldEngine } from '@/game/fieldEngine'
import { ACTIONS } from '@/game/const'

import emitter from '@/game/eventBus';
import ActionHint from "@/components/ActionHint.vue";
import CellContextHelp from "@/components/CellContextHelp.vue";

export default {
  name: "GameGrid",
  components: {
    ActionHint,
    GameCell,
    CellContextHelp,
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
  },
  data() {
    return {
      selectedCoords: null,
      selectedAction: null,
      waveEngine: null,
      fieldEngine: null,
      fieldOutput: null,  // Will be initialized in created()
      contextHelpVisible: false,
      contextHelpX: 0,
      contextHelpY: 0,
      contextHelpCell: null,
      infoPanelContextHelpVisible: false,
    }
  },
  computed: {
    width() {
      return this.field && this.field.length > 0 ? this.field.length : 0;
    },
    height() {
      return this.field && this.field.length > 0 && this.field[0] ? this.field[0].length : 0;
    },
    fieldT() {
      // Transpose field for rendering (convert from [x][y] to [y][x])
      if (!this.field || this.field.length === 0 || !this.field[0]) {
        return [];
      }
      return this.field[0].map((x, i) => this.field.map(x => x[i]));
    },
    lineHeight() {
      return `${this.cellSize}px`;
    },
    lineWidth() {
      return `${this.cellSize * this.width}px`;
    },
    boardHeight() {
      return `${this.cellSize * this.height}px`;
    },
    boardWidth() {
      return `${this.cellSize * this.width}px`;
    },
    boardWrapperHeight() {
      return `${this.cellSize * this.height + 50}px`
    },
    boardWrapperWidth() {
      return `${this.cellSize * this.width}px`;
    },
    selectedUnitOnStorage() {
      // Check if the selected unit is standing on a storage building
      if (!this.selectedCoords) {
        return false;
      }
      const [x, y] = this.selectedCoords;
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
        return false;
      }
      const cell = this.field[x][y];
      if (!cell || !cell.building) {
        return false;
      }
      return cell.building._type === Models.BuildingTypes.STORAGE;
    },
  },
  created() {
    // Initialize fieldOutput
    if (this.field && this.field.length > 0 && this.field[0]) {
      const width = this.field.length;
      const height = this.field[0].length;
      this.fieldOutput = Array.from({ length: width }, () =>
        Array.from({ length: height }, () => ({ isHidden: false, isHighlighted: false }))
      );
    }
    
    this.waveEngine = new WaveEngine(
      this.field,
      this.width,
      this.height,
      this.fogOfWarRadius,
      this.enableScoutMode,
    );
    this.fieldEngine = new FieldEngine(
      this.field,
      this.width,
      this.height,
      this.fogOfWarRadius,
    );
  },
  watch: {
    field: {
      handler(newField) {
        // Update engines when field prop changes
        if (newField && newField.length > 0 && newField[0]) {
          const width = newField.length;
          const height = newField[0].length;
          
          // Update fieldOutput dimensions if needed
          if (!this.fieldOutput || this.fieldOutput.length !== width || 
              (this.fieldOutput[0] && this.fieldOutput[0].length !== height)) {
            this.fieldOutput = Array.from({ length: width }, () =>
              Array.from({ length: height }, () => ({ isHidden: false, isHighlighted: false }))
            );
          }
          
          // Update engines with new field reference
          this.waveEngine = new WaveEngine(
            newField,
            width,
            height,
            this.fogOfWarRadius,
            this.enableScoutMode,
          );
          this.fieldEngine = new FieldEngine(
            newField,
            width,
            height,
            this.fogOfWarRadius,
          );
        }
      },
      deep: true,
      immediate: false,
    },
  },
  mounted() {
    emitter.on('initTurn', this.initTurn);
    emitter.on('selectNextUnit', this.selectNextUnit);
    emitter.on('infoPanelContextHelpChanged', this.onInfoPanelContextHelpChanged);
    emitter.on('closeGameGridContextHelp', this.hideContextHelp);
    emitter.on('setAction', this.setAction);
    emitter.on('saveCoords', this.saveCoords);
    emitter.on('getScrollCoordsByCell', this.getScrollCoordsByCell);
    // Hide context help when clicking outside
    document.addEventListener('click', this.hideContextHelpOnOutsideClick);
  },
  beforeUnmount() {
    emitter.off('initTurn', this.initTurn);
    emitter.off('selectNextUnit', this.selectNextUnit);
    emitter.off('infoPanelContextHelpChanged', this.onInfoPanelContextHelpChanged);
    emitter.off('closeGameGridContextHelp', this.hideContextHelp);
    emitter.off('setAction', this.setAction);
    emitter.off('saveCoords', this.saveCoords);
    emitter.off('getScrollCoordsByCell', this.getScrollCoordsByCell);
    document.removeEventListener('click', this.hideContextHelpOnOutsideClick);
  },
  methods: {
    initTurn(scrollCoords=null) {
      // console.log(scrollCoords);
      this.selectedCoords = null;
      this.selectedAction = null;
      this.removeHighlights();
      if (scrollCoords) {
        this.$refs.gameGridContainer.scrollTo(...scrollCoords);
      }
    },
    selectNextUnit(unitCoordsArr) {
      if (unitCoordsArr.length === 0) return;
      
      let coords = unitCoordsArr[0];

      if (this.selectedCoords) {
        const curIdx = unitCoordsArr.findIndex(el => el[0] === this.selectedCoords[0] && el[1] === this.selectedCoords[1]);
        if (curIdx !== -1 && curIdx + 1 < unitCoordsArr.length) {
          // Selected unit is still in the array, select next one
          coords = unitCoordsArr[curIdx + 1];
        } else if (curIdx === -1) {
          // Selected unit was moved (no longer in array), continue with next unit
          // Find the first unit that comes after the previously selected position
          // If no such unit exists, wrap around to the first unit
          const nextIdx = unitCoordsArr.findIndex(el => {
            // Compare by position: find first unit that is "after" the selected one
            return el[0] > this.selectedCoords[0] || 
                   (el[0] === this.selectedCoords[0] && el[1] > this.selectedCoords[1]);
          });
          coords = nextIdx !== -1 ? unitCoordsArr[nextIdx] : unitCoordsArr[0];
        }
        // If curIdx is the last element, it will wrap to the first (coords already set to unitCoordsArr[0])
      }
      const [x, y] = coords;
      const unit = this.field[x][y].unit;
      if (unit) {
        this.selectUnit(x, y, unit.movePoints);
        const scrollCoords = this.getScrollCoordsByCell([x, y]);
        this.$refs.gameGridContainer.scrollTo(...scrollCoords);
      }
    },
    selectUnit(x, y, movePoints) {
      this.selectedCoords = [x, y];
      this.removeHighlights();
      this.setHighlights(x, y, movePoints);
    },
    processClick(event, x, y) {
      // Check if any context window is open
      const wasContextHelpVisible = this.contextHelpVisible || this.infoPanelContextHelpVisible;
      
      // Hide context help on any click
      this.hideContextHelp();
      
      // If a context window was open, just close it and don't perform any action
      if (wasContextHelpVisible) {
        return;
      }
      
      // In multiplayer mode, only process clicks if it's the player's turn
      if (!this.isMyTurn) {
        console.log('Not my turn');
        return;
      }
      
      if (this.selectedAction === ACTIONS.scouting) {
        // In multiplayer, send scout message to server
        emitter.emit('scoutArea', {x: x, y: y, fogRadius: this.fogOfWarRadius});
        this.selectedAction = null;
        return;
      }
      const unit = this.field[x][y].unit;
      if (unit) {
        // Select unit if it belongs to current player and hasn't moved
        if (unit.player === this.currentPlayer && !unit.hasMoved) {
          this.selectUnit(x, y, unit.movePoints);
        }
      }
      else if (this.selectedCoords && this.waveEngine.canMove(this.selectedCoords, [x, y])) {
        // Move unit to clicked cell - this will emit 'moveUnit' event
        // which will be handled by MultiplayerDinoGame to send to server
        this.moveUnit(this.selectedCoords, [x, y]);
      }
    },
    moveUnit(fromCoords, toCoords) {
      let [x, y] = fromCoords;
      // Save movePoints value for the further remove highlights
      const movePoints = this.field[x][y].unit.movePoints;
      // Call game moveUnit function to change field
      emitter.emit('moveUnit', {fromCoords: fromCoords, toCoords: toCoords});
      this.selectedCoords = null;
      this.removeHighlightsForArea(x, y, movePoints);
    },
    setAction(action) {
      this.selectedAction = action;
    },
    saveCoords(player) {
      const container = this.$refs.gameGridContainer;
      player.scrollCoords = [container.scrollLeft, container.scrollTop];
    },
    getScrollCoordsByCell(coords) {
      const [x, y] = coords;
      const container = this.$refs.gameGridContainer;
      const scrollX = (x * this.cellSize) - (container.clientWidth / 2) + (this.cellSize / 2);
      const scrollY = (y * this.cellSize) - (container.clientHeight / 2) + (this.cellSize / 2);
      return [scrollX, scrollY];
    },

    // Highlights helpers
    removeHighlights() {
      for (let curX = 0; curX < this.width; curX++) {
        for (let curY = 0; curY < this.height; curY++) {
          this.fieldOutput[curX][curY].isHighlighted = false;
        }
      }
    },
    removeHighlightsForArea(x, y, radius) {
      for (let curX = x - radius; curX <= x + radius; curX++) {
        for (let curY = y - radius; curY <= y + radius; curY++) {
          if (this.fieldEngine.areExistingCoords(curX, curY))
            this.fieldOutput[curX][curY].isHighlighted = false;
        }
      }
    },
    setHighlights(x, y, radius) {
      const highlightedCoordsArr = this.waveEngine.getReachableCoordsArr(x, y, radius);

      for (const coords of highlightedCoordsArr) {
        const curX = coords[0];
        const curY = coords[1];
        this.fieldOutput[curX][curY].isHighlighted = true;
      }
    },
    handleContextMenu(coords) {
      const { x, y } = coords;
      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        const cell = this.field[x][y];
        // Only show context help for visible cells
        if (!cell.isHidden) {
          // Close InfoPanel context help if open
          if (this.infoPanelContextHelpVisible) {
            emitter.emit('infoPanelContextHelpChanged', false);
          }
          this.contextHelpX = x;
          this.contextHelpY = y;
          this.contextHelpCell = cell;
          this.contextHelpVisible = true;
        }
      }
    },
    hideContextHelp() {
      this.contextHelpVisible = false;
    },
    hideContextHelpOnOutsideClick(event) {
      // Hide context help if clicking outside the board
      if (this.contextHelpVisible && this.$refs.gameGridContainer) {
        if (!this.$refs.gameGridContainer.contains(event.target)) {
          this.hideContextHelp();
        }
      }
    },
    onInfoPanelContextHelpChanged(visible) {
      this.infoPanelContextHelpVisible = visible;
    },
  }
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
  width: 100vw;    /* Full viewport width */
  height: 100vh;   /* Full viewport height */
  overflow: auto;  /* Enables scroll when the content overflows */
  position: relative;
  /* Hide scrollbars but keep scrolling */
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
  background-image: url('/images/background.png');
  background-size: cover;
}

.game-grid-container::-webkit-scrollbar {
  display: none; /* Safari and Chrome */
}

div.board-wrapper {
  position: relative;
  display: inline-block;
}

div.board {
  position: relative;
  border: solid 2px;
  color: #2c3e50;
}
</style>
