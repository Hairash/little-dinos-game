<template>
  <ReadyLabel
    v-if="state === STATES.ready"
    :on-click-action="readyBtnClick"
    :current-player="currentPlayer"
    :is-active-player="isMyTurn"
    :is-player-informed-lose="false"
    :are-all-human-players-eliminated="false"
    :winner="winner"
    :last-player="null"
  />
  <GameGrid
    v-if="localField && localField.length > 0"
    ref="gameGridRef"
    :is-hidden="state === STATES.ready"
    :fog-of-war-radius="fogOfWarRadius"
    :enable-fog-of-war="enableFogOfWar"
    :enable-scout-mode="enableScoutMode"
    :hide-enemy-speed="hideEnemySpeed"
    :field="localField"
    :current-player="currentPlayer"
    :cellSize="cellSize"
    :is-my-turn="isMyTurn"
  />
  <InfoPanel
    v-if="state === STATES.play"
    :current-player="currentPlayer"
    :players="players"
    :current-stats="getCurrentStats()"
    :handle-end-turn-btn-click="processEndTurn"
    :handle-unit-click="findNextUnit"
    :cellSize="cellSize"
    :handle-change-cell-size="changeCellSize"
    :handle-exit-btn-click="() => this.state = this.STATES.exitDialog"
    :are-all-units-on-buildings="false"
  />
  <ExitDialog
    v-if="state === STATES.exitDialog"
    :handle-cancel="() => state = STATES.play"
    :handle-confirm="exitGame"
  />
</template>

<script>
import ReadyLabel from '@/components/ReadyLabel.vue';
import GameGrid from '@/components/GameGrid.vue';
import InfoPanel from '@/components/InfoPanel.vue';
import ExitDialog from '@/components/ExitDialog.vue';
import Models from "@/game/models";
import { WaveEngine } from "@/game/waveEngine";
import { FieldEngine } from "@/game/fieldEngine";
import { GameWebSocket } from "@/game/gameWebSocket";
import { whoami } from "@/auth";
import { normalizeField } from "@/game/helpers";
import emitter from '@/game/eventBus';

