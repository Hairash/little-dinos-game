<template>
  <div class="unitContainer" :class="{'hidden': hidden}">
    <img class="unitImg" :src="`/images/${image}.png`">
    <span class="movePointsLabel" :class="{'hasMoved': hasMoved}">{{movePoints}}</span>
  </div>
</template>

<script>
import { TRANSITION_DELAY } from '@/game/const'

export default {
  name: "GameUnit",
  props: {
    hidden: Boolean,
    width: Number,
    height: Number,
    image: String,
    movePoints: Number,
    hasMoved: Boolean,
  },
  data() {
    const fontSize = Math.max(this.width * 0.3, 12);
    const labelHeight = fontSize + 2;
    return {
      cssProps: {
        width: `${this.width * 0.6}px`,
        height: `${this.height * 0.6}px`,
        left: `${this.width * 0.2}px`,
        top: `${this.height * 0.2}px`,
        fontSize: `${fontSize}px`,
        labelHeight: `${labelHeight}px`,
        transitionOpacity: `opacity ${TRANSITION_DELAY}s`,
      },
    }
  },
}
</script>

<style scoped>
div.unitContainer {
  transition: v-bind('cssProps.transitionOpacity');
}
div.unitContainer.hidden {
  opacity: 0;
}
img.unitImg {
  width: v-bind('cssProps.width');
  height: v-bind('cssProps.height');
  position: absolute;
  left: v-bind('cssProps.left');
  top: v-bind('cssProps.top');
}
span.movePointsLabel {
  position: absolute;
  right: 2px;
  bottom: 2px;
  font-size: v-bind('cssProps.fontSize');
  font-weight: bold;
  background-color: white;
  border-radius: 4px;
  height: v-bind('cssProps.fontSize');
  padding-left: 1px;
  padding-right: 1px;
  line-height: v-bind('cssProps.labelHeight');
}
span.movePointsLabel.hasMoved {
  background-color: darkred;
  color: #DDDDDD;
}
</style>
