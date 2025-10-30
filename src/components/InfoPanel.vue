<template>
  <div class="infoPanel">
    <!-- Zoom buttons -->
<!--    style="margin-left: 11px-->
    <div id="inner-info-panel">
      <!-- Left group: Zoom controls -->
      <span class="infoBlock left-group">
        <button type="button" class="infoBtn" @click="handleExitBtnClick">
          <img
            style="margin-left: 1px; margin-top: 1px;"
            class="curPlayerImage"
            :src="`/images/exit_icon.png`"
          >
        </button>
        <button
          type="button"
          class="infoBtn"
          @click="handleChangeCellSize(10)"
          style="margin-left: 2px"
        >
          <img
            style="margin-left: 1px; margin-top: 1px;"
            class="curPlayerImage"
            :src="`/images/plus.png`"
          >
        </button>
        <button
          type="button"
          class="infoBtn"
          @click="handleChangeCellSize(-10)"
          style="margin-left: 2px"
        >
          <img
            style="margin-left: 1px; margin-top: 1px;"
            class="curPlayerImage"
            :src="`/images/minus.png`"
          >
        </button>
      </span>

      <!-- Spacer -->
      <!-- <div class="spacer"></div> -->

      <!-- Center-left: Units -->
      <span class="infoItem">
        <button type="button" class="infoBtn" @click="handleUnitClick">
          <img v-if="areAllUnitsOnBuildings && currentStats.units.active > 0"
            class="curPlayerImage"
            :src="`/images/habitation.png`"
            style="position: absolute;"
            title="Next unit"
          >
          <img
            class="curPlayerImage"
            :src="`/images/dino${currentPlayer + 1}.png`"
            title="Next unit"
          >
        </button>
        <span class="infoLabel">
          {{ currentStats.units.active }}/{{ currentStats.units.total }}/{{ maxUnitsNum }}
        </span>
      </span>

      <!-- Spacer -->
      <!-- <div class="spacer"></div> -->

      <!-- Center-right: Towers -->
      <span class="infoItem center-group">
        <img
          class="towerImage"
          :src="`/images/base${currentPlayer + 1}.png`"
        >
        <span class="infoLabel">
          {{ currentStats.towers.total }}/{{ maxTowersNum }}
        </span>
      </span>

      <!-- Spacer -->
      <!-- <div class="spacer"></div> -->

      <!-- Right group: End turn button -->
      <button
        type="button"
        class="infoBtn endTurnBtn right-group"
        @click="handleEndTurnBtnClick"
        :disabled="player.type === botType"
      >
        <img
          style="margin-left: 4px; margin-top: 1px;"
          class="curPlayerImage"
          :src="`/images/arrow.png`"
        >
      </button>

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
  </div>
</template>

<script>
import Models from "@/game/models";

export default {
  name: 'InfoPanel',
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
  },
  data() {
    return {
      showScore: false,
    }
  },
  computed: {
    player() {
      return this.players[this.currentPlayer];
    },
    maxUnitsNum() {
      return this.currentStats.units.max ? this.currentStats.units.max : '∞';
    },
    maxTowersNum() {
      return this.currentStats.towers.max ? this.currentStats.towers.max : '∞';
    },
    botType() {
      return Models.PlayerTypes.BOT;
    }
  },
  methods: {
    handleExitClick() {
      console.log('Exit button clicked');
      this.handleExitBtnClick();
    }
  },
}
</script>

<style scoped>
/* Panel shell stays the same */
div.infoPanel {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  margin: 0 auto;
  max-width: 400px;
  height: 40px;
  padding: 2px 0 4px;
  background-image: url('/images/panel.png');
  background-size: 100% 100%;
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
  overflow: hidden;
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
}

.infoItem .infoBtn,
.infoItem img {
  flex: 0 0 auto;           /* fixed-size controls */
}

/* Labels scale with their container width */
span.infoLabel {
  flex: 1 1 0;              /* <-- key: label takes remaining space */
  min-width: 0;
  line-height: 26px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;  /* or ellipsis */
  /* 1cqw = 1% of .infoItem width */
  /* font-size: 16px; */
  font-size: clamp(1px, 3.9cqw, 16px);
  font-weight: bold;   /* restore what you had in .infoBlock */
  color: black;
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
</style>

<style>
@container (max-width: 120px) { .infoLabel { font-size: 8px; } }
@container (max-width: 90px)  { .infoLabel { font-size: 6px; } }
</style>
