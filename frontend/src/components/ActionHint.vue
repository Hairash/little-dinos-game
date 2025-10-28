<template>
  <div class="action-hint">
    <div v-if="action === 'scouting'">
      Select point to scout
    </div>
  </div>
</template>

<script>
export default {
  name: 'ActionHint',
  props: {
    action: String,
  },
};
</script>

<style scoped>

div.action-hint {
  position: fixed;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  width: 100vw;
  background-color: transparent;
  pointer-events: none;
  z-index: 1;
}
</style>