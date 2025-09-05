<template>
  <div class="gameSetup">
  <!--  Add button to go back  -->
    <button
      type="button"
      class="goBackBtn"
      @click="handleBackBtnClick"
    >
      <img :src="`/images/arrow_white.png`">
    </button>
    <h1>Game setup</h1>
    <div id="settings-wrapper">
      <div id="main-settings">
        <div class="plate" style="width: 178px;">
          <div class="icon">
            <img :src="`/images/field_icon.png`">
          </div>
          <!--      <label for="width">Width:</label>-->

          <input
            type="number"
            id="width"
            class="inputNumber digits2"
            v-model.number="width"
            min="5"
            max="50"
          />
          <!--    </div>-->
          <!--    <div>-->
          <!--      <label for="height">Height:</label>-->
          <span class="labelForInput">✘</span>
          <input
            type="number"
            id="height"
            class="inputNumber digits2"
            v-model.number="height"
            min="5"
            max="50"
          />
        </div>
        <!-- <h2>Players</h2> -->

        <div class="upperGrid">
          <div class="plate" style="width: 112px;">
            <!--      <label for="humanPlayersNum">Number of human players:</label>-->
            <div class="icon">
              <img :src="`/images/human_icon.png`">
            </div>
            <input
              type="number"
              id="humanPlayersNum"
              class="inputNumber digits2"
              v-model.number="humanPlayersNum"
              min="1"
              max="8"
            />
          </div>
          <!-- <div v-for="(player, index) in humanPlayerNames" :key="index">
            <label :for="'player' + index">Player {{ index + 1 }} name:</label>
            <input type="text" :id="'player' + index" v-model="humanPlayerNames[index]" />
          </div> -->
          <div class="botBlock plate" style="width: 112px;">
            <!--      <label for="botPlayersNum">Number of bot players:</label>-->
            <div class="icon">
              <img :src="`/images/bot_icon.png`">
            </div>
            <input
              type="number"
              id="botPlayersNum"
              class="inputNumber digits2"
              v-model.number="botPlayersNum"
              min="0"
              max="7"
            />
          </div>
          <div class="plate" style="width: 112px;">
            <!--      <label for="maxUnitsNum">Max units number:</label>-->
            <div class="icon">
              <img :src="`/images/dino_icon.png`">
            </div>
            <input
              type="number"
              id="maxUnitsNum"
              class="inputNumber digits2"
              v-model.number="maxUnitsNum"
              min="0"
              max="50"
            />
          </div>
          <div class="plate" style="width: 112px;">
            <!--      <label for="maxUnitsNum">Max units number:</label>-->
            <div class="icon">
              <img :src="`/images/dino_icon_plus.png`">
            </div>
            <input
              type="number"
              id="unitModifier"
              class="inputNumber digits2"
              v-model.number="unitModifier"
              min="1"
              max="20"
            />
          </div>
          <div class="plate" style="width: 112px;">
            <!--      <label for="maxBasesNum">Max towers number:</label>-->
            <div class="icon">
              <img :src="`/images/tower_icon.png`">
            </div>
            <input
              type="number"
              id="maxBasesNum"
              class="inputNumber digits2"
              v-model.number="maxBasesNum"
              min="0"
              max="50"
            />
          </div>
          <div class="plate" style="width: 112px;">
            <!--      <label for="maxBasesNum">Max towers number:</label>-->
            <div class="icon">
              <img :src="`/images/tower_icon_plus.png`">
            </div>
            <input
              type="number"
              id="baseModifier"
              class="inputNumber digits2"
              v-model.number="baseModifier"
              min="1"
              max="20"
            />
          </div>
        </div>

        <div>
          <!--      <label for="unitSpeedRange">Dinos speed range:</label>-->
          <!-- Common plate: 114 x 57 px -->
          <div class="plate" style="display: inline-block; width: 182px;">
            <div class="icon">
              <img :src="`/images/speed_icon.png`">
            </div>
            <input type="number" id="minSpeed" class="inputNumber digits2" v-model.number="minSpeed" min="1" max="20"/>
            <span class="labelForInput" style="font-size: 45px; font-weight: bold; line-height: 38px">-</span>
            <input type="number" id="maxSpeed" class="inputNumber digits2" v-model.number="maxSpeed" min="1" max="20"/>
          </div>
        </div>


        <div style="height: 60px; margin: 4px auto;">
          <!--      <label for="fogOfWar">Enable fog of war:</label>-->
          <input
            type="checkbox"
            id="fogOfWar"
            v-model="enableFogOfWar"
            class="hidden-checkbox"
          />
          <label for="fogOfWar" class="checkboxImg">
            <img v-if="!enableFogOfWar" :src="`images/open_eye.png`">
            <img v-if="enableFogOfWar" :src="`images/closed_eye.png`">
          </label>
          <!--      <input type="checkbox" id="fogOfWar" v-model="enableFogOfWar"/>-->
          <div
            v-if="enableFogOfWar"
            class="plate"
            style="position: relative; display: inline-block; top: -5px; margin: 0 4px;"
          >
            <!--      <label for="fogOfWarRadius">Fog of war radius:</label>-->
            <span class="icon">
              <img :src="`/images/radius_icon.png`">
            </span>
            <input
              type="number"
              id="fogOfWarRadius"
              class="inputNumber digits2"
              v-model.number="fogOfWarRadius"
              min="1"
              max="20"
            />
          </div>
        </div>

        <div v-if="enableFogOfWar" style="height: 60px; margin: 4px auto;">
          <div style="display: inline-block;">
            <!--      <label for="visibilitySpeedRelation">Visibility-speed relation:</label>-->
            <input type="checkbox" id="scoutMode" v-model="visibilitySpeedRelation" class="hidden-checkbox"/>
            <label for="scoutMode" class="checkboxImg">
              <img v-if="!visibilitySpeedRelation" :src="`/images/visibility_speed_no_relation_icon.png`">
              <img v-if="visibilitySpeedRelation" :src="`/images/visibility_speed_relation_icon.png`">
            </label>
          </div>
          <div
            v-if="visibilitySpeedRelation"
            class="plate"
            style="position: relative; display: inline-block; top: -5px; margin: 0 4px;"
          >
            <div class="icon">
              <img :src="`/images/speed_icon_max.png`">
            </div>
            <input type="number" id="speedMinVisibility" class="inputNumber digits2" v-model.number="speedMinVisibility" min="1" max="20"/>
          </div>
        </div>

        <!--  Removed ability to disable scout mode  -->
        <!--    <div v-if="enableFogOfWar">-->
        <!--      <label for="scoutMode">Enable scout mode:</label>-->
        <!--      <input type="checkbox" id="scoutMode" v-model="enableScoutMode" />-->
        <!--    </div>-->

        <div>
          <!--      <label for="killAtBirth">Kill at birth:</label>-->
          <input type="checkbox" id="killAtBirth" v-model="killAtBirth" class="hidden-checkbox"/>
          <label for="killAtBirth" class="checkboxImg" style="margin-right: 4px;">
            <img v-if="!killAtBirth" :src="`/images/dino_birth_icon.png`">
            <img v-if="killAtBirth" :src="`/images/dino_birth_kill_icon.png`">
          </label>

          <input type="checkbox" id="hideEnemySpeed" v-model="hideEnemySpeed" class="hidden-checkbox"/>
          <label for="hideEnemySpeed" class="checkboxImg">
            <img v-if="!hideEnemySpeed" :src="`/images/show_speed_icon.png`">
            <img v-if="hideEnemySpeed" :src="`/images/hide_speed_icon.png`">
          </label>
        </div>
      </div>

      <div id="buildings-settings">
        <div>
          <!--      <label for="baseRate" class="labelRange">Rate of bases:</label>-->
          <div class="icon">
            <img :src="`/images/base.png`">
          </div>
          <vue3-slider
            id="baseRate"
            class="slider"
            v-model="buildingRates.base"
            :min="0"
            :max="5"
            :step="1"
            :color="'#ae7b62'"
            :sticky="true"
            :tooltip="true"
            :formatTooltip="value => marks[value]"
            :handleScale="2.5"
            :alwaysShowHandle="true"
          ></vue3-slider>
        </div>
        <div>
          <!--      <label for="habitationRate" class="labelRange">Rate of habitations:</label>-->
          <div class="icon">
            <img :src="`/images/habitation.png`">
          </div>
          <vue3-slider
            id="baseRate"
            class="slider"
            v-model="buildingRates.habitation"
            :min="0"
            :max="5"
            :step="1"
            :color="'#ae7b62'"
            :sticky="true"
            :tooltip="true"
            :formatTooltip="value => marks[value]"
            :handleScale="2.5"
            :alwaysShowHandle="true"
          ></vue3-slider>
        </div>
        <div>
          <!--      <label for="templeRate" class="labelRange">Rate of temples:</label>-->
          <div class="icon">
            <img :src="`/images/temple.png`">
          </div>
          <vue3-slider
            id="baseRate"
            class="slider"
            v-model="buildingRates.temple"
            :min="0"
            :max="5"
            :step="1"
            :color="'#ae7b62'"
            :sticky="true"
            :tooltip="true"
            :formatTooltip="value => marks[value]"
            :handleScale="2.5"
            :alwaysShowHandle="true"
          ></vue3-slider>
        </div>
        <div>
          <!--      <label for="wellRate" class="labelRange">Rate of wells:</label>-->
          <div class="icon">
            <img :src="`/images/well.png`">
          </div>
          <vue3-slider
            id="baseRate"
            class="slider"
            v-model="buildingRates.well"
            :min="0"
            :max="5"
            :step="1"
            :color="'#ae7b62'"
            :sticky="true"
            :tooltip="true"
            :formatTooltip="value => marks[value]"
            :handleScale="2.5"
            :alwaysShowHandle="true"
          ></vue3-slider>
        </div>
        <div>
          <!--      <label for="storageRate" class="labelRange">Rate of storages:</label>-->
          <div class="icon">
            <img :src="`/images/storage.png`">
          </div>
          <vue3-slider
            id="baseRate"
            class="slider"
            v-model="buildingRates.storage"
            :min="0"
            :max="5"
            :step="1"
            :color="'#ae7b62'"
            :sticky="true"
            :tooltip="true"
            :formatTooltip="value => marks[value]"
            :handleScale="2.5"
            :alwaysShowHandle="true"
          ></vue3-slider>
        </div>
        <div>
          <!--      <label for="obeliskRate" class="labelRange">Rate of obelisks:</label>-->
          <div class="icon">
            <img :src="`/images/obelisk.png`">
          </div>
          <vue3-slider
            id="baseRate"
            class="slider"
            v-model="buildingRates.obelisk"
            :min="0"
            :max="5"
            :step="1"
            :color="'#ae7b62'"
            :sticky="true"
            :tooltip="true"
            :formatTooltip="value => marks[value]"
            :handleScale="2.5"
            :alwaysShowHandle="true"
          ></vue3-slider>
        </div>
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
    <div style="padding: 30px">
      <button
        type="button"
        class="startBtn"
        @click="processStartBtnClick"
      >
        <span>GO!</span>
      </button>
    </div>
