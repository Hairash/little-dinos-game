<template>
  <div class="cell" :class="{'hidden': hidden, 'selected': selected, 'highlighted': highlighted}">
    <img
      class="terrainImg"
      :class="{'hidden': hidden}"
      :src="`/images/${terrain}.png`"
    >
    <GameBuilding v-if="building"
      :hidden="hidden"
      :image="getBuildingImg()"
      :width="width"
      :height="height"
    />
    <GameUnit v-if="unit"
      :hidden="hidden"
      :image="unit._type"
      :width="width"
      :height="height"
      :movePoints="unit.movePoints"
      :has-moved="unit.hasMoved"
      :showMovePoints="showMovePoints()"
    />
  </div>
</template>

<script>
import GameUnit from '@/components/GameUnit'
import GameBuilding from '@/components/GameBuilding'
import Models from '@/game/models'
import { TRANSITION_DELAY } from '@/game/const'

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
    currentPlayer: Number,
    hideEnemySpeed: Boolean,
  },
  data() {
    return {
      cssProps: {
        width: `${this.width}px`,
        height: `${this.height}px`,
        transitionBorder: `border ${TRANSITION_DELAY}s`,
        transitionOpacity: `opacity ${TRANSITION_DELAY}s`,
      },
    }
  },
  methods: {
    getBuildingImg() {
      let buildingImg = this.building._type;
      if (this.building.player !== null) buildingImg += `${this.building.player + 1}`;
      return buildingImg;
    },
    showMovePoints() {
      if (!this.hideEnemySpeed) return true;
      if (this.unit && this.unit.player === this.currentPlayer) return true;
      return false;
    },
  }
}
</script>

<style scoped>
div.cell {
  position: relative;
  display: inline-block;
  border: solid 1px;
  width: v-bind('cssProps.width');
  height: v-bind('cssProps.height');
  transition: v-bind('cssProps.transitionBorder');
}
div.cell.hidden {
  border: solid 1px black;
}
img.terrainImg {
  width: v-bind('cssProps.width');
  height: v-bind('cssProps.height');
  transition: v-bind('cssProps.transitionOpacity');
}
img.terrainImg.hidden {
  opacity: 0;
}
div.cell.selected {
  background-color: #42b983;
}
div.cell.highlighted {
  background-color: rgba(66, 185, 131, 0.5);
}
</style>
