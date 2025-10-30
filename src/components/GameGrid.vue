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
                :hideEnemySpeed="hideEnemySpeed"
                @click="processClick($event, x, y)"
              />
            </template>
          </div>
        </div>
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

export default {
  name: "GameGrid",
  components: {
    ActionHint,
    GameCell,
  },
  props: {
    isHidden: Boolean,
    enableFogOfWar: Boolean,
    fogOfWarRadius: Number,
    enableScoutMode: Boolean,
    hideEnemySpeed: Boolean,
    field: Array[Array[Models.Cell]],
    currentPlayer: Number,
    cellSize: Number,
  },
  data() {
    const width = this.field.length;
    const height = this.field[0].length;
    const fieldT = (m => m[0].map((x, i) => m.map(x => x[i])))(this.field);
    const fieldOutput = Array.from({ length: width }, () =>
      Array.from({ length: height }, () => ({ isHidden: false, isHighlighted: false }))
    );
    // console.log((cellWidth + 2) * width);
    // console.log((cellHeight + 2) * height + 35);
    return {
      width,
      height,
      fieldT,
      selectedCoords: null,
      selectedAction: null,
      waveEngine: null,
      fieldEngine: null,
      fieldOutput,
      // cssProps: {
      //   lineHeight: `${this.cellSize}px`,
      //   lineWidth: `${this.cellSize * width}px`,
      //   boardHeight: `${this.cellSize * height}px`,
      //   boardWidth: `${this.cellSize * width}px`,
      //   boardWrapperHeight: `${this.cellSize * height + 35}px`,
      //   boardWrapperWidth: `${this.cellSize * width}px`,
      // },
    }
  },
  computed: {
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
  },
  created() {
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
  mounted() {
    emitter.on('initTurn', this.initTurn);
    emitter.on('selectNextUnit', this.selectNextUnit);
    emitter.on('setAction', this.setAction);
    emitter.on('saveCoords', this.saveCoords);
    emitter.on('getScrollCoordsByCell', this.getScrollCoordsByCell);
  },
  beforeUnmount() {
    emitter.off('initTurn', this.initTurn);
    emitter.off('selectNextUnit', this.selectNextUnit);
    emitter.off('setAction', this.setAction);
    emitter.off('saveCoords', this.saveCoords);
    emitter.off('getScrollCoordsByCell', this.getScrollCoordsByCell);
  },
  methods: {
    initTurn(scrollCoords) {
      // console.log(scrollCoords);
      this.selectedCoords = null;
      this.selectedAction = null;
      this.removeHighlights();
      this.$refs.gameGridContainer.scrollTo(...scrollCoords);
    },
    selectNextUnit(unitCoordsArr) {
      let coords = unitCoordsArr[0];

      if (this.selectedCoords) {
        const curIdx = unitCoordsArr.findIndex(el => el[0] === this.selectedCoords[0] && el[1] === this.selectedCoords[1]);
        if (curIdx + 1 < unitCoordsArr.length) {
          coords = unitCoordsArr[curIdx + 1];
        }
      }
      const [x, y] = coords;
      const unit = this.field[x][y].unit;
      this.selectUnit(x, y, unit.movePoints);
      const scrollCoords = this.getScrollCoordsByCell([x, y]);
      this.$refs.gameGridContainer.scrollTo(...scrollCoords);
    },
    selectUnit(x, y, movePoints) {
      this.selectedCoords = [x, y];
      this.removeHighlights();
      this.setHighlights(x, y, movePoints);
    },
    processClick(event, x, y) {
      if (this.selectedAction === ACTIONS.scouting) {
        emitter.emit('addTempVisibilityForCoords', {x: x, y: y, fogRadius: this.fogOfWarRadius});
        this.selectedAction = null;
        return;
      }
      const unit = this.field[x][y].unit;
      if (unit) {
        if (unit.player === this.currentPlayer && !unit.hasMoved) {
          this.selectUnit(x, y, unit.movePoints);
        }
      }
      else if (this.selectedCoords && this.waveEngine.canMove(this.selectedCoords, [x, y])) {
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
