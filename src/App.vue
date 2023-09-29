<template>
  <GameSetup
    v-if="state === STATES.setup"
    :handleClick = "handleStartBtnClick"
  />
  <DinoGame
    v-if="state === STATES.game"
    :humanPlayersNum = "settings.humanPlayersNum"
    :botPlayersNum = "settings.botPlayersNum"
    :width = "settings.width"
    :height = "settings.height"
    :sectorsNum = "settings.sectorsNum"
    :enableFogOfWar = "settings.enableFogOfWar"
    :fogOfWarRadius = "settings.fogOfWarRadius"
    :enableScoutMode = "settings.enableScoutMode"
    :minSpeed = "settings.minSpeed"
    :maxSpeed = "settings.maxSpeed"
    :enableUndo = "settings.enableUndo"
    :loadGame = "settings.loadGame"
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
    let settings = {};
    return {
      STATES,
      state,
      settings,
    }
  },
  methods: {
    handleStartBtnClick(settings) {
      console.log(settings);
      this.settings = settings;
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
}
</style>