export default {
  name: 'MultiplayerDinoGame',
  components: {
    ReadyLabel,
    GameGrid,
    InfoPanel,
    ExitDialog,
  },
  emits: ['exitGame'],
  props: {
    gameCode: {
      type: String,
      required: true,
    },
    field: {
      type: Array,
      required: true,
    },
    settings: {
      type: Object,
      required: true,
    },
    gameState: {
      type: Object,
      default: () => ({}),
    },
    getAppState: {
      type: Function,
      default: null,
    },
  },
  data() {
    const STATES = {
      ready: 'ready',
      play: 'play',
      exitDialog: 'exitDialog',
    };
    
    return {
      STATES,
      localField: [],  // Local copy of field for reactivity (initialize as empty array)
      localSettings: null,  // Local copy of settings for reactivity (can be updated from server)
      players: [],
      currentPlayer: 0,
      currentUserId: null,
      myPlayerOrder: null,
      state: STATES.play,
      cellSize: 30,
      gameWs: null,
      clientSeq: 0,
      reconnectAttempts: 0,  // Track reconnect attempts for UI
      isInitialConnect: true,  // Track if this is the first connection
      // Settings from props
      width: 20,
      height: 20,
      fogOfWarRadius: 3,
      enableFogOfWar: true,
      enableScoutMode: true,
      hideEnemySpeed: false,
      // Track coordinates revealed by scout actions (persist until turn ends)
      scoutRevealedCoords: new Set(), // Set of strings like "x,y"
      // Game end state
      winner: null, // Player order (0, 1, 2, ...) of the winner, or null if game not ended
    };
  },
  computed: {
    isMyTurn() {
      return this.myPlayerOrder !== null && this.currentPlayer === this.myPlayerOrder;
    },
  },
  async created() {
    // Get current user info first - MUST complete before initializing players
    try {
      const userInfo = await whoami();
      // whoami returns { auth: true, user: { id, username } }
      if (userInfo.auth && userInfo.user) {
        this.currentUserId = userInfo.user.id;
        console.log(`[DEBUG] Set currentUserId to: ${this.currentUserId} from whoami response:`, userInfo);
      } else {
        console.warn(`[DEBUG] whoami returned auth=false or no user:`, userInfo);
      }
    } catch (error) {
      console.error('Failed to get user info:', error);
    }
    
    // Initialize from props first (fallback if WebSocket hasn't connected yet)
    // Note: initializeFromProps might call initializePlayers, but currentUserId should be set by now
    this.initializeFromProps();
    
    // Connect to game WebSocket - it will send full state on connect
    this.connectGameWebSocket();
  },
  mounted() {
    emitter.on('moveUnit', this.emitMoveUnit);
    emitter.on('addTempVisibilityForCoords', this.emitAddTempVisibilityForCoords);
    emitter.on('scoutArea', this.emitScoutArea);
    emitter.on('processEndTurn', this.processEndTurn);
    emitter.on('startTurn', this.startTurn);
    
    this.startTurn();
  },
  beforeUnmount() {
    emitter.off('moveUnit', this.moveUnit);
    emitter.off('addTempVisibilityForCoords', this.emitAddTempVisibilityForCoords);
    emitter.off('scoutArea', this.emitScoutArea);
    emitter.off('processEndTurn', this.processEndTurn);
    emitter.off('startTurn', this.startTurn);
    
    if (this.gameWs) {
      this.gameWs.disconnect();
    }
  },
  methods: {
    initializeFromProps() {
      // Initialize field from prop and normalize to model instances
      if (this.field && this.field.length > 0) {
        this.localField = normalizeField(JSON.parse(JSON.stringify(this.field)));
      } else {
        this.localField = [];
      }
      
      // Initialize settings from props (create a local copy)
      const settings = this.settings || {};
      this.localSettings = JSON.parse(JSON.stringify(settings));
      this.width = settings.width || 20;
      this.height = settings.height || 20;
      this.fogOfWarRadius = settings.fogOfWarRadius || 3;
      this.enableFogOfWar = settings.enableFogOfWar !== false;
      this.enableScoutMode = settings.enableScoutMode !== false;
      this.hideEnemySpeed = settings.hideEnemySpeed || false;
      
      // Initialize players from gameState prop
      if (this.gameState && this.gameState.players) {
        this.initializePlayers(this.gameState.players, this.gameState.turnPlayer);
      }
      
      // Initialize engines if we have a field
      // Note: Don't call initVisibility() here - the backend handles visibility filtering
      // The field from props might be unfiltered (from lobby), but it will be replaced
      // by the filtered field when the WebSocket connects and sends server state
      if (this.localField && this.localField.length > 0) {
        this.initializeEngines();
      }
    },
    
    initializeFromServerState(gameState) {
      console.log('Initializing from server state:', gameState);
      
      // Update settings from server
      if (gameState.settings) {
        const settings = typeof gameState.settings === 'string' 
          ? JSON.parse(gameState.settings) 
          : gameState.settings;
        this.width = settings.width || 20;
        this.height = settings.height || 20;
        this.fogOfWarRadius = settings.fogOfWarRadius || 3;
        this.enableFogOfWar = settings.enableFogOfWar !== false;
        this.enableScoutMode = settings.enableScoutMode !== false;
        this.hideEnemySpeed = settings.hideEnemySpeed || false;
        // Store full settings locally (can't mutate props)
        this.localSettings = JSON.parse(JSON.stringify(settings));
      }
      
      // Update field from server and normalize to model instances
      if (gameState.field) {
        this.localField = normalizeField(JSON.parse(JSON.stringify(gameState.field)));
      }
      
      // Initialize players from server
      if (gameState.players) {
        this.initializePlayers(gameState.players, gameState.turnPlayer);
      }
      
      // Set currentPlayer from server if provided (preferred over turnPlayer)
      if (gameState.currentPlayer !== undefined) {
        this.currentPlayer = gameState.currentPlayer;
        console.log(`[DEBUG] Set currentPlayer from gameState: ${this.currentPlayer}`);
      }
      
      // Initialize engines with server data
      this.initializeEngines();
      
      // Don't call initVisibility() here - the backend already filtered the field
      // with correct isHidden values based on player's visibility
    },
    
    initializePlayers(playersData, turnPlayerUsername) {
      console.log(`[DEBUG] initializePlayers called with currentUserId=${this.currentUserId}, playersData:`, playersData);
      
      this.players = playersData.map((p, idx) => {
        // Find my player order - use the order from server, not array index
        // Compare both id and check if currentUserId is set
        if (this.currentUserId !== null && p.id === this.currentUserId) {
          this.myPlayerOrder = p.order !== undefined ? p.order : idx;
          console.log(`[DEBUG] Found my player order: ${this.myPlayerOrder} for user ${this.currentUserId} (player id: ${p.id})`);
        } else if (this.currentUserId === null) {
          console.warn(`[DEBUG] currentUserId is null, cannot determine myPlayerOrder. Player data:`, p);
        }
        return new Models.Player(Models.PlayerTypes.HUMAN);
      });
      
      // Set current player from turnPlayer - use order from server
      if (turnPlayerUsername) {
        const turnPlayer = playersData.find(p => p.username === turnPlayerUsername);
        if (turnPlayer) {
          // Use the order from server data, not array index
          this.currentPlayer = turnPlayer.order !== undefined ? turnPlayer.order : playersData.findIndex(p => p.id === turnPlayer.id);
          console.log(`[DEBUG] Set currentPlayer to: ${this.currentPlayer} (turnPlayer: ${turnPlayerUsername}, order: ${turnPlayer.order})`);
        } else {
          console.warn(`[DEBUG] Turn player not found: ${turnPlayerUsername}`);
        }
      } else {
        // If no turnPlayer specified, default to first player
        this.currentPlayer = 0;
        console.log(`[DEBUG] No turnPlayer specified, defaulting currentPlayer to 0`);
      }
      
      console.log(`[DEBUG] isMyTurn check: myPlayerOrder=${this.myPlayerOrder}, currentPlayer=${this.currentPlayer}, currentUserId=${this.currentUserId}, isMyTurn=${this.isMyTurn}`);
    },
    
    initializeEngines() {
      if (!this.localField || this.localField.length === 0) {
        return;
      }
      
      // Initialize engines
      this.waveEngine = new WaveEngine(
        this.localField,
        this.width,
        this.height,
        this.fogOfWarRadius,
        this.enableScoutMode,
      );
      
      // Use localSettings if available, otherwise fall back to prop
      const settings = this.localSettings || this.settings || {};
      this.fieldEngine = new FieldEngine(
        this.localField,
        this.width,
        this.height,
        this.fogOfWarRadius,
        this.players,
        settings.minSpeed || 1,
        settings.maxSpeed || 5,
        settings.speedMinVisibility || 7,
        settings.maxUnitsNum || 5,
        settings.maxBasesNum || 3,
        settings.unitModifier || 3,
        settings.baseModifier || 3,
        settings.killAtBirth !== false,
        settings.visibilitySpeedRelation !== false,
      );
    },
    
    connectGameWebSocket() {
      this.gameWs = new GameWebSocket(
        this.gameCode,
        {
          onOpen: () => {
            console.log('Game WebSocket connected');
          },
          onReconnected: () => {
            console.log('[WS] Successfully reconnected to game');
            this.reconnectAttempts = 0;
            this.isInitialConnect = false;  // Mark that we've reconnected
            // State will be synced via onJoined callback when server sends full state
          },
          onReconnecting: (attempt, delay) => {
            console.warn(`[WS] Reconnecting... (attempt ${attempt}, next try in ${delay}ms)`);
            this.reconnectAttempts = attempt;
            // Could show a UI notification here if needed
          },
          onMaxReconnectAttempts: () => {
            console.error('[WS] Failed to reconnect after maximum attempts');
            // Could show an error message to user here
          },
          onJoined: (gameState) => {
            console.log('Joined game, received state:', gameState);
            // Update clientSeq from server if provided (for reconnection)
            // The server sends the last clientSeq that was processed for this player
            // We set it to that value, and sendMoveToServer will increment it before sending
            // So the next move will be lastClientSeq + 1, which is correct
            if (gameState.lastClientSeq !== undefined) {
              console.log(`[WS] Setting clientSeq to ${gameState.lastClientSeq} (next move will be ${gameState.lastClientSeq + 1})`);
              this.clientSeq = gameState.lastClientSeq;
            }
            // Initialize game state from server
            // This is called both on initial connect and on reconnect
            this.initializeFromServerState(gameState);
            // Initialize scrollCoords once at the beginning of the game
            // Only do this on initial connect, not on reconnect
            if (this.isInitialConnect) {
              this.isInitialConnect = false;
              this.$nextTick(() => {
                this.initScrollCoordsOnce();
              });
            }
          },
          onStateUpdate: (patch, serverTick) => {
            console.log('State update received:', patch, serverTick);
            this.applyStatePatch(patch);
          },
          onGameStarted: (gameState) => {
            console.log('Game started event:', gameState);
            // Update field and state from server, normalize to model instances
            // Note: This callback is never called for Game WebSocket (only for Lobby WebSocket)
            if (gameState.field) {
              this.localField = normalizeField(JSON.parse(JSON.stringify(gameState.field)));
            }
          },
          onError: (error) => {
            console.error('Game WebSocket error:', error);
          },
          onClose: () => {
            console.log('Game WebSocket disconnected');
          },
        },
        this.getAppState  // Pass state getter for reconnect logic
      );
      this.gameWs.connect();
    },
    
    applyStatePatch(patch) {
      // Apply state changes from server
      console.log('[DEBUG] applyStatePatch called with patch:', patch);
      
      if (patch.field) {
        // Check if this is a partial patch (has null values) or full replacement
        const isPartialPatch = patch.field.some(row => row && row.some(cell => cell === null));
        
        if (isPartialPatch) {
          // Partial patch - merge with existing field (likely a scout action)
          console.log('[DEBUG] Merging partial field patch (scout action)');
          if (!this.localField || this.localField.length === 0) {
            console.warn('[DEBUG] Cannot merge partial patch - localField not initialized');
            return;
          }
          
          // Merge the patch into existing field and track revealed coordinates
          for (let x = 0; x < patch.field.length && x < this.localField.length; x++) {
            if (!patch.field[x] || !this.localField[x]) continue;
            for (let y = 0; y < patch.field[x].length && y < this.localField[x].length; y++) {
              if (patch.field[x][y] !== null) {
                // Update this cell with patch data
                this.localField[x][y] = normalizeField([[patch.field[x][y]]])[0][0];
                // Ensure isHidden is false for revealed cells
                if (this.localField[x][y] && typeof this.localField[x][y] === 'object') {
                  this.localField[x][y].isHidden = false;
                }
                // Track this coordinate as scout-revealed (persist until turn ends)
                this.scoutRevealedCoords.add(`${x},${y}`);
              }
            }
          }
          
          // Re-normalize the merged field
          const normalizedField = normalizeField(this.localField);
          this.localField = normalizedField;
        } else {
          // Full field replacement
          console.log('[DEBUG] Updating localField from full patch.field');
          const normalizedField = normalizeField(patch.field);
          console.log('[DEBUG] Normalized field, length:', normalizedField.length);
          this.localField = normalizedField;
          
          // IMPORTANT: After full field replacement, the server may have set isHidden
          // based on normal visibility, but we need to preserve scout-revealed cells
          // Restore them immediately after field update
          this.ensureScoutRevealedVisible();
        }
        
        // Update engines immediately with new field reference
        // This ensures fieldEngine.field points to the new localField
        this.waveEngine = new WaveEngine(
          this.localField,
          this.width,
          this.height,
          this.fogOfWarRadius,
          this.enableScoutMode,
        );
        // Use localSettings if available, otherwise fall back to prop
        const settings = this.localSettings || this.settings || {};
        this.fieldEngine = new FieldEngine(
          this.localField,
          this.width,
          this.height,
          this.fogOfWarRadius,
          this.players,
          settings.minSpeed || 1,
          settings.maxSpeed || 5,
          settings.speedMinVisibility || 7,
          settings.maxUnitsNum || 5,
          settings.maxBasesNum || 3,
          settings.unitModifier || 3,
          settings.baseModifier || 3,
          settings.killAtBirth !== false,
          settings.visibilitySpeedRelation !== false,
        );
        console.log('[DEBUG] Engines updated with new field');
        
        // Ensure scout-revealed cells remain visible after field updates
        // (Called again here in case engines modified the field)
        this.ensureScoutRevealedVisible();
        
        // Check if the last move was to an obelisk and trigger scouting action
        if (patch.lastMove && patch.lastMove.toCoords && this.fieldEngine) {
          const [x, y] = patch.lastMove.toCoords;
          if (this.localField[x] && this.localField[x][y] && this.localField[x][y].building) {
            const action = this.fieldEngine.getActionTriggered(x, y);
            if (action) {
              console.log('[DEBUG] Obelisk detected at', x, y, '- triggering scouting action');
              emitter.emit('setAction', action);
            }
          }
        }
      }
      // Check if game ended first - if so, skip visibility recalculation and reveal everything
      const gameEnded = patch.gameEnded === true;
      
      if (patch.currentPlayer !== undefined) {
        const previousPlayer = this.currentPlayer;
        this.currentPlayer = patch.currentPlayer;
        console.log(`[DEBUG] Updated currentPlayer from patch: ${this.currentPlayer}, isMyTurn=${this.isMyTurn}`);
        
        // Clear scout-revealed coordinates when turn changes and recalculate visibility
        // The server will send a properly filtered field patch, but we also recalculate on client
        // Skip visibility recalculation if game has ended (we'll reveal everything instead)
        if (previousPlayer !== undefined && previousPlayer !== this.currentPlayer && !gameEnded) {
          console.log('[DEBUG] Turn changed, clearing scout-revealed coordinates and recalculating visibility');
          this.scoutRevealedCoords.clear();
          // Recalculate visibility based on current player's units and buildings only (no scout-revealed coords)
          this.recalculateVisibilityForClient();
          // Clear selected unit and highlighted cells (but don't change scrollCoords)
          emitter.emit('initTurn');
        }
      }
      if (patch.players) {
        this.players = patch.players;
      }
      if (gameEnded) {
        console.log('[DEBUG] Game ended! Winner:', patch.winner, patch.winnerUsername);
        this.winner = patch.winner;
        // Show ready label with winner
        this.state = this.STATES.ready;
        // Reveal the whole field to all players when game ends
        if (this.localField && this.localField.length > 0) {
          for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
              if (this.localField[x] && this.localField[x][y]) {
                this.localField[x][y].isHidden = false;
              }
            }
          }
        }
        // Clear selected unit and highlighted cells
        emitter.emit('initTurn');
      }
    },
    
    sendMoveToServer(payload) {
      if (!this.gameWs) {
        console.error('Game WebSocket not connected');
        return;
      }
      
      this.clientSeq++;
      this.gameWs.sendMove(payload, this.clientSeq);
    },
    
    emitMoveUnit(coordsDict) {
      if (!this.isMyTurn) {
        console.warn('Not your turn');
        return;
      }
      this.moveUnit(coordsDict.fromCoords, coordsDict.toCoords);
    },
    
    moveUnit(fromCoords, toCoords) {
      const [x0, y0] = fromCoords;
      const [x1, y1] = toCoords;
      
      if (!this.localField || !this.localField[x0] || !this.localField[x0][y0]) {
        console.error('[DEBUG] moveUnit: Invalid source cell', x0, y0);
        return;
      }
      
      const unit = this.localField[x0][y0].unit;
      
      if (!unit || unit.player !== this.myPlayerOrder) {
        console.warn('[DEBUG] moveUnit: Unit check failed', { unit, myPlayerOrder: this.myPlayerOrder });
        return;
      }
      
      console.log('[DEBUG] moveUnit: Sending move to server from', fromCoords, 'to', toCoords);
      
      // Send move to server - wait for server response to update the field
      const payload = {
        fromCoords: fromCoords,
        toCoords: toCoords,
      };
      this.sendMoveToServer(payload);
    },
    
    processEndTurn() {
      if (this.state === this.STATES.ready || !this.isMyTurn || this.winner !== null) return;
      
      // Send end turn to server
      const payload = {
        type: 'endTurn',
      };
      this.sendMoveToServer(payload);
      
    //   this.state = this.STATES.ready;
      // Don't save scrollCoords - they should remain fixed after initial setup
    },
    
    startTurn() {
      if (this.checkSkipReadyLabel()) {
        this.state = this.STATES.play;
      }
      
      // Don't change scrollCoords on turn change - they remain fixed after initial setup
      // Just clear selected unit and highlighted cells
      if (this.isMyTurn) {
        emitter.emit('initTurn');
      }
    },
    
    readyBtnClick() {
      this.state = this.STATES.play;
    },
    
    checkSkipReadyLabel() {
      // Skip ready label if it's not player's turn or other conditions
      return !this.isMyTurn;
    },
    
    getCurrentStats() {
      // Calculate stats for current player - must match InfoPanel expected structure
      const settings = this.localSettings || this.settings || {};
      const stats = {
        units: {
          active: 0,
          total: 0,
          max: settings.maxUnitsNum || 5,
          coordsArr: [],
        },
        towers: {
          total: 0,
          max: settings.maxBasesNum || 3,
        },
      };
      
      // Guard: return default stats if field is not ready
      if (!this.localField || !Array.isArray(this.localField) || this.localField.length === 0) {
        return stats;
      }
      
      for (let x = 0; x < this.width; x++) {
        // Guard: check if row exists
        if (!this.localField[x] || !Array.isArray(this.localField[x])) {
          continue;
        }
        
        for (let y = 0; y < this.height; y++) {
          // Guard: check if cell exists
          if (!this.localField[x][y]) {
            continue;
          }
          
          const cell = this.localField[x][y];
          const unit = cell.unit;
          const building = cell.building;
          
          if (unit && unit.player === this.currentPlayer) {
            stats.units.total++;
            if (!unit.hasMoved) {
              stats.units.coordsArr.push([x, y]);
              stats.units.active++;
            }
            // Check for habitation buildings that increase unit limit
            if (building && building._type === Models.BuildingTypes.HABITATION && stats.units.max > 0) {
              stats.units.max += (settings.unitModifier || 3);
            }
            // Check for storage buildings that increase base limit
            if (building && building._type === Models.BuildingTypes.STORAGE && stats.towers.max > 0) {
              stats.towers.max += (settings.baseModifier || 3);
            }
          }
          
          // Count bases (towers)
          if (building && building._type === Models.BuildingTypes.BASE && building.player === this.currentPlayer) {
            stats.towers.total++;
          }
        }
      }
      
      return stats;
    },
    
    findNextUnit() {
      // Find next unit that can move
      const unitCoords = this.getCurrentUnitCoords();
      if (unitCoords.length > 0) {
        emitter.emit('selectNextUnit', unitCoords);
      }
    },
    
    getCurrentUnitCoords() {
      const coords = [];
      
      // Guard: return empty array if field is not ready
      if (!this.localField || !Array.isArray(this.localField) || this.localField.length === 0) {
        return coords;
      }
      
      for (let x = 0; x < this.width; x++) {
        // Guard: check if row exists
        if (!this.localField[x] || !Array.isArray(this.localField[x])) {
          continue;
        }
        
        for (let y = 0; y < this.height; y++) {
          const unit = this.localField[x][y].unit;
          if (unit && unit.player === this.currentPlayer && !unit.hasMoved) {
            coords.push([x, y]);
          }
        }
      }
      return coords;
    },
    
    initScrollCoordsOnce() {
      // Initialize scrollCoords once at the beginning of the game
      // Find the first unit for the current player (or my player if it's my turn)
      const playerOrder = this.myPlayerOrder;
      
      if (playerOrder === null || playerOrder === undefined) {
        console.warn('[DEBUG] Cannot init scrollCoords - playerOrder not set');
        return;
      }
      
      // Find first unit for this player
      let firstUnitCoords = null;
      for (let x = 0; x < this.width; x++) {
        if (!this.localField[x]) continue;
        for (let y = 0; y < this.height; y++) {
          const cell = this.localField[x] && this.localField[x][y];
          if (cell && cell.unit && cell.unit.player === playerOrder) {
            firstUnitCoords = [x, y];
            break;
          }
        }
        if (firstUnitCoords) break;
      }
      
      if (firstUnitCoords && this.$refs.gameGridRef) {
        // Get scroll coordinates for this cell from GameGrid component
        const scrollCoords = this.$refs.gameGridRef.getScrollCoordsByCell(firstUnitCoords);
        // Set scrollCoords for the current player
        if (this.players[playerOrder]) {
          this.players[playerOrder].scrollCoords = scrollCoords;
        }
        // Scroll to this position once
        console.log('[DEBUG] initScrollCoordsOnce: Scrolling to', scrollCoords);
        emitter.emit('initTurn', scrollCoords);
      } else {
        // No units found or GameGrid not mounted, use default
        if (this.players[playerOrder]) {
          this.players[playerOrder].scrollCoords = [0, 0];
        }
        console.log('[DEBUG] initScrollCoordsOnce: No units found, scrolling to [0, 0]');
        emitter.emit('initTurn', [0, 0]);
      }
    },
    
    changeCellSize(delta) {
      this.cellSize = Math.min(Math.max(10, this.cellSize + delta), 70);
    },
    
    exitGame() {
      if (this.gameWs) {
        this.gameWs.disconnect();
      }
      this.$emit('exitGame');
    },
    
    // Visibility helpers
    doesVisibilityMakeSense() {
      return this.enableFogOfWar && this.isMyTurn;
    },
    
    emitAddTempVisibilityForCoords(data) {
      this.addTempVisibilityForCoords(data.x, data.y, data.fogRadius);
    },
    
    emitScoutArea(data) {
      if (!this.isMyTurn) {
        console.warn('Not your turn');
        return;
      }
      // Send scout message to server
      const payload = {
        type: 'scout',
        targetCoords: [data.x, data.y],
        fogRadius: data.fogRadius,
      };
      this.sendMoveToServer(payload);
    },
    
    addVisibilityForCoords(x, y, fogRadius) {
      if (!this.doesVisibilityMakeSense()) return;
      
      for (let curX = x - fogRadius; curX <= x + fogRadius; curX++) {
        if (curX < 0 || curX >= this.width) continue;
        for (let curY = y - fogRadius; curY <= y + fogRadius; curY++) {
          if (curY < 0 || curY >= this.height) continue;
          if (Math.abs(curX - x) + Math.abs(curY - y) > fogRadius) continue;
          this.localField[curX][curY].isHidden = false;
        }
      }
      
      // Ensure scout-revealed cells remain visible after unit moves
      this.ensureScoutRevealedVisible();
    },
    
    ensureScoutRevealedVisible() {
      console.log('[DEBUG] ensureScoutRevealedVisible called', this.scoutRevealedCoords);
      // Keep scout-revealed cells visible even after visibility recalculations
      if (!this.localField || this.scoutRevealedCoords.size === 0) return;
      
      for (const coordStr of this.scoutRevealedCoords) {
        const [x, y] = coordStr.split(',').map(Number);
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          if (this.localField[x] && this.localField[x][y]) {
            this.localField[x][y].isHidden = false;
          }
        }
      }
    },
    
    setVisibilityForArea(x, y, radius) {
      if (!this.doesVisibilityMakeSense()) return;
      
      for (let curX = x - radius; curX <= x + radius; curX++) {
        if (curX < 0 || curX >= this.width) continue;
        for (let curY = y - radius; curY <= y + radius; curY++) {
          if (curY < 0 || curY >= this.height) continue;
          if (Math.abs(curX - x) + Math.abs(curY - y) > radius) continue;
          this.localField[curX][curY].isHidden = false;
        }
      }
      
      // Ensure scout-revealed cells remain visible after setting visibility for area
      this.ensureScoutRevealedVisible();
    },
    
    addTempVisibilityForCoords(x, y, fogRadius) {
      // Temporary visibility (e.g., from obelisks)
      this.addVisibilityForCoords(x, y, fogRadius);
    },
    
    initVisibility() {
      // Initialize visibility based on current player's units
      if (!this.enableFogOfWar) {
        for (let x = 0; x < this.width; x++) {
          for (let y = 0; y < this.height; y++) {
            this.localField[x][y].isHidden = false;
          }
        }
        return;
      }
      
      // Hide all cells initially
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          this.localField[x][y].isHidden = true;
        }
      }
      
      // Show cells around player's units
      if (this.isMyTurn) {
        for (let x = 0; x < this.width; x++) {
          for (let y = 0; y < this.height; y++) {
            const unit = this.localField[x][y].unit;
            if (unit && unit.player === this.myPlayerOrder) {
              this.addVisibilityForCoords(x, y, unit.visibility);
            }
          }
        }
      }
    },
    
    recalculateVisibilityForClient() {
      // Recalculate visibility for the client based on their units and buildings only
      // (without scout-revealed coordinates - those are cleared when turn changes)
      if (!this.enableFogOfWar || !this.localField || this.localField.length === 0) {
        return;
      }
      
      // First, hide all cells
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          if (this.localField[x] && this.localField[x][y]) {
            this.localField[x][y].isHidden = true;
          }
        }
      }
      
      // Then show cells around current player's units and buildings
      for (let x = 0; x < this.width; x++) {
        for (let y = 0; y < this.height; y++) {
          if (!this.localField[x] || !this.localField[x][y]) continue;
          
          const cell = this.localField[x][y];
          const unit = cell.unit;
          const building = cell.building;
          
          // Add visibility from units
          if (unit && unit.player === this.myPlayerOrder) {
            // Use square visibility (Chebyshev distance) to match backend
            const visibility = unit.visibility || this.fogOfWarRadius;
            for (let curX = x - visibility; curX <= x + visibility; curX++) {
              if (curX < 0 || curX >= this.width) continue;
              for (let curY = y - visibility; curY <= y + visibility; curY++) {
                if (curY < 0 || curY >= this.height) continue;
                if (this.localField[curX] && this.localField[curX][curY]) {
                  this.localField[curX][curY].isHidden = false;
                }
              }
            }
          }
          
          // Add visibility from bases
          if (building && building.player === this.myPlayerOrder && building._type === 'base') {
            const baseVisibility = this.fogOfWarRadius;
            for (let curX = x - baseVisibility; curX <= x + baseVisibility; curX++) {
              if (curX < 0 || curX >= this.width) continue;
              for (let curY = y - baseVisibility; curY <= y + baseVisibility; curY++) {
                if (curY < 0 || curY >= this.height) continue;
                if (this.localField[curX] && this.localField[curX][curY]) {
                  this.localField[curX][curY].isHidden = false;
                }
              }
            }
          }
        }
      }
      
      // IMPORTANT: Always restore scout-revealed cells after recalculating visibility
      // Scout-revealed cells should remain visible regardless of unit positions
      this.ensureScoutRevealedVisible();
    },
  },
};
</script>