<!--    <div v-if="areRulesOpen" class="toggleContent">-->
<!--      <div class="contentBlock">-->
<!--        <br>-->
<!--        <b>Summary</b><br>-->
<!--        <div class="textBlock">-->
<!--          🌿 At the start of each turn, every empty tower of your color spawns a new dino with a random speed.<br>-->
<!--          🌿 At the end of dino's move all adjacent enemy dinos (4 directions) die.<br>-->
<!--          🌿 If your dino comes to an enemy tower, it becomes yours.<br>-->
<!--          🌿 You can move any number of your dinos each turn.<br>-->
<!--          🌿 A dino can move a number of cells up to its speed during a turn.<br>-->
<!--          🌿 Rocks and other dinos block movement.<br>-->
<!--          🌿 There are 2 ways to win:<br>-->
<!--          &emsp;&emsp;🌱 eliminate all other players or<br>-->
<!--          &emsp;&emsp;🌱 reach specific number of score (set up in settings)<br>-->
<!--        </div>-->
<!--        <br>-->
<!--        <b>Description</b><br>-->
<!--        <div class="textBlock">-->
<!--          It is a simple turn-based strategy game, where you can challenge the bots, play with friends, or even mix it-->
<!--          up-->
<!--          with both bots and pals.<br>-->
<!--          <br>-->
<!--          The gameplay unfolds on a randomly generated grid, punctuated by impassable rock cells. As the game begins,-->
<!--          you'll have a tower and a dino of the same color (e.g., blue for the first player) staying on it. The dino-->
<!--          displays its speed as a number in its bottom right corner, representing how many cells it can traverse in a-->
<!--          single turn. Other dinos, whether they're friend or foe, are obstacles you can't move through as well as-->
<!--          rocks.-->
<!--          <br>-->
<!--          <br>-->
<!--          To move a dino, simply click or tap on it, then select the cell you want it to go to. When a dino completes-->
<!--          its-->
<!--          move, it eliminates opposing dinos in its immediate vicinity (those in the 4 main directions: ⬅️➡️⬇️⬆️). If-->
<!--          your-->
<!--          dino lands on an enemy tower, it captures the tower and it becomes yours. With every new turn, each your-->
<!--          unoccupied towers will produce a new dino with a randomly assigned speed.<br>-->
<!--          <br>-->
<!--          You receive 10 score for every enemy you kill and lose 3 score every turn for every tower you control.<br>-->
<!--          Before you dive in, note that there are a few game settings available. Kindly recommend you to start with the-->
<!--          "fog of war" option disabled to-->
<!--          <img class="unitImg" style="float: right" :src="`/images/dino3.png`">-->
<!--          understand what's going on.<br>-->
<!--          Enjoy!-->
<!--        </div>-->
<!--      </div>-->
<!--    </div>-->
  </div>
