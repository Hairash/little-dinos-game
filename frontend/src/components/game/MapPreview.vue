<template>
  <div class="map-preview" :style="containerStyle">
    <div v-for="(col, x) in field" :key="x" class="map-preview-col">
      <div
        v-for="(cell, y) in col"
        :key="y"
        class="map-preview-cell"
        :class="{ 'map-preview-cell-fog': !isVisible(x, y) }"
        :style="cellStyle(cell, x, y)"
      >
        <img
          v-if="cell.building && isVisible(x, y)"
          class="map-preview-img"
          :src="getImagePath(buildingImage(cell.building))"
          :alt="cell.building._type"
          loading="lazy"
        />
        <img
          v-if="cell.unit && isVisible(x, y)"
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
import { calculateUnitVisibility, getImagePath, getPlayerColor } from '@/game/helpers'

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
    // When set (and the map has fog of war enabled), only cells
    // visible to THIS player at the start of the scenario are rendered
    // normally; the rest are drawn as fog so the preview doesn't spoil
    // the layout. Null means "show everything" (saved-maps browser,
    // map editor, etc.).
    viewingPlayer: {
      type: Number,
      default: null,
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
    settings() {
      return this.map?.settings || null
    },
    // Set of "x,y" strings reachable from the viewing player's
    // starting units and bases. Null means "no masking" — either the
    // map has fog off, the field array was passed directly (no
    // settings), or no viewing player was provided.
    //
    // Mirrors `FieldEngine.getCurrentVisibilitySet` + `DinoGame`'s
    // initialMap rehydration: each unit's visibility comes from its
    // own movePoints/visibility if set, otherwise from the global
    // minSpeed (the value DinoGame reseeds unit speeds to). Bases
    // contribute `fogOfWarRadius`. Visibility uses Chebyshev distance
    // (`max(|dx|, |dy|)`), same as the engine.
    visibleSet() {
      if (this.viewingPlayer === null) return null
      const s = this.settings
      if (!s || !s.enableFogOfWar) return null
      const field = this.field
      const w = this.width
      const h = this.height
      if (!w || !h) return null
      const fogR = s.fogOfWarRadius ?? 3
      const minSpeed = s.minSpeed ?? 1
      const threshold = s.speedMinVisibility ?? 7
      const set = new Set()
      for (let x = 0; x < w; x++) {
        const col = field[x]
        if (!col) continue
        for (let y = 0; y < h; y++) {
          const cell = col[y]
          if (!cell) continue
          const owns = obj => obj && obj.player === this.viewingPlayer
          const hasUnit = owns(cell.unit)
          const hasBase = cell.building && cell.building._type === 'base' && owns(cell.building)
          if (!hasUnit && !hasBase) continue
          let radius = 0
          if (hasUnit) {
            // Mirrors what DinoGame produces at scenario start: prefer
            // an explicit `visibility`/`movePoints` from the canonical
            // map; otherwise default the speed to `minSpeed` and
            // derive visibility from it (or `fogOfWarRadius` directly
            // when the relation is off).
            let unitVis = cell.unit.visibility
            if (!unitVis) {
              // `>= 0` honours an explicit speed-0 (immobile) dino; only
              // a missing/non-numeric movePoints falls back to minSpeed.
              const speed =
                typeof cell.unit.movePoints === 'number' && cell.unit.movePoints >= 0
                  ? cell.unit.movePoints
                  : minSpeed
              // DinoGame/createFieldEngine collapse min=max to the unit's
              // own starting speed (createNewUnit(player, speed, speed,…)),
              // so pass `speed` as the min too — otherwise a speed-0 dino
              // would preview a different radius than it gets in-game.
              unitVis = s.visibilitySpeedRelation
                ? calculateUnitVisibility(speed, speed, threshold, fogR)
                : fogR
            }
            radius = Math.max(radius, unitVis)
          }
          if (hasBase) radius = Math.max(radius, fogR)
          const x0 = Math.max(0, x - radius)
          const x1 = Math.min(w - 1, x + radius)
          const y0 = Math.max(0, y - radius)
          const y1 = Math.min(h - 1, y + radius)
          for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) set.add(`${cx},${cy}`)
          }
        }
      }
      return set
    },
  },
  methods: {
    getImagePath,
    isVisible(x, y) {
      // No mask configured (or fog disabled) → every cell renders.
      if (this.visibleSet === null) return true
      return this.visibleSet.has(`${x},${y}`)
    },
    cellStyle(cell, x, y) {
      const visible = this.isVisible(x, y)
      const base = {
        width: `${this.cellSize}px`,
        height: `${this.cellSize}px`,
        position: 'relative',
        boxSizing: 'border-box',
      }
      if (!visible) {
        // Drop the terrain image; the `.map-preview-cell-fog` class
        // paints the dark fill that replaces it.
        return base
      }
      const kind = cell?.terrain?.kind
      let idx = cell?.terrain?.idx ?? 1
      // Mountain assets only exist for idx 1..5 — the field generator
      // produces 1..9 and GameCell folds 6..9 back into 4..1 with the
      // mirror `idx = 10 - idx`. Mirror that here so the preview never
      // shows broken-image squares for mountains whose idx > 5.
      if (kind === 'mountain' && idx > 5) idx = 10 - idx
      const bg =
        kind === 'mountain' ? `url(/images/mountain${idx}.png)` : `url(/images/empty${idx}.png)`
      return {
        ...base,
        backgroundImage: bg,
        backgroundSize: 'cover',
      }
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

/* Fogged cells in the scenarios picker — solid dark fill so the
   preview doesn't spoil the layout of fog-of-war scenarios. Same
   slate the in-game `GameGrid`'s `.board` uses for hidden cells. */
.map-preview-cell-fog {
  background-color: #000000;
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
