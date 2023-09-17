<template>
  <div class="gameSetup">
    <span class="gameTitle">
      <img class="unitImg" :src="`/images/dino3.png`">
      <h1>Little DinoS</h1>
      <img class="unitImg" :src="`/images/dino3a.png`">
    </span>

    <h1>Game setup</h1>
    <div>
      <label for="width">Width:</label>
      <input type="number" id="width" class="inputNumber" v-model.number="width" min="5" max="50" />
    </div>
    <div>
      <label for="height">Height:</label>
      <input type="number" id="height" class="inputNumber" v-model.number="height" min="5" max="50" />
    </div>
    <!-- <h2>Players</h2> -->
    <div>
      <label for="humanPlayersNum">Number of human players:</label>
      <input
        type="number"
        id="humanPlayersNum"
        class="inputNumber"
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
      <input type="number" id="botPlayersNum" class="inputNumber" v-model.number="botPlayersNum" min="0" max="7" />
    </div>
    <div>
      <label for="fogOfWar">Enable fog of war:</label>
      <input type="checkbox" id="fogOfWar" v-model="enableFogOfWar" />
    </div>
    <div v-if="enableFogOfWar">
      <label for="fogOfWarRadius">Fog of war radius:</label>
      <input type="number" id="fogOfWarRadius" class="inputNumber" v-model.number="fogOfWarRadius" min="1" max="20"/>
    </div>
    <div v-if="enableFogOfWar">
      <label for="scoutMode">Enable scout mode:</label>
      <input type="checkbox" id="scoutMode" v-model="enableScoutMode" />
    </div>
    <!-- <div>
      <label for="Undo">Enable undo:</label>
      <input type="checkbox" id="Undo" v-model="enableUndo" />
    </div> -->
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
    <div>
      <button type="button" @click="areRulesOpen = !areRulesOpen">Show game rules</button>
    </div>
    <div v-if="areRulesOpen" class="toggleContent">
      <div class="contentBlock">
        <br>
        <b>Summary</b><br>
        <div class="textBlock">
          🌿 At the start of each turn, every empty tower of your color spawns a new dino with a random speed.<br>
          🌿 At the end of dino's move all adjacent enemy dinos (4 directions) die.<br>
          🌿 If your dino comes to an enemy tower, it becomes yours.<br>
          🌿 You can move any number of your dinos each turn.<br>
          🌿 A dino can move a number of cells up to its speed during a turn.<br>
          🌿 Rocks and other dinos block movement.<br>
          🌿 No win conditions, just enjoy!<br>
        </div>
        <br>
        <b>Description</b><br>
        <div class="textBlock">
          <!-- It is a simple turn-based strategy game you can play alone versus bots or with your friends, or with friends and
          bots - whatever.<br>
          Game is played on the randomly generated field, split by cells, some of them are rocks so they are unpassable.
          At the beginning of the game you have one tower of your color (blue for the first player) and one dino of the
          same color, staying on it as well as other players. In the right bottom corner of your dino you can see a number
          - it is its speed - number of cells it can pass through one turn. Other dinos (yours or enemy's) are unpassable
          as well as rocks.<br>
          Every turn you may move any number of your dinos one by one. To do it just press the dino and then press the cell
          you want it to move to. When the dino ends move, all the dinos around it belongs to other players die. In this
          case around means 4 directions (⬅️➡️⬇️⬆️).<br>
          Also if your dino ends turn on the cell with enemy's tower, dino occupies it, and the tower becomes yours. In
          the beginning of the turn each your free tower generates new dino with random speed.<br>
          There is no way to win this game. But if you lose all your dinos and towers, you will have no moves.<br>
          Also there are few options to setup. Kindly recommend you to play your first game with for of war disabled to
          understand what's
          <img class="unitImg" style="float: right" :src="`/images/dino3.png`">
          going on.<br>
          Enjoy! -->

          It is a simple turn-based strategy game, where you can challenge the bots, play with friends, or even mix it up
          with both bots and pals.<br>
          The gameplay unfolds on a randomly generated grid, punctuated by impassable rock cells. As the game begins,
          you'll have a tower and a dino of the same color (e.g., blue for the first player) staying on it. The dino
          displays its speed as a number in its bottom right corner, representing how many cells it can traverse in a
          single turn. Other dinos, whether they're friend or foe, are obstacles you can't move through as well as rocks.
          <br>
          To move a dino, simply click or tap on it, then select the cell you want it to go to. When a dino completes its
          move, it eliminates opposing dinos in its immediate vicinity (those in the 4 main directions: ⬅️➡️⬇️⬆️). If your
          dino lands on an enemy tower, it captures the tower and it becomes yours. With every new turn, each your
          unoccupied towers will produce a new dino with a randomly assigned speed.<br>
          Although there's no way to "win," if you lose all your towers and dinos, you'll run out of moves and effectively
          be out of the game.<br>
          Before you dive in, note that there are a few game settings available. Kindly recommend you to start with the
          "fog of war" option disabled to
          <img class="unitImg" style="float: right" :src="`/images/dino3.png`">
          understand what's going on.<br>
          Enjoy!
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// import Models from '@/game/models';
import { FIELDS_TO_SAVE } from '@/game/const';

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
      enableScoutMode: false,
      enableUndo: false,
      loadGame: false,
      loadGamePossible: false,
      LIMITS,
      areRulesOpen: false,
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
        enableScoutMode: this.enableScoutMode,
        enableUndo: this.enableUndo,
        loadGame: this.loadGame,
      }
      this.handleClick(settings);
    },
    processLoadBtnClick() {
      if (this.loadGamePossible) {
        const fieldsToLoad = FIELDS_TO_SAVE.filter(item => item !== 'field');
        for (const field of fieldsToLoad) {
          localStorage.getItem(field, JSON.stringify(this[field]));
          this[field] = JSON.parse(localStorage.getItem(field));
        }
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

<style scoped>
/* TODO: Unify font style for all labels - add font style to the App */
/* TODO: Center the label */
div.gameSetup {
  position: relative;
  top: 20px;
}

.gameTitle h1 {
  display: inline;
  color: rgb(0, 150, 0);
  font-size: 44px;
}

img.unitImg {
  display: inline;
  width: 34px;
  height: 34px;
  margin: 0 10px;
}

div.toggleContent {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

div.contentBlock {
  max-width: 800px;
  margin: 0 10px 10px 10px;
}

div.textBlock {
  text-align: left;
}

input.inputNumber {
  max-width: 40px;
}

/* div.botBlock {
    margin-top: 20px;
} */
</style>