</template>

<script>
import slider from 'vue3-slider'

// import Models from '@/game/models';
import {DEFAULT_BUILDING_RATES, FIELDS_TO_SAVE, GAME_STATES, INITIAL_SETTINGS} from '@/game/const';
import emitter from "@/game/eventBus";

export default {
  name: 'GameSetup',
  components: {
    "vue3-slider": slider,
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
      speedMinVisibility: {
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
      maxBasesNum: {
        min: 0,
        max: 50,
      },
      unitModifier: {
        min: 1,
        max: 20,
      },
      baseModifier: {
        min: 1,
        max: 20,
      },
    };
    // const PLAYER_TYPES = Models.PlayerTypes;
    return {
      ...INITIAL_SETTINGS,
      humanPlayerNames: [''],
      //   new Models.Player(Models.PlayerTypes.HUMAN),
      //   new Models.Player(Models.PlayerTypes.BOT),
      //   new Models.Player(Models.PlayerTypes.BOT),
      //   new Models.Player(Models.PlayerTypes.BOT),
      // ],
      enableUndo: false,
      loadGame: false,
      loadGamePossible: false,
      LIMITS,
      areRulesOpen: false,
      marks: {
        0: 'None',
        1: 'Ones',
        2: 'Few',
        3: 'Average',
        4: 'A lot',
        5: 'Very much',
      },
      // PLAYER_TYPES,
    };
  },
  mounted() {
    this.loadSettings();
    this.loadGamePossible = !!localStorage.getItem('field');
  },
  methods: {
    handleBackBtnClick() {
      emitter.emit('goToPage', GAME_STATES.menu);
    },
    loadSettings() {
      const fieldsToLoad = FIELDS_TO_SAVE.filter(item => item !== 'field');
      for (const field of fieldsToLoad) {
        const value = localStorage.getItem(field);
        // Dirty hack to set default values for buildingRates, because otherwise
        // vue3-slider displays default values instead of 0
        if (field === 'buildingRates' && !value) {
          this.buildingRates = DEFAULT_BUILDING_RATES;
        }
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
        speedMinVisibility: this.speedMinVisibility,
        scoresToWin: this.scoresToWin,
        maxUnitsNum: this.maxUnitsNum,
        maxBasesNum: this.maxBasesNum,
        unitModifier: this.unitModifier,
        baseModifier: this.baseModifier,
      };
      if (!this.isInputValid(settings)) {
        return;
      }
      // let players = Array.from({ length: this.humanPlayersNum }, () => new Models.Player(Models.PlayerTypes.HUMAN));
      // players = players.concat(Array.from({ length: this.humanPlayersNum }, () => new Models.Player(Models.PlayerTypes.HUMAN)));
      const playersNum = this.humanPlayersNum + this.botPlayersNum;
      this.sectorsNum = playersNum <= 4 ? 4 : 6;
      // const buildingRates = this.calculateBuildingsRate();

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
        maxUnitsNum: this.maxUnitsNum,
        maxBasesNum: this.maxBasesNum,
        buildingRates: this.buildingRates,
      }
      emitter.emit('startGame', settings);
    },
    processLoadBtnClick() {
      if (this.loadGamePossible) {
        this.loadSettings();
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
          alert(`Wrong value for ${key}`);
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
      if (this.speedMinVisibility < this.minSpeed) {
        alert('Blind speed should be greater than min speed');
        return false;
      }
      return true;
    },
    calculateBuildingsRate() {
      const totalRate = Object.values(this.buildingRates).reduce((sum, rate) => sum + rate, 0);
      const normalizedRates = {};
      for (const key in this.buildingRates) {
        normalizedRates[key] = this.buildingRates[key] / totalRate;
      }
      return normalizedRates;
    },
  },
}
</script>

