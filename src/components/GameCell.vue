<template>
  <div class="cell">
    <img class="terrainImg" :class="{'selected': selected}" :src="`/images/${terrain}.png`">
    <GameUnit v-if="unit"
      :image="unit._type"
      :width="width"
      :height="height"
      :movePoints="unit.movePoints"
      :has-moved="unit.hasMoved"
    />
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
    selected: Boolean,
  },
  data() {
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
img.terrainImg {
  /*border: solid 0.1px;*/
  width: v-bind('cssProps.width');
  height: v-bind('cssProps.height');
}
img.terrainImg.selected {
  background-color: #42b983;
}
</style>
