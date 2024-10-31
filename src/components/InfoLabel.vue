<template>
  <div class="infoLabelWrapper">
    <div class="infoLabel">
      <span
        class="infoTextLabel"
        @click="handleImgClick"
      >
        <!-- TODO: Fix it. Make images for players (not units) -->
        <img
          class="curPlayerImage"
          :src="`/images/dino${currentPlayer + 1}.png`"
          title="Next unit"
        >
        <span
          class="unitsLabel" title="Active / Total / Max"
        >
          {{ activeUnits }}/{{ totalUnits }}/{{ maxUnitsNum }}
        </span>
      </span>
      <span class="infoTextLabel" title="Killed / Lost">☠️: {{ player.killed }} 🪦: {{ player.lost }}</span>
      <span class="infoTextLabel" title="Score" @click="showScore = !showScore">
        🏆: {{ player.score }}
        <div v-if="showScore"
          class="tooltip"
        >
          <div v-for="(p, idx) in players" :key=idx>
            <img class="playerImage" :src="`/images/dino${idx + 1}.png`">:
            <span>{{ p.score }}</span>
          </div>
        </div>
      </span>

      <button
        type="button"
        class="endBtn"
        title="End turn"
        @click="handleEndTurnBtnClick"
        :disabled="player.type === botType"
      >
        🔚
  <!--      ↩️-->
  <!--      ▶️-->
      </button>
    </div>
  </div>
</template>

<script>
import Models from "@/game/models";

export default {
  name: 'InfoLabel',
  props: {
    currentPlayer: Number,
    players: Array[Models.Player],
    maxUnitsNum: Number,
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
    botType() {
      return Models.PlayerTypes.BOT;
    },
  },
}
</script>

<style scoped>
div.infoLabelWrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: black;
}

div.infoLabel {
  display: flex;
  justify-content: space-around;
  align-items: center;
  max-width: 600px;
  margin: 0 auto;
  padding: 3px;
}

img.curPlayerImage {
  width: 30px;
  height: 30px;
  //vertical-align: bottom;
}

span.unitsLabel {
  margin-left: 5px;
}

img.playerImage {
  width: 20px;
  height: 20px;
}

span.infoTextLabel {
  margin-right: 15px;
  user-select: none;
  display: flex;
  align-items: center;
}

div.tooltip {
  position: absolute;
  bottom: 34px;
  background: black;
  border: solid 2px;
  min-width: 52px;
  padding: 4px;
}

button.endBtn {
  font-size: 18px;
  width: 70px;
}

</style>
