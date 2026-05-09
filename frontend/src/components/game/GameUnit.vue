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
    // const fontSize = Math.max(this.width * 0.3, 12);
    // const labelHeight = fontSize + 2;
    return {
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
}
span.movePointsLabel {
  position: absolute;
  right: 2px;
  bottom: 2px;
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

/* Birth animation: simple fade-in from fully transparent to fully solid
 * over BIRTH_ANIMATION_DELAY. `forwards` keeps the unit at full opacity
 * once the keyframe finishes — even if the controller's flag clears a
 * frame later, there's no blink. */
div.unitContainer.borning img.unitImg {
  animation: dinoBirthFade v-bind('cssProps.birthDuration') forwards;
}
@keyframes dinoBirthFade {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
/* Pending-birth: the unit is on the field but its turn to fade in hasn't
 * come yet. Hold at opacity 0 (no animation) until the controller swaps
 * the class for `borning`. */
div.unitContainer.pendingBirth img.unitImg {
  opacity: 0;
}
</style>
