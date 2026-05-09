<template>
  <div class="infoPanel">
    <div id="inner-info-panel">
      <!-- Left group: Menu button and Undo button -->
      <span class="infoBlock left-group">
        <button
          type="button"
          class="infoBtn"
          @click="toggleMenu"
          @contextmenu.prevent="showContextHelp($event, 'Menu')"
          :disabled="menuOpen"
          title="Menu"
        >
          <img
            style="margin-left: 1px; margin-top: 1px"
            class="curPlayerImage"
            :src="getImagePath('settings_icon')"
          />
        </button>
        <button
          type="button"
          class="infoBtn undoBtn"
          @click="handleUndoClick"
          @contextmenu.prevent="showContextHelp($event, 'Undo last move')"
          :disabled="!canUndo || menuOpen"
          title="Undo last move"
        >
          <img
            style="margin-left: 1px; margin-top: 1px"
            class="curPlayerImage"
            :src="getImagePath('undo')"
          />
        </button>
      </span>

      <!-- Spacer -->
      <!-- <div class="spacer"></div> -->

      <!-- Center-left: Units -->
      <span class="infoItem">
        <button
          type="button"
          class="infoBtn"
          @click="handleUnitClick"
          @contextmenu.prevent="showContextHelp($event, 'Next unit')"
          :disabled="menuOpen"
        >
          <img
            v-if="areAllUnitsOnBuildings && currentStats.units.active > 0"
            class="curPlayerImage"
            :src="getImagePath('habitation')"
            style="position: absolute"
            title="Next unit"
          />
          <img
            class="curPlayerImage"
            :src="getImagePath('dino' + (currentPlayer + 1))"
            title="Next unit"
          />
        </button>
        <span
          class="infoLabel"
          :class="{
            'units-overlimit': unitsOverLimit,
            'units-overlimit-animate': animateUnitsOverlimit,
          }"
          @contextmenu.prevent="showUnitsContextHelp($event)"
          title="Active / Total / Max dinos"
        >
          {{ currentStats.units.active }}/<span
            :key="currentStats.units.total"
            :class="{ 'limit-animate': animateUnitsTotal }"
            class="limit-number"
            :style="animateUnitsTotal ? { '--player-color': playerColor } : {}"
            >{{ currentStats.units.total }}</span
          >/<span
            :key="maxUnitsNum"
            :class="{ 'limit-animate': animateUnitsLimit }"
            class="limit-number"
            :style="animateUnitsLimit ? { '--player-color': playerColor } : {}"
            >{{ maxUnitsNum }}</span
          >
        </span>
      </span>

      <!-- Spacer -->
      <!-- <div class="spacer"></div> -->

      <!-- Center-right: Towers -->
      <span class="infoItem center-group">
        <img class="towerImage" :src="getImagePath('base' + (currentPlayer + 1))" />
        <span
          class="infoLabel"
          :class="{
            'units-overlimit': towersOverLimit,
            'units-overlimit-animate': animateTowersOverlimit,
          }"
          @contextmenu.prevent="showTowersContextHelp($event)"
          title="Total / Max towers"
        >
          <span
            :key="currentStats.towers.total"
            :class="{ 'limit-animate': animateTowersTotal }"
            class="limit-number"
            :style="animateTowersTotal ? { '--player-color': playerColor } : {}"
            >{{ currentStats.towers.total }}</span
          >/<span
            :key="maxTowersNum"
            :class="{ 'limit-animate': animateTowersLimit }"
            class="limit-number"
            :style="animateTowersLimit ? { '--player-color': playerColor } : {}"
            >{{ maxTowersNum }}</span
          >
        </span>
      </span>

      <!-- Spacer -->
      <!-- <div class="spacer"></div> -->
      <!-- Right group: End turn button -->
      <span class="endTurnBtnWrapper right-group">
        <div v-if="showEndTurnTip" class="endTurnTip">
          <span class="endTurnTipArrow">DONE?<br />⬇</span>
        </div>
        <button
          type="button"
          class="infoBtn endTurnBtn"
          @click="handleEndTurnBtnClick"
          @contextmenu.prevent="showContextHelp($event, 'End turn')"
          :disabled="(player && player.type === botType) || menuOpen"
          title="End turn"
        >
          <img
            style="margin-left: 4px; margin-top: 1px"
            class="curPlayerImage"
            :src="getImagePath('arrow')"
          />
        </button>
      </span>

      <!--    <span class="infoTextLabel">Killed: {{ player.killed }} Lost: {{ player.lost }}</span>-->
      <!--    <span class="infoTextLabel" @click="showScore = !showScore">-->
      <!--      Score: {{ player.score }}-->
      <!--      <div v-if="showScore"-->
      <!--        class="tooltip"-->
      <!--      >-->
      <!--        <div v-for="(p, idx) in players" :key=idx>-->
      <!--          P{{ idx + 1 }}: {{ p.score }}-->
      <!--        </div>-->
      <!--      </div>-->
      <!--    </span>-->
    </div>
    <!-- Context help window - refactored to avoid v-html for XSS safety -->
    <div v-if="contextHelpVisible" class="info-context-help" :style="contextHelpStyle">
      <b>{{ contextHelpTitle }}</b>
      <template v-if="contextHelpWarning">
        <br /><span class="warning-text">❗Limit reached❗</span>
      </template>
    </div>
    <!-- Game Menu Overlay -->
    <GameMenuOverlay
      v-if="menuOpen"
      :field="field"
      :field-engine="fieldEngine"
      :current-player="currentPlayer"
      :players="players"
      :enable-fog-of-war="enableFogOfWar"
      :min-speed="minSpeed"
      :max-speed="maxSpeed"
      :building-totals-override="buildingTotalsOverride"
      :handle-exit="handleMenuExit"
      :handle-zoom-in="handleMenuZoomIn"
      :handle-zoom-out="handleMenuZoomOut"
      :handle-resume="toggleMenu"
    />
  </div>
