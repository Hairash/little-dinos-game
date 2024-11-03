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
      <label for="maxUnitsNum">Max units number:</label>
      <input type="number" id="maxUnitsNum" class="inputNumber" v-model.number="maxUnitsNum" min="0" max="50"/>
    </div>
    <div>
      <label for="fogOfWar">Enable fog of war:</label>
      <input type="checkbox" id="fogOfWar" v-model="enableFogOfWar" />
    </div>
    <div v-if="enableFogOfWar">
      <label for="fogOfWarRadius">Fog of war radius:</label>
      <input type="number" id="fogOfWarRadius" class="inputNumber" v-model.number="fogOfWarRadius" min="1" max="20"/>
    </div>
<!--  Removed ability to disable scout mode  -->
<!--    <div v-if="enableFogOfWar">-->
<!--      <label for="scoutMode">Enable scout mode:</label>-->
<!--      <input type="checkbox" id="scoutMode" v-model="enableScoutMode" />-->
<!--    </div>-->
    <div v-if="enableFogOfWar">
      <label for="visibilitySpeedRelation">Visibility-speed relation:</label>
      <input type="checkbox" id="scoutMode" v-model="visibilitySpeedRelation" />
    </div>
    <div>
      <label for="unitSpeedRange">Dinos speed range:</label>
      <input type="number" id="minSpeed" class="inputNumber" v-model.number="minSpeed" min="1" max="20" />
      -
      <input type="number" id="maxSpeed" class="inputNumber" v-model.number="maxSpeed" min="1" max="20" />
    </div>
    <div>
      <label for="hideEnemySpeed">Hide enemy speed:</label>
      <input type="checkbox" id="hideEnemySpeed" v-model="hideEnemySpeed" />
    </div>
    <div>
      <label for="killAtBirth">Kill at birth:</label>
      <input type="checkbox" id="killAtBirth" v-model="killAtBirth" />
    </div>

    <div class="scoreBlock">
      <span class="scoreHeader">Scores</span>
      <div class="scoreInput">
        <label for="scoresToWin">Scores to win:</label>
        <input type="number" id="scoresToWin" class="inputNumber" v-model.number="scoresToWin" min="0" max="10000"/>
      </div>
      <div v-for="(value, key) in scoreMods" :key="key">
        <label :for="key" class="labelRange">{{ key }}:</label>
        <input
          type="range"
          step="1"
          :id="key"
          class="inputRange"
          v-model.number="scoreMods[key]"
          :min="-20"
          :max="20"
        />
        <span class="rangeValue">{{ scoreMods[key] }}</span>
        <span class="scoreHelpIcon" :class="{ selected: scoreHelp === key }" @click="scoreHelp=key" title="Score help">
          ℹ️
          <div v-if="scoreHelp === key" class="scoreHelpText">{{scoreHelpMap[key]}}</div>
        </span>
      </div>
      <div class="randomScoreBlock">
        <button type="button" class="scoreBtn" @click="randomizeScoreValues">Randomize</button>
        <button type="button" class="scoreBtn" @click="setDefaultScoreValues">Set default</button>
      </div>
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
      <button type="button" @click="processOpenRulesBtnClick">Show game rules</button>
    </div>
    <div v-if="areRulesOpen" class="toggleContent">
      <div class="contentBlock" ref="contentBlock">
        <br>
        <b>Summary</b><br>
        <div class="textBlock">
          🌿 At the start of each turn, every empty tower of your color spawns a new dino with a random speed.<br>
          🌿 At the end of dino's move all adjacent enemy dinos (4 directions) die.<br>
          🌿 If your dino comes to an enemy tower, it becomes yours.<br>
          🌿 You can move any number of your dinos each turn.<br>
          🌿 A dino can move a number of cells up to its speed during a turn.<br>
          🌿 Rocks and other dinos block movement.<br>
          🌿 There are 2 ways to win:<br>
          &emsp;&emsp;🌱 eliminate all other players or<br>
          &emsp;&emsp;🌱 reach specific number of score (set up in settings)<br>
        </div>
        <br>
        <b>Description</b><br>
        <div class="textBlock">
          It is a simple turn-based strategy game, where you can challenge the bots, play with friends, or even mix it up
          with both bots and pals.<br>
          <br>
          The gameplay unfolds on a randomly generated grid, punctuated by impassable rock cells. As the game begins,
          you'll have a tower and a dino of the same color (e.g., blue for the first player) staying on it. The dino
          displays its speed as a number in its bottom right corner, representing how many cells it can traverse in a
          single turn. Other dinos, whether they're friend or foe, are obstacles you can't move through as well as rocks.
          <br>
          <br>
          To move a dino, simply click or tap on it, then select the cell you want it to go to. When a dino completes its
          move, it eliminates opposing dinos in its immediate vicinity (those in the 4 main directions: ⬅️➡️⬇️⬆️). If your
          dino lands on an enemy tower, it captures the tower and it becomes yours. With every new turn, each your
          unoccupied towers will produce a new dino with a randomly assigned speed.<br>
          <br>
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
      minSpeed: {
        min: 1,
        max: 20,
      },
      maxSpeed: {
        min: 1,
        max: 20,
      },
      scoresToWin: {
        min: 0,
        max: 10000,
      },
      maxUnitsNum: {
        min: 0,
        max: 50,
      },
    };
    const SCORE_HELP_MAP = {
      kill: 'Kill enemy unit',
      lose: 'Lose your unit',
      building: 'Building under control at the beginning of the turn',
      unit: 'Unit under control at the beginning of the turn',
      produce: 'Produce unit at the beginning of the turn',
      move: 'Move unit',
      capture: 'Capture building',
      leave: 'Lose building',
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
      scoresToWin: 200,
      scoreMods: {
        kill: 10,  // kill enemy unit
        lose: -5,  // lose your unit
        building: -3,  // building under control at the beginning of the turn
        unit: 1,  // unit under control at the beginning of the turn
        produce: 2,  // produce unit at the beginning of the turn
        move: -1,  // mover unit
        capture: 20,  // capture building
        leave: -8,  // lose building
      },
      scoreHelp: null,
      scoreHelpMap: SCORE_HELP_MAP,
      // TODO: make them changeable ?
      sectorsNum: 4,
      enableFogOfWar: false,
      fogOfWarRadius: 3,
      enableScoutMode: true,
      visibilitySpeedRelation: true,
      minSpeed: 1,
      maxSpeed: 10,
      maxUnitsNum: 15,
      hideEnemySpeed: false,
      killAtBirth: true,
      enableUndo: false,
      loadGame: false,
      loadGamePossible: false,
      LIMITS,
      areRulesOpen: false,
      // PLAYER_TYPES,
    };
  },
  mounted() {
    this.loadSettings();
    this.loadGamePossible = !!localStorage.getItem('field');
  },
  methods: {
    loadSettings() {
      const fieldsToLoad = FIELDS_TO_SAVE.filter(item => item !== 'field');
      for (const field of fieldsToLoad) {
        const value = localStorage.getItem(field);
        if (value) {
          this[field] = JSON.parse(value);
        }
      }
    },
    updateHumanPlayers() {
      this.humanPlayerNames.length = this.humanPlayersNum;
    },
    processStartBtnClick() {
      // Settings to validate (limit check)
      let settings = {
        width: this.width,
        height: this.height,
        humanPlayersNum: this.humanPlayersNum,
        botPlayersNum: this.botPlayersNum,
        minSpeed: this.minSpeed,
        maxSpeed: this.maxSpeed,
        scoresToWin: this.scoresToWin,
        maxUnitsNum: this.maxUnitsNum,
      };
      if (!this.isInputValid(settings)) {
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
        visibilitySpeedRelation: this.visibilitySpeedRelation,
        hideEnemySpeed: this.hideEnemySpeed,
        killAtBirth: this.killAtBirth,
        enableUndo: this.enableUndo,
        loadGame: this.loadGame,
        scoreMods: this.scoreMods,
      }
      this.handleClick(settings);
    },
    processLoadBtnClick() {
      if (this.loadGamePossible) {
        this.loadSettings();
        this.loadGame = true;
      }
      this.processStartBtnClick();
    },
    processOpenRulesBtnClick() {
      this.areRulesOpen = !this.areRulesOpen;
      if (this.areRulesOpen) {
        this.$nextTick(() => {
          this.$refs.contentBlock.scrollIntoView({ behavior: 'smooth' });
        });
      }
    },
    isInputValid(settings) {
      for (const key in settings) {
        if (
          (!settings[key] && settings[key] !== 0) ||
          !Number.isInteger(settings[key]) ||
          settings[key] < this.LIMITS[key].min ||
          settings[key] > this.LIMITS[key].max
        ) {
          alert(`Wrong value for ${key}: ${settings[key]}`);
          return false;
        }
      }
      if (this.humanPlayersNum + this.botPlayersNum > 8) {
        alert('Total number of players shouldn\'t be greater than 8');
        return false;
      }
      if (this.maxSpeed < this.minSpeed) {
        alert('Max speed should be greater than min speed');
        return false;
      }
      return true;
    },
    randomizeScoreValues() {
      for (const key in this.scoreMods) {
        this.scoreMods[key] = Math.floor(Math.random() * 41) - 20;
      }
    },
    setDefaultScoreValues() {
      this.scoreMods = {
        kill: 10,
        lose: 0,
        building: -3,
        unit: 0,
        produce: 0,
        move: 0,
        capture: 0,
        leave: 0,
      };
    }
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
  max-width: 50px;
}

div.scoreBlock {
  border: 1px solid;
  width: 260px;
  position: relative;
  margin: 10px auto;
  padding: 8px 10px 12px 10px;
}

span.scoreHeader {
  display: inline-block;
  margin-bottom: 5px;
  font-size: 18px;
  font-weight: 900;
}

div.scoreInput {
  margin-bottom: 10px;
}

label.labelRange {
  display: inline-block;
  width: 100px;
}

input.inputRange {
  vertical-align: middle;
  max-width: 100px;
}

span.rangeValue {
  display: inline-block;
  width: 30px;
  text-align: center;
  vertical-align: middle;
}

span.scoreHelpIcon {
  position: relative;
  display: inline-block;
  width: 22px;
  height: 22px;
  line-height: 24px;
  cursor: pointer;
}

span.scoreHelpIcon.selected {
  background-color: lightgray;
}

div.scoreHelpText {
  position: absolute;
  bottom: 0;
  left: 24px;
  width: 100px;
  background: black;
  color: white;
  border: solid 2px;
}

div.randomScoreBlock {
  margin-top: 10px;
}

button.scoreBtn {
  margin: 0 21px;
}

/* div.botBlock {
    margin-top: 20px;
} */
</style>
