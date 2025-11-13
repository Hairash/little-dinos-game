<template>
  <div class="menu-error">
    <div class="menu-error-content">
      {{ error }}
      <button class="menu-error-close" @click="setError(null)">OK</button>
    </div>
  </div>
  <!-- <div class="menu-error-overlay"></div> -->
</template>

<script>
export default {
  name: 'MenuError',
  props: {
    error: String,
    setError: Function,
  },
}
</script>

<style scoped>
.menu-error {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.menu-error-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
}

.menu-error-close {
  position: relative;
  display: block;
  margin: 10px auto;
  /* Below the menu-error */
  /* position: fixed; */
  /* bottom: 10px; */
  /* left: 50%; */
  /* transform: translateX(-50%); */
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  z-index: 1001;
  font-family: inherit;
}

.menu-error-content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  background-image: url('/images/error_plate.png');
  background-size: 100% 100%;
  padding: 15px;
  color: black;
  width: 300px;
}
</style>
