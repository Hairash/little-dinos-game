<template>
  <img :src="`/images/${terrain}.png`">
<!--  <GameUnit />-->
</template>

<script>
import Unit from '../game/engine'
// import GameUnit from './GameUnit'

export default {
  name: "GameCell",
  components: {
    // GameUnit,
  },
  props: {
    width: Number,
    height: Number,
    terrain: String,
    unit: Unit,
  },
  data() {
    console.log(this.terrain);
    return {
      cssProps: {
        width: `${this.width}px`,
        height: `${this.height}px`,
      },
    }
  }
}
</script>

<style scoped>
div {
  display: inline-block;
  border: solid 1px;
  width: v-bind('cssProps.width');
  height: v-bind('cssProps.height');
}
img {
  width: v-bind('cssProps.width');
  height: v-bind('cssProps.height');
}
</style>