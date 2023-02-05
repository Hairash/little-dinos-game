<template>
  <div class="cell">
    <img :src="`/images/${terrain}.png`">
    <GameUnit v-if="unit" :image="unit._type" :width="width" :height="height"/>
  </div>
</template>

<script>
import Unit from '../game/engine'
import GameUnit from './GameUnit'

export default {
  name: "GameCell",
  components: {
    GameUnit,
  },
  props: {
    width: Number,
    height: Number,
    terrain: String,
    unit: Unit,
  },
  data() {
    if (this.unit) console.log(this.unit._type);
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
  position: relative;
  display: inline-block;
  border: solid 0.1px;
  width: v-bind('cssProps.width');
  height: v-bind('cssProps.height');
}
img {
  /*border: solid 0.1px;*/
  width: v-bind('cssProps.width');
  height: v-bind('cssProps.height');
}
</style>