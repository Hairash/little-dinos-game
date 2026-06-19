<template>
  <div class="confirm-dialog">
    <div class="confirm-dialog-content">
      {{ message }}
      <div class="confirm-dialog-btn-block">
        <button class="confirm-dialog-btn" @click="handleConfirm">{{ confirmLabel }}</button>
        <button class="confirm-dialog-btn" @click="handleCancel">{{ cancelLabel }}</button>
      </div>
    </div>
  </div>
</template>

<script>
// Generic yes/no confirmation modal. Visually identical to ExitDialog
// (`error_plate.png` plate, same button look, same z-index above the
// in-game gear menu) so every "Are you sure?" prompt in the app shares
// a single look-and-feel.
//
// Pass `message` for the body text, and `handleConfirm` / `handleCancel`
// for the two buttons. The labels default to "Yes" / "No" to mirror
// ExitDialog but can be overridden ("Delete" / "Cancel", etc.).
export default {
  name: 'ConfirmDialog',
  props: {
    message: {
      type: String,
      required: true,
    },
    handleConfirm: {
      type: Function,
      required: true,
    },
    handleCancel: {
      type: Function,
      required: true,
    },
    confirmLabel: {
      type: String,
      default: 'Yes',
    },
    cancelLabel: {
      type: String,
      default: 'No',
    },
  },
}
</script>

<style scoped>
.confirm-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 10090;
}

.confirm-dialog-btn {
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

.confirm-dialog-content {
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
