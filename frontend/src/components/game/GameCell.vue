<template>
  <div
    class="cell"
    :class="{ hidden: hidden, selected: selected, highlighted: highlighted }"
    :style="{ width: `${width}px`, height: `${height}px` }"
    @contextmenu.prevent="handleContextMenu"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <img
      class="terrainImg"
      :class="{ hidden: hidden }"
      :src="getTerrainImg()"
      :style="{ width: `${width}px`, height: `${height}px`, transition: transitionOpacity }"
    />
    <div
      class="cellSelection"
      :class="{ selected: selected, highlighted: highlighted }"
      :style="{ width: `${width}px`, height: `${height}px` }"
    ></div>
    <GameBuilding
      v-if="building"
      :hidden="hidden"
      :image="getBuildingImg()"
      :width="width"
      :height="height"
    />
    <GameUnit
      v-if="unit"
      :hidden="hidden"
      :image="unit._type"
      :width="width"
      :height="height"
      :move-points="unit.movePoints"
      :has-moved="unit.hasMoved"
      :show-move-points="showMovePoints()"
    />
    <!-- Warning indicator for tower limit reached -->
    <img
      v-if="showTowerLimitWarning"
      class="tower-limit-warning"
      src="/images/warning_sign.png"
      alt="Warning"
    />
  </div>
</template>

<script>
import GameUnit from '@/components/game/GameUnit.vue'
import GameBuilding from '@/components/game/GameBuilding.vue'
import Models from '@/game/models.js'
import { TRANSITION_DELAY } from '@/game/const.js'
import { getImagePath } from '@/game/helpers.js'

export default {
  name: 'GameCell',
  components: {
    GameUnit,
    GameBuilding,
  },
  props: {
    width: Number,
    height: Number,
    terrain: Object,
    unit: {
      type: Object,
      validator: value => value === null || value instanceof Models.Unit,
    },
    building: {
      type: Object,
      validator: value => value === null || value instanceof Models.Building,
    },
    selected: Boolean,
    highlighted: Boolean,
    hidden: Boolean,
    currentPlayer: Number,
    myPlayerOrder: {
      type: Number,
      default: null, // null for single-player mode
    },
    hideEnemySpeed: Boolean,
    cellX: Number,
    cellY: Number,
    hasSelectedUnit: Boolean,
    currentStats: {
      type: Object,
      default: () => ({
        towers: { total: 0, max: 0 },
      }),
    },
    baseModifier: {
      type: Number,
      default: 3,
    },
    selectedUnitOnStorage: Boolean,
  },
  computed: {
    transitionOpacity() {
      return `opacity ${TRANSITION_DELAY}s`
    },
    showTowerLimitWarning() {
      // Show warning if:
      // 1. A unit is selected
      // 2. This cell is highlighted (in unit's zone)
      // 3. This cell has a building that is a tower (base)
      // 4. The tower is empty or enemy-owned
      // 5. Tower limit is reached
      if (!this.hasSelectedUnit || !this.highlighted) {
        return false
      }

      if (!this.building || this.building._type !== Models.BuildingTypes.BASE) {
        return false
      }

      // Check if tower is empty or enemy-owned
      const isTowerEmpty = this.building.player === null
      const isTowerEnemy =
        this.building.player !== null && this.building.player !== this.currentPlayer

      if (!isTowerEmpty && !isTowerEnemy) {
        return false
      }

      // Check if tower limit is reached
      const towersTotal = this.currentStats?.towers?.total || 0
      let towersMax = this.currentStats?.towers?.max || 0

      // If max is 0, there's no limit
      if (towersMax === 0) {
        return false
      }

      // If the selected unit is standing on a storage building, subtract the modifier
      // because when the unit moves away, the storage bonus will be lost
      if (this.selectedUnitOnStorage) {
        console.log('selectedUnitOnStorage', this.selectedUnitOnStorage)
        towersMax = Math.max(0, towersMax - this.baseModifier)
      }

      return towersTotal >= towersMax
    },
  },
  methods: {
    getTerrainImg() {
      if (this.terrain.kind === Models.TerrainTypes.MOUNTAIN) {
        let idx = this.terrain.idx
        if (idx > 5) idx = 10 - idx
        return getImagePath(`${this.terrain.kind}${idx}`)
      }
      // const idx = Math.ceil(Math.random() * 4);
      // console.log('terrain idx', idx);
      return getImagePath(`${this.terrain.kind}${this.terrain.idx}`)
    },
    getBuildingImg() {
      let buildingImg = this.building._type
      if (this.building.player !== null) buildingImg += `${this.building.player + 1}`
      return buildingImg
    },
    showMovePoints() {
      if (!this.hideEnemySpeed) return true
      // In multiplayer mode, use myPlayerOrder to show speed only for own units
      // In single-player mode (myPlayerOrder is null), use currentPlayer
      const playerToCheck = this.myPlayerOrder !== null ? this.myPlayerOrder : this.currentPlayer
      if (this.unit && this.unit.player === playerToCheck) return true
      return false
    },
    handleContextMenu(_event) {
      // Right-click handler (also triggered by long press on mobile)
      this.$emit('contextMenu', { x: this.cellX, y: this.cellY })
    },
    handleMouseEnter() {
      this.$emit('mouseEnter', { x: this.cellX, y: this.cellY })
    },
    handleMouseLeave() {
      this.$emit('mouseLeave', { x: this.cellX, y: this.cellY })
    },
  },
}
</script>

<style scoped>
div.cell {
  position: relative;
  display: inline-block;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  -o-user-select: none;
  /*border: solid 1px;*/
  /*transition: v-bind('cssProps.transitionBorder');*/
}
/*div.cell.hidden {*/
/*  !*border: solid 1px black;*!*/
/*}*/
img.terrainImg {
  vertical-align: top;
}
img.terrainImg.hidden {
  opacity: 0;
}
div.cell .cellSelection {
  position: absolute;
  left: 0;
  top: 0;
  /*transition: v-bind('cssProps.transitionBorder');*/
}
div.cell .cellSelection.selected {
  background-color: #42b983;
}
div.cell .cellSelection.highlighted {
  background-color: rgba(66, 185, 131, 0.5);
}

.tower-limit-warning {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  width: 40%;
  height: 40%;
  pointer-events: none;
}
</style>
