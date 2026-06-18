<template>
  <div class="exit-dialog">
    <div class="exit-dialog-content">
      Do you really want to exit the game?
      <div id="exit-dialog-btn-block">
        <button class="exit-dialog-btn" @click="handleConfirm()">Yes</button>
        <button class="exit-dialog-btn" @click="handleCancel()">No</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ExitDialog',
  props: {
    handleCancel: Function,
    handleConfirm: Function,
  },
}
</script>

<style scoped>
.exit-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  /* Sits above every tutorial layer (TutorialHint 10050, end-of-
     scenario overlay 10060, in-game gear menu 10080) so the exit
     confirmation is always reachable from anywhere in a scenario. */
  z-index: 10090;
}

.exit-dialog-btn {
  position: relative;
  display: inline-block;
  margin: 10px;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  z-index: 10091;
  font-family: inherit;
}

.exit-dialog-content {
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