</template>

<script>
import Models from '@/game/models'
import { getPlayerColor } from '@/game/helpers'
import emitter from '@/game/eventBus'
import GameMenuOverlay from '@/components/game/GameMenuOverlay.vue'
import { getImagePath } from '@/game/helpers.js'

export default {
  name: 'InfoPanel',
  components: {
    GameMenuOverlay,
  },
  props: {
    currentPlayer: Number,
    players: Array[Models.Player],
    currentStats: Object,
    handleEndTurnBtnClick: Function,
    handleUnitClick: Function,
    cellSize: Number,
    handleChangeCellSize: Function,
    handleExitBtnClick: Function,
    areAllUnitsOnBuildings: Boolean,
    showEndTurnTip: {
      type: Boolean,
      default: false,
    },
    field: Array,
    fieldEngine: Object,
    enableFogOfWar: Boolean,
    minSpeed: Number,
    maxSpeed: Number,
    canUndo: {
      type: Boolean,
      default: false,
    },
    handleUndoClick: {
      type: Function,
      default: () => {},
    },
    // Server-provided per-type building totals (multiplayer). When null,
    // GameMenuOverlay falls back to counting from the local field
    // (single-player has full visibility, so the fallback is exact).
    buildingTotalsOverride: {
      type: Object,
      default: null,
    },
  },
  emits: ['menuOpen'],
  data() {
    return {
      showScore: false,
      prevMaxUnitsNum: null,
      prevMaxTowersNum: null,
      prevUnitsTotal: null,
      prevTowersTotal: null,
      animateUnitsLimit: false,
      animateTowersLimit: false,
      animateUnitsTotal: false,
      animateTowersTotal: false,
      prevUnitsOverLimit: false,
      animateUnitsOverlimit: false,
      prevTowersOverLimit: false,
      animateTowersOverlimit: false,
      contextHelpVisible: false,
      contextHelpTitle: '',
      contextHelpWarning: false,
      contextHelpIsTowers: false,
      contextHelpX: 0,
      contextHelpY: 0,
      menuOpen: false,
    }
  },
  computed: {
    player() {
      // Guard: return null if players array is empty or currentPlayer is out of bounds
      if (!this.players || !Array.isArray(this.players) || this.players.length === 0) {
        return null
      }
      if (this.currentPlayer < 0 || this.currentPlayer >= this.players.length) {
        return null
      }
      return this.players[this.currentPlayer]
    },
    maxUnitsNum() {
      return this.currentStats.units.max ? this.currentStats.units.max : '∞'
    },
    maxTowersNum() {
      return this.currentStats.towers.max ? this.currentStats.towers.max : '∞'
    },
    botType() {
      return Models.PlayerTypes.BOT
    },
    playerColor() {
      return getPlayerColor(this.currentPlayer)
    },
    unitsOverLimit() {
      if (!this.currentStats.units.max) return false
      const emptyBases = this.currentStats.towers.empty || 0
      return this.currentStats.units.total + emptyBases > this.currentStats.units.max
    },
    towersOverLimit() {
      if (!this.currentStats.towers.max) return false
      return this.currentStats.towers.total >= this.currentStats.towers.max
    },
    contextHelpStyle() {
      if (!this.contextHelpVisible) return {}
      const style = {
        left: `${this.contextHelpX}px`,
        top: `${this.contextHelpY}px`,
      }
      if (this.contextHelpIsTowers) {
        style.minWidth = '115px'
      }
      return style
    },
  },
  watch: {
    maxUnitsNum(newVal, _oldVal) {
      if (this.prevMaxUnitsNum !== null && newVal !== this.prevMaxUnitsNum) {
        // Limit changed - trigger animation
        this.animateUnitsLimit = true
        // Reset animation class after animation completes
        setTimeout(() => {
          this.animateUnitsLimit = false
        }, 1000)
      }
      this.prevMaxUnitsNum = newVal
    },
    maxTowersNum(newVal, _oldVal) {
      if (this.prevMaxTowersNum !== null && newVal !== this.prevMaxTowersNum) {
        // Limit changed - trigger animation
        this.animateTowersLimit = true
        // Reset animation class after animation completes
        setTimeout(() => {
          this.animateTowersLimit = false
        }, 1000)
      }
      this.prevMaxTowersNum = newVal
    },
    'currentStats.units.total'(newVal, _oldVal) {
      if (this.prevUnitsTotal !== null && newVal !== this.prevUnitsTotal) {
        // Total units changed - trigger animation
        this.animateUnitsTotal = true
        // Reset animation class after animation completes
        setTimeout(() => {
          this.animateUnitsTotal = false
        }, 1000)
      }
      this.prevUnitsTotal = newVal
    },
    'currentStats.towers.total'(newVal, _oldVal) {
      if (this.prevTowersTotal !== null && newVal !== this.prevTowersTotal) {
        // Total towers changed - trigger animation
        this.animateTowersTotal = true
        // Reset animation class after animation completes
        setTimeout(() => {
          this.animateTowersTotal = false
        }, 1000)
      }
      this.prevTowersTotal = newVal
    },
    unitsOverLimit(newVal) {
      if (newVal === true && this.prevUnitsOverLimit !== true) {
        this.animateUnitsOverlimit = true
        setTimeout(() => {
          this.animateUnitsOverlimit = false
        }, 500)
      }
      this.prevUnitsOverLimit = newVal
    },
    towersOverLimit(newVal) {
      if (newVal === true && this.prevTowersOverLimit !== true) {
        this.animateTowersOverlimit = true
        setTimeout(() => {
          this.animateTowersOverlimit = false
        }, 500)
      }
      this.prevTowersOverLimit = newVal
    },
  },
  mounted() {
    // Initialize previous values
    this.prevMaxUnitsNum = this.maxUnitsNum
    this.prevMaxTowersNum = this.maxTowersNum
    this.prevUnitsTotal = this.currentStats.units.total
    this.prevTowersTotal = this.currentStats.towers.total
    this.prevUnitsOverLimit = this.unitsOverLimit || false
    this.prevTowersOverLimit = this.towersOverLimit || false

    // Add click listener to hide context help when clicking outside
    document.addEventListener('click', this.hideContextHelp)

    // Listen for events to close context help when GameGrid opens its own
    emitter.on('infoPanelContextHelpChanged', this.onContextHelpChanged)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.hideContextHelp)
    emitter.off('infoPanelContextHelpChanged', this.onContextHelpChanged)
  },
  methods: {
    getImagePath,
    toggleMenu() {
      this.menuOpen = !this.menuOpen
      this.$emit('menuOpen', this.menuOpen)
    },
    handleMenuExit() {
      this.menuOpen = false
      this.$emit('menuOpen', false)
      this.handleExitBtnClick()
    },
    handleMenuZoomIn() {
      this.handleChangeCellSize(10)
    },
    handleMenuZoomOut() {
      this.handleChangeCellSize(-10)
    },
    handleExitClick() {
      console.log('Exit button clicked')
      this.handleExitBtnClick()
    },
    showContextHelp(event, text) {
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      const panelRect = this.$el.getBoundingClientRect()

      // Position above the element, centered horizontally
      this.contextHelpX = rect.left - panelRect.left + rect.width / 2
      this.contextHelpY = rect.top - panelRect.top - 5 // 5px above

      // Close GameGrid context help if open
      emitter.emit('closeGameGridContextHelp')

      this.contextHelpTitle = text
      this.contextHelpWarning = false
      this.contextHelpIsTowers = false
      this.contextHelpVisible = true
      emitter.emit('infoPanelContextHelpChanged', true)
    },
    showUnitsContextHelp(event) {
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      const panelRect = this.$el.getBoundingClientRect()

      // Position above the element, centered horizontally
      this.contextHelpX = rect.left - panelRect.left + rect.width / 2
      this.contextHelpY = rect.top - panelRect.top - 5 // 5px above

      // Close GameGrid context help if open
      emitter.emit('closeGameGridContextHelp')

      this.contextHelpTitle = 'Active / Total / Max dinos'
      this.contextHelpWarning = this.unitsOverLimit
      this.contextHelpIsTowers = false
      this.contextHelpVisible = true
      emitter.emit('infoPanelContextHelpChanged', true)
    },
    showTowersContextHelp(event) {
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      const panelRect = this.$el.getBoundingClientRect()

      // Position above the element, centered horizontally
      this.contextHelpX = rect.left - panelRect.left + rect.width / 2
      this.contextHelpY = rect.top - panelRect.top - 5 // 5px above

      // Close GameGrid context help if open
      emitter.emit('closeGameGridContextHelp')

      this.contextHelpTitle = 'Total / Max towers'
      this.contextHelpWarning = this.towersOverLimit
      this.contextHelpIsTowers = true
      this.contextHelpVisible = true
      emitter.emit('infoPanelContextHelpChanged', true)
    },
    hideContextHelp(event) {
      // Don't hide if it's a right-click event
      if (event && event.button === 2) return
      this.contextHelpVisible = false
      emitter.emit('infoPanelContextHelpChanged', false)
    },
    onContextHelpChanged(visible) {
      // This handles both our own changes and external requests to close
      if (!visible) {
        this.contextHelpVisible = false
      }
    },
  },
}
</script>

