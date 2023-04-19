<template>
  <GameSetup
    v-if="state === STATES.setup"
    :handleClick = "handleStartBtnClick"
  />
  <DinoGame
    v-if="state === STATES.game"
  />
</template>

<script>
import GameSetup from './components/GameSetup.vue'
import DinoGame from './components/DinoGame.vue'

export default {
  name: 'App',
  components: {
    GameSetup,
    DinoGame,
  },
  data() {
    const STATES = {
      setup: 'setup',
      game: 'game',
    }
    const state = STATES.setup;
    return {
      STATES,
      state,
    }
  },
  methods: {
    handleStartBtnClick() {
      this.state = this.STATES.game;
    },
  },
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: white;
  margin-top: 60px;
}
</style>
