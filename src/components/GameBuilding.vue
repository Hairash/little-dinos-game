<template>
  <img class="buildingImg" :class="{'hidden': hidden}" :src="`/images/${image}.png`">
</template>

<script>
import { TRANSITION_DELAY } from '@/game/const'

export default {
  name: "GameBuilding",
  props: {
    hidden: Boolean,
    width: Number,
    height: Number,
    image: String,
  },
  data() {
    return {
      cssProps: {
        width: `${this.width * 0.9}px`,
        height: `${this.height * 0.9}px`,
        left: `${this.width * 0.05}px`,
        top: `${this.height * 0.05}px`,
        transitionOpacity: `opacity ${TRANSITION_DELAY}s`,
      },
    }
  },
}
</script>

<style scoped>
img.buildingImg {
  width: v-bind('cssProps.width');
  height: v-bind('cssProps.height');
  position: absolute;
  left: v-bind('cssProps.left');
  top: v-bind('cssProps.top');
  transition: v-bind('cssProps.transitionOpacity');
}
img.buildingImg.hidden {
  opacity: 0;
}
</style>
