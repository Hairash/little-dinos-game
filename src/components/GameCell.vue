<template>
  <div class="cell" :class="{'hidden': hidden, 'selected': selected, 'highlighted': highlighted}">
    <img v-if="!hidden"
      class="terrainImg"
      :src="`/images/${terrain}.png`"
    >
    <GameBuilding v-if="!hidden && building"
      :image="getBuildingImg()"
      :width="width"
      :height="height"
    />
    <GameUnit v-if="!hidden && unit"
      :image="unit._type"
      :width="width"
      :height="height"
      :movePoints="unit.movePoints"
      :has-moved="unit.hasMoved"
    />
  </div>
</template>

<script>
import Models from '../game/models'
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
    unit: Models.Unit,
    building: Models.Building,
    selected: Boolean,
    highlighted: Boolean,
    hidden: Boolean,
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
div.cell {
  position: relative;
  display: inline-block;
  border: solid 0.1px;
  width: v-bind('cssProps.width');
  height: v-bind('cssProps.height');
}
div.cell.hidden {
  border: 0;
}
img.terrainImg {
  /*border: solid 0.1px;*/
  width: v-bind('cssProps.width');
  height: v-bind('cssProps.height');
}
div.cell.selected {
  background-color: #42b983;
}
div.cell.highlighted {
  background-color: rgba(66, 185, 131, 0.5);
}
</style>
