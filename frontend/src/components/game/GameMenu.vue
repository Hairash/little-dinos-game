<template>
  <div id="menu">
    <div id="menu-content">
      <h1>Little Dinos</h1>
      <div id="buttons">
        <button @click="handleStartBtnClick">New Game</button>
        <button @click="handleLoadBtnClick">Load Game</button>
        <button
          @click="handleMultiplayerBtnClick"
          :disabled="multiplayerLoading"
          class="multiplayer-btn"
        >
          <img
            v-if="multiplayerLoading"
            src="/images/loading.png"
            alt="Loading..."
            class="loading-spinner"
          />
          <template v-else>Multiplayer</template>
        </button>
        <button @click="handleHelpBtnClick">Help</button>
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
  name: 'GameMenu',
  components: {
    MenuError,
  },
  props: {
    error: String,
    setError: Function,
  },
  data() {
    return {
      // Cleared by unmount when App transitions to lobby/login after the
      // whoami() check, so we don't need an explicit reset path.
      multiplayerLoading: false,
    }
  },
  methods: {
    handleStartBtnClick() {
      emitter.emit('goToPage', GAME_STATES.setup)
    },
    handleLoadBtnClick() {
      emitter.emit('loadGame')
    },
    handleMultiplayerBtnClick() {
      if (this.multiplayerLoading) return
      this.multiplayerLoading = true
      emitter.emit('startMultiplayer')
    },
    handleHelpBtnClick() {
      emitter.emit('goToPage', GAME_STATES.help)
    },
  },
}
</script>

<style>
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
  min-height: 44px; /* Touch target minimum */
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
  transition:
    transform 0.1s,
    box-shadow 0.1s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  margin: 0 auto;
  flex-shrink: 0;
}

/* Loading state for the Multiplayer button: hide the label and show a
   rotating spinner while waiting for the server. Source-ordered AFTER the
   generic `#menu-content button` rule so `display: flex` wins over `block`
   at equal specificity. */
#menu-content .multiplayer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}

#menu-content .multiplayer-btn .loading-spinner {
  height: 60%;
  width: auto;
  animation: multiplayer-btn-spin 1s linear infinite;
}

@keyframes multiplayer-btn-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Landscape orientation adjustments */
@media (orientation: landscape) and (max-height: 600px) {
  #menu-content {
    flex-direction: row;
    gap: 4vw;
    max-width: 95vw;
  }

  #menu h1 {
    font-size: clamp(20px, 6vh, 36px);
    margin-bottom: 0;
  }

  #menu-content #buttons {
    margin-top: 0;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    gap: clamp(8px, 1.5vh, 20px);
  }

  #menu-content button {
    width: auto;
    min-width: clamp(120px, 20vw, 200px);
    height: clamp(40px, 10vh, 60px);
    font-size: clamp(14px, 3vh, 22px);
  }
}

/* Very small screens */
@media (max-height: 500px) {
  #menu h1 {
    font-size: clamp(18px, 6vh, 32px);
    white-space: normal; /* Allow wrapping on very small screens if needed */
  }

  #menu-content #buttons {
    gap: clamp(5px, 1vh, 15px);
  }

  #menu-content button {
    height: clamp(40px, 10vh, 60px);
    font-size: clamp(14px, 3vh, 20px);
  }
}

/* Very narrow screens - allow wrapping if title doesn't fit */
@media (max-width: 320px) {
  #menu h1 {
    white-space: normal;
  }
}

/* Very wide screens - keep buttons reasonable size */
@media (min-width: 1200px) {
  #menu-content {
    max-width: 500px;
  }

  #menu-content button {
    max-width: 300px;
  }
}
</style>
