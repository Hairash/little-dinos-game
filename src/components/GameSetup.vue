<template>
  <div class="game-setup">
    <h1>Game setup</h1>
    <div>
      <label for="playersNum">Number of Players:</label>
      <input type="number" id="playersNum" v-model.number="playersNum" min="2" max="4" />
    </div>
    <div>
      <label for="width">Width:</label>
      <input type="number" id="width" v-model.number="width" min="5" max="50" />
    </div>
    <div>
      <label for="height">Height:</label>
      <input type="number" id="height" v-model.number="height" min="5" max="50" />
    </div>
    <button type="button" @click="processClick">Start game</button>
  </div>
</template>

<script>
export default {
  name: 'GameSetup',
  props: {
    handleClick: Function,
  },
  data() {
    const LIMITS = {
      playersNum: {
        min: 2,
        max: 4,
      },
      width: {
        min: 5,
        max: 50,
      },
      height: {
        min: 5,
        max: 50,
      },
    };
    return {
      playersNum: 2,
      width: 26,
      height: 16,
      LIMITS,
    };
  },
  methods: {
    processClick() {
      const settings = {
        playersNum: this.playersNum,
        width: this.width,
        height: this.height,
      };
      if (!this.isInputValid(settings)) {
        alert('Invalid input');
        return;
      }
      this.handleClick(settings);
    },
    isInputValid(settings) {
      for (const key in settings) {
        if (
          !settings[key] ||
          !Number.isInteger(settings[key]) ||
          settings[key] < this.LIMITS[key].min ||
          settings[key] > this.LIMITS[key].max
        ) {
          return false;
        }
      }
      return true;
    },
  },
}
</script>

<style>
/* TODO: Unify font style for all labels - add font style to the App */
/* TODO: Center the label */
div.game-setup {
  position: relative;
  top: 60px;
}
</style>
