<template>
  <div class="playability-warning">
    <div class="playability-warning-content">
      <p class="playability-warning-title">Game might be unplayable with current settings.</p>
      <p>Consider:</p>
      <ul>
        <li>
          Increase
          <img class="inline-icon" :src="getImagePath('dino_icon')" alt="max units" />
          or/and
          <img
            class="inline-icon"
            :src="getImagePath('dino_icon_plus')"
            alt="dinos per habitation"
          />
        </li>
        <li>
          Increase
          <img class="inline-icon" :src="getImagePath('habitation')" alt="habitation" />
        </li>
        <li>
          Decrease
          <img class="inline-icon" :src="getImagePath('tower_icon')" alt="towers" />
        </li>
      </ul>
      <div class="playability-warning-buttons">
        <button class="playability-warning-btn" @click="onPlayAnyway">Play anyway</button>
        <button class="playability-warning-btn" @click="onUpdateSettings">Update settings</button>
      </div>
    </div>
  </div>
</template>

<script>
import { getImagePath } from '@/game/helpers.js'

export default {
  name: 'PlayabilityWarning',
  emits: ['playAnyway', 'updateSettings'],
  methods: {
    getImagePath,
    onPlayAnyway() {
      this.$emit('playAnyway')
    },
    onUpdateSettings() {
      this.$emit('updateSettings')
    },
  },
}
</script>

<style scoped>
.playability-warning {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.playability-warning-content {
  background-image: url('/images/error_plate_big.png');
  background-size: 100% 100%;
  padding: 30px 35px;
  color: black;
  width: 320px;
  text-align: left;
  font-family: inherit;
}

.playability-warning-title {
  font-weight: bold;
  margin-top: 0;
}

.playability-warning-content ul {
  margin: 8px 0 16px;
  padding-left: 20px;
}

.playability-warning-content li {
  margin-bottom: 6px;
  line-height: 28px;
}

.inline-icon {
  width: 24px;
  height: 24px;
  vertical-align: middle;
  margin: 0 2px;
}

.playability-warning-buttons {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
}

.playability-warning-btn {
  flex: 1;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  padding: 10px;
  border-radius: 5px;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
}
</style>
