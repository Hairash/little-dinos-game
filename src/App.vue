<template>
  <GameMenu
    v-if="state === GAME_STATES.menu"
  />
  <GameSetup
    v-if="state === GAME_STATES.setup"
  />
  <DinoGame
    v-if="state === GAME_STATES.game"
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
  <GameHelp
    v-if="state === GAME_STATES.help"
  />

</template>

<script>
import GameMenu from "@/components/GameMenu.vue";
import GameSetup from '@/components/GameSetup.vue'
import DinoGame from '@/components/DinoGame.vue'
import GameHelp from "@/components/GameHelp.vue";

import emitter from "@/game/eventBus";
import {DEFAULT_BUILDING_RATES, FIELDS_TO_SAVE, GAME_STATES} from "@/game/const";

export default {
  name: 'App',
  components: {
    GameHelp,
    GameMenu,
    GameSetup,
    DinoGame,
  },
  data() {
    const state = GAME_STATES.menu;
    let settings = {};
    return {
      GAME_STATES,
      state,
      settings,
    }
  },
  mounted() {
    emitter.on('startGame', this.startGame);
    emitter.on('loadGame', this.loadGame);
    emitter.on('goToPage', this.goToPage);
  },
  methods: {
    startGame(settings) {
      console.log(settings);
      this.settings = settings;
      this.state = this.GAME_STATES.game;
    },
    goToPage(page) {
      this.state = page;
    },
    loadGame() {
      console.log('Load game clicked');
      const fieldsToLoad = FIELDS_TO_SAVE.filter(item => item !== 'field');
      for (const field of fieldsToLoad) {
        const value = localStorage.getItem(field);
        // Dirty hack to set default values for buildingRates, because otherwise
        // vue3-slider displays default values instead of 0
        if (field === 'buildingRates' && !value) {
          this.buildingRates = DEFAULT_BUILDING_RATES;
        }
        if (value) {
          this.settings[field] = JSON.parse(value);
        }
      }
      this.settings.loadGame = true;
      this.state = this.GAME_STATES.game;
    },
  },
  beforeUnmount() {
    emitter.off('startGame', this.startGame);
    emitter.off('loadGame', this.loadGame);
    emitter.off('goToPage', this.goToPage);
    // TODO: Check we didn't forget smth
  }
}
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=RocknRoll+One&family=Ubuntu+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap');

body {
  margin: 0;
}

#app {
  font-family: "RocknRoll One", Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: white;
}
</style>
