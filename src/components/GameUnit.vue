<template>
  <img class="unitImg" :src="`/images/${image}.png`">
  <span class="movePointsLabel" :class="{'hasMoved': hasMoved}">{{movePoints}}</span>
</template>

<script>
export default {
  name: "GameUnit",
  props: {
    width: Number,
    height: Number,
    image: String,
    movePoints: Number,
    hasMoved: Boolean,
  },
  data() {
    return {
      cssProps: {
        width: `${this.width * 0.6}px`,
        height: `${this.height * 0.6}px`,
        left: `${this.width * 0.2}px`,
        top: `${this.height * 0.2}px`,
      },
    }
  },
}
</script>

<style scoped>
img.unitImg {
  width: v-bind('cssProps.width');
  height: v-bind('cssProps.height');
  position: absolute;
  left: v-bind('cssProps.left');
  top: v-bind('cssProps.top');
}
span.movePointsLabel {
  position: absolute;
  right: 5px;
  bottom: 2px;
}
span.movePointsLabel.hasMoved {
  color: darkred;
}
</style>
