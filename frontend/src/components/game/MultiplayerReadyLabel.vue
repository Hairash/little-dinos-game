<template>
  <div class="ready-overlay">
    <div class="ready-content">
      <template v-if="youLose">
        <div class="ready-headline">You lose</div>
        <div class="ready-subline">You may continue watching the game.</div>
      </template>
      <template v-else-if="winnerUsername">
        <div class="ready-headline">
          Player <span :style="{ color: getPlayerColor(winner) }">{{ winnerUsername }}</span> wins!
        </div>
      </template>
      <template v-else-if="winner !== null">
        <div class="ready-headline">
          Player <span :style="{ color: getPlayerColor(winner) }">{{ winner + 1 }}</span> wins!
        </div>
      </template>
      <div class="ready-exit-hint">
        To exit the game click
        <img class="ready-inline-icon" :src="getImagePath('settings_icon')" alt="settings" />, then
        <img class="ready-inline-icon" :src="getImagePath('exit_icon')" alt="exit" />
      </div>
      <button type="button" @click="handleOkClick" class="ready-close">OK</button>
    </div>
  </div>
</template>

<script>
import { getPlayerColor, getImagePath } from '@/game/helpers'

export default {
  name: 'MultiplayerReadyLabel',
  props: {
    winner: {
      type: Number,
      default: null,
    },
    winnerUsername: {
      type: String,
      default: null,
    },
    // When true, override the winner banner with a "You lose" message.
    // The eliminated player dismisses this and continues as a spectator.
    youLose: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    handleOkClick() {
      this.$emit('close')
    },
    getPlayerColor,
    getImagePath,
  },
}
</script>

<style scoped>
/* Match the MenuError styling so win/lose announcements share the same
   visual language as the menu/game-setup error dialogs. */
.ready-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.ready-content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  background-image: url('/images/error_plate_big.png');
  background-size: 100% 100%;
  padding: 30px 35px;
  color: black;
  width: 320px;
}

.ready-headline {
  font-weight: bold;
  margin-bottom: 8px;
}

.ready-subline {
  margin-bottom: 12px;
}

.ready-exit-hint {
  margin: 12px 0;
  line-height: 28px;
}

.ready-inline-icon {
  width: 24px;
  height: 24px;
  vertical-align: middle;
  margin: 0 2px;
}

.ready-close {
  position: relative;
  display: block;
  margin: 10px auto;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  z-index: 1001;
  font-family: inherit;
}
</style>
