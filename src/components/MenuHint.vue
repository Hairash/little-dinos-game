<template>
  <div class="menu-hint">
    <div class="menu-hint-content" :class="hintOrientation" v-if="currentHint === id">
      {{ hint }}
    </div>
  </div>
</template>

<script>
export default {
  name: 'MenuHint',
  props: {
    id: String,
    hint: String,
    currentHint: String,
    hintOrientation: String('left'),
  },
  data() {
    return {
      isVisible: false,
    }
  },
}
</script>

<style scoped>
.menu-hint {
  position: absolute;
  width: 25px;
  height: 25px;
  margin-left: -33px;
  margin-top: 13px;
  background-image: url("/public/images/hint_icon.png");
  background-size: cover;
  cursor: pointer;
  user-select: none;
  z-index: 1;
}

.menu-hint-content {
  position: absolute;
  text-align: center;
  width: 200px;
  bottom: 37px;
  color: white;
  background-color: black;  
  cursor: auto;
  
  padding: 3px 7px;
  border: 1px solid;
  border-radius: 4px;
  /* font-weight: 700; */
  align-items: center;
}

.menu-hint-content.right {
  right: 0;
}
</style>
