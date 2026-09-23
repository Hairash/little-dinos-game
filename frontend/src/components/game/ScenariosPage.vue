<template>
  <div class="scenarios-page">
    <button class="goBackBtn" @click="goBack" title="Back">
      <img :src="getImagePath('arrow_white')" alt="Back" />
    </button>
    <h1>Scenarios</h1>
    <div class="scenarios-content">
      <div class="scenarios-body">
        <div ref="listRef" class="scenarios-list-pane">
          <div class="scenarios-list">
            <!-- Import sits on top so a shared .ldm file can be pulled in
                 without a trip through the Map Editor. The imported entry
                 lands in the user-scenarios bucket (same as the editor's
                 Import) and is selected right away. -->
            <button class="scenarios-list-item scenarios-list-item-new" @click="triggerImport">
              ↑ Import scenario from file
            </button>
            <button
              v-for="s in scenarios"
              :key="s.id"
              class="scenarios-list-item"
              :class="{ 'scenarios-list-item-selected': selectedId === s.id }"
              @click="handleSelect(s.id)"
            >
              <div class="scenarios-list-name">
                <!-- Beaten in single-player. Same cue the tutorial list
                     uses; cosmetic only. -->
                <span
                  v-if="wonMaps[wonKey(s.map.name, true)]"
                  class="scenarios-list-won"
                  title="Won"
                  >✓</span
                >
                {{ s.map.name }}
                <!-- Tags the read-only scenarios that ship with the game
                     (JSON files in src/game/scenarios/), as opposed to
                     the user's own from the Map Editor. -->
                <span v-if="s.isBuiltin" class="scenarios-list-badge">default</span>
              </div>
              <div class="scenarios-list-meta">
                <!-- Playable seats, not the map's declared capacity —
                     that's what you'll actually face in the game. -->
                {{ actualPlayers(s.map) }}p · {{ s.map.metadata.width }}×{{ s.map.metadata.height }}
              </div>
            </button>
          </div>
        </div>

        <div ref="previewRef" class="scenarios-preview-pane">
          <div v-if="selected" class="scenarios-preview">
            <MapPreview
              :map="selected.map"
              :max-size="320"
              :viewing-player="previewViewingPlayer"
            />
            <p class="scenarios-description">{{ selected.description }}</p>
            <a class="scenarios-back-to-list" href="#" @click.prevent="scrollToList">
              ↑ Back to the list
            </a>
          </div>
          <div v-else class="scenarios-preview-empty">
            Pick a scenario on the left to preview it.
          </div>
        </div>
      </div>

      <div v-if="importError" class="scenarios-import-error">{{ importError }}</div>

      <div class="scenarios-bottom-buttons">
        <button
          class="scenarios-btn scenarios-btn-primary"
          :disabled="!selected"
          @click="handleStart"
        >
          Start Game
        </button>
      </div>

      <!-- Hidden file picker for the Import item; value cleared on every
           open so re-importing the same file fires `change` again. -->
      <input
        ref="importInput"
        type="file"
        accept=".ldm,.json,application/json"
        class="scenarios-import-input"
        @change="onImportFile"
      />
    </div>
  </div>
</template>

<script>
import emitter from '@/game/eventBus'
import { getImagePath } from '@/game/helpers'
import { GAME_STATES } from '@/game/const'
import { SCENARIOS } from '@/game/scenarios'
import { getActualPlayerCounts } from '@/game/mapSchema'
import { loadWonMaps, wonKey } from '@/game/mapProgress'
import {
  listEditorScenarios,
  migrateLegacyBuiltinOverrides,
  importEditorScenario,
} from '@/game/mapEditorStorage'
import MapPreview from '@/components/game/MapPreview.vue'

// Built-ins first (curated order — read-only JSON files from
// `src/game/scenarios/`), user-authored scenarios appended.
// Description defaults to a friendly stub for user maps that
// haven't had one filled in via the editor's parameters form.
function buildScenarioList() {
  // `isBuiltin` drives the DEFAULT badge — the picker mixes the shipped
  // read-only scenarios with the user's own, and the badge is the only
  // cue telling them apart (an imported copy of a built-in carries the
  // same name).
  const builtins = SCENARIOS.map(s => ({ ...s, isBuiltin: true }))
  const userEntries = listEditorScenarios().map(s => ({
    id: s.id,
    description: s.description || '(User-created scenario from Map Editor.)',
    map: s.map,
    isBuiltin: false,
  }))
  return [...builtins, ...userEntries]
}

