<template>
  <img class="buildingImg" :src="`/images/${image}.png`">
</template>

<script>
export default {
  name: "GameUnit",
  props: {
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
}
</style>
