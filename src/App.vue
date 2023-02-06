<template>
  <GameGrid :width=8 :height=6 :currentPlayer="currentPlayer"/>
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
      console.log(this.currentPlayer);
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
</style>
