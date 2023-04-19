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
</style>