export default {
  name: 'ScenariosPage',
  components: { MapPreview },
  data() {
    // Legacy built-in overrides (the editor used to edit built-ins in
    // place) are copied into the user bucket once before listing.
    migrateLegacyBuiltinOverrides()
    const merged = buildScenarioList()
    return {
      scenarios: merged,
      selectedId: merged[0]?.id ?? null,
      // Surface for import failures (bad JSON, schema mismatch, etc.).
      importError: '',
      // `{ key: true }` of scenarios already beaten in single-player.
      wonMaps: loadWonMaps(),
    }
  },
  computed: {
    selected() {
      return this.scenarios.find(s => s.id === this.selectedId) || null
    },
    // The seat whose starting visibility the preview masks to — the
    // first human seat, which is seat 0 in every shipped scenario.
    // `MapPreview` only masks when this is non-null AND the map has fog
    // enabled. Every browser (this page, the editor list, the saved-maps
    // picker) applies the same rule.
    previewViewingPlayer() {
      const players = this.selected?.map?.players
      if (!Array.isArray(players)) return null
      const idx = players.findIndex(p => p._type === 'human')
      return idx >= 0 ? idx : null
    },
  },
  methods: {
    getImagePath,
    wonKey,
    actualPlayers(map) {
      return getActualPlayerCounts(map).total
    },
    refreshScenarios() {
      this.scenarios = buildScenarioList()
      if (this.selectedId && !this.scenarios.find(s => s.id === this.selectedId)) {
        this.selectedId = this.scenarios[0]?.id ?? null
      }
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
        this.refreshScenarios()
        this.selectedId = entry.id
      } catch (e) {
        this.importError = `Import failed: ${e.message || 'unable to read file'}`
      }
    },
    isMobileLayout() {
      return typeof window !== 'undefined' && window.matchMedia('(max-width: 759px)').matches
    },
    handleSelect(id) {
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
    handleStart() {
      if (!this.selected) return
      const map = this.selected.map
      emitter.emit('startGame', {
        ...map.settings,
        humanPlayersNum: map.metadata.humanPlayersNum,
        botPlayersNum: map.metadata.botPlayersNum,
        width: map.metadata.width,
        height: map.metadata.height,
        // `enableScoutMode` is not part of the canonical map schema, so
        // pickSettings strips it. Force it on for scenarios — the modern
        // rule is "fog of war blocks movement" (true = blocks). The
        // legacy permissive mode (false) is not a playable option here.
        enableScoutMode: true,
        initialMap: map,
        // A scenario is a puzzle to replay, so losing keeps its fog and
        // ends the run — unlike a saved map, which behaves like the
        // random game it came from.
        isScenario: true,
        loadGame: false,
      })
    },
    goBack() {
      emitter.emit('goToPage', GAME_STATES.newGame)
    },
  },
}
</script>

<style scoped>
.scenarios-page {
  position: relative;
  background-image: url('/images/background.png');
  background-size: cover;
  overflow: auto;
  height: 100vh;
  width: 100vw;
}

.scenarios-content {
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
  user-select: none;
}

.goBackBtn:hover img {
  filter: brightness(1.15);
}

.scenarios-page h1 {
  margin: 0;
  padding: 30px;
  text-align: center;
  white-space: nowrap;
}

.scenarios-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 900px;
  margin: 0 auto;
  align-items: stretch;
}

.scenarios-list-pane {
  display: flex;
  flex-direction: column;
}

.scenarios-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  max-height: 50vh;
}

@media (min-width: 760px) {
  .scenarios-body {
    display: grid;
    grid-template-columns: minmax(220px, 320px) 1fr;
    align-items: flex-start;
    min-height: 360px;
  }

  .scenarios-list {
    max-height: 460px;
  }
}

.scenarios-list-item {
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

.scenarios-list-item:hover {
  background: rgba(146, 104, 70, 0.85);
}

/* The Import action item — same dashed style the Map Editor's list
   uses for its create/import entries, so the affordance reads the
   same in both browsers. */
.scenarios-list-item-new {
  background: rgba(94, 62, 38, 0.85);
  text-align: center;
  font-weight: bold;
  border: 1px dashed #deae88;
}

.scenarios-list-item-new:hover {
  background: rgba(94, 62, 38, 1);
}

/* Inline error shown above the bottom button row when an import
   fails — same red as the editor's import error. */
.scenarios-import-error {
  color: #a00;
  font-size: 12px;
  text-align: center;
  margin: 10px auto 0;
  max-width: 480px;
}

/* Hidden file input, triggered from the Import list item. */
.scenarios-import-input {
  display: none;
}

.scenarios-list-item-selected {
  background: #deae88;
  color: #000;
  border-color: #5e3e26;
  text-shadow: none;
}

.scenarios-list-name {
  font-weight: bold;
  font-size: 14px;
}

/* "Beaten" tick, matching the tutorial list's cue. */
.scenarios-list-won {
  color: #7ddb7d;
  margin-right: 4px;
}

/* Inline "default" tag on the shipped scenarios. Small pill so it
   doesn't dominate the row but is obvious enough to disambiguate a
   user's own copy from the original. */
.scenarios-list-badge {
  /* display: inline-block; */
  float: right;
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

.scenarios-list-item-selected .scenarios-list-badge {
  background: rgba(94, 62, 38, 0.85);
  color: #fff;
}

.scenarios-list-meta {
  font-size: 12px;
  margin-top: 2px;
  opacity: 0.85;
}

.scenarios-preview-pane {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 6px;
  padding: 12px;
}

.scenarios-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.scenarios-description {
  color: #fff;
  font-size: 14px;
  line-height: 1.45;
  text-align: left;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  margin: 0;
  max-width: 480px;
}

.scenarios-preview-empty {
  color: #fff;
  font-style: italic;
  padding: 40px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
}

.scenarios-back-to-list {
  display: none;
  margin-top: 4px;
  color: #deae88;
  text-decoration: underline;
  cursor: pointer;
  font-size: 14px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
}

@media (max-width: 759px) {
  .scenarios-back-to-list {
    display: inline-block;
  }
}

.scenarios-bottom-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}

.scenarios-btn {
  background-color: #926846;
  color: #ffffff;
  border: 1px solid #5e3e26;
  padding: 10px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
}

.scenarios-btn:hover:not(:disabled) {
  background-color: #b0815a;
}

.scenarios-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.scenarios-btn-primary {
  background-color: #5e3e26;
}

.scenarios-btn-primary:hover:not(:disabled) {
  background-color: #7a4f30;
}
</style>
