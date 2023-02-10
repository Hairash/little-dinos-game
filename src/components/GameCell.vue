<template>
  <div class="cell">
    <img class="terrainImg" :class="{'selected': selected}" :src="`/images/${terrain}.png`">
    <GameBuilding v-if="building"
      :image="getBuildingImg()"
      :width="width"
      :height="height"
    />
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
import Engine from '../game/engine'
import GameUnit from './GameUnit'
import GameBuilding from './GameBuilding'

export default {
  name: "GameCell",
  components: {
    GameUnit,
    GameBuilding,
  },
  props: {
    width: Number,
    height: Number,
    terrain: String,
    unit: Engine.Unit,
    building: Engine.Building,
    selected: Boolean,
  },
  data() {
    return {
      cssProps: {
        width: `${this.width}px`,
        height: `${this.height}px`,
      },
    }
  },
  methods: {
    getBuildingImg() {
      let buildingImg = this.building._type;
      if (this.building.player !== null) buildingImg += `${this.building.player + 1}`;
      return buildingImg;
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
