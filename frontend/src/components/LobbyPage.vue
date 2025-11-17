<template>
    <div id="lobby-page">
        <div id="lobby-page-header">
            <h1 id="lobby-page-title">Welcome, {{ username || 'Player' }}!</h1>
            <button id="lobby-page-signout-button" @click="handleSignOut" title="Sign Out">
                Sign Out
            </button>
        </div>

        <!-- Current Game Section (Top) -->
        <div id="lobby-page-current-game">
            <div id="lobby-page-current-game-header">
                <h2>Current Game</h2>
            </div>
            <div id="lobby-page-current-game-content">
                <div v-if="gameCode" id="lobby-page-current-game-info">
                    <div id="lobby-page-current-game-code">
                        <p>Game Code: <strong>{{ gameCode }}</strong></p>
                    </div>
                    <div id="lobby-page-current-game-players">
                        <h3>Players</h3>
                        <div id="lobby-page-current-game-players-list">
                            <div id="lobby-page-current-game-players-player" v-for="player in players" :key="player.id"
                                :style="{ color: getPlayerColor(player.order) }">
                                {{ player.username }}
                            </div>
                            <div v-if="players.length === 0" id="lobby-page-current-game-players-empty">
                                <p>No players yet. Waiting for players to join...</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else id="lobby-page-current-game-empty">
                    <p>No active game. Create or join a game to start.</p>
                </div>
                <div id="lobby-page-current-game-actions">
                    <button id="lobby-page-button" @click="createGame">Create Game</button>
                    <div id="lobby-page-join-section">
                        <input type="text" id="lobby-page-input" placeholder="Game Code" v-model="inputGameCode"
                            required />
                        <button id="lobby-page-button" @click="joinGame">Join Game</button>
                    </div>
                    <div v-if="gameCode && isGameCreator" id="lobby-page-setup-start-section">
                        <button id="lobby-page-button" @click="setupGame">
                            Setup Game
                        </button>
                        <button id="lobby-page-button" @click="startMultiplayerGame" :disabled="players.length < 2"
                            :title="players.length < 2 ? 'At least 2 players are required to start the game' : ''">
                            Start Game
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Active Games Section (Bottom) -->
        <div id="lobby-page-active-games">
            <div id="lobby-page-active-games-header">
                <h2>Active Games</h2>
                <button id="lobby-page-refresh-button" @click="loadActiveGames" title="Refresh games list">
                    ↻
                </button>
            </div>
            <div id="lobby-page-active-games-content">
                <div v-if="loadingGames" id="lobby-page-active-games-loading">
                    <p>Loading games...</p>
                </div>
                <div v-else-if="activeGames.length === 0" id="lobby-page-active-games-empty">
                    <p>No active games. Create or join a game to start.</p>
                </div>
                <div v-else id="lobby-page-active-games-list">
                    <div v-for="game in activeGames" :key="game.gameCode" id="lobby-page-active-games-game">
                        <div id="lobby-page-active-games-game-info">
                            <h3>Game: <strong>{{ game.gameCode }}</strong></h3>
                            <p>Turn: {{ game.turnPlayer || 'N/A' }}</p>
                            <p>Players: {{game.players.map(p => p.username).join(', ')}}</p>
                        </div>
                        <button id="lobby-page-active-games-game-connect" @click="connectToGame(game)">
                            Connect
                        </button>
                    </div>
                    <div v-if="hasMoreGames" id="lobby-page-active-games-load-more">
                        <button id="lobby-page-load-more-button" @click="loadAllGames" :disabled="loadingAllGames">
                            {{ loadingAllGames ? 'Loading...' : 'Load More' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import emitter from "@/game/eventBus";
import { LobbyWebSocket } from "@/game/lobbyWebSocket";
import { getActiveGames } from "@/game/service";
import { whoami, signout } from "@/auth";

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
            activeGames: [],
            loadingGames: false,
            username: null,
            hasMoreGames: false,
            loadingAllGames: false,
            currentUserId: null,  // Store current user ID to check if creator
            preventReconnect: false,  // Flag to prevent automatic reconnection during transitions
        }
    },
    mounted() {
        // Get current user's username
        this.loadUsername();
        // Load active games
        this.loadActiveGames();
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
            // Don't reconnect if we're preventing reconnection (during intentional disconnection)
            if (this.preventReconnect) {
                return;
            }
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
    computed: {
        isGameCreator() {
            // Creator is the player with order=0
            if (!this.currentUserId || !this.players || this.players.length === 0) {
                return false;
            }
            const creatorPlayer = this.players.find(p => p.order === 0);
            return creatorPlayer && creatorPlayer.id === this.currentUserId;
        },
    },
    methods: {
        connectWebSocket(gameCode) {
            if (this.lobbyWs) {
                this.lobbyWs.disconnect();
                this.lobbyWs = null;  // Ensure old instance is cleared
            }
            // Create new WebSocket instance with reconnection enabled
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
            // Prevent starting if there are less than 2 players
            if (this.players.length < 2) {
                console.warn('Cannot start game: At least 2 players are required');
                return;
            }
            console.log('Starting game');
            emitter.emit('callStartMultiplayerGame');
        },
        async loadActiveGames() {
            this.loadingGames = true;
            try {
                const response = await getActiveGames(10); // Load only 10 games initially
                this.activeGames = response.games || [];
                this.hasMoreGames = response.hasMore || false;
                console.log('Loaded active games:', this.activeGames, 'hasMore:', this.hasMoreGames);
            } catch (error) {
                console.error('Error loading active games:', error);
                this.activeGames = [];
                this.hasMoreGames = false;
            } finally {
                this.loadingGames = false;
            }
        },
        async loadAllGames() {
            this.loadingAllGames = true;
            try {
                const response = await getActiveGames(null); // Load all games (no limit)
                this.activeGames = response.games || [];
                this.hasMoreGames = false; // No more games to load
                console.log('Loaded all active games:', this.activeGames);
            } catch (error) {
                console.error('Error loading all active games:', error);
            } finally {
                this.loadingAllGames = false;
            }
        },
        connectToGame(game) {
            console.log('Connecting to game:', game.gameCode);
            this.$emit('connectToGame', game);
        },
        async loadUsername() {
            try {
                const userInfo = await whoami();
                if (userInfo.auth && userInfo.user) {
                    this.username = userInfo.user.username;
                    this.currentUserId = userInfo.user.id;
                }
            } catch (error) {
                console.error('Error loading username:', error);
            }
        },
        setupGame() {
            console.log('Setting up game');
            this.$emit('setupGame');
        },
        getPlayerColor(order) {
            // Color mapping based on player order (0-indexed, but we'll treat as 1-indexed for colors)
            const colorMap = {
                0: '#4A90E2',      // 1 - blue
                1: '#32cc67',      // 2 - mint
                2: '#FF4444',      // 3 - red
                3: '#FFD700',      // 4 - yellow
                4: '#8B5CF6',      // 5 - violet
                5: '#00FFFF',      // 6 - cyan
                6: '#9B59B6',      // 7 - purple
                7: '#2E7D32',      // 8 - dark green
            };
            return colorMap[order] || '#ffffff'; // Default to white if order is out of range
        },
        async handleSignOut() {
            try {
                await signout();
                // Emit event to parent to change state to login
                this.$emit('signOut');
            } catch (error) {
                console.error('Error signing out:', error);
                // Even if there's an error, try to redirect to login
                this.$emit('signOut');
            }
        }
    }
}
</script>

