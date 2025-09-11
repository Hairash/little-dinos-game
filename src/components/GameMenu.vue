<template>
  <div id="menu">
    <div id="menu-content">
      <h1>Little Dinos</h1>
      <div id="buttons">
        <button @click="handleStartBtnClick">New Game</button>
        <button @click="handleLoadBtnClick">Load Game</button>
        <button @click="handleHelpBtnClick">Help</button>
      </div>
    </div>
    <MenuError
      v-if="error"
      :error="error"
      :setError="setError"
    />
  </div>
</template>

<script>
import emitter from "@/game/eventBus";
import {GAME_STATES} from "@/game/const";
import MenuError from '@/components/MenuError.vue';

export default {
  name: 'GameMenu',
  components: {
    MenuError,
  },
  props: {
    error: String,
    setError: Function,
  },
  methods: {
    handleStartBtnClick() {
      emitter.emit('goToPage', GAME_STATES.setup);
    },
    handleLoadBtnClick() {
      emitter.emit('loadGame');
    },
    handleHelpBtnClick() {
      emitter.emit('goToPage', GAME_STATES.help);
    }
  },
}
</script>


<style>
#menu {
  background-image: url('/public/images/menu_background.png');
  width: 100vw;
  height: 100vh;
  overflow: auto;
  background-size: cover;
  background-position: center;
}

#menu-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #fff;
}

#menu h1 {
  position: relative;
  text-shadow: -3px 0 black, 0 2px black, 1px 0 black, 0 -1px black;
  font-size: 48px;
}

#menu-content #buttons {
  margin-top: 60px;
}

#menu-content button {
  position: relative;
  display: block;
  margin: 30px auto 0 auto;
  width: 260px;
  height: 70px;
  background: url('/public/images/long_menu_button.png') no-repeat center center;
  background-size: 100% 100%;
  border: none;
  color: #fff;
  font-size: 28px;
  font-family: inherit;
  font-weight: bold;
  text-shadow: 2px 2px 4px #000;
  cursor: pointer;
  outline: none;
  transition: transform 0.1s, box-shadow 0.1s;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  border-radius: 12px;
}

@media (max-height: 435px) {
  #menu-content {
    max-height: 90vh;
  }
  #menu h1 {
    margin: 0;
    font-size: 8vh;
  }
  #menu-content #buttons {
    margin-top: 10vh;
  }
  #menu-content button {
    max-width: 60vh;
    height: 14vh;
    font-size: 5vh;
    margin-top: 1vh;
  }
}
</style>