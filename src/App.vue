<template>
  <GameGrid :width=8 :height=6 :currentPlayer="currentPlayer"/>
  <span class="curPlayerLabel">Current player:
    <!-- Fix it. Make images for players -->
    <img class="curPlayerImage" :src="`/images/dino${currentPlayer + 1}.png`">
  </span>
  <EndTurnBtn @click="processEndTurn"/>
</template>

<script>
import GameGrid from './components/GameGrid.vue'
import EndTurnBtn from './components/EndTurnBtn.vue'

export default {
  name: 'App',
  components: {
    GameGrid,
    EndTurnBtn,
  },
  data() {
    const playersNum = 2;
    let currentPlayer = 0;
    return {
      playersNum,
      currentPlayer,
    }
  },
  methods: {
    processEndTurn() {
      this.currentPlayer += 1;
      this.currentPlayer %= this.playersNum;
    }
  },
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}

span.curPlayerLabel {
  margin-right: 30px;
}

img.curPlayerImage {
  width: 30px;
  height: 30px;
  vertical-align: bottom;
}
</style>
