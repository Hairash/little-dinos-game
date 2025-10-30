<template>
  <div class="unitContainer" :class="{'hidden': hidden}">
    <img
      class="unitImg"
      :style="{ width: calculatedWidth, height: calculatedHeight, left: left, top: top }"
      :src="`/images/${image}.png`"
    >
    <span
      v-if="width > 10"
      class="movePointsLabel"
      :class="{'hasMoved': hasMoved}"
      :style="{ fontSize: `${fontSize}px`, height: `${fontSize}px`, lineHeight: `${labelHeight}px` }"
    >
      {{showMovePoints ? movePoints : '*'}}
    </span>
  </div>
</template>

<script>
import { TRANSITION_DELAY } from '@/game/const.js'

export default {
  name: "GameUnit",
  props: {
    hidden: Boolean,
    width: Number,
    height: Number,
    image: String,
    movePoints: Number,
    hasMoved: Boolean,
    showMovePoints: Boolean,
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
      },
    }
  },
  computed: {
    calculatedWidth() {
      return `${this.width * 0.9}px`;
    },
    calculatedHeight() {
      return `${this.height * 0.9}px`;
    },
    left() {
      return `${this.width * 0.05}px`;
    },
    top() {
      return `${this.height * 0.05}px`;
    },
    fontSize() {
      return this.width * 0.3;
    },
    labelHeight() {
      // if (this.fontSize > 9) return this.fontSize + 2;
      // if (this.fontSize > 6) return this.fontSize + 1;
      return this.fontSize + 1;
    }
  }
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
  color: #DDDDDD;
}
</style>
