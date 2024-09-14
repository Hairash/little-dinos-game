<template>
  <div class="cell"
    :class="{'hidden': hidden, 'selected': selected, 'highlighted': highlighted}"
    :style="{ width: `${width}px`, height: `${height}px` }"
  >
    <img
      class="terrainImg"
      :class="{'hidden': hidden}"
      :src="getTerrainImg()"
      :style="{ width: `${width}px`, height: `${height}px`, transition: transitionOpacity }"
    >
    <div
      class="cellSelection"
      :class="{'selected': selected, 'highlighted': highlighted}"
      :style="{ width: `${width}px`, height: `${height}px` }"
    >
    </div>
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
    terrain: Object,
    unit: Models.Unit,
    building: Models.Building,
    selected: Boolean,
    highlighted: Boolean,
    hidden: Boolean,
    currentPlayer: Number,
    hideEnemySpeed: Boolean,
  },
  computed: {
    transitionOpacity() {
      return `opacity ${TRANSITION_DELAY}s`;
    },
  },
  // data() {
  //   return {
  //     cssProps: {
  //       width: `${this.width}px`,
  //       height: `${this.height}px`,
  //       transitionBorder: `border ${TRANSITION_DELAY}s`,
  //       transitionOpacity: `opacity ${TRANSITION_DELAY}s`,
  //     },
  //   }
  // },
  methods: {
    getTerrainImg() {
      if (this.terrain.kind === Models.TerrainTypes.MOUNTAIN) {
        let idx = this.terrain.idx;
        if (idx > 5) idx = 10 - idx;
        return `/images/${this.terrain.kind}${idx}.png`
      }
      // const idx = Math.ceil(Math.random() * 4);
      // console.log('terrain idx', idx);
      return `/images/${this.terrain.kind}${this.terrain.idx}.png`
    },
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
  /*border: solid 1px;*/
  /*transition: v-bind('cssProps.transitionBorder');*/
}
/*div.cell.hidden {*/
/*  !*border: solid 1px black;*!*/
/*}*/
img.terrainImg {
  vertical-align: top;
}
img.terrainImg.hidden {
  opacity: 0;
}
div.cell .cellSelection {
  position: absolute;
  left: 0;
  top: 0;
  /*transition: v-bind('cssProps.transitionBorder');*/
}
div.cell .cellSelection.selected {
  background-color: #42b983;
}
div.cell .cellSelection.highlighted {
  background-color: rgba(66, 185, 131, 0.5);
}
</style>
