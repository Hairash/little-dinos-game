<template>
  <div class="infoLabel">
    <span class="curPlayerLabel">Current player:
      <!-- TODO: Fix it. Make images for players (not units) -->
      <img class="curPlayerImage" :src="`/images/dino${currentPlayer + 1}.png`">
    </span>
    <span class="curActiveUnitsLabel">Active units: {{ getCurrentActiveUnits() }}</span>
    <button type="button" @click="handleEndTurnBtnClick">End turn</button>
  </div>
</template>

<script>
export default {
  name: 'InfoLabel',
  props: {
    currentPlayer: Number,
    getCurrentActiveUnits: Function,
    handleEndTurnBtnClick: Function,
  },
}
</script>

<style>
div.infoLabel {
  position: fixed;
  padding-bottom: 6px;
  bottom: 0;
  left: 0;
  right: 0;
  background: black;
}

span.curPlayerLabel {
  margin-right: 30px;
}

img.curPlayerImage {
  width: 30px;
  height: 30px;
  vertical-align: bottom;
}

span.curActiveUnitsLabel {
  margin-right: 30px;
}
</style>
