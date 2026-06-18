<template>
  <div class="game-menu-overlay" @click.self="handleResume">
    <div class="menu-content">
      <div class="menu-inner">
        <h2>Game Statistics</h2>

        <!-- Game Statistics -->
        <div class="statistics-section">
          <!-- Speed Range -->
          <div
            class="speed-range"
            @contextmenu.prevent="showHint($event, 'Speed range (min / max)')"
          >
            <div class="speed-icon-wrapper">
              <img
                class="speed-icon"
                :src="getImagePath('speed_icon')"
                alt="Speed"
                loading="lazy"
              />
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
                  <th class="dino-header" @contextmenu.prevent="showHint($event, 'Dinos')">
                    <img
                      :src="getImagePath('dino_icon')"
                      alt="Dinos"
                      class="building-icon"
                      loading="lazy"
                    />
                  </th>
                  <th
                    v-for="buildingType in visibleBuildingTypes"
                    :key="buildingType.type"
                    class="building-header"
                    @contextmenu.prevent="showHint($event, buildingHint(buildingType.type))"
                  >
                    <img
                      :src="getImagePath(buildingType.icon)"
                      :alt="buildingType.name"
                      class="building-icon"
                      loading="lazy"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(playerBuildings, playerIndex) in allPlayersBuildings"
                  :key="playerIndex"
                  :class="{ 'current-player-row': playerIndex === currentPlayer }"
                  :style="
                    playerIndex === currentPlayer
                      ? { backgroundColor: getPlayerColor(playerIndex) }
                      : {}
                  "
                >
                  <td
                    class="player-cell"
                    @contextmenu.prevent="showHint($event, playerHintLabel(playerIndex))"
                  >
                    <img
                      :src="getImagePath('dino' + (playerIndex + 1))"
                      :alt="`Player ${playerIndex + 1}`"
                      class="player-icon"
                      loading="lazy"
                    />
                  </td>
                  <td class="dino-cell" @contextmenu.prevent="showHint($event, 'Dinos')">
                    <span>{{ allPlayersDinos[playerIndex] || 0 }}</span>
                  </td>
                  <td
                    v-for="buildingType in visibleBuildingTypes"
                    :key="buildingType.type"
                    class="building-cell"
                    @contextmenu.prevent="showHint($event, buildingHint(buildingType.type))"
                  >
                    <span>
                      {{ playerBuildings[buildingType.type] || 0 }}
                    </span>
                  </td>
                </tr>
                <tr class="total-row">
                  <td
                    class="player-cell total-label"
                    @contextmenu.prevent="showHint($event, 'Total on the map')"
                  >
                    TOTAL
                  </td>
                  <td class="dino-cell"></td>
                  <td
                    v-for="buildingType in visibleBuildingTypes"
                    :key="buildingType.type"
                    class="building-cell"
                    @contextmenu.prevent="showHint($event, buildingHint(buildingType.type))"
                  >
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
          <button
            @click="handleResume"
            @contextmenu.prevent="showHint($event, 'Resume')"
            class="menu-btn"
            title="Resume"
          >
            <img
              class="btn-icon btn-icon-resume"
              :src="getImagePath('arrow')"
              alt="Resume"
              loading="lazy"
            />
          </button>
          <button
            @click="handleZoomIn"
            @contextmenu.prevent="showHint($event, 'Zoom In')"
            class="menu-btn"
            title="Zoom In"
          >
            <img class="btn-icon" :src="getImagePath('plus')" alt="Zoom In" loading="lazy" />
          </button>
          <button
            @click="handleZoomOut"
            @contextmenu.prevent="showHint($event, 'Zoom Out')"
            class="menu-btn"
            title="Zoom Out"
          >
            <img class="btn-icon" :src="getImagePath('minus')" alt="Zoom Out" loading="lazy" />
          </button>
          <button
            @click="handleExit"
            @contextmenu.prevent="showHint($event, 'Exit')"
            class="menu-btn"
            title="Exit"
          >
            <img class="btn-icon" :src="getImagePath('exit_icon')" alt="Exit" loading="lazy" />
          </button>
        </div>
      </div>
    </div>
    <!-- Right-click hint tooltip (positioned in viewport coords). -->
    <div v-if="hintVisible" class="menu-hint" :style="{ left: hintX + 'px', top: hintY + 'px' }">
      <b :style="hintContent.titleStyle">{{ hintContent.title }}</b>
      <template v-if="hintContent.description"> <br />{{ hintContent.description }} </template>
      <template v-if="hintContent.warning">
        <br /><span class="warning-text">❗Limit reached❗</span>
      </template>
    </div>
  </div>
</template>

