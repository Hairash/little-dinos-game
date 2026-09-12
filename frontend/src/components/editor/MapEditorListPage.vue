<template>
  <div class="editor-list-page">
    <button class="goBackBtn" @click="goBack" title="Back">
      <img :src="getImagePath('arrow_white')" alt="Back" />
    </button>
    <h1>Map editor</h1>

    <div class="editor-list-content">
      <!-- Two sources, two tabs: user-authored scenarios and maps saved
           from games. Same per-entry controls on both (Edit / Export /
           Delete / Test); Create + Import live on the Scenarios tab.
           Built-in scenarios are read-only JSON files and never appear
           here. -->
      <div class="editor-tabs">
        <button
          class="editor-tab"
          :class="{ 'editor-tab-active': activeTab === 'scenario' }"
          @click="switchTab('scenario')"
        >
          Scenarios
        </button>
        <button
          class="editor-tab"
          :class="{ 'editor-tab-active': activeTab === 'savedMap' }"
          @click="switchTab('savedMap')"
        >
          Saved maps
        </button>
      </div>

      <div class="editor-list-body">
        <div ref="listRef" class="editor-list-pane">
          <div class="editor-list">
            <!-- Create / Import sit above the entries: with a long list
                 they'd otherwise be scrolled out of reach, and they're
                 the actions a user arrives here to take. Scenarios tab
                 only — saved maps come from games, not from here. -->
            <template v-if="activeTab === 'scenario'">
              <button class="editor-list-item editor-list-item-new" @click="openCreateDialog">
                + Create new scenario
              </button>
              <button class="editor-list-item editor-list-item-new" @click="triggerImport">
                ↑ Import scenario from file
              </button>
            </template>
            <button
              v-for="s in entries"
              :key="s.id"
              class="editor-list-item"
              :class="{ 'editor-list-item-selected': selectedId === s.id }"
              @click="selectScenario(s.id)"
            >
              <div class="editor-list-name">
                {{ s.map.name }}
              </div>
              <div class="editor-list-meta">
                <!-- "placed of capacity": the editor is where the gap
                     matters, so both numbers are shown. -->
                {{ actualPlayers(s.map).total }} of {{ s.map.metadata.playersNum }}p ·
                {{ s.map.metadata.width }}×{{ s.map.metadata.height }}
              </div>
            </button>
            <div v-if="activeTab === 'savedMap' && entries.length === 0" class="editor-list-empty">
              No saved maps yet. Save one from the in-game menu during a random-map game.
            </div>
          </div>
        </div>

        <div ref="previewRef" class="editor-preview-pane">
          <div v-if="!selected" class="editor-preview-empty">
            Pick a scenario on the left, or create a new one.
          </div>

          <div v-else class="editor-preview">
            <!-- Fog-of-war maps preview masked to the first human seat's
                 starting visibility — same rule as ScenariosPage, applied
                 to both tabs, so the browser doesn't spoil the layout. -->
            <MapPreview
              :map="selected.map"
              :max-size="320"
              :viewing-player="previewViewingPlayer"
            />

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
                {{ selectedActual.humans }} of {{ selected.map.metadata.humanPlayersNum }}
              </div>
              <div class="settings-row">
                <span class="settings-icon"><img :src="getImagePath('bot_icon')" alt="" /></span>
                {{ selectedActual.bots }} of {{ selected.map.metadata.botPlayersNum }}
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

            <p v-if="activeTab === 'savedMap'" class="editor-description">
              Saved {{ formatDate(selected.map.metadata.savedAt) }}
            </p>
            <p v-else-if="selected.description" class="editor-description">
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
        <!-- Immediate SP launch on the selected entry — the same start
             payload SavedMapsPage/ScenariosPage build, so a designer can
             try a map without leaving the editor flow. -->
        <button class="editor-btn editor-btn-primary" :disabled="!selected" @click="testMap">
          Test
        </button>
        <!--
          Exports the selected entry as a `.ldm` file (JSON content, see
          `buildScenarioFile`). Same wrapper for both tabs, so the
          receiver doesn't have to know the source.
        -->
        <button class="editor-btn" :disabled="!selected" @click="exportSelected">Export</button>
        <button class="editor-btn editor-btn-danger" :disabled="!selected" @click="askDelete">
          Delete
        </button>
      </div>

      <!--
        Hidden file picker — triggered from the "Import scenario from
        file" list item. We clear its value on every open so re-importing
        the same file fires `change` again. Accepts the modern `.ldm`
        extension plus legacy `.json` exports — the content is validated
        by the wrapper `kind`, never the extension.
      -->
      <input
        ref="importInput"
        type="file"
        accept=".ldm,.json,application/json"
        class="editor-import-input"
        @change="onImportFile"
      />
    </div>

    <ConfirmDialog
      v-if="deleteTarget"
      :message="deleteConfirmMessage"
      confirm-label="Delete"
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
  ENTRY_SOURCES,
  listEditorScenarios,
  deleteAnyEditorEntry,
  createNewScenario,
  buildScenarioFile,
  importEditorScenario,
  migrateLegacyBuiltinOverrides,
  SCENARIO_FILE_EXTENSION,
} from '@/game/mapEditorStorage'
import { listSavedMaps } from '@/game/mapStorage'
import { getActualPlayerCounts } from '@/game/mapSchema'
import MapPreview from '@/components/game/MapPreview.vue'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'

