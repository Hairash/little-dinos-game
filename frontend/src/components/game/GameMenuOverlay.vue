<template>
  <div class="game-menu-overlay" @click.self="handleResume">
    <div class="menu-content">
      <h2>Game Statistics</h2>
      
      <!-- Game Statistics -->
      <div class="statistics-section">
        <!-- Speed Range -->
        <div class="speed-range">
          <div class="speed-icon-wrapper">
            <img class="speed-icon" :src="`/images/speed_icon.png`" alt="Speed">
          </div>
          <span class="speed-number">{{ speedRangeMin }}</span>
          <span class="speed-dash">-</span>
          <span class="speed-number">{{ speedRangeMax }}</span>
        </div>

        <!-- Building Stats Table -->
        <div class="table-container">
          <table class="buildings-table">
            <thead>
              <tr>
                <th class="player-header"></th>
                <th class="dino-header">
                  <img :src="`/images/dino_icon.png`" alt="Dinos" class="building-icon">
                </th>
                <th v-for="buildingType in buildingTypes" :key="buildingType.type" class="building-header">
                  <img :src="`/images/${buildingType.icon}.png`" :alt="buildingType.name" class="building-icon">
                </th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="(playerBuildings, playerIndex) in allPlayersBuildings" 
                :key="playerIndex"
                :class="{ 'current-player-row': playerIndex === currentPlayer }"
                :style="playerIndex === currentPlayer ? { backgroundColor: getPlayerColor(playerIndex) } : {}"
              >
                <td class="player-cell">
                  <img :src="`/images/dino${playerIndex + 1}.png`" :alt="`Player ${playerIndex + 1}`" class="player-icon">
                </td>
                <td class="dino-cell">
                  <span>{{ allPlayersDinos[playerIndex] || 0 }}</span>
                </td>
                <td v-for="buildingType in buildingTypes" :key="buildingType.type" class="building-cell">
                  <span>
                    {{ playerBuildings[buildingType.type] || 0 }}
                  </span>
                </td>
              </tr>
              <tr class="total-row">
                <td class="player-cell total-label">TOTAL</td>
                <td class="dino-cell"></td>
                <td v-for="buildingType in buildingTypes" :key="buildingType.type" class="building-cell">
                  <span>
                    {{ totalBuildings[buildingType.type] || 0 }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Menu Buttons -->
      <div class="menu-buttons">
        <button @click="handleResume" class="menu-btn" title="Resume">
          <img class="btn-icon btn-icon-resume" :src="`/images/arrow.png`" alt="Resume">
        </button>
        <button @click="handleZoomIn" class="menu-btn" title="Zoom In">
          <img class="btn-icon" :src="`/images/plus.png`" alt="Zoom In">
        </button>
        <button @click="handleZoomOut" class="menu-btn" title="Zoom Out">
          <img class="btn-icon" :src="`/images/minus.png`" alt="Zoom Out">
        </button>
        <button @click="handleExit" class="menu-btn" title="Exit">
          <img class="btn-icon" :src="`/images/exit_icon.png`" alt="Exit">
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import Models from "@/game/models";
import { getPlayerColor } from "@/game/helpers";

export default {
  name: 'GameMenuOverlay',
  props: {
    field: {
      type: Array,
      required: true,
    },
    fieldEngine: {
      type: Object,
      required: true,
    },
    currentPlayer: {
      type: Number,
      required: true,
    },
    players: {
      type: Array,
      required: true,
    },
    enableFogOfWar: {
      type: Boolean,
      default: false,
    },
    minSpeed: {
      type: Number,
      required: true,
    },
    maxSpeed: {
      type: Number,
      required: true,
    },
    handleExit: {
      type: Function,
      required: true,
    },
    handleZoomIn: {
      type: Function,
      required: true,
    },
    handleZoomOut: {
      type: Function,
      required: true,
    },
    handleResume: {
      type: Function,
      required: true,
    },
  },
  computed: {
    buildingTypes() {
      return [
        { type: Models.BuildingTypes.BASE, icon: 'base', name: 'Tower' },
        { type: Models.BuildingTypes.HABITATION, icon: 'habitation', name: 'Habitation' },
        { type: Models.BuildingTypes.TEMPLE, icon: 'temple', name: 'Temple' },
        { type: Models.BuildingTypes.WELL, icon: 'well', name: 'Well' },
        { type: Models.BuildingTypes.STORAGE, icon: 'storage', name: 'Storage' },
        { type: Models.BuildingTypes.OBELISK, icon: 'obelisk', name: 'Obelisk' },
      ];
    },
    speedRangeMin() {
      const templesOccupied = this.countTemplesOccupied(this.currentPlayer);
      return this.minSpeed + templesOccupied;
    },
    speedRangeMax() {
      const templesOccupied = this.countTemplesOccupied(this.currentPlayer);
      return this.maxSpeed + templesOccupied;
    },
    allPlayersDinos() {
      const dinosCounts = [];
      const width = this.field ? this.field.length : 0;
      const height = this.field && this.field[0] ? this.field[0].length : 0;

      for (let playerIndex = 0; playerIndex < this.players.length; playerIndex++) {
        let dinoCount = 0;

        for (let x = 0; x < width; x++) {
          if (!this.field[x]) continue;
          for (let y = 0; y < height; y++) {
            if (!this.field[x][y]) continue;

            const cell = this.field[x][y];
            const unit = cell.unit;

            // Check if cell is visible
            const isVisible = !this.enableFogOfWar || !cell.isHidden;

            if (!isVisible) continue;

            // Count units (dinos) for this player
            if (unit && unit.player === playerIndex) {
              dinoCount++;
            }
          }
        }

        dinosCounts.push(dinoCount);
      }

      return dinosCounts;
    },
    allPlayersBuildings() {
      const allBuildings = [];
      const width = this.field ? this.field.length : 0;
      const height = this.field && this.field[0] ? this.field[0].length : 0;

      for (let playerIndex = 0; playerIndex < this.players.length; playerIndex++) {
        const playerBuildings = {};
        // Initialize all building types to 0
        for (let _type in Models.BuildingTypes) {
          playerBuildings[Models.BuildingTypes[_type]] = 0;
        }

        if (playerIndex === this.currentPlayer) {
          // For current player, use fieldEngine method to get all buildings
          if (this.fieldEngine && typeof this.fieldEngine.getBuildingsOccupied === 'function') {
            const occupied = this.fieldEngine.getBuildingsOccupied(playerIndex);
            // Count towers owned by player (separate from occupied buildings)
            for (let x = 0; x < width; x++) {
              if (!this.field[x]) continue;
              for (let y = 0; y < height; y++) {
                if (!this.field[x][y]) continue;
                const building = this.field[x][y].building;
                if (building && building._type === Models.BuildingTypes.BASE && building.player === playerIndex) {
                  playerBuildings[Models.BuildingTypes.BASE]++;
                }
              }
            }
            // Add occupied buildings (excluding bases which we count separately above)
            for (let type in occupied) {
              if (type !== Models.BuildingTypes.BASE) {
                playerBuildings[type] = occupied[type];
              }
            }
          } else {
            // Fallback: count manually if fieldEngine not available
            for (let x = 0; x < width; x++) {
              if (!this.field[x]) continue;
              for (let y = 0; y < height; y++) {
                if (!this.field[x][y]) continue;
                const cell = this.field[x][y];
                const building = cell.building;
                const unit = cell.unit;

                if (building) {
                  if (building._type === Models.BuildingTypes.BASE && building.player === playerIndex) {
                    playerBuildings[Models.BuildingTypes.BASE]++;
                  } else if (unit && unit.player === playerIndex) {
                    playerBuildings[building._type]++;
                  }
                }
              }
            }
          }
        } else {
          // For other players, count only visible buildings
          for (let x = 0; x < width; x++) {
            if (!this.field[x]) continue;
            for (let y = 0; y < height; y++) {
              if (!this.field[x][y]) continue;

              const cell = this.field[x][y];
              const building = cell.building;
              const unit = cell.unit;

              // Check if cell is visible
              const isVisible = !this.enableFogOfWar || !cell.isHidden;

              if (!isVisible) continue;

              if (building) {
                if (building._type === Models.BuildingTypes.BASE) {
                  // Base is counted if owned by the player
                  if (building.player === playerIndex) {
                    playerBuildings[Models.BuildingTypes.BASE]++;
                  }
                } else if (unit && unit.player === playerIndex) {
                  // Other buildings are counted if occupied by player's unit
                  playerBuildings[building._type]++;
                }
              }
            }
          }
        }

        allBuildings.push(playerBuildings);
      }

      return allBuildings;
    },
    totalBuildings() {
      const totals = {};
      const width = this.field ? this.field.length : 0;
      const height = this.field && this.field[0] ? this.field[0].length : 0;

      // Initialize all building types to 0
      for (let _type in Models.BuildingTypes) {
        totals[Models.BuildingTypes[_type]] = 0;
      }

      // Count all buildings regardless of visibility
      for (let x = 0; x < width; x++) {
        if (!this.field[x]) continue;
        for (let y = 0; y < height; y++) {
          if (!this.field[x][y]) continue;

          const cell = this.field[x][y];
          const building = cell.building;

          if (building) {
            // Count all buildings of each type
            totals[building._type]++;
          }
        }
      }

      return totals;
    },
  },
  mounted() {
    // Close menu on Escape key
    document.addEventListener('keydown', this.handleKeyDown);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown);
  },
  methods: {
    countTemplesOccupied(player) {
      let count = 0;
      const width = this.field ? this.field.length : 0;
      const height = this.field && this.field[0] ? this.field[0].length : 0;

      for (let x = 0; x < width; x++) {
        if (!this.field[x]) continue;
        for (let y = 0; y < height; y++) {
          if (!this.field[x][y]) continue;

          const cell = this.field[x][y];
          const building = cell.building;
          const unit = cell.unit;

          if (
            building &&
            building._type === Models.BuildingTypes.TEMPLE &&
            unit &&
            unit.player === player
          ) {
            count++;
          }
        }
      }

      return count;
    },
    getPlayerColor(playerIndex) {
      return getPlayerColor(playerIndex);
    },
    handleKeyDown(event) {
      if (event.key === 'Escape') {
        this.handleResume();
      }
    },
  },
};
</script>

