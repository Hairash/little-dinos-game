<template>
  <!-- Two skins, one set of messages.
       * Hotseat (several humans): a full-screen black plate. Hiding the
         board is the whole point — the device is about to change hands.
       * Single human: the compact centred plate multiplayer uses, over a
         still-visible board. There's nobody to hide the map from, and
         this only ever appears at the end of a run. -->
  <div :class="isSingleHuman ? 'plate-overlay' : 'fixed-label'">
    <div :class="isSingleHuman ? 'plate-content' : ''">
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
      <div v-if="showOtherWinner">Player {{ winner + 1 }} wins!</div>

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

      <!-- Exit guidance. The single-human skin points at the icons the way
           the multiplayer dialog does; hotseat keeps the plain wording,
           which reads better on the big black plate. -->
      <div v-if="showExitHint && isSingleHuman" class="exit-hint">
        To exit the game click
        <img class="inline-icon" :src="getImagePath('settings_icon')" alt="settings" />, then
        <img class="inline-icon" :src="getImagePath('exit_icon')" alt="exit" />
      </div>
      <div v-else-if="showExitHint" class="note">
        Press exit icon on the panel to start new game
      </div>
      <!-- Only offered when the turn can actually still be passed. A lost
           scenario ends there: its End-turn button is disabled, so
           promising a bot fight would be a dead end. -->
      <div v-if="canWatchBots && lastPlayer === null && areAllHumanPlayersEliminated" class="note">
        Or you may watch bot fighting
      </div>

      <div>
        <button type="button" :class="isSingleHuman ? 'plate-close' : ''" @click="onClickAction">
          <div v-if="isSingleHuman">OK</div>
          <div v-else style="position: relative; top: -2px">Ready</div>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { getImagePath } from '@/game/helpers'

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
    // False once losing has ended the run outright (a scenario), so the
    // "watch bot fighting" offer is suppressed. Random and saved maps
    // leave it true.
    canWatchBots: {
      type: Boolean,
      default: true,
    },
  },
  computed: {
    showLose() {
      return !this.isActivePlayer && !this.isPlayerInformedLose
    },
    // Third-person "someone else won". Suppressed on a lone player's own
    // lose screen: "You lose" plus the way out is the whole message, and
    // which bot came top is noise at that moment. A hotseat table still
    // wants to know who took it, and a single player who stays to watch
    // the bot fight finish still sees it at the end.
    showOtherWinner() {
      if (this.winner === null || this.winner === this.currentPlayer) return false
      return !(this.isSingleHuman && this.showLose)
    },
    // The run is over for someone — point them at Exit.
    showExitHint() {
      return this.areAllHumanPlayersEliminated || this.winner !== null || this.lastPlayer !== null
    },
  },
  methods: {
    getImagePath,
  },
}
</script>

<style scoped>
/* Single-human skin — the same plate `MultiplayerReadyLabel` uses, so an
   end-of-game announcement looks the same however you're playing. The
   board stays visible behind the dim. */
.plate-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.plate-content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  background-image: url('/images/error_plate_big.png');
  background-size: 100% 100%;
  padding: 30px 35px;
  color: black;
  width: 320px;
  font-size: 1rem;
  font-weight: bold;
}

.plate-content .note {
  font-weight: normal;
}

.exit-hint {
  margin: 12px 0;
  line-height: 28px;
  font-weight: normal;
}

.inline-icon {
  width: 24px;
  height: 24px;
  vertical-align: middle;
  margin: 0 2px;
}

.plate-close {
  position: relative;
  display: block;
  margin: 10px auto 0;
  background-color: rgba(0, 0, 0, 0.5);
  background-image: none;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  z-index: 1001;
  font-family: inherit;
  font-size: 1rem;
}

.plate-content .curPlayerImage {
  width: 28px;
  height: 28px;
}

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
