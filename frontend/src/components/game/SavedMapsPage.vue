<template>
  <div class="saved-maps-page">
    <!-- Sub-menu page header. Same pattern as TutorialPage and
         GameSetup (see .claude/docs/sub-menu-pages.md): the back
         button is absolutely positioned in the top-left, and the
         title is a plain centered h1. Centering is relative to the
         viewport, so the title stays centered regardless of the
         arrow's width. -->
    <button class="goBackBtn" @click="goBack" title="Back">
      <img :src="getImagePath('arrow_white')" alt="Back" />
    </button>
    <h1>Saved maps</h1>
    <div class="saved-maps-content">
      <!-- Two-column layout above 760px (list on the left, preview on
         the right). Below 760px the columns stack: list first, then
         preview, with a "Back to the list" link under the preview.
         Mirrors GameSetup.vue's responsive layout pattern. -->
      <div class="saved-maps-body">
        <div ref="listRef" class="saved-maps-list-pane">
          <div class="saved-maps-list">
            <button
              v-for="m in maps"
              :key="m.name"
              class="saved-maps-list-item"
              :class="{ 'saved-maps-list-item-selected': selectedName === m.name }"
              @click="handleSelectMap(m.name)"
            >
              <div class="saved-maps-list-name">{{ m.name }}</div>
              <div class="saved-maps-list-meta">
                {{ m.metadata.playersNum }}p · {{ m.metadata.width }}×{{ m.metadata.height }} ·
                {{ formatDate(m.metadata.savedAt) }}
              </div>
            </button>
          </div>
        </div>

        <div ref="previewRef" class="saved-maps-preview-pane">
          <div v-if="selectedMap" class="saved-maps-preview">
            <MapPreview :map="selectedMap" :max-size="320" />
            <!-- Read-only summary of the map's settings. Each row is a
               small `icon.png`-plate icon + the value text — same
               vocabulary as GameSetup but compact (≈18 px icons, 13 px
               text) since it's information-only. -->
            <div class="saved-maps-settings">
              <div class="settings-row">
                <span class="settings-icon"><img :src="getImagePath('field_icon')" alt="" /></span>
                {{ selectedMap.metadata.width }}×{{ selectedMap.metadata.height }}
              </div>
              <div class="settings-row">
                <span class="settings-icon"><img :src="getImagePath('human_icon')" alt="" /></span>
                {{ selectedMap.metadata.humanPlayersNum }}
              </div>
              <div class="settings-row">
                <span class="settings-icon"><img :src="getImagePath('bot_icon')" alt="" /></span>
                {{ selectedMap.metadata.botPlayersNum }}
              </div>
              <div class="settings-row">
                <span class="settings-icon"><img :src="getImagePath('speed_icon')" alt="" /></span>
                {{ selectedMap.settings.minSpeed }}–{{ selectedMap.settings.maxSpeed }}
              </div>
              <div class="settings-row">
                <span class="settings-icon"><img :src="getImagePath('dino_icon')" alt="" /></span>
                {{ selectedMap.settings.maxUnitsNum }}
              </div>
              <div class="settings-row">
                <span class="settings-icon"
                  ><img :src="getImagePath('dino_icon_plus')" alt=""
                /></span>
                {{ selectedMap.settings.unitModifier }}
              </div>
              <div class="settings-row">
                <span class="settings-icon"><img :src="getImagePath('tower_icon')" alt="" /></span>
                {{ selectedMap.settings.maxBasesNum }}
              </div>
              <div class="settings-row">
                <span class="settings-icon"
                  ><img :src="getImagePath('tower_icon_plus')" alt=""
                /></span>
                {{ selectedMap.settings.baseModifier }}
              </div>
              <div class="settings-row">
                <span class="settings-icon">
                  <img
                    :src="
                      getImagePath(selectedMap.settings.enableFogOfWar ? 'closed_eye' : 'open_eye')
                    "
                    alt=""
                  />
                </span>
                <template v-if="selectedMap.settings.enableFogOfWar">
                  {{ selectedMap.settings.fogOfWarRadius }}
                </template>
              </div>
              <div class="settings-row">
                <span class="settings-icon">
                  <img
                    :src="
                      getImagePath(
                        selectedMap.settings.visibilitySpeedRelation
                          ? 'visibility_speed_relation_icon'
                          : 'visibility_speed_no_relation_icon'
                      )
                    "
                    alt=""
                  />
                </span>
                <template v-if="selectedMap.settings.visibilitySpeedRelation">
                  ≥ {{ selectedMap.settings.speedMinVisibility }}
                </template>
              </div>
              <div class="settings-row">
                <span class="settings-icon">
                  <img
                    :src="
                      getImagePath(
                        selectedMap.settings.killAtBirth
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
                        selectedMap.settings.hideEnemySpeed ? 'hide_speed_icon' : 'show_speed_icon'
                      )
                    "
                    alt=""
                  />
                </span>
              </div>
            </div>
            <!-- Mobile-only "back to list" link. Hidden on desktop via
               CSS media query so we don't show it when both panes are
               on screen at once. -->
            <a class="saved-maps-back-to-list" href="#" @click.prevent="scrollToList">
              ↑ Back to the list
            </a>
          </div>
          <div v-else class="saved-maps-preview-empty">Pick a map on the left to preview it.</div>
        </div>
      </div>

      <div class="saved-maps-bottom-buttons">
        <button
          class="saved-maps-btn saved-maps-btn-primary"
          :disabled="!selectedMap"
          @click="handleStart"
        >
          {{ mode === 'pick' ? 'Use This Map' : 'Start Game' }}
        </button>
        <button class="saved-maps-btn" :disabled="!selectedMap" @click="askDelete">Delete</button>
      </div>
    </div>

    <ConfirmDialog
      v-if="deleteCandidate"
      :message="`Delete saved map &quot;${deleteCandidate}&quot;?`"
      confirm-label="Delete"
      cancel-label="Cancel"
      :handle-confirm="confirmDelete"
      :handle-cancel="cancelDelete"
    />
  </div>
