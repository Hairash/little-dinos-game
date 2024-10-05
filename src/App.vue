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
    :scoresToWin = "settings.scoresToWin"
    :sectorsNum = "settings.sectorsNum"
    :enableFogOfWar = "settings.enableFogOfWar"
    :fogOfWarRadius = "settings.fogOfWarRadius"
    :enableScoutMode = "settings.enableScoutMode"
    :visibilitySpeedRelation = "settings.visibilitySpeedRelation"
    :minSpeed = "settings.minSpeed"
    :maxSpeed = "settings.maxSpeed"
    :max-units-num="settings.maxUnitsNum"
    :max-bases-num="settings.maxBasesNum"
    :building-rates="settings.buildingRates"
    :enableUndo = "settings.enableUndo"
    :hideEnemySpeed = "settings.hideEnemySpeed"
    :killAtBirth = "settings.killAtBirth"
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
