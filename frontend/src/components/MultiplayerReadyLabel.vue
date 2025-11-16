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
    getPlayerColor(order) {
      // Color mapping based on player order (0-indexed, but we'll treat as 1-indexed for colors)
      const colorMap = {
        0: '#4A90E2',      // 1 - blue
        1: '#32cc67',      // 2 - mint
        2: '#FF4444',      // 3 - red
        3: '#FFD700',      // 4 - yellow
        4: '#8B5CF6',      // 5 - violet
        5: '#00FFFF',      // 6 - cyan
        6: '#9B59B6',      // 7 - purple
        7: '#2E7D32',      // 8 - dark green
      };
      return colorMap[order] || '#ffffff'; // Default to white if order is out of range
    },
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