<script>
import Models from '@/game/models'
import { getPlayerColor } from '@/game/helpers'
import { getImagePath } from '@/game/helpers.js'
import { getBuildingHintContent } from '@/game/buildingHints'

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
    // Authoritative per-type building totals supplied by the server in
    // multiplayer. When null, fall back to counting from the local field —
    // correct in single-player (full visibility) but undercounts under
    // multiplayer fog of war.
    buildingTotalsOverride: {
      type: Object,
      default: null,
    },
    unitModifier: {
      type: Number,
      default: 3,
    },
    baseModifier: {
      type: Number,
      default: 3,
    },
    fogOfWarRadius: {
      type: Number,
      default: 3,
    },
  },
  data() {
    return {
      // Right-click hint state. Floating tooltip anchored to the
      // viewport with absolute coordinates; mirrors InfoPanel's
      // `info-context-help` approach. Hidden by default; hideHint clears
      // it on outside click / scroll.
      hintContent: null,
      hintVisible: false,
      hintX: 0,
      hintY: 0,
    }
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
      ]
    },
    // Drop columns for building types that don't exist on the map. Reads
    // from `totalBuildings` so it benefits from the server-supplied totals
    // in multiplayer (which see through fog of war).
    visibleBuildingTypes() {
      return this.buildingTypes.filter(bt => (this.totalBuildings[bt.type] || 0) > 0)
    },
    speedRangeMin() {
      const templesOccupied = this.countTemplesOccupied(this.currentPlayer)
      return this.minSpeed + templesOccupied
    },
    speedRangeMax() {
      const templesOccupied = this.countTemplesOccupied(this.currentPlayer)
      return this.maxSpeed + templesOccupied
    },
    allPlayersDinos() {
      const dinosCounts = []
      const width = this.field ? this.field.length : 0
      const height = this.field && this.field[0] ? this.field[0].length : 0

      for (let playerIndex = 0; playerIndex < this.players.length; playerIndex++) {
        let dinoCount = 0

        for (let x = 0; x < width; x++) {
          if (!this.field[x]) continue
          for (let y = 0; y < height; y++) {
            if (!this.field[x][y]) continue

            const cell = this.field[x][y]
            const unit = cell.unit

            // Check if cell is visible
            const isVisible = !this.enableFogOfWar || !cell.isHidden

            if (!isVisible) continue

            // Count units (dinos) for this player
            if (unit && unit.player === playerIndex) {
              dinoCount++
            }
          }
        }

        dinosCounts.push(dinoCount)
      }

      return dinosCounts
    },
    allPlayersBuildings() {
      const allBuildings = []
      const width = this.field ? this.field.length : 0
      const height = this.field && this.field[0] ? this.field[0].length : 0

      for (let playerIndex = 0; playerIndex < this.players.length; playerIndex++) {
        const playerBuildings = {}
        // Initialize all building types to 0
        for (let _type in Models.BuildingTypes) {
          playerBuildings[Models.BuildingTypes[_type]] = 0
        }

        if (playerIndex === this.currentPlayer) {
          // For current player, use fieldEngine method to get all buildings
          if (this.fieldEngine && typeof this.fieldEngine.getBuildingsOccupied === 'function') {
            const occupied = this.fieldEngine.getBuildingsOccupied(playerIndex)
            // Count towers owned by player (separate from occupied buildings)
            for (let x = 0; x < width; x++) {
              if (!this.field[x]) continue
              for (let y = 0; y < height; y++) {
                if (!this.field[x][y]) continue
                const building = this.field[x][y].building
                if (
                  building &&
                  building._type === Models.BuildingTypes.BASE &&
                  building.player === playerIndex
                ) {
                  playerBuildings[Models.BuildingTypes.BASE]++
                }
              }
            }
            // Add occupied buildings (excluding bases which we count separately above)
            for (let type in occupied) {
              if (type !== Models.BuildingTypes.BASE) {
                playerBuildings[type] = occupied[type]
              }
            }
          } else {
            // Fallback: count manually if fieldEngine not available
            for (let x = 0; x < width; x++) {
              if (!this.field[x]) continue
              for (let y = 0; y < height; y++) {
                if (!this.field[x][y]) continue
                const cell = this.field[x][y]
                const building = cell.building
                const unit = cell.unit

                if (building) {
                  if (
                    building._type === Models.BuildingTypes.BASE &&
                    building.player === playerIndex
                  ) {
                    playerBuildings[Models.BuildingTypes.BASE]++
                  } else if (unit && unit.player === playerIndex) {
                    playerBuildings[building._type]++
                  }
                }
              }
            }
          }
        } else {
          // For other players, count only visible buildings
          for (let x = 0; x < width; x++) {
            if (!this.field[x]) continue
            for (let y = 0; y < height; y++) {
              if (!this.field[x][y]) continue

              const cell = this.field[x][y]
              const building = cell.building
              const unit = cell.unit

              // Check if cell is visible
              const isVisible = !this.enableFogOfWar || !cell.isHidden

              if (!isVisible) continue

              if (building) {
                if (building._type === Models.BuildingTypes.BASE) {
                  // Base is counted if owned by the player
                  if (building.player === playerIndex) {
                    playerBuildings[Models.BuildingTypes.BASE]++
                  }
                } else if (unit && unit.player === playerIndex) {
                  // Other buildings are counted if occupied by player's unit
                  playerBuildings[building._type]++
                }
              }
            }
          }
        }

        allBuildings.push(playerBuildings)
      }

      return allBuildings
    },
    totalBuildings() {
      const totals = {}
      // Initialize all building types to 0
      for (let _type in Models.BuildingTypes) {
        totals[Models.BuildingTypes[_type]] = 0
      }

      // Server-provided totals win over local counting under fog of war.
      if (this.buildingTotalsOverride) {
        for (const _type in totals) {
          if (this.buildingTotalsOverride[_type] != null) {
            totals[_type] = this.buildingTotalsOverride[_type]
          }
        }
        return totals
      }

      const width = this.field ? this.field.length : 0
      const height = this.field && this.field[0] ? this.field[0].length : 0

      // Count all buildings regardless of visibility (single-player path —
      // local field has full info).
      for (let x = 0; x < width; x++) {
        if (!this.field[x]) continue
        for (let y = 0; y < height; y++) {
          if (!this.field[x][y]) continue

          const cell = this.field[x][y]
          const building = cell.building

          if (building) {
            // Count all buildings of each type
            totals[building._type]++
          }
        }
      }

      return totals
    },
  },
  mounted() {
    // Close menu on Escape key
    document.addEventListener('keydown', this.handleKeyDown)
    // Dismiss the right-click hint on any non-hint click or scroll.
    document.addEventListener('click', this.hideHint)
    document.addEventListener('scroll', this.hideHint, true)
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown)
    document.removeEventListener('click', this.hideHint)
    document.removeEventListener('scroll', this.hideHint, true)
  },
  methods: {
    getPlayerColor,
    getImagePath,
    // Show a right-click hint anchored above the clicked element.
    showHint(event, content) {
      if (!content) return
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      this.hintContent =
        typeof content === 'string'
          ? { title: content, titleStyle: null, description: null, warning: false }
          : content
      this.hintX = rect.left + rect.width / 2
      this.hintY = rect.top - 6
      this.hintVisible = true
    },
    buildingHint(buildingType) {
      return getBuildingHintContent(buildingType, {
        unitModifier: this.unitModifier,
        baseModifier: this.baseModifier,
        fogOfWarRadius: this.fogOfWarRadius,
      })
    },
    hideHint() {
      this.hintVisible = false
    },
    playerHintLabel(playerIndex) {
      // Prefer the username when available, otherwise fall back to a
      // 1-indexed "Player N" label.
      const p = this.players && this.players[playerIndex]
      return p && p.username ? p.username : `Player ${playerIndex + 1}`
    },
    countTemplesOccupied(player) {
      let count = 0
      const width = this.field ? this.field.length : 0
      const height = this.field && this.field[0] ? this.field[0].length : 0

      for (let x = 0; x < width; x++) {
        if (!this.field[x]) continue
        for (let y = 0; y < height; y++) {
          if (!this.field[x][y]) continue

          const cell = this.field[x][y]
          const building = cell.building
          const unit = cell.unit

          if (
            building &&
            building._type === Models.BuildingTypes.TEMPLE &&
            unit &&
            unit.player === player
          ) {
            count++
          }
        }
      }

      return count
    },
    handleKeyDown(event) {
      if (event.key === 'Escape') {
        this.handleResume()
      }
    },
  },
}
</script>

