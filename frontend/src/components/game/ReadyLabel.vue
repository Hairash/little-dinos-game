<template>
  <div class="fixed-label">
    <div>
      <div v-if="isActivePlayer && winner === null">
        Player {{ currentPlayer + 1 }}, get ready!<br />
        Your color:
        <img class="curPlayerImage" :src="`/images/dino${currentPlayer + 1}.png`" />
      </div>

      <!-- Win. The label only ever renders on someone's own turn, so
           winner === currentPlayer means "this is the winner reading it"
           (second person); otherwise an eliminated human is watching the
           bot fight and a bot just won (third person). -->
      <div v-if="winner !== null && winner === currentPlayer">
        <template v-if="isSingleHuman">You win</template>
        <template v-else>Player {{ winner + 1 }}, you win</template>
      </div>
      <div v-if="winner !== null && winner !== currentPlayer">Player {{ winner + 1 }} wins!</div>

      <!-- Lose. A lone human needs no seat number or color; a hotseat
           player is addressed by seat so the device-passers know whose
           message it is. -->
      <div v-if="showLose && isSingleHuman">You lose</div>
      <div v-if="showLose && !isSingleHuman">
        Player {{ currentPlayer + 1 }}, sorry, you lose<br />
        Your color:
        <img class="curPlayerImage" :src="`/images/dino${currentPlayer + 1}.png`" />
      </div>
      <div v-if="areAllHumanPlayersEliminated && !isSingleHuman">
        All human players were defeated
      </div>

      <!-- Bot-fight endpoint notice. Suppressed while the lose headline is
           up: "You lose" already tells the whole story when only one bot
           remains, per the endgame spec. -->
      <div v-if="lastPlayer !== null && !showLose">
        Player {{ lastPlayer + 1 }} is the only left
      </div>

      <div
        v-if="areAllHumanPlayersEliminated || winner !== null || lastPlayer !== null"
        class="note"
      >
        Press exit icon on the panel to start new game
      </div>
      <div v-if="lastPlayer === null && areAllHumanPlayersEliminated" class="note">
        Or you may watch bot fighting
      </div>

      <div>
        <button type="button" @click="onClickAction">
          <div style="position: relative; top: -2px">Ready</div>
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
    // True when the game has exactly one human seat. Switches win/lose
    // headlines to second person ("You win" / "You lose") and drops the
    // hotseat-only "All human players were defeated" line.
    isSingleHuman: Boolean,
  },
  computed: {
    showLose() {
      return !this.isActivePlayer && !this.isPlayerInformedLose
    },
  },
}
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
  background-image: url('/images/long_setup_btn_clean.png');
  background-size: 100% 100%;
  border: 0;
  padding: 8px 20px;
  font-family: inherit;
  font-size: 20px;
  font-weight: bold;
  cursor: pointer;
}
</style>
