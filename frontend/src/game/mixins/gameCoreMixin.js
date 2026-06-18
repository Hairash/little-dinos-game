/**
 * Game Core Mixin
 *
 * Shared logic between DinoGame.vue (single-player) and MultiplayerDinoGame.vue
 *
 * This mixin provides:
 * - State constants (STATES)
 * - UI state (cellSize)
 * - Stats calculation (getCurrentStats, getCurrentUnitCoords)
 * - Unit selection (findNextUnit)
 * - Cell size management (changeCellSize)
 * - Visibility helpers (doesVisibilityMakeSense, addVisibilityForCoords, setVisibilityForArea)
 */

import Models from '@/game/models'
import emitter from '@/game/eventBus'

export const gameCoreMixin = {
  data() {
    return {
      // State constants - shared between single-player and multiplayer
      STATES: {
        ready: 'ready',
        play: 'play',
        exitDialog: 'exitDialog',
      },

      // UI state
      cellSize: 30,
    }
  },

  methods: {
    /**
     * Get the current game field (handles both single-player and multiplayer)
     * @returns {Array} The game field
     */
    _getField() {
      return this.localField || this.field
    },

    /**
     * Get current game settings (handles both single-player and multiplayer)
     * @returns {Object} Settings object with maxUnitsNum, maxBasesNum, etc.
     */
    _getSettings() {
      return this.localSettings || this.settings || this
    },

    /**
     * Calculate stats (units / towers) for a given player.
     * @param {number} [playerNum] - Player order. Defaults to `currentPlayer`
     *   (the active turn-taker). Multiplayer passes the *viewing* player
     *   (usually the local user) so the bottom panel always reflects them.
     * @returns {Object} Stats object with units and towers info
     */
    getCurrentStats(playerNum = this.currentPlayer) {
      const settings = this._getSettings()
      const field = this._getField()
      // Tutorial scenarios may set per-player overrides (e.g. enemy has
      // a tighter unit cap than the human). Honour them here so the
      // bottom-panel limit and the info pop-ups reflect what the
      // FieldEngine will actually enforce during production.
      const overrides = this.tutorialScenario?.playerOverrides?.[playerNum] || null
      const maxUnitsNum =
        overrides && overrides.maxUnitsNum !== undefined
          ? overrides.maxUnitsNum
          : settings.maxUnitsNum || 0
      const maxBasesNum =
        overrides && overrides.maxBasesNum !== undefined
          ? overrides.maxBasesNum
          : settings.maxBasesNum || 0

      const stats = {
        units: {
          active: 0,
          total: 0,
          max: maxUnitsNum,
          coordsArr: [],
        },
        towers: {
          total: 0,
          max: maxBasesNum,
          empty: 0,
        },
      }

      // Guard: return default stats if field is not ready
      if (!field || !Array.isArray(field) || field.length === 0) {
        return stats
      }

      const unitsNotOnBuildings = []
      const unitsOnBuildings = []
      const width = this.width || field.length
      const height = this.height || (field[0] ? field[0].length : 0)

      for (let x = 0; x < width; x++) {
        if (!field[x] || !Array.isArray(field[x])) continue

        for (let y = 0; y < height; y++) {
          if (!field[x][y]) continue

          const unit = field[x][y].unit
          const building = field[x][y].building

          if (unit && unit.player === playerNum) {
            stats.units.total++
            if (!unit.hasMoved) {
              // Check if unit is on a building that should be excluded from priority
              const isOnExcludedBuilding =
                building &&
                ((building._type === Models.BuildingTypes.BASE && building.player === playerNum) ||
                  (building._type === Models.BuildingTypes.BASE && building.player === null) ||
                  building._type === Models.BuildingTypes.OBELISK)

              if (!building || isOnExcludedBuilding) {
                unitsNotOnBuildings.push([x, y])
              } else {
                unitsOnBuildings.push([x, y])
              }
              stats.units.active++
            }
            // Check for habitation buildings that increase unit limit
            if (
              building &&
              building._type === Models.BuildingTypes.HABITATION &&
              stats.units.max > 0
            ) {
              stats.units.max += settings.unitModifier || this.unitModifier || 0
            }
            // Check for storage buildings that increase base limit
            if (
              building &&
              building._type === Models.BuildingTypes.STORAGE &&
              stats.towers.max > 0
            ) {
              stats.towers.max += settings.baseModifier || this.baseModifier || 0
            }
          }

          // Count bases (towers)
          if (
            building &&
            building._type === Models.BuildingTypes.BASE &&
            building.player === playerNum
          ) {
            stats.towers.total++
            if (!unit) stats.towers.empty++
          }
        }
      }

      // Combine arrays: units not on buildings first, then units on buildings
      stats.units.coordsArr = [...unitsNotOnBuildings, ...unitsOnBuildings]
      return stats
    },

    /**
     * Get coordinates of all units that haven't moved yet
     * @param {number} playerNum - Player number (defaults to currentPlayer)
     * @returns {Array} Array of [x, y] coordinate pairs
     */
    getCurrentUnitCoords(playerNum = this.currentPlayer) {
      const field = this._getField()

      if (!field || !Array.isArray(field) || field.length === 0) {
        return []
      }

      const unitsNotOnBuildings = []
      const unitsOnBuildings = []
      const width = this.width || field.length
      const height = this.height || (field[0] ? field[0].length : 0)

      for (let x = 0; x < width; x++) {
        if (!field[x] || !Array.isArray(field[x])) continue

        for (let y = 0; y < height; y++) {
          const cell = field[x][y]
          if (!cell) continue

          const unit = cell.unit
          const building = cell.building

          if (unit && unit.player === playerNum && !unit.hasMoved) {
            // Check if unit is on a building that should be excluded from priority
            const isOnExcludedBuilding =
              building &&
              ((building._type === Models.BuildingTypes.BASE &&
                building.player === this.currentPlayer) ||
                (building._type === Models.BuildingTypes.BASE && building.player === null) ||
                building._type === Models.BuildingTypes.OBELISK)

            if (!building || isOnExcludedBuilding) {
              unitsNotOnBuildings.push([x, y])
            } else {
              unitsOnBuildings.push([x, y])
            }
          }
        }
      }

      return [...unitsNotOnBuildings, ...unitsOnBuildings]
    },

    /**
     * Find and select the next available unit.
     */
    findNextUnit() {
      const coordsArr = this.getCurrentUnitCoords()
      if (coordsArr.length === 0) return
      emitter.emit('selectNextUnit', coordsArr)
    },

    /**
     * Change the cell size for zooming
     * @param {number} delta - Amount to change (positive = zoom in, negative = zoom out)
     */
    changeCellSize(delta) {
      this.cellSize = Math.min(Math.max(10, this.cellSize + delta), 70)
    },

    /**
     * Check if visibility calculations should be performed
     * @returns {boolean} True if fog of war is enabled and conditions are met
     */
    doesVisibilityMakeSense() {
      const settings = this._getSettings()
      const enableFogOfWar = settings.enableFogOfWar ?? this.enableFogOfWar

      // For multiplayer: check isMyTurn
      if (this.isMyTurn !== undefined) {
        return enableFogOfWar && this.isMyTurn
      }

      // For single-player: check if player is active
      if (this.players && this.players[this.currentPlayer]) {
        return enableFogOfWar && this.players[this.currentPlayer].active
      }

      return enableFogOfWar
    },

    /**
     * Add visibility for coordinates within a radius
     * @param {number} x - Center X coordinate
     * @param {number} y - Center Y coordinate
     * @param {number} fogRadius - Visibility radius
     */
    addVisibilityForCoords(x, y, fogRadius) {
      const field = this._getField()
      if (!field) return

      const width = this.width || field.length
      const height = this.height || (field[0] ? field[0].length : 0)

      for (let curX = x - fogRadius; curX <= x + fogRadius; curX++) {
        for (let curY = y - fogRadius; curY <= y + fogRadius; curY++) {
          if (curX >= 0 && curX < width && curY >= 0 && curY < height) {
            field[curX][curY].isHidden = false
          }
        }
      }
    },

    /**
     * Recalculate visibility for an area (after unit moves away)
     * @param {number} x - Center X coordinate
     * @param {number} y - Center Y coordinate
     * @param {number} radius - Area radius
     */
    setVisibilityForArea(x, y, radius) {
      const field = this._getField()
      if (!field) return

      const width = this.width || field.length
      const height = this.height || (field[0] ? field[0].length : 0)

      // Make all area invisible first
      for (let curX = x - radius; curX <= x + radius; curX++) {
        for (let curY = y - radius; curY <= y + radius; curY++) {
          if (curX >= 0 && curX < width && curY >= 0 && curY < height) {
            field[curX][curY].isHidden = true
          }
        }
      }

      // Then reveal areas that should be visible from other units/buildings
      // Note: This is a simplified version. Components may override for full implementation.
      for (let curX = x - radius; curX <= x + radius; curX++) {
        for (let curY = y - radius; curY <= y + radius; curY++) {
          if (curX >= 0 && curX < width && curY >= 0 && curY < height) {
            const cell = field[curX][curY]
            if (cell) {
              // Check if there's a visible object here that reveals area
              if (this.fieldEngine && typeof this.fieldEngine.getVisibleObjRadius === 'function') {
                const curR = this.fieldEngine.getVisibleObjRadius(
                  curX,
                  curY,
                  this.currentPlayer,
                  x,
                  y,
                  radius
                )
                if (curR) {
                  this.addVisibilityForCoords(curX, curY, curR)
                }
              }
            }
          }
        }
      }
    },

    /**
     * Exit the game
     */
    exitGame() {
      // Multiplayer: emit event and disconnect
      if (this.gameWs) {
        this.gameWs.disconnect()
        this.$emit('exitGame')
      } else {
        // Single-player: reload page
        window.location.reload()
      }
    },
  },
}
