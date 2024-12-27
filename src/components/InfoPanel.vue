<template>
  <div class="infoPanel">
    <!-- Zoom buttons -->
<!--    style="margin-left: 11px-->
    <span class="infoBlock">
      <button
        type="button"
        class="infoBtn"
        @click="handleChangeCellSize(10)"
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
    <span class="separator"></span>

    <!-- Units -->
    <span class="infoBlock">
      <!-- TODO: Fix it. Make images for players (not units) ? -->
      <button type="button" class="infoBtn" @click="handleUnitClick">
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
    <span class="separator"></span>

    <!-- Towers -->
    <span class="infoBlock">
      <img
        class="towerImage"
        :src="`/images/base${currentPlayer + 1}.png`"
      >
      <span class="infoLabel">
        {{ currentStats.towers.total }}/{{ maxTowersNum }}
      </span>
    </span>
    <span class="separator"></span>

    <!-- End turn button -->
    <button
      type="button"
      class="infoBtn endTurnBtn"
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
}
</script>

<style scoped>
div.infoPanel {
  position: fixed;
  padding-bottom: 4px;
  padding-top: 2px;
  bottom: 0;
  left: 0;
  right: 0;
  //background: black;
  display: flex;
  justify-content: space-around;
  align-items: center;
  max-width: 400px;
  height: 40px;
  /* Check if we have iPhone - add margin bottom */
  margin: 0 auto;
  background-image: url('/public/images/panel.png');
  background-size: 100% 100%;
}

button.infoBtn {
  padding: 0;
  user-select: none;
  background-image: url('/public/images/small_button.png');
  background-color: transparent;
  background-size: 100% 100%;
  border: none;
  width: 26px;
  height: 26px;
  vertical-align: text-bottom;
}

button.infoBtn.endTurnBtn {
  width: 52px;
}

img.curPlayerImage {
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
  //margin-right: 15px;
  user-select: none;
  font-weight: bold;
  color: black;
}

span.infoLabel {
  vertical-align: text-bottom;
  line-height: 26px;
}

span.separator {
  max-width: 40px;
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