<style scoped>
.game-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow-y: auto;
}

.menu-content {
  position: relative;
  background-image: url('/images/ingame_menu_background.png');
  background-size: 100% 100%;
  background-position: center;
  width: 100%;
  max-width: min(90vw, 600px);
  max-height: 90vh;
  padding: clamp(20px, 4vh, 40px);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: clamp(15px, 3vh, 30px);
  overflow-y: auto;
  box-sizing: border-box;
  /* padding: 38px 40px 54px; */
}


.menu-content h2 {
  margin: 0;
  color: #000;
  font-size: clamp(20px, 5vh, 28px);
  text-align: center;
  flex-shrink: 0;
  font-weight: bold;
}

.statistics-section {
  display: flex;
  flex-direction: column;
  gap: clamp(15px, 3vh, 25px);
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.speed-range {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: clamp(8px, 1.5vh, 12px);
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  width: 128px;
}

.speed-icon-wrapper {
  background-image: url('/images/icon.png');
  width: 30px;
  height: 30px;
  display: inline-flex;
  background-size: contain;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
}

.speed-icon {
  width: 24px;
  height: 24px;
  margin: 3px;
  user-select: none;
}

.speed-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  box-sizing: border-box;
  font-size: clamp(18px, 2.5vh, 24px);
  font-weight: bold;
  background-color: #deae88;
  border: 1px solid rgba(0, 0, 0, 0.3);
  border-radius: 2px;
  padding: 0;
  color: #000;
  text-align: center;
}