<style>
#lobby-page {
    min-height: 100vh;
    overflow: hidden;
    background-color: #001111;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 15px;
    box-sizing: border-box;
}

#lobby-page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding: 0 10px;
}

#lobby-page-title {
    text-align: center;
    color: #ffffff;
    margin: 0;
    font-size: 24px;
    flex: 1;
}

#lobby-page-signout-button {
    padding: 6px 12px;
    background-color: #926846;
    color: #ffffff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: bold;
    transition: background-color 0.3s;
}

#lobby-page-signout-button:hover {
    background-color: #ae7b62;
}

#lobby-page-signout-button:active {
    background-color: #3a2019;
}

/* Current Game Section */
#lobby-page-current-game {
    background-color: #222222;
    border: 2px solid #d8a67e;
    border-radius: 6px;
    padding: 12px;
}

#lobby-page-current-game-header {
    margin-bottom: 10px;
}

#lobby-page-current-game-header h2 {
    margin: 0;
    color: #d8a67e;
    font-size: 18px;
}

#lobby-page-current-game-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

#lobby-page-current-game-info {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

#lobby-page-current-game-code {
    text-align: center;
    color: #ffffff;
    font-size: 14px;
}

#lobby-page-current-game-code strong {
    color: #d8a67e;
    font-size: 16px;
    letter-spacing: 1px;
}

#lobby-page-current-game-players h3 {
    margin: 0 0 6px 0;
    color: #d8a67e;
    font-size: 14px;
}

#lobby-page-current-game-players-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
}