<style scoped>
/* Panel shell stays the same */
div.infoPanel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  margin: 0 auto;
  max-width: 400px;
  height: 40px;
  padding: 2px 0 4px;
  background-image: url('/images/panel.png');
  background-size: 100% 100%;
  overflow: visible; /* Allow tip to be visible above panel */
  z-index: 1; /* Ensure panel is above game content */
}

/* Flex row with elastic spacers */
#inner-info-panel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between; /* distributes extra space as gaps, shrinks to 0 as needed */
  /* column-gap: 8px; */
  /* width: 100%; */
  min-width: 0;
  overflow: visible; /* Changed from hidden to allow tip to be visible */
  padding: 7px 9px;
}

.spacer {
  /* flex: 1 1000 8px; */
  min-width: 0;
}

/* NEW: item wrappers are containers; they shrink after spacers hit 0 */
.infoItem {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  flex: 0 1 auto;
  white-space: nowrap;
  overflow: visible;
}

.infoItem .infoBtn,
.infoItem img {
  flex: 0 0 auto; /* fixed-size controls */
}

/* Labels scale with their container width */
span.infoLabel {
  flex: 1 1 0; /* <-- key: label takes remaining space */
  min-width: 0;
  line-height: 26px;
  padding: 0 2px;
  margin: 0 1px;
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip; /* or ellipsis */
  /* 1cqw = 1% of .infoItem width */
  /* font-size: 16px; */
  font-size: clamp(1px, 3.9cqw, 16px);
  font-weight: bold; /* restore what you had in .infoBlock */
  color: black;

  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

button.infoBtn {
  padding: 0;
  user-select: none;
  background-image: url('/images/small_button.png');
  background-color: transparent;
  background-size: 100% 100%;
  border: none;
  width: 26px;
  height: 26px;
  vertical-align: text-bottom;
  cursor: pointer;
}

button.infoBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.infoBtn.undoBtn {
  margin-left: 4px;
}

button.infoBtn.endTurnBtn {
  width: 52px;
}

img.curPlayerImage {
  position: relative;
  width: 22px;
  height: 22px;
}

img.towerImage {
  vertical-align: text-bottom;
  width: 22px;
  height: 22px;
  padding-bottom: 3px;
}

span.infoBlock {
  /* margin-right: 15px; */
  user-select: none;
  font-weight: bold;
  color: black;
  white-space: nowrap; /* Prevent text wrapping */
  min-width: 0; /* Allow shrinking if needed */
  /* container-type: inline-size; */
  /* font-size: clamp(14px, 6cqw, 28px); */
}

div.tooltip {
  position: absolute;
  bottom: 34px;
  background: black;
  border: solid 2px;
  min-width: 52px;
  padding: 4px;
}

.endTurnBtnWrapper {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
}

.endTurnTip {
  position: absolute;
  bottom: 100%;
  margin-bottom: 8px;
  background-color: rgba(139, 0, 0, 0.85);
  color: white;
  padding: 6px 6px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: bold;
  white-space: nowrap;
  pointer-events: none;
  z-index: 2;
  animation: bounceDown 1s ease-in-out infinite;
  /* box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); */
  right: -40px;
  /* left: 50%; */
  /* transform: translateX(-50%); */
}

.endTurnTipArrow {
  display: block;
  font-size: 14px;
  line-height: 1;
  text-align: center;
}

@keyframes bounceDown {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-5px);
  }
}

