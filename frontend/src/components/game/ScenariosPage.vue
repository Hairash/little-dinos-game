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
            <button
              v-for="s in scenarios"
              :key="s.id"
              class="scenarios-list-item"
              :class="{ 'scenarios-list-item-selected': selectedId === s.id }"
              @click="handleSelect(s.id)"
            >
              <div class="scenarios-list-name">{{ s.map.name }}</div>
              <div class="scenarios-list-meta">
                {{ s.map.metadata.playersNum }}p · {{ s.map.metadata.width }}×{{
                  s.map.metadata.height
                }}
              </div>
            </button>
          </div>
        </div>

        <div ref="previewRef" class="scenarios-preview-pane">
          <div v-if="selected" class="scenarios-preview">
            <MapPreview :map="selected.map" :max-size="320" />
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

      <div class="scenarios-bottom-buttons">
        <button
          class="scenarios-btn scenarios-btn-primary"
          :disabled="!selected"
          @click="handleStart"
        >
          Start Game
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import emitter from '@/game/eventBus'
import { getImagePath } from '@/game/helpers'
import { GAME_STATES } from '@/game/const'
import { SCENARIOS } from '@/game/scenariosData'
import { listEditorScenarios, listBuiltinOverrides } from '@/game/mapEditorStorage'
import MapPreview from '@/components/game/MapPreview.vue'

export default {
  name: 'ScenariosPage',
  components: { MapPreview },
  data() {
    // Built-ins first (curated order, with the user's editor overrides
    // applied when present), user-authored scenarios appended.
    // Description defaults to a friendly stub for user maps that
    // haven't had one filled in via the editor's parameters form.
    const overrides = listBuiltinOverrides()
    const builtins = SCENARIOS.map(s => {
      const o = overrides[s.id]
      if (!o) return s
      return {
        id: s.id,
        description: o.description || s.description,
        map: o.map,
      }
    })
    const userEntries = listEditorScenarios().map(s => ({
      id: s.id,
      description: s.description || '(User-created scenario from Map Editor.)',
      map: s.map,
    }))
    const merged = [...builtins, ...userEntries]
    return {
      scenarios: merged,
      selectedId: merged[0]?.id ?? null,
    }
  },
  computed: {
    selected() {
      return this.scenarios.find(s => s.id === this.selectedId) || null
    },
  },
  methods: {
    getImagePath,
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