<style scoped>
/* TODO: Unify font style for all labels - add font style to the App */
div.gameSetup {
  position: relative;
  background-image: url('/public/images/background.png');
  background-size: cover;
  overflow: auto;
  height: 100vh;
  width: 100vw;
}

.goBackBtn {
  position: absolute;
  top: 34px;
  left: 16px;
  border: none;
  background-color: rgba(0, 0, 0, 0);
}

.goBackBtn img {
  width: 40px;
  height: 40px;
  user-select: none;
  cursor: pointer;
}

.gameSetup h1 {
  margin: 0;
  padding: 30px;
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

label.labelRange {
  display: inline-block;
  width: 150px;
}

input.inputRange {
  vertical-align: middle;
  max-width: 200px;
}

#settings-wrapper {
  display: flex;
  flex-direction: column; /* Stack vertically by default (for small screens) */
  align-items: center;
  gap: 24px;
  max-width: 840px;
  margin: 0 auto;
}

@media (min-width: 760px) {
  #settings-wrapper {
    flex-direction: row; /* Horizontal alignment */
    justify-content: center;
    align-items: flex-start;
  }
}


#main-settings {
  width: 360px;
  margin: 0 auto;
}

.upperGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 5px;
  margin: 4px auto;
  width: 229px;
}

.icon {
  background-image: url('/public/images/icon.png');
  width: 50px;
  height: 50px;
  display: inline-block;
  background-size: contain;
  user-select: none;
  margin-right: 4px;
}