</template>

<script>
import emitter from '@/game/eventBus'
import { listSavedMaps, deleteSavedMap, getSavedMap } from '@/game/mapStorage'
import { getImagePath } from '@/game/helpers'
import { GAME_STATES } from '@/game/const'
import MapPreview from '@/components/game/MapPreview.vue'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'

export default {
  name: 'SavedMapsPage',
  components: { MapPreview, ConfirmDialog },
  props: {
    // 'launch' (default): Start Game launches a fresh SP game from the
    // selected map.
    // 'pick': Start Game emits 'mapPicked' with the selected map back
    // to the caller (LobbyPage uses this to seed an MP game).
    mode: {
      type: String,
      default: 'launch',
    },
    // Optional source supplier — multiplayer view passes a function
    // that fetches from the server; defaults to local storage.
    listSource: {
      type: Function,
      default: null,
    },
    deleteSource: {
      type: Function,
      default: null,
    },
  },
  emits: ['mapPicked'],
  data() {
    return {
      maps: [],
      selectedName: null,
      // Name of the map the user has asked to delete; null hides the
      // ConfirmDialog. Holding the name (not a boolean) lets the dialog
      // render the target's name in its message.
      deleteCandidate: null,
    }
  },
  computed: {
    selectedMap() {
      return this.maps.find(m => m.name === this.selectedName) || null
    },
    backPage() {
      // Pick mode (from lobby) returns to the lobby; launch mode (from
      // main menu) returns to the New Game submenu.
      return this.mode === 'pick' ? GAME_STATES.lobby : GAME_STATES.newGame
    },
  },
  async mounted() {
    await this.refresh()
    if (this.maps.length === 0) {
      // Bounce back to where the user came from and surface the empty
      // state via the same MenuError dialog that "Load Game" uses when
      // no autosave exists. The caller page renders MenuError; we just
      // dispatch.
      emitter.emit('setError', 'No saved maps found. Save a map from the in-game menu first.')
      emitter.emit('goToPage', this.backPage)
      return
    }
    this.selectedName = this.maps[0].name
  },
  methods: {
    getImagePath,
    async refresh() {
      if (this.listSource) {
        this.maps = (await this.listSource()) || []
      } else {
        this.maps = listSavedMaps()
      }
    },
    isMobileLayout() {
      // Single source of truth for the "list stacks above preview"
      // breakpoint. Matches the CSS media query (760px) so the click
      // behaviour stays in sync with the visual layout. Falls back to
      // false in non-browser test environments.
      return typeof window !== 'undefined' && window.matchMedia('(max-width: 759px)').matches
    },
    handleSelectMap(name) {
      this.selectedName = name
      if (!this.isMobileLayout()) return
      // Mobile-only: pull the preview into view after Vue has rendered
      // the new selection. Without nextTick the scroll target's height
      // is the empty-state's, not the preview's.
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
    formatDate(iso) {
      if (!iso) return ''
      return iso.slice(0, 10)
    },
    askDelete() {
      if (!this.selectedMap) return
      this.deleteCandidate = this.selectedMap.name
    },
    cancelDelete() {
      this.deleteCandidate = null
    },
    async confirmDelete() {
      const name = this.deleteCandidate
      this.deleteCandidate = null
      if (!name) return
      if (this.deleteSource) {
        await this.deleteSource(name)
      } else {
        deleteSavedMap(name)
      }
      await this.refresh()
      if (this.maps.length === 0) {
        emitter.emit('setError', 'No saved maps found. Save a map from the in-game menu first.')
        emitter.emit('goToPage', this.backPage)
        return
      }
      this.selectedName = this.maps[0]?.name ?? null
    },
    handleStart() {
      if (!this.selectedMap) return
      if (this.mode === 'pick') {
        const fresh = this.listSource ? this.selectedMap : getSavedMap(this.selectedMap.name)
        this.$emit('mapPicked', fresh || this.selectedMap)
        return
      }
      emitter.emit('startGame', this.mapToStartSettings(this.selectedMap))
    },
    mapToStartSettings(map) {
      return {
        ...map.settings,
        humanPlayersNum: map.metadata.humanPlayersNum,
        botPlayersNum: map.metadata.botPlayersNum,
        width: map.metadata.width,
        height: map.metadata.height,
        initialMap: map,
        loadGame: false,
      }
    },
    goBack() {
      emitter.emit('goToPage', this.backPage)
    },
  },
}
</script>

<style scoped>
/* Match GameSetup.vue's palette: background.png with the brown panels
   used elsewhere in the game (lobby setup, game settings). */
.saved-maps-page {
  position: relative;
  background-image: url('/images/background.png');
  background-size: cover;
  overflow: auto;
  height: 100vh;
  width: 100vw;
  /* No padding on the wrapper — the title is a direct child and
     centers against the viewport, so any padding here would offset
     the title's centering relative to the absolute-positioned back
     arrow. Inner padding lives on `.saved-maps-content` instead so
     the body and bottom buttons don't touch the edges. Same shape
     TutorialPage uses (wrapper bare, inner #tutorialContent padded). */
}

.saved-maps-content {
  padding: 0 16px 30px 16px;
}

/* Header pattern matching TutorialPage and GameSetup: back arrow is
   absolutely positioned in the top-left corner, and the title is a
   plain centered h1. Because the back button is taken out of layout
   flow, the title's centering is calculated against the viewport and
   stays put no matter how wide the button is. Documented in
   .claude/docs/sub-menu-pages.md. */
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
  /* arrow_white.png already points left — render as-is, no transform. */
}

