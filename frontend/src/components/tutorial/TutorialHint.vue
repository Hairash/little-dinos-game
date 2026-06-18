<template>
  <div
    class="tutorial-hint-wrapper"
    :class="finalAnchorClass"
    :style="finalCellPos ? cellPositionStyle : null"
  >
    <div
      class="tutorial-hint"
      :class="{ 'has-shift': clickable }"
      @click="toggleShift"
    >
      <img
        v-if="imageSrc"
        class="tutorial-hint-image"
        :src="imageSrc"
        :alt="image"
      />
      <div class="tutorial-hint-text">{{ text }}</div>
      <div v-if="hintNote" class="tutorial-hint-note">{{ hintNote }}</div>
      <div v-if="showOk" class="tutorial-hint-actions">
        <button
          type="button"
          class="tutorial-hint-btn"
          @click.stop="$emit('ok')"
        >
          OK
        </button>
      </div>
      <div v-else class="tutorial-hint-waiting">
        <span class="tutorial-hint-dot"></span>
        <span class="tutorial-hint-dot"></span>
        <span class="tutorial-hint-dot"></span>
      </div>
    </div>
  </div>
</template>

<script>
import { getImagePath } from '@/game/helpers'

export default {
  name: 'TutorialHint',
  props: {
    text: { type: String, required: true },
    // Short note appended below the main text in a smaller, dimmer style.
    // Used to add "(click message to move it)" without bloating the
    // primary instruction.
    hintNote: { type: String, default: '' },
    anchor: { type: String, default: 'center' },
    // Optional: pin the hint next to a specific board cell. The component
    // looks up the rendered cell by its `data-cell-x` / `data-cell-y`
    // attributes and recomputes its on-screen position as the grid scrolls
    // or the window resizes.
    anchorCell: { type: Array, default: null },
    // Optional illustrative image (resolved through getImagePath so WebP
    // is used when supported). Typically a building or unit token — e.g.
    // 'habitation', 'storage', 'temple', 'well', 'base', 'dino1'.
    image: { type: String, default: '' },
    showOk: { type: Boolean, default: false },
  },
  emits: ['ok'],
  data() {
    return {
      // True once the player has clicked the message to push it out of
      // the way. Resets when the bound step (and thus this component
      // instance, via :key) changes.
      shifted: false,
      cellPos: null, // { left, top } in viewport pixels for the cell anchor
      scrollListener: null,
      scrollContainer: null,
    }
  },
  computed: {
    // Click-to-move is enabled for hints that carry the "click to move"
    // note — i.e. field-interaction tasks where the message might overlap
    // a cell or unit the player needs to reach. Informational OK steps
    // dismiss themselves with the OK button, so they stay non-shiftable.
    clickable() {
      return !!this.hintNote
    },
    finalCellPos() {
      if (this.shifted) return null
      if (!this.anchorCell) return null
      return this.cellPos
    },
    finalAnchorClass() {
      // Shifted hints always go to one of the screen edges so they
      // can't possibly overlap whatever the player is trying to click.
      if (this.shifted) {
        return this.isOriginallyTop() ? 'anchor-bottom' : 'anchor-top'
      }
      if (this.anchorCell) return 'anchor-cell'
      const allowed = [
        'center',
        'top',
        'bottom',
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
        'near-end-turn',
        'near-undo',
        'near-next-unit',
        'near-menu',
      ]
      const a = allowed.includes(this.anchor) ? this.anchor : 'center'
      return `anchor-${a}`
    },
    imageSrc() {
      return this.image ? getImagePath(this.image) : ''
    },
    cellPositionStyle() {
      if (!this.cellPos) return { visibility: 'hidden' }
      return {
        left: `${this.cellPos.left}px`,
        top: `${this.cellPos.top}px`,
      }
    },
  },
  watch: {
    anchorCell() {
      this.recomputeCellPosition()
    },
  },
  mounted() {
    if (this.anchorCell) {
      this.attachCellAnchorListeners()
      this.$nextTick(() => this.recomputeCellPosition())
    }
  },
  beforeUnmount() {
    this.detachCellAnchorListeners()
  },
  methods: {
    toggleShift() {
      if (!this.clickable) return
      this.shifted = !this.shifted
    },
    isOriginallyTop() {
      // Cell anchor: decide based on the cell's current viewport pos.
      if (this.anchorCell && this.cellPos) {
        return this.cellPos.top < window.innerHeight / 2
      }
      const a = this.anchor
      return a === 'top' || a === 'top-left' || a === 'top-right' || a === 'center'
    },
    attachCellAnchorListeners() {
      this.scrollContainer = document.querySelector('.game-grid-container')
      this.scrollListener = () => this.recomputeCellPosition()
      if (this.scrollContainer) {
        this.scrollContainer.addEventListener('scroll', this.scrollListener, { passive: true })
      }
      window.addEventListener('resize', this.scrollListener)
    },
    detachCellAnchorListeners() {
      if (this.scrollContainer && this.scrollListener) {
        this.scrollContainer.removeEventListener('scroll', this.scrollListener)
      }
      if (this.scrollListener) {
        window.removeEventListener('resize', this.scrollListener)
      }
      this.scrollListener = null
      this.scrollContainer = null
    },
    recomputeCellPosition() {
      if (!this.anchorCell) {
        this.cellPos = null
        return
      }
      const [x, y] = this.anchorCell
      const cellEl = document.querySelector(`.cell[data-cell-x="${x}"][data-cell-y="${y}"]`)
      if (!cellEl) {
        this.cellPos = null
        return
      }
      const rect = cellEl.getBoundingClientRect()
      const hintWidth = 320
      const margin = 12
      // Default: place the hint below the cell. If that overflows the
      // viewport, place above instead. Same idea for horizontal centring.
      let left = rect.left + rect.width / 2 - hintWidth / 2
      left = Math.max(margin, Math.min(window.innerWidth - hintWidth - margin, left))
      let top = rect.bottom + margin
      const estimatedHeight = 130
      if (top + estimatedHeight > window.innerHeight - 70) {
        top = rect.top - margin - estimatedHeight
      }
      this.cellPos = { left, top: Math.max(margin, top) }
    },
  },
}
</script>

