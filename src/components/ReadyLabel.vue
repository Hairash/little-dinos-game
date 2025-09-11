<template>
  <div class="fixed-label">
    <div>
      <div v-if="isActivePlayer">
        Player {{currentPlayer + 1}}, get ready!<br>
        Your color:
        <img class="curPlayerImage" :src="`/images/dino${currentPlayer + 1}.png`">
      </div>
      <div v-if="!isActivePlayer && !isPlayerInformedLose">
        Player {{currentPlayer + 1}}, sorry, you lose<br>
        Your color:
        <img class="curPlayerImage" :src="`/images/dino${currentPlayer + 1}.png`">
      </div>

      <div v-if="areAllHumanPlayersEliminated">
        All human players were defeated
      </div>
      <div v-if="winner !== null">
        Player {{ winner + 1}} wins!
      </div>
      <div v-if="lastPlayer !== null">
        Player {{ lastPlayer + 1}} is the only left
      </div>

      <div
          v-if="areAllHumanPlayersEliminated || winner !== null || lastPlayer !== null"
          class="note"
      >
        Refresh page to start new game
      </div>
      <div v-if="lastPlayer === null && areAllHumanPlayersEliminated" class="note">Or you may watch bot fighting</div>
      <div
          v-if="lastPlayer === null && !areAllHumanPlayersEliminated && winner !== null"
          class="note"
      >
        Or you may continue playing
      </div>

      <div>
        <button type="button" @click="onClickAction">
          <div style="position: relative; top: -2px;">Ready</div>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ReadyLabel',
  props: {
    onClickAction: Function,
    currentPlayer: Number,
    isActivePlayer: Boolean,
    isPlayerInformedLose: Boolean,
    areAllHumanPlayersEliminated: Boolean,
    winner: Number,
    lastPlayer: Number,
  },
};
</script>

<style scoped>
div.fixed-label {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 1);
  color: white;
  font-size: 2rem;
  z-index: 1000;
}

.note {
  font-style: italic;
  font-size: 1rem;
}

img.curPlayerImage {
  width: 35px;
  height: 35px;
  position: relative;
  top: 5px;
}

button {
  background-color: transparent;
  background-image: url("/public/images/long_setup_btn_clean.png");
  background-size: 100% 100%;
  border: 0;
  padding: 8px 20px;
  font-family: inherit;
  font-size: 20px;
  font-weight: bold;
  cursor: pointer;
}
</style>
