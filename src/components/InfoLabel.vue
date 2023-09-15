<template>
  <div class="infoLabel">
    <span class="infoTextLabel">
      <!-- TODO: Fix it. Make images for players (not units) -->
      <img class="curPlayerImage" :src="`/images/dino${currentPlayer + 1}.png`">
    </span>
    <span class="infoTextLabel">Active: {{ activeUnits }}/{{ totalUnits }}</span>
    <span class="infoTextLabel">Killed: {{ player.killed }} Lost: {{ player.lost }}</span>
    <button type="button" @click="handleEndTurnBtnClick">End turn</button>
  </div>
</template>

<script>
import Models from "@/game/models";

export default {
  name: 'InfoLabel',
  props: {
    currentPlayer: Number,
    player: Models.Player,
    getCurrentActiveUnits: Function,
    handleEndTurnBtnClick: Function,
  },
  computed: {
    currentUnitsArr() {
      return this.getCurrentActiveUnits();
    },
    activeUnits() {
      return this.currentUnitsArr[0];
    },
    totalUnits() {
      return this.currentUnitsArr[1];
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
}
</style>
