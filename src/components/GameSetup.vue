<template>
  <div class="game-setup">
    <h1>Game setup</h1>
    <!-- <div>
      <label for="playersNum">Number of Players:</label>
      <input type="number" id="playersNum" v-model.number="playersNum" min="2" max="4" />
    </div> -->
    <div>
      <label for="width">Width:</label>
      <input type="number" id="width" v-model.number="width" min="5" max="50" />
    </div>
    <div>
      <label for="height">Height:</label>
      <input type="number" id="height" v-model.number="height" min="5" max="50" />
    </div>
    <h2>Players</h2>
    <div v-for="(player, index) in players" :key="index">
      <label :for="'playerType' + index">Player {{ index + 1 }}:</label>
      <select :id="'playerType' + index" v-model="players[index]._type">
        <option v-for="(typeValue, typeName) in PLAYER_TYPES" :key="typeName" :value="typeValue">
          {{ typeName }}
        </option>
      </select>
    </div>
    <button type="button" @click="processClick">Start game</button>
  </div>
</template>

<script>
import Models from '@/game/models';

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
    const PLAYER_TYPES = Models.PlayerTypes;
    return {
      // playersNum: 4,
      players: [
        new Models.Player(Models.PlayerTypes.HUMAN),
        new Models.Player(Models.PlayerTypes.BOT),
        new Models.Player(Models.PlayerTypes.BOT),
        new Models.Player(Models.PlayerTypes.BOT),
      ],
      width: 20,
      height: 20,
      // TODO: make them changeable
      sectorsNum: 4,
      enableFogOfWar: true,
      fogOfWarRadius: 3,
      enableUndo: false,
      LIMITS,
      PLAYER_TYPES,
    };
  },
  methods: {
    processClick() {
      let settings = {
        // playersNum: this.playersNum,
        width: this.width,
        height: this.height,
      };
      if (!this.isInputValid(settings)) {
        alert('Invalid input');
        return;
      }
      settings = {
        ...settings,
        players: this.players,
        sectorsNum: this.sectorsNum,
        enableFogOfWar: this.enableFogOfWar,
        fogOfWarRadius: this.fogOfWarRadius,
        enableUndo: this.enableUndo,
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
