<template>
  <div class="editor-list-page">
    <button class="goBackBtn" @click="goBack" title="Back">
      <img :src="getImagePath('arrow_white')" alt="Back" />
    </button>
    <h1>Map editor</h1>

    <div class="editor-list-content">
      <div class="editor-list-body">
        <div ref="listRef" class="editor-list-pane">
          <div class="editor-list">
            <button
              v-for="s in scenarios"
              :key="s.id"
              class="editor-list-item"
              :class="{ 'editor-list-item-selected': selectedId === s.id }"
              @click="selectScenario(s.id)"
            >
              <div class="editor-list-name">
                {{ s.map.name }}
                <!-- Tag built-ins so the user knows which entries
                     come from `scenariosData.js` (and that "delete"
                     on them only resets their override, never wipes
                     the source). -->
                <span v-if="s.isBuiltin" class="editor-list-badge">default</span>
              </div>
              <div class="editor-list-meta">
                {{ s.map.metadata.playersNum }}p · {{ s.map.metadata.width }}×{{
                  s.map.metadata.height
                }}
              </div>
            </button>
            <button class="editor-list-item editor-list-item-new" @click="openCreateDialog">
              + Create new scenario
            </button>
            <button class="editor-list-item editor-list-item-new" @click="triggerImport">
              ↑ Import scenario from file
            </button>
          </div>
        </div>

        <div ref="previewRef" class="editor-preview-pane">
          <div v-if="!selected" class="editor-preview-empty">
            Pick a scenario on the left, or create a new one.
          </div>

          <div v-else class="editor-preview">
            <MapPreview :map="selected.map" :max-size="320" />

            <!-- Settings icon-row, same vocabulary SavedMapsPage uses
                 so the two browsers look familiar side-by-side. Each
                 row is a small `icon.png` plate + the value. -->
            <div class="editor-settings">
              <div class="settings-row">
                <span class="settings-icon"><img :src="getImagePath('field_icon')" alt="" /></span>
                {{ selected.map.metadata.width }}×{{ selected.map.metadata.height }}
              </div>
              <div class="settings-row">
                <span class="settings-icon"><img :src="getImagePath('human_icon')" alt="" /></span>
                {{ selected.map.metadata.humanPlayersNum }}
              </div>
              <div class="settings-row">
                <span class="settings-icon"><img :src="getImagePath('bot_icon')" alt="" /></span>
                {{ selected.map.metadata.botPlayersNum }}
              </div>
              <div class="settings-row">
                <span class="settings-icon"><img :src="getImagePath('speed_icon')" alt="" /></span>
                {{ selected.map.settings.minSpeed }}–{{ selected.map.settings.maxSpeed }}
              </div>
              <div class="settings-row">
                <span class="settings-icon"><img :src="getImagePath('dino_icon')" alt="" /></span>
                {{ selected.map.settings.maxUnitsNum }}
              </div>
              <div class="settings-row">
                <span class="settings-icon"
                  ><img :src="getImagePath('dino_icon_plus')" alt=""
                /></span>
                {{ selected.map.settings.unitModifier }}
              </div>
              <div class="settings-row">
                <span class="settings-icon"><img :src="getImagePath('tower_icon')" alt="" /></span>
                {{ selected.map.settings.maxBasesNum }}
              </div>
              <div class="settings-row">
                <span class="settings-icon"
                  ><img :src="getImagePath('tower_icon_plus')" alt=""
                /></span>
                {{ selected.map.settings.baseModifier }}
              </div>
              <div class="settings-row">
                <span class="settings-icon">
                  <img
                    :src="
                      getImagePath(selected.map.settings.enableFogOfWar ? 'closed_eye' : 'open_eye')
                    "
                    alt=""
                  />
                </span>
                <template v-if="selected.map.settings.enableFogOfWar">
                  {{ selected.map.settings.fogOfWarRadius }}
                </template>
              </div>
              <div class="settings-row">
                <span class="settings-icon">
                  <img
                    :src="
                      getImagePath(
                        selected.map.settings.visibilitySpeedRelation
                          ? 'visibility_speed_relation_icon'
                          : 'visibility_speed_no_relation_icon'
                      )
                    "
                    alt=""
                  />
                </span>
                <template v-if="selected.map.settings.visibilitySpeedRelation">
                  ≥ {{ selected.map.settings.speedMinVisibility }}
                </template>
              </div>
              <div class="settings-row">
                <span class="settings-icon">
                  <img
                    :src="
                      getImagePath(
                        selected.map.settings.killAtBirth
                          ? 'dino_birth_kill_icon'
                          : 'dino_birth_icon'
                      )
                    "
                    alt=""
                  />
                </span>
              </div>
              <div class="settings-row">
                <span class="settings-icon">
                  <img
                    :src="
                      getImagePath(
                        selected.map.settings.hideEnemySpeed ? 'hide_speed_icon' : 'show_speed_icon'
                      )
                    "
                    alt=""
                  />
                </span>
              </div>
            </div>

            <p v-if="selected.description" class="editor-description">
              {{ selected.description }}
            </p>
            <p v-else class="editor-description-empty">
              No description. Add one in the editor's ⚙ menu.
            </p>

            <a class="editor-back-to-list" href="#" @click.prevent="scrollToList">
              ↑ Back to the list
            </a>
          </div>
        </div>
      </div>

      <div v-if="importError" class="editor-import-error">{{ importError }}</div>

      <div class="editor-bottom-buttons">
        <button class="editor-btn editor-btn-primary" :disabled="!selected" @click="editMap">
          Edit
        </button>
        <!--
          Exports the selected scenario as a JSON file. Works for both
          built-ins (the override-or-original) and user scenarios — the
          file format is the same `buildScenarioFile` wrapper either
          way, so the receiver doesn't have to know the source.
        -->
        <button class="editor-btn" :disabled="!selected" @click="exportSelected">Export</button>
        <!--
          User scenarios show "Delete" (removes the entry); built-in
          scenarios show "Reset" (removes the override and restores
          the values from `scenariosData.js`). The Reset button is
          disabled when no override is currently saved — there's
          nothing to reset.
        -->
        <button
          v-if="!selected || !selected.isBuiltin"
          class="editor-btn editor-btn-danger"
          :disabled="!selected"
          @click="askDelete"
        >
          Delete
        </button>
        <button
          v-else
          class="editor-btn editor-btn-danger"
          :disabled="!selectedHasOverride()"
          @click="askDelete"
        >
          Reset
        </button>
      </div>

      <!--
        Hidden file picker — triggered from the "Import scenario from
        file" list item. We clear its value on every open so re-importing
        the same file fires `change` again.
      -->
      <input
        ref="importInput"
        type="file"
        accept=".json,application/json"
        class="editor-import-input"
        @change="onImportFile"
      />
    </div>

    <ConfirmDialog
      v-if="deleteTarget"
      :message="deleteConfirmMessage"
      :confirm-label="deleteTarget.isBuiltin ? 'Reset' : 'Delete'"
      cancel-label="Cancel"
      :handle-confirm="confirmDelete"
      :handle-cancel="() => (deleteTarget = null)"
    />

    <!--
      Create-new dialog. Three values: width, height, total players. The
      editor enforces 1 human + (total − 1) bots so we surface a single
      total instead of two inputs (matches the gear-menu Players row).
      Dimensions and total can both be changed later from the canvas
      editor's ⚙ menu.
    -->
    <div v-if="showCreate" class="create-backdrop" @click.self="showCreate = false">
      <div class="create-dialog">
        <h2>Create new scenario</h2>
        <label class="field-inline">
          <span>Width</span>
          <input v-model.number="createDraft.width" type="number" min="5" max="50" />
        </label>
        <label class="field-inline">
          <span>Height</span>
          <input v-model.number="createDraft.height" type="number" min="5" max="50" />
        </label>
        <label class="field-inline">
          <span>Players</span>
          <input v-model.number="createDraft.totalPlayers" type="number" min="1" max="8" />
        </label>
        <div class="create-actions">
          <button class="editor-btn editor-btn-primary" @click="confirmCreate">Create</button>
          <button class="editor-btn" @click="showCreate = false">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import emitter from '@/game/eventBus'
