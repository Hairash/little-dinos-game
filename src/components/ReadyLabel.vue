<template>
  <div class="fixed-label">
    <div>
      <div>
        Player {{currentPlayer + 1}}, get ready!<br>
        Your color:
        <img class="curPlayerImage" :src="`/images/dino${currentPlayer + 1}.png`">
      </div>
      <div>
        <button type="button" @click="onClickAction">Ready</button>
      </div>
    </div>
  </div>
</template>

<script>
import Models from '@/game/models';

export default {
  name: 'ReadyLabel',
  props: {
    player: Models.Player,
    currentPlayer: Number,
    onClickAction: Function,
  },
};
</script>

<style scoped>
div.fixed-label {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 1);
  color: white;
  font-size: 2rem;
  z-index: 1000;
}

img.curPlayerImage {
  width: 35px;
  height: 35px;
  position: relative;
  top: 5px;
}
</style>
