<template>
  <div class="save-map-dialog">
    <div class="save-map-dialog-content">
      <div class="save-map-title">Save map</div>
      <input
        ref="nameInput"
        v-model="name"
        type="text"
        class="save-map-input"
        :placeholder="defaultName"
        @keyup.enter="handleSave"
      />
      <div v-if="errorMessage" class="save-map-error">{{ errorMessage }}</div>
      <div class="save-map-btn-block">
        <button class="save-map-btn" @click="handleSave" :disabled="busy">Save</button>
        <button class="save-map-btn" @click="handleCancel" :disabled="busy">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SaveMapDialog',
  props: {
    // Pre-filled name shown in the input. The caller computes this from
    // the snapshot's metadata + today's date via `nextDefaultName`.
    defaultName: {
      type: String,
      required: true,
    },
    // Returns true if a saved map with this name already exists. Used
    // for inline collision feedback. Single-player passes the
    // mapStorage check; multiplayer passes a stub that always returns
    // false (server checks authoritatively, error comes back over WS).
    existsCheck: {
      type: Function,
      default: () => false,
    },
    // Server-side error to render (multiplayer). When non-empty the
    // dialog stays open and the message is shown above the buttons.
    serverError: {
      type: String,
      default: '',
    },
    busy: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['save', 'cancel'],
  data() {
    return {
      name: this.defaultName,
      localError: '',
    }
  },
  computed: {
    errorMessage() {
      return this.serverError || this.localError
    },
  },
  watch: {
    name() {
      this.localError = ''
    },
    serverError(v) {
      if (v) this.localError = ''
    },
  },
  mounted() {
    this.$nextTick(() => {
      const el = this.$refs.nameInput
      if (el) {
        el.focus()
        el.select()
      }
    })
  },
  methods: {
    handleSave() {
      if (this.busy) return
      const finalName = this.name.trim()
      if (!finalName) {
        this.localError = 'Name cannot be empty'
        return
      }
      if (this.existsCheck(finalName)) {
        this.localError = `Map "${finalName}" already exists`
        return
      }
      this.$emit('save', finalName)
    },
    handleCancel() {
      if (this.busy) return
      this.$emit('cancel')
    },
  },
}
</script>

<style scoped>
.save-map-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  /* Sits above the in-game gear menu (10080) so the save dialog is
     reachable from the menu, like ExitDialog. */
  z-index: 10090;
}

.save-map-dialog-content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  background-image: url('/images/error_plate.png');
  background-size: 100% 100%;
  padding: 20px;
  color: black;
  width: 320px;
  z-index: 10091;
}

.save-map-title {
  font-weight: bold;
  margin-bottom: 10px;
  font-size: 16px;
}

.save-map-input {
  width: 90%;
  padding: 6px 8px;
  font-family: inherit;
  font-size: 14px;
  border: 1px solid rgba(0, 0, 0, 0.4);
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.85);
  margin-bottom: 8px;
  box-sizing: border-box;
}

.save-map-error {
  color: #a00;
  font-size: 12px;
  min-height: 16px;
  margin-bottom: 6px;
}

.save-map-btn-block {
  margin-top: 8px;
}

.save-map-btn {
  display: inline-block;
  margin: 4px 6px;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  padding: 8px 18px;
  border-radius: 5px;
  cursor: pointer;
  font-family: inherit;
}

.save-map-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