.goBackBtn:hover img {
  filter: brightness(1.15);
}

.saved-maps-page h1 {
  margin: 0;
  padding: 30px;
  text-align: center;
  /* Keep multi-word titles ("Saved maps") on one line so the heading
     doesn't drop and the visual rhythm with the back arrow stays
     consistent across viewports. */
  white-space: nowrap;
}

/* Mobile-first: stack list above preview. The list pane is its own
   scroll region (capped height) so a long roster doesn't push the
   preview off the screen entirely — the user can still scroll within
   the list and then to the preview below. */
.saved-maps-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 900px;
  margin: 0 auto;
  align-items: stretch;
}

.saved-maps-list-pane {
  display: flex;
  flex-direction: column;
}

.saved-maps-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  /* Cap the list height so the preview is reachable by scrolling the
     page on mobile. On desktop the row layout makes this irrelevant. */
  max-height: 50vh;
}

/* Desktop: side-by-side. Mirrors GameSetup.vue's 760px breakpoint so
   the two screens behave consistently. */
@media (min-width: 760px) {
  .saved-maps-body {
    display: grid;
    grid-template-columns: minmax(220px, 320px) 1fr;
    align-items: flex-start;
    min-height: 360px;
  }

  .saved-maps-list {
    max-height: 460px;
  }
}

.saved-maps-list-item {
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

.saved-maps-list-item:hover {
  background: rgba(146, 104, 70, 0.85);
}

.saved-maps-list-item-selected {
  background: #deae88;
  color: #000;
  border-color: #5e3e26;
  text-shadow: none;
}

.saved-maps-list-name {
  font-weight: bold;
  font-size: 14px;
}

.saved-maps-list-meta {
  font-size: 12px;
  margin-top: 2px;
  opacity: 0.85;
}

.saved-maps-preview-pane {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 6px;
  padding: 12px;
}

.saved-maps-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
}

/* Lean icon-row summary of the map's settings. Replaces the older
   "bold label: value" text rows with the same small `icon.png` plate
   GameSetup uses for labels, just sized down so it reads as inline
   text rather than a control. No per-row plate background. */
.saved-maps-settings {
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

.saved-maps-preview-empty {
  color: #fff;
  font-style: italic;
  padding: 40px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
}

/* "Back to the list" link below the preview. Visible only on mobile;
   on desktop both panes are on screen at the same time so a scroll-up
   link makes no sense. */
.saved-maps-back-to-list {
  display: none;
  margin-top: 12px;
  color: #deae88;
  text-decoration: underline;
  cursor: pointer;
  font-size: 14px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
}

@media (max-width: 759px) {
  .saved-maps-back-to-list {
    display: inline-block;
  }
}

.saved-maps-bottom-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}

.saved-maps-btn {
  background-color: #926846;
  color: #ffffff;
  border: 1px solid #5e3e26;
  padding: 10px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
}

.saved-maps-btn:hover:not(:disabled) {
  background-color: #b0815a;
}

.saved-maps-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.saved-maps-btn-primary {
  background-color: #5e3e26;
}

.saved-maps-btn-primary:hover:not(:disabled) {
  background-color: #7a4f30;
}
</style>
