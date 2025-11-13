<template>
    <div id="lobby-page">
        <h1 id="lobby-page-title">Lobby</h1>
        <div v-if="gameCode" id="lobby-page-game-code">
            <p>Game Code: <strong>{{ gameCode }}</strong></p>
        </div>
        <div id="lobby-page-content">
            <div id="lobby-page-content-item">
                <h2>Players</h2>
                <div id="lobby-page-content-item-players">
                    <div id="lobby-page-content-item-players-player" v-for="player in players" :key="player.id">
                        <h3>{{ player.username }}</h3>
                    </div>
                    <div v-if="players.length === 0" id="lobby-page-content-item-players-empty">
                        <p>No players yet. Create or join a game to start.</p>
                    </div>
                </div>
            </div>
        </div>
        <div id="lobby-page-footer">
            <button id="lobby-page-footer-button" @click="createGame">Create Game</button>
            <input type="text" id="lobby-page-footer-input" placeholder="Game Code" v-model="inputGameCode" required />
            <button id="lobby-page-footer-button" @click="joinGame">Join Game</button>
            <!-- <button id="lobby-page-footer-button" @click="leaveGame">Leave Lobby</button> -->
            <br>
            <button id="lobby-page-footer-button" @click="startMultiplayerGame">Start Game</button>
        </div>
    </div>
</template>

<script>
import emitter from "@/game/eventBus";
import { LobbyWebSocket } from "@/game/lobbyWebSocket";

export default {
    name: 'LobbyPage',
  props: {
    gameCode: {
      type: String,
      default: null,
    },
    getAppState: {
      type: Function,
      default: null,
    },
  },
    data() {
        return {
            players: [],
            inputGameCode: '',
            lobbyWs: null,
        }
    },
    mounted() {
        // Connect to WebSocket if we have a game code
        if (this.gameCode) {
            this.connectWebSocket(this.gameCode);
        }
    },
    beforeUnmount() {
        if (this.lobbyWs) {
            this.lobbyWs.disconnect();
        }
    },
    watch: {
        gameCode(newCode, oldCode) {
            if (newCode && newCode !== oldCode) {
                // Disconnect from old game if switching
                if (this.lobbyWs) {
                    this.lobbyWs.disconnect();
                }
                this.connectWebSocket(newCode);
            } else if (!newCode && this.lobbyWs) {
                this.lobbyWs.disconnect();
                this.lobbyWs = null;
            }
        }
    },
    methods: {
        connectWebSocket(gameCode) {
            if (this.lobbyWs) {
                this.lobbyWs.disconnect();
            }
            this.lobbyWs = new LobbyWebSocket(
                gameCode,
                {
                    onPlayersUpdate: (players) => {
                        this.players = players;
                    },
                    onGameStarted: (gameState) => {
                        // Disconnect lobby WebSocket before transitioning to game
                        if (this.lobbyWs) {
                            this.lobbyWs.disconnect();
                            this.lobbyWs = null;
                        }
                        // Emit to parent so it can connect to GameConsumer and transition to game
                        this.$emit('gameStarted', gameState);
                    },
                },
                this.getAppState  // Pass state getter for reconnect logic
            );
            this.lobbyWs.connect();
        },
        createGame() {
            console.log('Creating game');
            emitter.emit('createGame');
        },
        joinGame() {
            // Get game code from input
            const code = this.inputGameCode.trim();
            if (!code) {
                console.error('Game code is required');
                return;
            }
            // Join game
            emitter.emit('joinGame', code);
        },
        startMultiplayerGame() {
            console.log('Starting game');
            emitter.emit('callStartMultiplayerGame');
        }
    }
}
</script>

<style>
#lobby-page {
    width: 100vw;
    height: 100vh;
    background-color: #001111;
}

#lobby-page-game-code {
    text-align: center;
    padding: 10px;
    color: #ffffff;
    font-size: 18px;
}

#lobby-page-game-code strong {
    color: #4CAF50;
    font-size: 20px;
    letter-spacing: 2px;
}
</style>
