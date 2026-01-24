<template>
  <div
    v-if="visible"
    class="cell-context-help"
    :style="positionStyle"
  >
    <!-- Refactored to avoid v-html for XSS safety -->
    <div v-if="cellContent">
      <b :style="cellContent.titleStyle">{{ cellContent.title }}</b>
      <template v-if="cellContent.description">
        <br>{{ cellContent.description }}
      </template>
      <template v-if="cellContent.warning">
        <br><span class="warning-text">❗Limit reached❗</span>
      </template>
    </div>
  </div>
</template>

<script>
import Models from '@/game/models';
import { getPlayerColor } from '@/game/helpers';

export default {
  name: 'CellContextHelp',
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    x: {
      type: Number,
      default: 0,
    },
    y: {
      type: Number,
      default: 0,
    },
    cellSize: {
      type: Number,
      default: 40,
    },
    fieldWidth: {
      type: Number,
      default: 0,
    },
    fieldHeight: {
      type: Number,
      default: 0,
    },
    cell: {
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
    hasSelectedUnit: {
      type: Boolean,
      default: false,
    },
    currentStats: {
      type: Object,
      default: () => ({
        towers: { total: 0, max: 0 },
      }),
    },
    currentPlayer: {
      type: Number,
      default: 0,
    },
    selectedUnitOnStorage: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    // Returns structured content object instead of HTML for XSS safety
    cellContent() {
      if (!this.cell) return null;

      if (this.cell.building) {
        return this.buildingContent(this.cell.building._type);
      }
      if (this.cell.terrain && this.cell.terrain.kind === Models.TerrainTypes.MOUNTAIN) {
        return { title: 'Rock', titleStyle: null, description: null, warning: false };
      }
      return { title: 'Empty space', titleStyle: null, description: null, warning: false };
    },
    positionStyle() {
      if (!this.visible) return {};
      
      // Calculate position relative to the cell
      const cellX = this.x * this.cellSize;
      const cellY = this.y * this.cellSize;
      
      // Tooltip dimensions (approximate)
      const tooltipWidth = 120;
      const tooltipHeight = 26;
      const offset = 2; // Offset from cell edge
      
      // Field boundaries
      const maxX = this.fieldWidth * this.cellSize;
      const maxY = this.fieldHeight * this.cellSize;
      
      // Try to position to the right of the cell first
      const rightSideLeft = cellX + this.cellSize + offset;
      
      // Check if tooltip fits on the right side
      if (rightSideLeft + tooltipWidth <= maxX) {
        // Position to the right: use left property
        const left = rightSideLeft;
        const top = Math.max(0, Math.min(
          cellY + (this.cellSize / 2) - (tooltipHeight / 2),
          maxY - tooltipHeight
        ));
        
        return {
          left: `${left}px`,
          top: `${top}px`,
        };
      } else {
        // Position to the left: use right property to align tooltip's right edge with cell's right edge
        // Cell's right edge is at cellX + cellSize from the left
        // We want tooltip's right edge at cellX + cellSize + offset from the left
        // So right = maxX - (cellX + cellSize + offset)
        const right = maxX - cellX - offset;
        const top = Math.max(0, Math.min(
          cellY + (this.cellSize / 2) - (tooltipHeight / 2),
          maxY - tooltipHeight
        ));
        
        return {
          right: `${right}px`,
          top: `${top}px`,
        };
      }
    },
    cannotBeCaptured() {
      // Check if tower cannot be captured (same logic as in GameCell)
      if (!this.hasSelectedUnit) {
        return false;
      }
      
      if (!this.cell || !this.cell.building || this.cell.building._type !== Models.BuildingTypes.BASE) {
        return false;
      }
      
      // Check if tower is empty or enemy-owned
      const isTowerEmpty = this.cell.building.player === null;
      const isTowerEnemy = this.cell.building.player !== null && this.cell.building.player !== this.currentPlayer;
      
      if (!isTowerEmpty && !isTowerEnemy) {
        return false;
      }
      
      // Check if tower limit is reached
      const towersTotal = this.currentStats?.towers?.total || 0;
      let towersMax = this.currentStats?.towers?.max || 0;
      
      // If max is 0, there's no limit
      if (towersMax === 0) {
        return false;
      }
      
      // If the selected unit is standing on a storage building, subtract the modifier
      // because when the unit moves away, the storage bonus will be lost
      if (this.selectedUnitOnStorage) {
        towersMax = Math.max(0, towersMax - this.baseModifier);
      }
      
      return towersTotal >= towersMax;
    },
  },
  methods: {
    // Returns structured content object instead of HTML for XSS safety
    buildingContent(_type) {
      const building = this.cell.building;
      const playerColor = building && building.player !== null && building.player !== undefined
        ? getPlayerColor(building.player)
        : null;

      const towerTitleStyle = playerColor ? { color: playerColor } : null;

      switch (_type) {
        case 'base':
          return {
            title: 'Tower',
            titleStyle: towerTitleStyle,
            description: 'Produce 1 unit every turn',
            warning: this.cannotBeCaptured,
          };
        case 'habitation':
          return {
            title: 'Habitation',
            titleStyle: null,
            description: `Units limit +${this.unitModifier}`,
            warning: false,
          };
        case 'temple':
          return {
            title: 'Temple',
            titleStyle: null,
            description: 'Speed for generated units +1',
            warning: false,
          };
        case 'well':
          return {
            title: 'Well',
            titleStyle: null,
            description: 'Speed for current unit +1',
            warning: false,
          };
        case 'storage':
          return {
            title: 'Storage',
            titleStyle: null,
            description: `Towers limit +${this.baseModifier}`,
            warning: false,
          };
        case 'obelisk':
          return {
            title: 'Obelisk',
            titleStyle: null,
            description: `Show any part of the map ${this.fogOfWarRadius}x${this.fogOfWarRadius}`,
            warning: false,
          };
        default:
          return null;
      }
    },
  },
};
</script>

<style scoped>
.cell-context-help {
  position: absolute;
  background-color: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  max-width: 120px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  line-height: 1.4;
  z-index: 1000;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
/* 
.warning-text {
  color: #ff6b6b;
} */
</style>