export default {
  name: 'MapEditorListPage',
  components: { MapPreview, ConfirmDialog },
  data() {
    return {
      // Which bucket the list shows: 'scenario' (user-authored) or
      // 'savedMap' (maps saved from games). Mirrors ENTRY_SOURCES.
      activeTab: ENTRY_SOURCES.scenario,
      entries: [],
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
      return this.entries.find(s => s.id === this.selectedId) || null
    },
    // Playable seats of the selected entry, split human/bot. Shown as
    // "n of N" so a designer sees at a glance that a 7-slot map only has
    // three colours placed.
    selectedActual() {
      return this.selected
        ? getActualPlayerCounts(this.selected.map)
        : { total: 0, humans: 0, bots: 0, seats: [] }
    },
    // The seat whose starting visibility masks the fog-of-war preview —
    // the first human seat (seat 0 for editor maps; MP-saved maps mark
    // every seat human, so it's seat 0 there too). `MapPreview` only
    // masks when this is non-null AND the map has fog enabled.
    previewViewingPlayer() {
      const players = this.selected?.map?.players
      if (!Array.isArray(players)) return null
      const idx = players.findIndex(p => p._type === 'human')
      return idx >= 0 ? idx : null
    },
    deleteConfirmMessage() {
      if (!this.deleteTarget) return ''
      return `Delete "${this.deleteTarget.map.name}"? This cannot be undone.`
    },
  },
  mounted() {
    // Legacy override-layer data (built-ins used to be editable) is
    // copied into the user bucket once before the first listing.
    migrateLegacyBuiltinOverrides()
    this.refresh()
  },
  methods: {
    getImagePath,
    actualPlayers(map) {
      return getActualPlayerCounts(map)
    },
    refresh() {
      if (this.activeTab === ENTRY_SOURCES.savedMap) {
        // Saved maps are keyed by name in their bucket — the name doubles
        // as the entry id. No description; savedAt shown instead.
        this.entries = listSavedMaps().map(map => ({
          id: map.name,
          description: '',
          map,
          source: ENTRY_SOURCES.savedMap,
        }))
      } else {
        this.entries = listEditorScenarios().map(s => ({
          ...s,
          source: ENTRY_SOURCES.scenario,
        }))
      }
      if (this.selectedId && !this.entries.find(s => s.id === this.selectedId)) {
        this.selectedId = null
      }
    },
    switchTab(tab) {
      if (this.activeTab === tab) return
      this.activeTab = tab
      this.selectedId = null
      this.importError = ''
      this.refresh()
    },
    formatDate(iso) {
      if (!iso) return ''
      return iso.slice(0, 10)
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
      if (!this.selected) return
      emitter.emit('openMapEditorCanvas', { id: this.selected.id, source: this.selected.source })
    },
    testMap() {
      // Immediate SP launch on the selected entry — same payload shape
      // SavedMapsPage/ScenariosPage build. `enableScoutMode` is not part
      // of the canonical map schema, so force the modern "fog blocks
      // movement" rule at the boundary (legacy false is not playable).
      if (!this.selected) return
      const map = this.selected.map
      emitter.emit('startGame', {
        ...map.settings,
        humanPlayersNum: map.metadata.humanPlayersNum,
        botPlayersNum: map.metadata.botPlayersNum,
        width: map.metadata.width,
        height: map.metadata.height,
        enableScoutMode: true,
        initialMap: map,
        // Test launches from either tab; only the Scenarios tab counts as
        // a scenario for the lose rules.
        isScenario: this.activeTab === ENTRY_SOURCES.scenario,
        loadGame: false,
      })
    },
    askDelete() {
      this.deleteTarget = this.selected
    },
    confirmDelete() {
      const target = this.deleteTarget
      deleteAnyEditorEntry(target)
      this.deleteTarget = null
      this.selectedId = null
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
      a.download = `${safe}.${SCENARIO_FILE_EXTENSION}`
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

/* Bucket tabs (Scenarios / Saved maps). Same palette as the list items
   so the header reads as part of the list, with the active tab using
   the selected-item tan. */
.editor-tabs {
  display: flex;
  justify-content: center;
  gap: 8px;
  max-width: 900px;
  margin: 0 auto 12px;
}

.editor-tab {
  background: rgba(146, 104, 70, 0.65);
  border: 1px solid #5e3e26;
  border-bottom-width: 3px;
  border-radius: 6px;
  padding: 8px 18px;
  cursor: pointer;
  color: #fff;
  font-family: inherit;
  font-size: 14px;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
}

.editor-tab:hover {
  background: rgba(146, 104, 70, 0.85);
}

.editor-tab-active {
  background: #deae88;
  color: #000;
  text-shadow: none;
}

.editor-list-empty {
  font-style: italic;
  font-size: 13px;
  color: #fff;
  opacity: 0.8;
  padding: 12px 4px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
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
