<template>
  <LoginPage
    v-if="state === GAME_STATES.login"
    @loginSuccess="loginSuccess"
    @loginError="loginError"
  />
  <LobbyPage
    v-if="state === GAME_STATES.lobby"
    ref="lobbyPageRef"
    :gameCode="currentGameCode"
    :getAppState="getAppState"
    @gameStarted="handleGameStarted"
    @connectToGame="connectToGame"
    @signOut="handleSignOut"
    @setupGame="handleSetupGame"
  />
  <GameMenu
    v-if="state === GAME_STATES.menu"
    :error="currentError"
    :setError="setError"
  />
  <GameSetup
    v-if="state === GAME_STATES.setup"
    :isMultiplayerMode="!!currentGameCode"
    :savedMultiplayerSettings="multiplayerSettings"
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
    ref="multiplayerGameRef"
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
import {DEFAULT_BUILDING_RATES, FIELDS_TO_SAVE, GAME_STATES, INITIAL_SETTINGS, MULTIPLAYER_INITIAL_SETTINGS} from "@/game/const";
import { whoami } from "@/auth";
import { joinGame, createGame, startMultiplayerGame, leaveGame } from "@/game/service";

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
      multiplayerSettings: null,  // Store custom settings for multiplayer game
    }
  },
  mounted() {
    emitter.on('startGame', this.startGame);
    emitter.on('loadGame', this.loadGame);
    emitter.on('goToPage', this.goToPage);

    emitter.on('joinGame', this.callJoinGame);
    emitter.on('createGame', this.callCreateGame);
    emitter.on('callStartMultiplayerGame', this.callStartMultiplayerGame);
    emitter.on('multiplayerSettingsConfigured', this.handleMultiplayerSettingsConfigured);

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
    async callJoinGame(gameCode) {
      console.log('Joining game', gameCode);
      // Leave current game if we're in one
      if (this.currentGameCode && this.currentGameCode !== gameCode) {
        await this.leaveCurrentGame();
      }
      // Temporarily clear gameCode to prevent watcher from reconnecting to old game
      const oldGameCode = this.currentGameCode;
      this.currentGameCode = null;
      // Close any existing WebSocket connections (both game and lobby)
      this.closeAllWebSockets();
      // Wait a tick to ensure WebSocket is fully closed
      this.$nextTick(() => {
        joinGame(gameCode).then(response => {
          console.log(response);
          // Re-enable reconnection and set new gameCode
          if (this.$refs.lobbyPageRef) {
            this.$refs.lobbyPageRef.preventReconnect = false;
          }
          this.currentGameCode = gameCode;
          // WebSocket will connect automatically via LobbyPage prop watch
        }).catch(error => {
          console.error(error);
          // Re-enable reconnection and restore old gameCode on error
          if (this.$refs.lobbyPageRef) {
            this.$refs.lobbyPageRef.preventReconnect = false;
          }
          this.currentGameCode = oldGameCode;
        });
      });
    },
    async callCreateGame() {
      console.log('Creating game');
      // Leave current game if we're in one
      if (this.currentGameCode) {
        await this.leaveCurrentGame();
      }
      // Temporarily clear gameCode to prevent watcher from reconnecting to old game
      const oldGameCode = this.currentGameCode;
      this.currentGameCode = null;
      // Close any existing WebSocket connections (both game and lobby)
      this.closeAllWebSockets();
      // Wait a tick to ensure WebSocket is fully closed
      this.$nextTick(() => {
        createGame().then(response => {
          console.log(response);
          // Re-enable reconnection and set new gameCode
          if (this.$refs.lobbyPageRef) {
            this.$refs.lobbyPageRef.preventReconnect = false;
          }
          this.currentGameCode = response.gameCode;
          // WebSocket will connect automatically via LobbyPage prop watch
        }).catch(error => {
          console.error(error);
          // Re-enable reconnection and restore old gameCode on error
          if (this.$refs.lobbyPageRef) {
            this.$refs.lobbyPageRef.preventReconnect = false;
          }
          this.currentGameCode = oldGameCode;
        });
      });
    },
    async leaveCurrentGame() {
      if (!this.currentGameCode) {
        return;
      }
      try {
        console.log('Leaving current game:', this.currentGameCode);
        await leaveGame(this.currentGameCode);
      } catch (error) {
        // Don't block on leave errors - just log them
        console.warn('Error leaving game (non-blocking):', error);
      }
    },
    closeAllWebSockets() {
      // Set flag to prevent automatic reconnection in LobbyPage watcher
      if (this.$refs.lobbyPageRef) {
        this.$refs.lobbyPageRef.preventReconnect = true;
      }
      // Close game WebSocket connection if there's an active game component
      if (this.$refs.multiplayerGameRef && this.$refs.multiplayerGameRef.gameWs) {
        console.log('Closing existing game WebSocket connection');
        this.$refs.multiplayerGameRef.gameWs.disconnect();
      }
      // Close lobby WebSocket connection if there's an active lobby component
      if (this.$refs.lobbyPageRef && this.$refs.lobbyPageRef.lobbyWs) {
        console.log('Closing existing lobby WebSocket connection');
        this.$refs.lobbyPageRef.lobbyWs.disconnect();
        this.$refs.lobbyPageRef.lobbyWs = null;
      }
    },
    callStartMultiplayerGame() {
      console.log('Starting multiplayer game');
      // Use custom settings if available, otherwise load from localStorage
      let settings = this.multiplayerSettings;
      
      if (!settings) {
        // Load settings from localStorage if available
        const storedSettings = this.loadStoredMultiplayerSettings();
        if (storedSettings) {
          settings = storedSettings;
        } else {
          // Only use null (which triggers defaults) if no stored settings exist
          settings = null;
        }
      }
      
      startMultiplayerGame(this.currentGameCode, settings).then(response => {
        console.log(response);
        // Clear settings after starting
        this.multiplayerSettings = null;
        // Don't change state here - wait for game_started WebSocket message
        // The state will change in handleGameStarted
      }).catch(error => {
        console.error(error);
      });
    },
    loadStoredMultiplayerSettings() {
      // Load settings from localStorage (same logic as GameSetup.vue)
      const storedSettings = { ...MULTIPLAYER_INITIAL_SETTINGS };
      let hasAnyStoredValue = false;
      
      const fieldsToLoad = FIELDS_TO_SAVE.filter(item => item !== 'field');
      for (const field of fieldsToLoad) {
        const value = localStorage.getItem(field);
        if (value) {
          storedSettings[field] = JSON.parse(value);
          hasAnyStoredValue = true;
        }
      }
      
      // Return settings only if we found at least one stored value
      // This ensures we use stored settings if any exist, otherwise return null to use defaults
      return hasAnyStoredValue ? storedSettings : null;
    },
    handleGameStarted(gameState) {
      console.log('Game started, received state:', gameState);
      // Close lobby WebSocket before transitioning to game (lobby WS not needed during game)
      if (this.$refs.lobbyPageRef && this.$refs.lobbyPageRef.lobbyWs) {
        console.log('Closing lobby WebSocket before starting game');
        this.$refs.lobbyPageRef.lobbyWs.disconnect();
        this.$refs.lobbyPageRef.lobbyWs = null;
      }
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
      // Close any existing WebSocket connections (both game and lobby)
      this.closeAllWebSockets();
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
      // Close any existing WebSocket connections (both game and lobby)
      this.closeAllWebSockets();
      // Clear game state
      this.currentGameCode = null;
      this.currentGameState = null;
      this.multiplayerSettings = null;
      // Redirect to login page
      this.state = GAME_STATES.login;
    },
    handleSetupGame() {
      // Navigate to GameSetup page for multiplayer game configuration
      this.state = GAME_STATES.setup;
    },
    handleMultiplayerSettingsConfigured(settings) {
      // Store settings and return to lobby
      this.multiplayerSettings = settings;
      this.state = GAME_STATES.lobby;
    },
  },
  beforeUnmount() {
    emitter.off('startGame', this.startGame);
    emitter.off('loadGame', this.loadGame);
    emitter.off('goToPage', this.goToPage);
    emitter.off('multiplayerSettingsConfigured', this.handleMultiplayerSettingsConfigured);
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
