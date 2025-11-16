<template>
  <LoginPage
    v-if="state === GAME_STATES.login"
    @loginSuccess="loginSuccess"
    @loginError="loginError"
  />
  <LobbyPage
    v-if="state === GAME_STATES.lobby"
    :gameCode="currentGameCode"
    :getAppState="getAppState"
    @gameStarted="handleGameStarted"
    @connectToGame="connectToGame"
    @signOut="handleSignOut"
  />
  <GameMenu
    v-if="state === GAME_STATES.menu"
    :error="currentError"
    :setError="setError"
  />
  <GameSetup
    v-if="state === GAME_STATES.setup"
  />
  <DinoGame
    v-if="state === GAME_STATES.game && !currentGameCode"
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
    :speedMinVisibility = "settings.speedMinVisibility"
    :maxSpeed = "settings.maxSpeed"
    :max-units-num="settings.maxUnitsNum"
    :max-bases-num="settings.maxBasesNum"
    :unit-modifier="settings.unitModifier"
    :base-modifier="settings.baseModifier"
    :building-rates="settings.buildingRates"
    :enableUndo = "settings.enableUndo"
    :hideEnemySpeed = "settings.hideEnemySpeed"
    :killAtBirth = "settings.killAtBirth"
    :loadGame = "settings.loadGame"
    :field = "settings.field"
  />
  <MultiplayerDinoGame
    v-if="state === GAME_STATES.game && currentGameCode"
    :gameCode="currentGameCode"
    :field="settings.field"
    :settings="settings"
    :gameState="currentGameState"
    :getAppState="getAppState"
    @exitGame="handleExitMultiplayerGame"
  />
  <GameHelp
    v-if="state === GAME_STATES.help"
  />

</template>

<script>
import GameMenu from "@/components/GameMenu.vue";
import GameSetup from '@/components/GameSetup.vue'
import DinoGame from '@/components/DinoGame.vue'
import MultiplayerDinoGame from '@/components/MultiplayerDinoGame.vue'
import GameHelp from "@/components/GameHelp.vue";
import LoginPage from '@/components/LoginPage.vue';
import LobbyPage from '@/components/LobbyPage.vue';
import emitter from "@/game/eventBus";
import {DEFAULT_BUILDING_RATES, FIELDS_TO_SAVE, GAME_STATES, INITIAL_SETTINGS} from "@/game/const";
import { whoami } from "@/auth";
import { joinGame, createGame, startMultiplayerGame } from "@/game/service";

export default {
  name: 'App',
  components: {
    LoginPage,
    LobbyPage,
    GameMenu,
    GameSetup,
    DinoGame,
    MultiplayerDinoGame,
    GameHelp,
  },
  data() {
    return {
      GAME_STATES,
      state: null,
      settings: {},
      currentError: null,
      currentGameCode: null,
      currentGameState: null,
    }
  },
  mounted() {
    emitter.on('startGame', this.startGame);
    emitter.on('loadGame', this.loadGame);
    emitter.on('goToPage', this.goToPage);

    emitter.on('joinGame', this.callJoinGame);
    emitter.on('createGame', this.callCreateGame);
    emitter.on('callStartMultiplayerGame', this.callStartMultiplayerGame);

    whoami().then(data => {
      this.state = data.auth ? GAME_STATES.lobby : GAME_STATES.login;
    }).catch(error => {
      this.state = GAME_STATES.login;
      console.error(error);
    });
  },
  methods: {
    // State getter function for WebSocket reconnect logic
    getAppState() {
      return {
        state: this.state,
        gameCode: this.currentGameCode,
      };
    },
    loginSuccess(response) {
      console.log(response);
      this.state = this.GAME_STATES.lobby;
    },
    loginError(error) {
      console.error(error);
    },
    callJoinGame(gameCode) {
      console.log('Joining game', gameCode);
      joinGame(gameCode).then(response => {
        console.log(response);
        this.currentGameCode = gameCode;
        // WebSocket will connect automatically via LobbyPage prop watch
      }).catch(error => {
        console.error(error);
      });
    },
    callCreateGame() {
      console.log('Creating game');
      createGame().then(response => {
        console.log(response);
        this.currentGameCode = response.gameCode;
        // WebSocket will connect automatically via LobbyPage prop watch
      }).catch(error => {
        console.error(error);
      });
    },
    callStartMultiplayerGame() {
      console.log('Starting multiplayer game');
      startMultiplayerGame(this.currentGameCode).then(response => {
        console.log(response);
        // Don't change state here - wait for game_started WebSocket message
        // The state will change in handleGameStarted
      }).catch(error => {
        console.error(error);
      });
    },
    handleGameStarted(gameState) {
      console.log('Game started, received state:', gameState);
      // Store game state and transition to game view
      // The game component will connect to GameConsumer to receive filtered field
      this.state = this.GAME_STATES.game;
      // Store settings from backend (field will come from GameConsumer, not here)
      if (gameState.settings) {
        this.settings = typeof gameState.settings === 'string' 
          ? JSON.parse(gameState.settings) 
          : gameState.settings;
      }
      // Don't store field from game_started - it will come from GameConsumer with proper filtering
      // Store game state for multiplayer component (without field)
      this.currentGameState = gameState;
    },
    handleExitMultiplayerGame() {
      // Return to lobby when exiting multiplayer game
      this.currentGameCode = null;
      this.currentGameState = null;
      this.state = this.GAME_STATES.lobby;
    },

    startGame(settings) {
      console.log(settings);
      this.settings = settings;
      this.state = this.GAME_STATES.game;
    },
    goToPage(page) {
      this.state = page;
    },
    loadGame() {
      const loadGamePossible = !!localStorage.getItem('field');
      if (!loadGamePossible) {
        // TODO: Use dialog instead of alert
        this.setError('No saved game found. Start a new game first.');
        return;
      }
      this.settings = INITIAL_SETTINGS;
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
      console.log(this.settings);
    },
    setError(error) {
      this.currentError = error;
    },
    connectToGame(game) {
      console.log('Connecting to game:', game.gameCode);
      // Set game code and state
      this.currentGameCode = game.gameCode;
      // Store game state
      if (game.settings) {
        this.settings = typeof game.settings === 'string' 
          ? JSON.parse(game.settings) 
          : game.settings;
      }
      this.currentGameState = game;
      // Navigate to game
      this.state = GAME_STATES.game;
    },
    handleSignOut() {
      // Clear game state
      this.currentGameCode = null;
      this.currentGameState = null;
      // Redirect to login page
      this.state = GAME_STATES.login;
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
