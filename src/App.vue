<template>
  <DinoGame />
</template>

<script>
import DinoGame from './components/DinoGame.vue'

export default {
  name: 'App',
  components: {
    DinoGame,
  },
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: white;
  margin-top: 60px;
}
</style>
