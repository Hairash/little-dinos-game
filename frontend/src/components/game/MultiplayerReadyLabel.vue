<template>
  <div class="fixed-label">
    <div>
      <div v-if="winnerUsername">
        Player <span :style="{ color: getPlayerColor(winner) }">{{ winnerUsername }}</span> wins!
      </div>
      <div v-else-if="winner !== null">
        Player <span :style="{ color: getPlayerColor(winner) }">{{ winner + 1 }}</span> wins!
      </div>
      <div>
        <button type="button" @click="handleOkClick" class="ok-button">
          OK
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { getPlayerColor } from '@/game/helpers';

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
  },
  methods: {
    handleOkClick() {
      this.$emit('close');
    },
    getPlayerColor,
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
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  font-size: 2rem;
  z-index: 1000;
}

.ok-button {
  background-color: #d8a67e;
  color: #001111;
  border: none;
  border-radius: 4px;
  padding: 12px 30px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 20px;
  transition: background-color 0.3s;
  font-family: inherit;
}

.ok-button:hover {
  background-color: #ae7b62;
}

.ok-button:active {
  background-color: #926846;
}
</style>

