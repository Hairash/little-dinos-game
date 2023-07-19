<template>
  <div class="game-setup">
    <h1>Game setup</h1>
    <div>
      <label for="width">Width:</label>
      <input type="number" id="width" v-model.number="width" min="5" max="50" />
    </div>
    <div>
      <label for="height">Height:</label>
      <input type="number" id="height" v-model.number="height" min="5" max="50" />
    </div>
    <h2>Players</h2>
    <div>
      <label for="humanPlayersNum">Number of human players:</label>
      <input
        type="number"
        id="humanPlayersNum"
        v-model.number="humanPlayersNum"
        min="1"
        max="8"
      />
    </div>
    <!-- <div v-for="(player, index) in humanPlayerNames" :key="index">
      <label :for="'player' + index">Player {{ index + 1 }} name:</label>
      <input type="text" :id="'player' + index" v-model="humanPlayerNames[index]" />
    </div> -->
    <div class="botBlock">
      <label for="botPlayersNum">Number of bot players:</label>
      <input type="number" id="botPlayersNum" v-model.number="botPlayersNum" min="0" max="7" />
    </div>
    <div>
      <label for="fogOfWar">Enable fog of war:</label>
      <input type="checkbox" id="fogOfWar" v-model="enableFogOfWar" />
    </div>
    <div v-if="enableFogOfWar">
      <label for="fogOfWarRadius">Fog of war radius:</label>
      <input type="number" id="fogOfWarRadius" v-model.number="fogOfWarRadius" min="1" max="20"/>
    </div>
    <div>
      <label for="Undo">Enable undo:</label>
      <input type="checkbox" id="Undo" v-model="enableUndo" />
    </div>
    <!-- <div v-for="(player, index) in players" :key="index">
      <label :for="'playerType' + index">Player {{ index + 1 }}:</label>
      <select :id="'playerType' + index" v-model="players[index]._type">
        <option v-for="(typeValue, typeName) in PLAYER_TYPES" :key="typeName" :value="typeValue">
          {{ typeName }}
        </option>
      </select>
    </div> -->
    <div>
      <button type="button" @click="processStartBtnClick">Start game</button>
    </div>
    <div>
      <button type="button" @click="processLoadBtnClick" v-if="loadGamePossible">Load previous game</button>
    </div>
  </div>
</template>

<script>
// import Models from '@/game/models';

export default {
  name: 'GameSetup',
  props: {
    handleClick: Function,
  },
  data() {
    const LIMITS = {
      humanPlayersNum: {
        min: 1,
        max: 8,
      },
      botPlayersNum: {
        min: 0,
        max: 7,
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
    // const PLAYER_TYPES = Models.PlayerTypes;
    return {
      humanPlayerNames: [''],
      //   new Models.Player(Models.PlayerTypes.HUMAN),
      //   new Models.Player(Models.PlayerTypes.BOT),
      //   new Models.Player(Models.PlayerTypes.BOT),
      //   new Models.Player(Models.PlayerTypes.BOT),
      // ],
      width: 20,
      height: 20,
      humanPlayersNum: 1,
      botPlayersNum: 3,
      // TODO: make them changeable
      sectorsNum: 4,
      enableFogOfWar: true,
      fogOfWarRadius: 3,
      enableUndo: false,
      loadGame: false,
      loadGamePossible: false,
      LIMITS,
      // PLAYER_TYPES,
    };
  },
  mounted() {
    console.log('getItem');
    this.loadGamePossible = !!localStorage.getItem('field');
  },
  methods: {
    updateHumanPlayers() {
      this.humanPlayerNames.length = this.humanPlayersNum;
    },
    processStartBtnClick() {
      let settings = {
        width: this.width,
        height: this.height,
        humanPlayersNum: this.humanPlayersNum,
        botPlayersNum: this.botPlayersNum,
      };
      if (!this.isInputValid(settings)) {
        alert('Invalid input');
        return;
      }
      // let players = Array.from({ length: this.humanPlayersNum }, () => new Models.Player(Models.PlayerTypes.HUMAN));
      // players = players.concat(Array.from({ length: this.humanPlayersNum }, () => new Models.Player(Models.PlayerTypes.HUMAN)));
      const playersNum = this.humanPlayersNum + this.botPlayersNum;
      this.sectorsNum = playersNum <= 4 ? 4 : 6;
      settings = {
        ...settings,
        sectorsNum: this.sectorsNum,
        enableFogOfWar: this.enableFogOfWar,
        fogOfWarRadius: this.fogOfWarRadius,
        enableUndo: this.enableUndo,
        loadGame: this.loadGame,
      }
      this.handleClick(settings);
    },
    processLoadBtnClick() {
      if (this.loadGamePossible) {
        this.humanPlayersNum = JSON.parse(localStorage.getItem('humanPlayersNum'));
        this.botPlayersNum = JSON.parse(localStorage.getItem('botPlayersNum'));
        this.width = JSON.parse(localStorage.getItem('width'));
        this.height = JSON.parse(localStorage.getItem('height'));
        this.sectorsNum = JSON.parse(localStorage.getItem('sectorsNum'));
        this.enableFogOfWar = JSON.parse(localStorage.getItem('enableFogOfWar'));
        this.fogOfWarRadius = JSON.parse(localStorage.getItem('fogOfWarRadius'));
        this.enableUndo = JSON.parse(localStorage.getItem('enableUndo'));
        this.loadGame = true;
      }
      this.processStartBtnClick();
    },
    isInputValid(settings) {
      for (const key in settings) {
        if (
          (!settings[key] && settings[key] !== 0) ||
          !Number.isInteger(settings[key]) ||
          settings[key] < this.LIMITS[key].min ||
          settings[key] > this.LIMITS[key].max
        ) {
          return false;
        }
      }
      // TODO: Add alert with error - no more than 8 players
      if (this.humanPlayersNum + this.botPlayersNum > 8) return false;
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
/* div.botBlock {
    margin-top: 20px;
} */
</style>