.icon img {
  width: 40px;
  height: 40px;
  margin: 5px;
  user-select: none;
}

.hidden-checkbox {
  display: none;
}

.checkboxImg {
  display: inline-block;
  width: 60px;
  height: 60px;
  background-image: url('/public/images/big_button.png');
  background-size: cover;
  cursor: pointer;
  user-select: none;
}

.checkboxImg img {
  width: 40px;
  height: 40px;
  margin: 10px;
  user-select: none;
}


input.inputNumber {
  max-width: 50px;
  font-size: 28px; /* Set the font size */
  background-color: #deae88; /* Set the background color */
  padding: 5px; /* Adjust the padding if needed */
  vertical-align: top;
  border: black solid 1px; /* TODO: Think about border style */
  margin-top: 2px;
}

input.inputNumber.digits2 {
  max-width: 35px;
}

/* Hide the default increase/decrease buttons inside the input element */
input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type=number] {
  -moz-appearance: textfield; /* Firefox */
}

span.labelForInput {
  font-size: 28px;
  vertical-align: top;
  line-height: 48px;
  color: black;
}

.slider {
  display: inline-block;
  width: 250px;
  top: -15px;
  left: 8px;
}

.plate {
  background: url('/public/images/plate_no_border.png') no-repeat center center;
  background-size: 100% 100%;
  width: 112px;
  margin: auto;
  padding-top: 4px;
}

#buildings-settings {
  width: 360px;
  margin: 0 auto;
}

@media (min-width: 760px) {
  #buildings-settings {
    padding-top: 67px;
  }
}

.startBtn {
  width: 200px;
  height: 60px;
  border: 0;
  background-image: url("/public/images/long_setup_btn.png");
  background-size: 100% 100%;
  background-color: transparent;
  font-size: 36px;
  font-family: "RocknRoll One", Avenir, Helvetica, Arial, sans-serif;
  cursor: pointer;
}

.startBtn span {
  position: relative;
  top: -2px;
  font-weight: bold;
}

/* div.botBlock {
    margin-top: 20px;
} */
</style>