.speed-dash {
  font-size: clamp(28px, 4vh, 45px);
  font-weight: bold;
  color: #000;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  height: 100%;
  position: relative;
  top: -1px;
}

.table-container {
  overflow-x: auto;
  overflow-y: auto;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  padding: clamp(8px, 1.5vh, 12px);
  max-width: 100%;
}

.buildings-table {
  width: 100%;
  max-width: 100%;
  border-collapse: collapse;
  color: #000;
  table-layout: auto;
}

.buildings-table th,
.buildings-table td {
  padding: clamp(4px, 0.8vh, 8px);
  text-align: center;
  border: 1px solid rgba(0, 0, 0, 0.2);
}

.buildings-table th {
  font-weight: bold;
  background-color: rgba(0, 0, 0, 0.1);
}

.dino-header {
  min-width: 40px;
}

.player-header {
  min-width: 45px;
}

.building-header {
  min-width: 40px;
}

.building-icon {
  width: 18px;
  height: 18px;
  vertical-align: middle;
}

.dino-cell {
  font-size: clamp(12px, 2vh, 16px);
  font-weight: bold;
  color: #000;
  text-align: center;
}

.player-cell {
  text-align: center;
}

.player-icon {
  width: 18px;
  height: 18px;
  vertical-align: middle;
}

