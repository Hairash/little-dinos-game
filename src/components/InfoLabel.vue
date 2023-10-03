<template>
  <div class="infoLabel">
    <span class="infoTextLabel">
      <!-- TODO: Fix it. Make images for players (not units) -->
      <img
        class="curPlayerImage"
        :src="`/images/dino${currentPlayer + 1}.png`"
        title="Next unit"
        @click="handleImgClick"
      >
    </span>
    <span class="infoTextLabel">Active: {{ activeUnits }}/{{ totalUnits }}</span>
    <span class="infoTextLabel">Killed: {{ player.killed }} Lost: {{ player.lost }}</span>
    <span class="infoTextLabel" @click="showScore = !showScore">
      Score: {{ player.score }}
      <div v-if="showScore"
        class="tooltip"
      >
        <div v-for="(p, idx) in players" :key=idx>
          {{ p.score }}
        </div>
      </div>
    </span>

    <button type="button" @click="handleEndTurnBtnClick">End turn</button>
  </div>
</template>

<script>
import Models from "@/game/models";

export default {
  name: 'InfoLabel',
  props: {
    currentPlayer: Number,
    players: Array[Models.Player],
    getCurrentActiveUnits: Function,
    handleEndTurnBtnClick: Function,
    handleImgClick: Function,
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
    currentUnitsArr() {
      return this.getCurrentActiveUnits();
    },
    activeUnits() {
      return this.currentUnitsArr.active;
    },
    totalUnits() {
      return this.currentUnitsArr.total;
    },
  },
}
</script>

<style scoped>
div.infoLabel {
  position: fixed;
  padding-bottom: 6px;
  bottom: 0;
  left: 0;
  right: 0;
  background: black;
  display: flex;
  justify-content: space-around;
  align-items: center;
  max-width: 600px;
  margin: 0 auto;
}

img.curPlayerImage {
  width: 30px;
  height: 30px;
  vertical-align: bottom;
}

span.infoTextLabel {
  margin-right: 15px;
  user-select: none;
}

div.tooltip {
  position: absolute;
  bottom: 34px;
  background: black;
  border: solid 2px;
  width: 60px;
}
</style>