#lobby-page-current-game-players-player {
    padding: 4px 10px;
    background-color: #001111;
    border: 1px solid #d8a67e;
    border-radius: 4px;
    color: #ffffff;
    font-size: 14px;
}

#lobby-page-current-game-players-empty {
    color: #cccccc;
    font-style: italic;
    padding: 6px;
    font-size: 14px;
}

#lobby-page-current-game-empty {
    text-align: center;
    color: #cccccc;
    padding: 12px;
    font-style: italic;
    font-size: 14px;
}

#lobby-page-current-game-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
}

#lobby-page-join-section {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    width: 100%;
    max-width: 400px;
    justify-content: center;
    align-items: center;
}

#lobby-page-join-section #lobby-page-input {
    flex: 0 0 auto;
    width: 150px;
}

#lobby-page-join-section #lobby-page-button {
    flex: 0 0 auto;
    width: auto;
    max-width: none;
    padding: 8px 16px;
}

#lobby-page-setup-start-section {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    width: 100%;
    max-width: 400px;
    justify-content: center;
    align-items: center;
}

#lobby-page-setup-start-section #lobby-page-button {
    flex: 0 0 auto;
    width: auto;
    max-width: none;
    padding: 8px 16px;
}

#lobby-page-button {
    padding: 8px 16px;
    background-color: #d8a67e;
    color: #001111;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: background-color 0.3s;
    width: 100%;
    max-width: 180px;
}

#lobby-page-button:hover {
    background-color: #ae7b62;
}

#lobby-page-button:active {
    background-color: #926846;
}

#lobby-page-button:disabled {
    background-color: #555555;
    color: #888888;
    cursor: not-allowed;
    opacity: 0.6;
}

#lobby-page-button:disabled:hover {
    background-color: #555555;
}

#lobby-page-input {
    padding: 8px;
    border: 2px solid #d8a67e;
    border-radius: 4px;
    background-color: #001111;
    color: #ffffff;
    font-size: 14px;
    flex: 1;
}

#lobby-page-input::placeholder {
    color: #888888;
}

#lobby-page-input:focus {
    outline: none;
    border-color: #ae7b62;
}

/* Active Games Section */
#lobby-page-active-games {
    background-color: #222222;
    border: 2px solid #d8a67e;
    border-radius: 6px;
    padding: 12px;
}

#lobby-page-active-games-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}

#lobby-page-active-games-header h2 {
    margin: 0;
    color: #d8a67e;
    font-size: 18px;
}

#lobby-page-refresh-button {
    background-color: #d8a67e;
    color: #001111;
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.3s, transform 0.3s;
}

#lobby-page-refresh-button:hover {
    background-color: #ae7b62;
    transform: rotate(180deg);
}

#lobby-page-refresh-button:active {
    background-color: #926846;
}

#lobby-page-active-games-content {
    min-height: 60px;
}

#lobby-page-active-games-loading,
#lobby-page-active-games-empty {
    text-align: center;
    color: #ffffff;
    padding: 20px 10px;
    font-size: 14px;
}

#lobby-page-active-games-empty {
    color: #cccccc;
    font-style: italic;
}

#lobby-page-active-games-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

#lobby-page-active-games-game {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    background-color: #001111;
    border: 2px solid #d8a67e;
    border-radius: 6px;
    color: #ffffff;
}

#lobby-page-active-games-game-info {
    flex: 1;
}

#lobby-page-active-games-game-info h3 {
    margin: 0 0 4px 0;
    color: #d8a67e;
    font-size: 14px;
}

#lobby-page-active-games-game-info h3 strong {
    color: #ffffff;
    letter-spacing: 1px;
}

#lobby-page-active-games-game-info p {
    margin: 2px 0;
    font-size: 14px;
    color: #cccccc;
}

#lobby-page-active-games-game-connect {
    padding: 6px 16px;
    background-color: #d8a67e;
    color: #001111;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: background-color 0.3s;
}

#lobby-page-active-games-game-connect:hover {
    background-color: #ae7b62;
}

#lobby-page-active-games-game-connect:active {
    background-color: #926846;
}

#lobby-page-active-games-load-more {
    display: flex;
    justify-content: center;
    padding: 15px 0;
}

#lobby-page-load-more-button {
    padding: 8px 20px;
    background-color: #d8a67e;
    color: #001111;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: background-color 0.3s;
}

#lobby-page-load-more-button:hover {
    background-color: #ae7b62;
}

#lobby-page-load-more-button:active {
    background-color: #926846;
}

#lobby-page-load-more-button:disabled {
    background-color: #926846;
    cursor: not-allowed;
    opacity: 0.7;
}
</style>
