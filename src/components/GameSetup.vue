<template>
  <div>Game setup</div>
  <button type="button" @click="handleClick">Start game</button>
</template>

<script>
export default {
  name: 'GameSetup',
  props: {
    handleClick: Function,
  },
}
</script>

<style>
</style>
