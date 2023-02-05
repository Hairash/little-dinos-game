<template>
  <img :src="`/images/${image}.png`">
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
        width: `${this.width}px`,
        height: `${this.height}px`,
      },
    }
  },
}
</script>

<style scoped>
img {
  width: v-bind('cssProps.width');
  height: v-bind('cssProps.height');
  position: absolute;
  left: 0;
}
</style>