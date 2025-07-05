<template>
  <div id="contentWrapper">
    <div id="buttonWrapper">
      <button
        type="button"
        class="goBackBtn"
        @click="handleBackBtnClick"
      >
        <img :src="`/images/arrow_white.png`">
      </button>
      <div id="contentBlock">
        <h1>Game rules</h1>
        <h3>Summary</h3>
        <div class="textBlock">
          🌿 At the start of each turn, every empty tower of your color spawns a new dino with a random speed.<br>
          🌿 At the end of dino's move all adjacent enemy dinos (4 directions) die.<br>
          🌿 If your dino comes to an enemy tower, it becomes yours.<br>
          🌿 You can move any number of your dinos each turn.<br>
          🌿 A dino can move a number of cells up to its speed during a turn.<br>
          🌿 Rocks and other dinos block movement.<br>
          🌿 You should eliminate all other players to win.<br>
        </div>
        <br>
        <h3>Description</h3>
        <div class="textBlock">
          It is a simple turn-based strategy game, where you can challenge the bots, play with friends, or even mix it
          up
          with both bots and pals.<br>
          <br>
          The gameplay unfolds on a randomly generated grid, punctuated by impassable rock cells. As the game begins,
          you'll have a tower and a dino of the same color (e.g., blue for the first player) staying on it. The dino
          displays its speed as a number in its bottom right corner, representing how many cells it can traverse in a
          single turn. Other dinos, whether they're friend or foe, are obstacles you can't move through as well as
          rocks.
          <br>
          <br>
          To move a dino, simply click or tap on it, then select the cell you want it to go to. When a dino completes
          its
          move, it eliminates opposing dinos in its immediate vicinity (those in the 4 main directions: ⬅️➡️⬇️⬆️). If
          your
          dino lands on an enemy tower, it captures the tower and it becomes yours. With every new turn, each your
          unoccupied towers will produce a new dino with a randomly assigned speed.<br>
          <br>
          <!-- TODO: Add description of buildings -->
          Before you dive in, note that there are a few game settings available. Kindly recommend you to start with the
          "fog of war" option disabled to
          understand what's going on.
          <img class="unitImg" style="float: right" :src="`/images/dino3.png`">
          <br>
          Enjoy!
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import emitter from "@/game/eventBus";
import {GAME_STATES} from "@/game/const";

export default {
  name: 'GameHelp',
  methods: {
    handleBackBtnClick() {
      emitter.emit('goToPage', GAME_STATES.menu);
    },
  },
}

</script>

<style scoped>
#contentWrapper {
  height: 100vh;
  width: 100vw;
  overflow: auto;
  background-image: url('/public/images/background.png');
  background-size: cover;
  text-align: center;
}

#buttonWrapper {
  position: relative;
}

#contentBlock {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 15px 15px;
}

.goBackBtn {
  position: absolute;
  top: 34px;
  left: 16px;
  border: none;
  background-color: rgba(0, 0, 0, 0);
}

.goBackBtn img {
  width: 40px;
  height: 40px;
  user-select: none;
  cursor: pointer;
}

h1 {
  margin: 0;
  padding: 30px;
}

.textBlock {
  text-align: left;
}

img.unitImg {
  display: inline;
  width: 34px;
  height: 34px;
  margin: 0 10px;
}
</style>