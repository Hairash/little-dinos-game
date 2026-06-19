<template>
  <div id="menu">
    <div id="menu-content">
      <h1>New Game</h1>
      <div id="buttons">
        <button @click="goTutorial">Tutorial</button>
        <button @click="goRandom">Random map</button>
        <button @click="goSavedMaps">Saved map</button>
        <button class="back-btn" @click="goBack">Back</button>
      </div>
    </div>
    <MenuError v-if="error" :error="error" :set-error="setError" />
  </div>
</template>

<script>
import emitter from '@/game/eventBus'
import { GAME_STATES } from '@/game/const'
import MenuError from '@/components/ui/MenuError.vue'

export default {
  name: 'NewGameSubmenu',
  components: { MenuError },
  props: {
    error: { type: String, default: null },
    setError: { type: Function, default: null },
  },
  methods: {
    goTutorial() {
      emitter.emit('goToPage', GAME_STATES.tutorial)
    },
    goRandom() {
      emitter.emit('goToPage', GAME_STATES.setup)
    },
    goSavedMaps() {
      emitter.emit('goToPage', GAME_STATES.savedMaps)
    },
    goBack() {
      emitter.emit('goToPage', GAME_STATES.menu)
    },
  },
}
</script>

<style scoped>
/* Reuse the look-and-feel of GameMenu.vue: same background, same button
   plate, same layout. The selectors are scoped, so we can keep the same
   ids without colliding. */
#menu {
  background-image: url('/images/menu_background.png');
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

#menu-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #fff;
  width: 100%;
  max-width: min(90vw, 400px);
  padding: 2vh 4vw;
  box-sizing: border-box;
}

#menu h1 {
  position: relative;
  text-shadow:
    -3px 0 black,
    0 2px black,
    1px 0 black,
    0 -1px black;
  margin: 0;
  font-size: clamp(24px, 8vh, 48px);
  line-height: 1.2;
  flex-shrink: 0;
  white-space: nowrap;
}

#menu-content #buttons {
  margin-top: clamp(20px, 4vh, 60px);
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 2vh, 30px);
  flex: 1;
  justify-content: center;
  min-height: 0;
}

#menu-content button {
  position: relative;
  display: block;
  width: 100%;
  max-width: 260px;
  height: clamp(50px, 12vh, 70px);
  min-height: 44px;
  background: url('/images/long_menu_button.png') no-repeat center center;
  background-size: 100% 100%;
  border: none;
  color: #fff;
  font-size: clamp(16px, 4vh, 28px);
  font-family: inherit;
  font-weight: bold;
  text-shadow: 2px 2px 4px #000;
  cursor: pointer;
  outline: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  margin: 0 auto;
  flex-shrink: 0;
}
</style>