.building-cell {
  font-size: clamp(12px, 2vh, 16px);
  font-weight: bold;
  color: #000;
}

.total-row {
  background-color: rgba(0, 0, 0, 0.15);
  font-weight: bold;
}

.total-label {
  font-weight: bold;
  color: #000;
}

.current-player-row {
  background-color: transparent;
}

.current-player-row td {
  background-color: inherit;
  border-color: rgba(0, 0, 0, 0.3);
}

.current-player-row .dino-cell,
.current-player-row .player-cell,
.current-player-row .building-cell {
  /* color: #fff; */
  /* text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7); */
}


.menu-buttons {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 4px;
  flex-shrink: 0;
  position: relative;
  top: -10px;
}

.menu-btn {
  padding: 0;
  user-select: none;
  background-image: url('/images/small_button.png');
  background-color: transparent;
  background-size: 100% 100%;
  border: none;
  width: 26px;
  height: 26px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-btn .btn-icon {
  width: 22px;
  height: 22px;
  margin-left: 1px;
  margin-top: 1px;
}

.menu-btn .btn-icon-resume {
  transform: scaleX(-1);
}

.menu-btn:active {
  transform: scale(0.95);
}

/* Landscape orientation adjustments */
@media (orientation: landscape) and (max-height: 600px) {
  .menu-content {
    max-width: 95vw;
    padding: clamp(15px, 3vh, 25px);
  }

  .menu-content h2 {
    font-size: clamp(18px, 4vh, 24px);
    margin-bottom: 0;
  }

  .buildings-table th,
  .buildings-table td {
    padding: clamp(3px, 0.6vh, 6px);
  }

  .dino-header,
  .player-header,
  .building-header {
    min-width: 35px;
  }

  .building-icon,
  .player-icon {
    width: 16px;
    height: 16px;
  }

  .dino-cell,
  .building-cell {
    font-size: clamp(11px, 1.8vh, 14px);
  }
}

/* Very small screens */
@media (max-height: 500px) {
  .menu-content h2 {
    font-size: clamp(16px, 4vh, 20px);
  }

  .buildings-table th,
  .buildings-table td {
    padding: clamp(2px, 0.5vh, 5px);
    font-size: 11px;
  }

  .dino-header,
  .player-header,
  .building-header {
    min-width: 30px;
  }

  .building-icon,
  .player-icon {
    width: 14px;
    height: 14px;
  }

  .dino-cell,
  .building-cell {
    font-size: 10px;
  }
}

/* Very narrow screens */
@media (max-width: 320px) {
  .table-container {
    overflow-x: scroll;
  }

  .buildings-table {
    min-width: 350px;
  }
}
</style>