<style scoped>
.game-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  /* Sits above TutorialHint (10050) and the end-of-scenario overlay
     (10060) so the player can always quit a tutorial scenario via the
     gear button. */
  z-index: 10080;
  /* Teleported to <body>, which doesn't inherit #app's font — restate
     the project font here so the menu looks the same as before. */
  font-family: 'RocknRoll One', Avenir, Helvetica, Arial, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow-y: auto;
}

/* Floating right-click hint inside the overlay. Same dark pill style as
   InfoPanel's `info-context-help`. Positioned in viewport coords; the
   `transform` centres horizontally and lifts it above the click target. */
.menu-hint {
  position: fixed;
  z-index: 10081;
  background-color: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.4;
  pointer-events: none;
  transform: translate(-50%, -100%);
  max-width: 120px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

/* Outer plate: 20px ornament strip painted with the stone-border texture,
   rounded corners. The inner `.menu-inner` sits on top with the parchment
   texture and its own rounded corners, so the outer strip reads as a
   frame around the content. */
.menu-content {
  position: relative;
  background-image: url('/images/ingame_menu_border.png');
  background-size: cover;
  background-position: center;
  background-repeat: repeat;
  width: 100%;
  max-width: min(90vw, 600px);
  max-height: 90vh;
  padding: 10px;
  border-radius: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  box-sizing: border-box;
  overflow: hidden;
}

.menu-inner {
  background-image: url('/images/ingame_menu_texture.png');
  background-size: cover;
  background-position: center;
  background-repeat: repeat;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.3);
  padding: clamp(20px, 2vh, 40px);
  max-height: calc(90vh - 40px);
  display: flex;
  flex-direction: column;
  gap: clamp(15px, 3vh, 30px);
  overflow-y: auto;
  box-sizing: border-box;
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
    padding: clamp(10px, 2vh, 25px);
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