import { GAME_STATES } from '@/game/const'
import { getImagePath } from '@/game/helpers'
import {
  listAllEditorEntries,
  deleteAnyEditorEntry,
  builtinHasOverride,
  createNewScenario,
  buildScenarioFile,
  importEditorScenario,
} from '@/game/mapEditorStorage'
import MapPreview from '@/components/game/MapPreview.vue'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'

export default {
  name: 'MapEditorListPage',
  components: { MapPreview, ConfirmDialog },
  data() {
    return {
      scenarios: [],
      selectedId: null,
      deleteTarget: null,
      showCreate: false,
      createDraft: { width: 20, height: 20, totalPlayers: 2 },
      // Surface for import failures (bad JSON, schema mismatch, etc.).
      // Cleared on next successful import attempt or when the user
      // dismisses by trying again.
      importError: '',
    }
  },
  computed: {
    selected() {
      return this.scenarios.find(s => s.id === this.selectedId) || null
    },
    deleteConfirmMessage() {
      if (!this.deleteTarget) return ''
      if (this.deleteTarget.isBuiltin) {
        return `Reset "${this.deleteTarget.map.name}" to its default values?`
      }
      return `Delete "${this.deleteTarget.map.name}"? This cannot be undone.`
    },
  },
  mounted() {
    this.refresh()
  },
  methods: {
    getImagePath,
    refresh() {
      // Merged list: built-ins (with overrides applied) + user-created.
      // Each entry carries `isBuiltin` so the action buttons know
      // whether "delete" should remove the entry or just reset an
      // override to the original.
      this.scenarios = listAllEditorEntries()
      if (this.selectedId && !this.scenarios.find(s => s.id === this.selectedId)) {
        this.selectedId = null
      }
    },
    selectedHasOverride() {
      // Used to decide whether the "Reset" button is meaningful for a
      // built-in (only when the user has actually saved an edit to it).
      if (!this.selected?.isBuiltin) return false
      return builtinHasOverride(this.selected.id)
    },
    isMobileLayout() {
      return typeof window !== 'undefined' && window.matchMedia('(max-width: 759px)').matches
    },
    selectScenario(id) {
      this.selectedId = id
      if (!this.isMobileLayout()) return
      this.$nextTick(() => {
        const el = this.$refs.previewRef
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
    },
    scrollToList() {
      const el = this.$refs.listRef
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    editMap() {
      if (!this.selectedId) return
      emitter.emit('openMapEditorCanvas', this.selectedId)
    },
    askDelete() {
      this.deleteTarget = this.selected
    },
    confirmDelete() {
      const target = this.deleteTarget
      deleteAnyEditorEntry(target)
      this.deleteTarget = null
      // User scenarios disappear after delete; built-ins stay (just
      // revert to the source-code values), so keep selection on the
      // built-in to make the reset visible.
      if (!target.isBuiltin) this.selectedId = null
      this.refresh()
    },
    exportSelected() {
      if (!this.selected) return
      const file = buildScenarioFile(this.selected)
      const json = JSON.stringify(file, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      // Build a filename from the map's display name, sanitised so the
      // OS save dialog doesn't reject characters like '/'. Empty/odd
      // names fall back to "scenario".
      const safe = (this.selected.map?.name || 'scenario').replace(/[^a-z0-9_-]+/gi, '_')
      const a = document.createElement('a')
      a.href = url
      a.download = `${safe}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Slightly delayed revoke so the browser has time to start the
      // download — immediate revoke is technically allowed but some
      // browsers (notably Safari) trip on it.
      setTimeout(() => URL.revokeObjectURL(url), 0)
    },
    triggerImport() {
      this.importError = ''
      // Resetting the input value lets the user re-import the SAME
      // file path twice in a row — without this `change` only fires
      // when a *different* file is chosen.
      if (this.$refs.importInput) this.$refs.importInput.value = ''
      this.$refs.importInput?.click()
    },
    async onImportFile(event) {
      const file = event.target.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        const entry = importEditorScenario(parsed)
        this.importError = ''
        this.refresh()
        this.selectedId = entry.id
      } catch (e) {
        this.importError = `Import failed: ${e.message || 'unable to read file'}`
      }
    },
    openCreateDialog() {
      this.createDraft = { width: 20, height: 20, totalPlayers: 2 }
      this.showCreate = true
    },
    confirmCreate() {
      // Map size floor matches GameSetup's `LIMITS.width.min` (5).
      const w = Math.max(5, Math.min(50, Number(this.createDraft.width) || 20))
      const h = Math.max(5, Math.min(50, Number(this.createDraft.height) || 20))
      // Single total split as 1 human + (total − 1) bots — same split
      // the gear-menu Players row enforces, so creating then editing
      // stays consistent.
      const total = Math.max(1, Math.min(8, Number(this.createDraft.totalPlayers) || 2))
      const humans = 1
      const bots = total - 1
      const entry = createNewScenario({
        width: w,
        height: h,
        humanPlayersNum: humans,
        botPlayersNum: bots,
      })
      this.showCreate = false
      // Hop straight into the editor rather than dropping back to the
      // list — the user just declared what they want to build, so the
      // canvas is the next obvious place.
      emitter.emit('openMapEditorCanvas', entry.id)
    },
    goBack() {
      emitter.emit('goToPage', GAME_STATES.menu)
    },
  },
}
</script>

<style scoped>
.editor-list-page {
  position: relative;
  background-image: url('/images/background.png');
  background-size: cover;
  overflow: auto;
  height: 100vh;
  width: 100vw;
}

.editor-list-content {
  padding: 0 16px 30px 16px;
}

.goBackBtn {
  position: absolute;
  top: 34px;
  left: 16px;
  border: none;
  background-color: transparent;
  cursor: pointer;
  padding: 0;
  z-index: 10;
}

.goBackBtn img {
  width: 40px;
  height: 40px;
}

.editor-list-page h1 {
  margin: 0;
  padding: 30px;
  text-align: center;
  white-space: nowrap;
}

.editor-list-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 900px;
  margin: 0 auto;
}

.editor-list-pane {
  display: flex;
  flex-direction: column;
}

.editor-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  max-height: 50vh;
}

@media (min-width: 760px) {
  .editor-list-body {
    display: grid;
    grid-template-columns: minmax(220px, 320px) 1fr;
    align-items: flex-start;
    min-height: 360px;
  }
  .editor-list {
    max-height: 460px;
  }
}

.editor-list-item {
  text-align: left;
  background: rgba(146, 104, 70, 0.65);
  border: 1px solid #5e3e26;
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
  color: #fff;
  font-family: inherit;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
}

.editor-list-item:hover {
  background: rgba(146, 104, 70, 0.85);
}

.editor-list-item-selected {
  background: #deae88;
  color: #000;
  border-color: #5e3e26;
  text-shadow: none;
}

.editor-list-item-new {
  background: rgba(94, 62, 38, 0.85);
  text-align: center;
  font-weight: bold;
  border: 1px dashed #deae88;
}

.editor-list-item-new:hover {
  background: rgba(94, 62, 38, 1);
}

.editor-list-name {
  font-weight: bold;
  font-size: 14px;
}

/* Inline error shown above the bottom button row when an import
   fails. Same red colour SaveMapDialog/MenuError use for "fix the
   input" messages. */
.editor-import-error {
  color: #a00;
  font-size: 12px;
  text-align: center;
  margin: 10px auto 0;
  max-width: 480px;
}

/* `<input type="file">` is invisible — we trigger it from the
   "Import scenario from file" list item via `ref.click()`. */
.editor-import-input {
  display: none;
}

/* Inline "default" tag on built-in scenarios. Small pill so it
   doesn't dominate the row but is obvious enough to disambiguate
   user copies from the originals. */
.editor-list-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(0, 0, 0, 0.35);
  color: #ffd34d;
  border-radius: 3px;
  vertical-align: middle;
  text-shadow: none;
}
.editor-list-item-selected .editor-list-badge {
  background: rgba(94, 62, 38, 0.85);
  color: #fff;
}

.editor-list-meta {
  font-size: 12px;
  margin-top: 2px;
  opacity: 0.85;
}

.editor-preview-pane {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 6px;
  padding: 12px;
}

.editor-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.editor-settings {
  font-size: 13px;
  color: #fff;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 4px 12px;
  width: 100%;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 22px;
}

.settings-icon {
  background-image: url('/images/icon.png');
  background-size: contain;
  background-repeat: no-repeat;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.settings-icon img {
  width: 14px;
  height: 14px;
}

.editor-description {
  font-size: 13px;
  text-align: left;
  line-height: 1.4;
  margin: 0;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  width: 100%;
  color: #fff;
}

.editor-description-empty {
  font-style: italic;
  font-size: 12px;
  opacity: 0.6;
  margin: 0;
  width: 100%;
  text-align: left;
  color: #fff;
}

.editor-preview-empty {
  font-style: italic;
  padding: 40px;
  color: #fff;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.editor-back-to-list {
  display: none;
  margin-top: 6px;
  color: #deae88;
  text-decoration: underline;
  cursor: pointer;
  font-size: 14px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
}

@media (max-width: 759px) {
  .editor-back-to-list {
    display: inline-block;
  }
}

.editor-bottom-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}

.editor-btn {
  background-color: #926846;
  color: #fff;
  border: 1px solid #5e3e26;
  padding: 10px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
}

.editor-btn:hover:not(:disabled) {
  background-color: #b0815a;
}

.editor-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.editor-btn-primary {
  background-color: #5e3e26;
}

.editor-btn-primary:hover:not(:disabled) {
  background-color: #7a4f30;
}

.editor-btn-danger {
  background-color: #6b2e2e;
}

.editor-btn-danger:hover:not(:disabled) {
  background-color: #8a3a3a;
}

.create-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 10090;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.create-dialog {
  background-image: url('/images/background.png');
  background-size: cover;
  border: 2px solid #5e3e26;
  border-radius: 8px;
  padding: 14px 18px;
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #fff;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.create-dialog h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.field-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.field-inline input {
  /* Tan + black border, same palette as `GameSetup.inputNumber`. */
  width: 80px;
  background: #deae88;
  color: #000;
  border: 1px solid #000;
  border-radius: 4px;
  padding: 4px 6px;
  font-family: inherit;
}

.create-note {
  font-size: 11px;
  font-style: italic;
  opacity: 0.75;
  margin: 4px 0 0;
}

.create-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}
</style>
