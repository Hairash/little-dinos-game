<template>
  <div
    class="unitContainer"
    :class="{
      hidden: hidden,
      dying: dying,
      borning: borning,
      pendingBirth: pendingBirth,
    }"
  >
    <!-- Birth "sun": procedurally seeded ray-burst that grows from the
         cell centre out past the cell edge while the unit fades in. The
         conic gradient draws evenly-spaced spokes; a radial mask soft-
         edges them so the burst reads as a glow rather than a hard disc.
         Per-instance seed (rotation, ray count, ray width) keeps each
         birth visually distinct. -->
    <div v-if="borning" class="birthSun" :style="birthSunStyle"></div>
    <img
      class="unitImg"
      :style="{ width: calculatedWidth, height: calculatedHeight, left: left, top: top }"
      :src="getImagePath(image)"
    />
    <!-- Death animation: damage flash overlay shown over the dying unit.
         Sized like the unit; fades in instantly, stays visible while the
         unit fades out underneath it. -->
    <img
      v-if="dying"
      class="damageOverlay"
      :style="{ width: calculatedWidth, height: calculatedHeight, left: left, top: top }"
      :src="getImagePath('damage')"
    />
    <span
      v-if="width > 10 && !dying"
      class="movePointsLabel"
      :class="{ hasMoved: hasMoved }"
      :style="{
        fontSize: `${fontSize}px`,
        height: `${fontSize}px`,
        lineHeight: `${labelHeight}px`,
      }"
    >
      {{ showMovePoints ? movePoints : '*' }}
    </span>
  </div>
</template>

<script>
import { BIRTH_ANIMATION_DELAY, DEATH_ANIMATION_DELAY, TRANSITION_DELAY } from '@/game/const.js'
import { getImagePath } from '@/game/helpers.js'

