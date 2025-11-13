<template>
  <div id="contentWrapper">
    <div id="buttonWrapper">
      <button type="button" class="goBackBtn" @click="handleBackBtnClick">
        <img :src="`/images/arrow_white.png`">
      </button>
      <div id="contentBlock">
        <h1>Game rules</h1>
        <h3>Summary</h3>
        <div class="text-block">
          🌿 At the start of each turn, every empty tower of your color spawns a new dino with a random speed.<br>
          🌿 At the end of dino's move all adjacent enemy dinos (4 directions) die.<br>
          🌿 If your dino comes to an enemy tower, it becomes yours.<br>
          🌿 You can move any number of your dinos each turn.<br>
          🌿 A dino can move a number of cells up to its speed during a turn.<br>
          🌿 Rocks and other dinos block movement.<br>
          🌿 To apply effect of habitations, wells, temples and storages your dino should stay on them at the
          beginning of the turn.<br>
          🌿 Effect of obelisk applies when dino ends move on it.<br>
          🌿 You should eliminate all other players to win.<br>
        </div>
        <br>
        <h3>Description</h3>
        <div class="text-block">
          It is a simple turn-based strategy game, where you can challenge the bots, play with friends, or even mix it
          up with both bots and pals.<br>
          <br>
          The gameplay unfolds on a randomly generated grid, punctuated by impassable rock cells. As the game begins,
          you'll have a tower and a dino of the same color (e.g.,
          <span style="color: #3e6eff;">blue for the first player</span>) staying on it. The dino
          displays its speed as a number in its bottom right corner, representing how many cells it can traverse in a
          single turn. Other dinos, whether they're friend or foe, are obstacles you can't move through as well as
          rocks.
          <br>
          <br>
          To move a dino, simply click or tap on it, then select the cell you want it to go to. When a dino completes
          its move, it eliminates opposing dinos in its immediate vicinity (those in the 4 main directions: ⬅️➡️⬇️⬆️).
          If your dino lands on an enemy tower, it captures the tower and it becomes yours.
          <div class="building-row">
            <div class="icon">
              <img class="building-img" :src="`/images/base.png`" alt="Tower">
            </div>
            <span class="building-desc">
              With every new turn, each your unoccupied tower will produce a new dino with a randomly assigned speed.
            </span>
          </div>
          <br>
          Buildings.<br>
          While tower is a main building in the game, there are others giving bonuses:<br>
          <div style="height: 10px;"></div>
          <div class="building-row">
            <div class="icon">
              <img class="building-img" :src="`/images/habitation.png`" alt="Habitation">
            </div>
            <span class="building-desc">
              <span class="building-desc-title">Habitation:</span> Increase maximum number of dinos
            </span>
          </div>
          <div class="building-row">
            <div class="icon">
              <img class="building-img" :src="`/images/temple.png`" alt="Temple">
            </div>
            <span class="building-desc">
              <span class="building-desc-title">Temple:</span> Increase speed of newly generated dinos by 1
            </span>
          </div>
          <div class="building-row">
            <div class="icon">
              <img class="building-img" :src="`/images/well.png`" alt="Well">
            </div>
            <span class="building-desc">
              <span class="building-desc-title">Well:</span> Increase speed of dino staying on it by 1
            </span>
          </div>
          <div class="building-row">
            <div class="icon">
              <img class="building-img" :src="`/images/storage.png`" alt="Storage">
            </div>
            <span class="building-desc">
              <span class="building-desc-title">Storage:</span> Increase maximum number of towers
            </span>
          </div>
          <div class="building-row">
            <div class="icon">
              <img class="building-img" :src="`/images/obelisk.png`" alt="Obelisk">
            </div>
            <span class="building-desc">
              <span class="building-desc-title">Obelisk:</span> Instantly show any part of the map
            </span>
          </div>
          To apply effect of first four buildings, your dino should stay on them at the beginning of the turn.
          Effect of obelisk applies when dino ends move on it.<br>
          <br>
          Before you dive in, note that there are a few game settings available. Kindly recommend you to start with the
          "fog of war" option disabled and towers only to understand what's going on.
          <img class="unit-img" style="float: right;" :src="`/images/dino2.png`">
          <br>
          Enjoy!
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import emitter from "@/game/eventBus";
import { GAME_STATES } from "@/game/const";

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
  background-image: url('/images/background.png');
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

.text-block {
  text-align: left;
}

img.unit-img {
  display: inline;
  width: 34px;
  height: 34px;
  margin: 0 10px;
}

.building-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  gap: 12px;
}

.icon {
  background-image: url('/images/icon.png');
  background-size: cover;
  display: flex;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  justify-content: center;
  align-items: center;
}

.building-img {
  height: 32px;
  width: 32px;
  object-fit: contain;
  vertical-align: middle;
}

.building-desc {
  display: block;
  line-height: 1.4em;
  flex: 1 1 0%;
  word-break: break-word;
}

.building-desc-title {
  color: #e08741;
}
</style>