.limit-number {
  display: inline-block;
  transition: color 0.3s ease-out;
  transform-origin: center center;
  position: relative;
  z-index: 1;
  color: black;
}

.limit-number.limit-animate {
  animation: limitScale 1s ease-out;
}

@keyframes limitScale {
  0% {
    transform: scale(2);
    color: var(--player-color, black);
  }
  /* 50% {
    color: var(--player-color, black);
  } */
  100% {
    transform: scale(1);
    color: black;
  }
}

.infoLabel.units-overlimit {
  background-color: rgb(156 10 14 / 85%);
  border-radius: 4px;
}

.infoLabel.units-overlimit-animate {
  animation: overlimitScale 0.5s ease-out;
}

@keyframes overlimitScale {
  0% {
    transform: scale(2);
  }
  100% {
    transform: scale(1);
  }
}

.info-context-help {
  position: absolute;
  background: black;
  border: solid 2px;
  border-color: white;
  color: white;
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  z-index: 1000;
  pointer-events: none;
  transform: translateX(-50%) translateY(-100%);
  margin-top: -5px;
  max-width: 200px;
  word-wrap: break-word;
  white-space: normal;
}
/* 
.warning-text {
  color: #ff6b6b;
} */
</style>

<style>
@container (max-width: 120px) {
  .infoLabel {
    font-size: 8px;
  }
}
@container (max-width: 90px) {
  .infoLabel {
    font-size: 6px;
  }
}
</style>