export default {
  name: 'GameUnit',
  methods: {
    getImagePath,
  },
  props: {
    hidden: Boolean,
    width: Number,
    height: Number,
    image: String,
    movePoints: Number,
    hasMoved: Boolean,
    showMovePoints: Boolean,
    // True while the unit is "dying" — controller sets this for cells the
    // last move killed, holds it for `MOVE_ANIMATION_DELAY` ms, then removes
    // the unit from the field. The component renders a damage flash and
    // fades the unit image to 0 over the same window.
    dying: Boolean,
    // True while the unit is freshly spawning at start of turn. Controller
    // marks the cell for `BIRTH_ANIMATION_DELAY` ms while the CSS keyframe
    // fades the unit image from 0 to 1.
    borning: Boolean,
    // True for spawn cells that haven't started their fade-in yet — the
    // unit is on the field (so the cell isn't empty in game state) but
    // rendered at opacity 0 so the user sees an empty base. The controller
    // moves cells from `pendingBirth` to `borning` one at a time, so the
    // turn opens with all spawn cells empty and they appear sequentially.
    pendingBirth: Boolean,
  },
  data() {
    // Per-instance random seed for the birth sun. GameUnit is created
    // fresh whenever a unit spawns into an empty cell, so this is rolled
    // once per birth — every burst has a slightly different ray layout.
    // The silhouette is a clip-path polygon whose inner vertices sit close
    // to the centre (`innerRatio` small), producing thin triangular spikes
    // with gaps between them — the cell terrain is visible in the gaps.
    // Each outer point gets a small length jitter so the rays don't look
    // mechanically uniform.
    const pointCount = 7 + Math.floor(Math.random() * 4) // 7–10 rays
    const outerJitter = Array.from({ length: pointCount }, () => 0.85 + Math.random() * 0.15)
    return {
      birthSunSeed: {
        pointCount,
        rotationDeg: Math.random() * 360,
        // 0.22–0.4: valleys pulled back from the centre give each ray a
        // thicker base so they read as broad sunbeams instead of thin
        // spokes, while still leaving visible gaps between them.
        innerRatio: 0.22 + Math.random() * 0.18,
        outerJitter,
      },
      cssProps: {
        // width: `${this.width * 0.9}px`,
        // height: `${this.height * 0.9}px`,
        // left: `${this.width * 0.05}px`,
        // top: `${this.height * 0.05}px`,
        // fontSize: `${fontSize}px`,
        // labelHeight: `${labelHeight}px`,
        transitionOpacity: `opacity ${TRANSITION_DELAY}s`,
        // Death animation duration. The controller holds the `dying` flag
        // for the same window before actually removing the unit from the
        // field, so the keyframes finish exactly when the unit is gone.
        deathDuration: `${DEATH_ANIMATION_DELAY}ms`,
        // Birth animation duration — same window as the controller holds
        // `borning` so the fade-in finishes exactly when the flag clears.
        birthDuration: `${BIRTH_ANIMATION_DELAY}ms`,
      },
    }
  },
  computed: {
    calculatedWidth() {
      return `${this.width * 0.9}px`
    },
    calculatedHeight() {
      return `${this.height * 0.9}px`
    },
    left() {
      return `${this.width * 0.05}px`
    },
    top() {
      return `${this.height * 0.05}px`
    },
    fontSize() {
      return this.width * 0.3
    },
    labelHeight() {
      // if (this.fontSize > 9) return this.fontSize + 2;
      // if (this.fontSize > 6) return this.fontSize + 1;
      return this.fontSize + 1
    },
    // Inline style for the birth sun. Sized to ~130% of the cell so the
    // ray tips poke into the neighbouring cells without sprawling far
    // beyond. The clip-path polygon is generated from the per-instance
    // seed: outer vertices (with a touch of length jitter) sit near the
    // bounding box, inner vertices sit close to the centre, producing thin
    // triangular spikes with the cell terrain visible in the gaps.
    birthSunStyle() {
      const { pointCount, rotationDeg, innerRatio, outerJitter } = this.birthSunSeed
      const sunSize = 1.3
      const offset = (1 - sunSize) / 2 // -0.15
      const rotation = (rotationDeg * Math.PI) / 180
      const totalVertices = pointCount * 2
      const points = []
      for (let i = 0; i < totalVertices; i++) {
        const angle = (i / totalVertices) * Math.PI * 2 + rotation
        const isOuter = i % 2 === 0
        const r = isOuter ? outerJitter[i / 2] : innerRatio
        const x = 50 + r * Math.cos(angle) * 50
        const y = 50 + r * Math.sin(angle) * 50
        points.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`)
      }
      const clipPath = `polygon(${points.join(', ')})`
      return {
        width: `${this.width * sunSize}px`,
        height: `${this.height * sunSize}px`,
        left: `${this.width * offset}px`,
        top: `${this.height * offset}px`,
        clipPath,
        WebkitClipPath: clipPath,
      }
    },
  },
}
</script>

<style scoped>
div.unitContainer {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  transition: v-bind('cssProps.transitionOpacity');
}
div.unitContainer.hidden {
  opacity: 0;
}
img.unitImg {
  /*width: v-bind('cssProps.width');*/
  /*height: v-bind('cssProps.height');*/
  position: absolute;
  /*left: v-bind('cssProps.left');*/
  /*top: v-bind('cssProps.top');*/
  /* Sit above the birth-sun ray burst (z-index 0) so the dino reads
   * as appearing in front of the rays, not behind them. */
  z-index: 1;
}
span.movePointsLabel {
  position: absolute;
  right: 2px;
  bottom: 2px;
  z-index: 1;
  /*font-size: v-bind('cssProps.fontSize');*/
  font-weight: bold;
  background-color: white;
  border-radius: 4px;
  /*height: v-bind('cssProps.fontSize');*/
  padding-left: 1px;
  padding-right: 1px;
  /*line-height: v-bind('cssProps.labelHeight');*/
  user-select: none;
}
span.movePointsLabel.hasMoved {
  background-color: darkred;
  color: #dddddd;
}

/* Death animation. Damage flash appears immediately (full opacity from
 * frame 0) so the user sees the hit before the fade-out begins. The unit
 * image lingers at full opacity for the first ~30% of the window (so the
 * damage overlay reads as "first") then fades to 0 over the rest. Both
 * cells are removed from the field by the controller after the same
 * duration, so the keyframes "lock in" their final state with `forwards`. */
div.unitContainer.dying img.unitImg {
  animation: dinoDeathFade v-bind('cssProps.deathDuration') forwards;
}
img.damageOverlay {
  position: absolute;
  pointer-events: none;
  z-index: 2;
  animation: damageFlash v-bind('cssProps.deathDuration') forwards;
}
@keyframes dinoDeathFade {
  0% {
    opacity: 1;
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
@keyframes damageFlash {
  0% {
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

/* Birth animation: the dino fades in fast over BIRTH_ANIMATION_DELAY
 * while a procedural sun-ray burst (`.birthSun` below) grows past the
 * cell edge behind it. `forwards` locks the unit at full opacity once
 * the keyframe ends — the controller may clear the flag a frame later
 * but there's no blink. */
div.unitContainer.borning img.unitImg {
  animation: dinoBirthFade v-bind('cssProps.birthDuration') ease-out forwards;
}
@keyframes dinoBirthFade {
  0% {
    opacity: 0;
    transform: scale(0.6);
  }
  60% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* The sun: a star with a handful of triangular rays radiating from the
 * centre (silhouette set by the inline clip-path). The radial gradient
 * keeps the inner core bright white and tapers the rays to a soft, semi-
 * transparent tip so they read as light beams rather than a solid star.
 *
 * Scales from a pinprick at the cell centre out to ~130% of the cell,
 * pops to peak opacity, holds briefly, then fades as the dino settles
 * in front. `filter: drop-shadow` paints a soft halo around the clipped
 * silhouette (background blur would get clipped) — gives the rays a
 * faint glow instead of looking like cut-out construction paper. */
div.birthSun {
  position: absolute;
  pointer-events: none;
  z-index: 0;
  transform-origin: center center;
  background: radial-gradient(
    circle,
    #ffffff 0%,
    #ffffff 55%,
    rgba(255, 252, 235, 0.92) 80%,
    rgba(255, 240, 170, 0.45) 100%
  );
  filter: drop-shadow(0 0 4px rgba(255, 240, 180, 0.7));
  animation: birthSunBurst v-bind('cssProps.birthDuration') ease-out forwards;
}
@keyframes birthSunBurst {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  25% {
    transform: scale(1);
    opacity: 1;
  }
  55% {
    opacity: 0.9;
  }
  100% {
    transform: scale(1.1);
    opacity: 0;
  }
}

/* Pending-birth: the unit is on the field but its turn to fade in hasn't
 * come yet. Hold at opacity 0 (no animation) until the controller swaps
 * the class for `borning`. */
div.unitContainer.pendingBirth img.unitImg {
  opacity: 0;
}
</style>
