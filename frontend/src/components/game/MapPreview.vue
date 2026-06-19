<template>
  <div class="map-preview" :style="containerStyle">
    <div v-for="(col, x) in field" :key="x" class="map-preview-col">
      <div v-for="(cell, y) in col" :key="y" class="map-preview-cell" :style="cellStyle(cell)">
        <img
          v-if="cell.building"
          class="map-preview-img"
          :src="getImagePath(buildingImage(cell.building))"
          :alt="cell.building._type"
          loading="lazy"
        />
        <img
          v-if="cell.unit"
          class="map-preview-img map-preview-unit"
          :src="getImagePath(unitImage(cell.unit))"
          :alt="cell.unit._type"
          loading="lazy"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { getImagePath, getPlayerColor } from '@/game/helpers'

// Read-only preview of a canonical Map's field. Bypasses GameGrid /
// GameCell entirely so we don't have to feed it a fieldEngine / players
// array / viewing-player / animation state just to render a static
// snapshot. The trade-off is that this view re-implements terrain image
// selection — but that's a tiny ruleset (kind + idx → asset name).
export default {
  name: 'MapPreview',
  props: {
    // Either a canonical map { field: [[{terrain, building, unit}, ...]] }
    // (parsed JSON) or its inner `.field` array — both shapes are handled.
    map: {
      type: Object,
      required: true,
    },
    // Total px the preview should fit inside (longer axis). The cell
    // size is computed from this and the map's larger dimension. Keep
    // it on the parent so the SavedMapsPage can choose a sensible value
    // for its layout without us pulling in a ResizeObserver.
    maxSize: {
      type: Number,
      default: 320,
    },
  },
  computed: {
    field() {
      // Tolerate either form: a full map JSON, or just the field array
      // passed directly (handy for tests).
      if (Array.isArray(this.map)) return this.map
      return this.map.field || []
    },
    width() {
      return this.field.length
    },
    height() {
      return this.field[0]?.length ?? 0
    },
    cellSize() {
      const longer = Math.max(this.width, this.height)
      if (!longer) return 0
      // Floor avoids sub-pixel layout drift that breaks the grid look.
      return Math.max(4, Math.floor(this.maxSize / longer))
    },
    containerStyle() {
      return {
        width: `${this.cellSize * this.width}px`,
        height: `${this.cellSize * this.height}px`,
      }
    },
  },
  methods: {
    getImagePath,
    cellStyle(cell) {
      const kind = cell?.terrain?.kind
      let idx = cell?.terrain?.idx ?? 1
      // Mountain assets only exist for idx 1..5 — the field generator
      // produces 1..9 and GameCell folds 6..9 back into 4..1 with the
      // mirror `idx = 10 - idx`. Mirror that here so the preview never
      // shows broken-image squares for mountains whose idx > 5.
      if (kind === 'mountain' && idx > 5) idx = 10 - idx
      const bg =
        kind === 'mountain' ? `url(/images/mountain${idx}.png)` : `url(/images/empty${idx}.png)`
      const style = {
        width: `${this.cellSize}px`,
        height: `${this.cellSize}px`,
        backgroundImage: bg,
        backgroundSize: 'cover',
        position: 'relative',
        boxSizing: 'border-box',
      }
      return style
    },
    buildingImage(building) {
      // Player-owned bases get the colored variant; neutral buildings
      // use the generic asset.
      if (building._type === 'base' && building.player !== null) {
        return `base${building.player + 1}`
      }
      return building._type
    },
    unitImage(unit) {
      // Units use dino1..dinoN asset by player order.
      const colorIdx = (unit.player ?? 0) + 1
      return `dino${colorIdx}`
    },
    getPlayerColor,
  },
}
</script>

<style scoped>
.map-preview {
  display: flex;
  flex-direction: row;
  border: 2px solid rgba(0, 0, 0, 0.4);
  background-color: rgba(0, 0, 0, 0.05);
}

.map-preview-col {
  display: flex;
  flex-direction: column;
}

.map-preview-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-preview-img {
  position: absolute;
  width: 90%;
  height: 90%;
  top: 5%;
  left: 5%;
}

.map-preview-unit {
  /* Render unit slightly above building so both are visible. */
  z-index: 1;
}
</style>