<style scoped>
.tutorial-hint-wrapper {
  position: fixed;
  z-index: 10050;
  pointer-events: none;
  display: flex;
  padding: 16px;
}

.tutorial-hint {
  pointer-events: auto;
  background-color: rgba(0, 0, 0, 0.88);
  border: 2px solid #d8a67e;
  border-radius: 10px;
  color: #ffffff;
  padding: 14px 18px;
  font-size: 16px;
  line-height: 1.4;
  max-width: 320px;
  min-width: 200px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55);
  text-align: center;
  font-family: inherit;
}

.tutorial-hint.has-shift {
  cursor: pointer;
}

.tutorial-hint-image {
  display: block;
  width: 56px;
  height: 56px;
  margin: 0 auto 8px;
  object-fit: contain;
  image-rendering: pixelated;
  user-select: none;
}

.tutorial-hint-text {
  margin-bottom: 10px;
  white-space: pre-line;
}

.tutorial-hint-note {
  margin: -4px 0 10px;
  font-size: 12px;
  opacity: 0.7;
  font-style: italic;
  white-space: pre-line;
}

.tutorial-hint-actions {
  display: flex;
  justify-content: center;
}

.tutorial-hint-btn {
  background-color: transparent;
  background-image: url('/images/long_setup_btn_clean.png');
  background-size: 100% 100%;
  border: 0;
  padding: 6px 22px;
  font-family: inherit;
  font-size: 16px;
  font-weight: bold;
  color: #ffffff;
  cursor: pointer;
  text-shadow: 1px 1px 2px #000;
}


.tutorial-hint-waiting {
  display: flex;
  justify-content: center;
  gap: 4px;
  height: 12px;
  align-items: center;
}

.tutorial-hint-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #d8a67e;
  animation: tutorial-dot-pulse 1.2s ease-in-out infinite;
}

.tutorial-hint-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.tutorial-hint-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes tutorial-dot-pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* Static anchors */
.anchor-center {
  inset: 0;
  align-items: center;
  justify-content: center;
}
.anchor-top {
  top: 0;
  left: 0;
  right: 0;
  justify-content: center;
}
.anchor-bottom {
  bottom: 60px;
  left: 0;
  right: 0;
  justify-content: center;
}
.anchor-top-left {
  top: 0;
  left: 0;
}
.anchor-top-right {
  top: 0;
  right: 0;
}
.anchor-bottom-left {
  bottom: 60px;
  left: 0;
}
.anchor-bottom-right {
  bottom: 60px;
  right: 0;
}

/* Button-targeted anchors. The InfoPanel is fixed at bottom-centre with
 * max-width 400px. Each button sits at a known x-offset inside the panel,
 * so we anchor against `50vw` (panel centre) and let `max()` keep the
 * hint on-screen for narrow viewports. */
.anchor-near-menu {
  bottom: 50px;
  left: max(8px, calc(50vw - 260px));
}
.anchor-near-undo {
  bottom: 50px;
  left: max(8px, calc(50vw - 220px));
}
.anchor-near-next-unit {
  bottom: 50px;
  left: 0;
  right: 0;
  justify-content: center;
}
.anchor-near-end-turn {
  bottom: 50px;
  right: max(8px, calc(50vw - 260px));
}

/* Cell anchor uses inline left/top from cellPositionStyle. */
.anchor-cell {
  padding: 0;
}
</style>
