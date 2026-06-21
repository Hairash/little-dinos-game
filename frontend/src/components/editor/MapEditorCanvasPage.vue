<template>
  <div class="editor-canvas-page">
    <!--
      Outer scroll viewport sized to (viewport − bottomPanelHeight). Same
      pattern as GameGrid: `.board-wrapper-container` uses
      `min-width: max(100vw, --board-width)` so wide maps scroll cleanly
      to either edge (the naive `display: flex; justify-content: center`
      directly on the scroll container clips the left edge of wide
      boards). See `.claude/docs/scenarios.md` → Map Editor.
    -->
    <div
      v-if="map"
      ref="bodyRef"
      class="game-grid-container"
      :style="{
        '--board-width': boardWidthPx,
        '--board-height': boardHeightPx,
      }"
    >
      <div
        class="board-wrapper-container"
        :style="{
          '--board-width': boardWidthPx,
          '--board-height': boardHeightPx,
        }"
      >
        <div class="board-wrapper" :style="{ width: boardWidthPx, height: boardHeightPx }">
          <!--
            Match GameGrid's structure exactly: a `.board` with the 2px
            outer border, containing `.cell_line` rows of inline-block
            `div.cell` elements. No per-cell borders, no gaps — terrain
            tiles meet edge-to-edge, same as in the game.
          -->
          <div class="board" :style="{ width: boardWidthPx, height: boardHeightPx }">
            <div
              v-for="(line, y) in fieldT"
              :key="`row-${y}`"
              class="cell_line"
              :style="{ width: boardWidthPx, height: `${cellSize}px` }"
            >
              <!--
                Drag-to-paint: `mousedown.left` arms the brush and paints
                the starting cell; `mouseenter` paints any cell crossed
                while the button stays down (`onPaintMove` dedups
                consecutive enters on the same cell). `mouseup` lives on
                `window` so releasing off the grid still ends the
                stroke. We don't bind a `click` handler — `mousedown`
                already paints, and PC click would just double-fire.
                Touch tap is synthesized as a mousedown+mouseup pair so
                single-tap painting still works on touch screens, but
                drag-paint is PC-only by design (touch drag has to keep
                scrolling the canvas).
              -->
              <div
                v-for="(cellData, x) in line"
                :key="`cell-${x}-${y}`"
                class="cell"
                :style="{ width: `${cellSize}px`, height: `${cellSize}px` }"
                @mousedown.left="onPaintStart(x, y)"
                @mouseenter="onPaintMove(x, y)"
                @contextmenu="onCellContextMenu($event, x, y)"
                :title="`(${x}, ${y})`"
              >
                <img
                  class="terrainImg"
                  :src="getImagePath(terrainImage(cellData.terrain))"
                  :style="{ width: `${cellSize}px`, height: `${cellSize}px` }"
                />
                <img
                  v-if="cellData.building"
                  class="overlayImg buildingImg"
                  :src="getImagePath(buildingImage(cellData.building))"
                  :alt="cellData.building._type"
                  :style="{
                    width: `${cellSize * 0.9}px`,
                    height: `${cellSize * 0.9}px`,
                    left: `${cellSize * 0.05}px`,
                    top: `${cellSize * 0.05}px`,
                  }"
                />
                <img
                  v-if="cellData.unit"
                  class="overlayImg unitImg"
                  :src="getImagePath(cellData.unit._type || `dino${cellData.unit.player + 1}`)"
                  :alt="cellData.unit._type"
                  :style="{
                    width: `${cellSize * 0.9}px`,
                    height: `${cellSize * 0.9}px`,
                    left: `${cellSize * 0.05}px`,
                    top: `${cellSize * 0.05}px`,
                  }"
                />
                <!--
                  Matches `GameUnit`'s `v-if="width > 10 && !dying"` rule
                  — at the minimum cell size the speed badge crowds the
                  dino sprite, so the in-game UI hides it. Keeping the
                  same threshold (`cellSize > 10`) means the editor
                  preview matches what a player actually sees at min
                  zoom in the live game.
                -->
                <span
                  v-if="cellData.unit?.movePoints && cellSize > MIN_CELL_SIZE"
                  class="cell-speed"
                  :style="{
                    fontSize: `${labelFontSize}px`,
                    lineHeight: `${labelFontSize + 1}px`,
                  }"
                >
                  {{ cellData.unit.movePoints }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!--
      Bottom panel — only persistent UI. Same look as the in-game
      InfoPanel: `panel.png` background, fixed bottom, max-width centred.
      Layout mirrors InfoPanel's left/right grouping: gear on the LEFT
      (the in-game "toggleMenu" position), tool buttons on the RIGHT.
    -->
    <div class="editor-bottom-panel">
      <div class="inner-info-panel">
        <span class="info-block left-group">
          <button class="infoBtn" @click="gearOpen = true" title="Menu">
            <img class="curPlayerImage" :src="getImagePath('settings_icon')" alt="Menu" />
          </button>
          <!--
            Zoom controls live on the bottom panel alongside the gear so
            they're reachable without opening the menu — same shortcut
            you'd find on any tile editor. Same `.infoBtn` 26×26 plate
            as everything else on the panel.
          -->
          <button
            class="infoBtn"
            @click="zoom(+10)"
            :disabled="cellSize >= MAX_CELL_SIZE"
            title="Zoom In"
          >
            <img class="curPlayerImage" :src="getImagePath('plus')" alt="Zoom In" />
          </button>
          <button
            class="infoBtn"
            @click="zoom(-10)"
            :disabled="cellSize <= MIN_CELL_SIZE"
            title="Zoom Out"
          >
            <img class="curPlayerImage" :src="getImagePath('minus')" alt="Zoom Out" />
          </button>
        </span>
        <!--
          Tool buttons. Terrain and Eraser are normal `.infoBtn`s.
          Building and Dino are TWICE-wide composite controls: an icon
          half (left) showing the current type/dino, and a color half
          (right) showing the owner colour. Left-click anywhere on the
          composite selects the tool. Right-click on the icon half
          opens an "object" floating popup (building type / dino
          speed); right-click on the color half opens a "color"
          floating popup. See `popup` data + `openPopup`/`pick…`
          methods below; revert by restoring this loop from
          `MapEditorCanvasPage.vue`'s git history.
        -->
        <span class="info-block right-group">
          <!-- Terrain. Right-click opens a floating popup with the two
               terrain kinds (empty, mountain) — same pattern as the
               other tools' picker popups. -->
          <button
            class="infoBtn toolBtn"
            :class="{ 'toolBtn-active': activeTool === 'terrain' }"
            title="Terrain — left-click to select, right-click to change kind"
            @click="activeTool = 'terrain'"
            @contextmenu.prevent="openPopup('terrain', 'object')"
          >
            <img
              class="curPlayerImage"
              :src="getImagePath(toolConfig.terrain.kind === 'mountain' ? 'mountain1' : 'empty1')"
              :alt="toolConfig.terrain.kind"
            />
          </button>

          <!-- Building (square `.infoBtn`) + separate color square. -->
          <span class="tool-cluster" :class="{ 'toolBtn-active': activeTool === 'building' }">
            <button
              class="infoBtn toolBtn"
              title="Building — left-click to select, right-click to change type"
              @click="activeTool = 'building'"
              @contextmenu.prevent="openPopup('building', 'object')"
            >
              <img
                class="curPlayerImage"
                :src="getImagePath(buildingToolPreviewImg)"
                :alt="toolConfig.building._type"
              />
            </button>
            <button
              class="color-square"
              title="Owner — left-click to select tool, right-click to change color"
              :style="{ background: buildingColorSwatch }"
              @click="activeTool = 'building'"
              @contextmenu.prevent="openPopup('building', 'color')"
            ></button>

            <!--
              Building popups (type and color) are NOT rendered here —
              see the panel-level container below alongside the dino
              popups. Moving them out keeps all four popups at the same
              `bottom: 100%` anchor (relative to the panel), so they
              line up vertically per spec.
            -->
          </span>

          <!-- Dino button + separate color square. -->
          <span class="tool-cluster" :class="{ 'toolBtn-active': activeTool === 'dino' }">
            <button
              class="infoBtn toolBtn"
              title="Dino — left-click to select, right-click to change speed"
              @click="activeTool = 'dino'"
              @contextmenu.prevent="openPopup('dino', 'object')"
            >
              <img
                class="curPlayerImage"
                :src="getImagePath(`dino${toolConfig.dino.player + 1}`)"
                :alt="`dino${toolConfig.dino.player + 1}`"
              />
              <span class="tool-speed-badge">{{ toolConfig.dino.speed }}</span>
            </button>
            <button
              class="color-square"
              title="Owner — left-click to select tool, right-click to change color"
              :style="{ background: getPlayerColor(toolConfig.dino.player) }"
              @click="activeTool = 'dino'"
              @contextmenu.prevent="openPopup('dino', 'color')"
            ></button>

            <!--
              Dino popups (color and speed) are NOT rendered here —
              see the panel-level container below. At max seat count
              both rows are wider than the dino cluster itself, so we
              anchor them to the right edge of the bottom panel
              instead (spec: "should always fit into screen").
            -->
          </span>

          <!-- Eraser (unchanged) -->
          <button
            class="infoBtn toolBtn"
            :class="{ 'toolBtn-active': activeTool === 'eraser' }"
            title="Eraser — left-click to select"
            @click="activeTool = 'eraser'"
            @contextmenu.prevent=""
          >
            <span class="tool-eraser">✕</span>
          </button>
        </span>
      </div>

      <!-- Terrain-kind popup. Two-option row centred above the
           terrain button. -->
      <div
        v-if="popup && popup.tool === 'terrain' && popup.kind === 'object'"
        class="floating-popup popup-anchor-terrain"
      >
        <button
          v-for="opt in TERRAIN_OPTIONS"
          :key="opt.value"
          class="floating-opt"
          :class="{ 'floating-opt-selected': opt.value === toolConfig.terrain.kind }"
          :title="opt.label"
          @click="pickTerrainKind(opt.value)"
        >
          <img :src="getImagePath(opt.preview)" :alt="opt.label" />
        </button>
      </div>

      <!--
        Dino-speed popup. Lives at the bottom-panel level (not inside
        the dino cluster) so we can anchor its right edge to the
        panel's right edge — the 3×7 grid is wider than the cluster
        itself and would otherwise overflow off-screen when the dino
        button is near the right side of the panel.
      -->
      <div
        v-if="popup && popup.tool === 'dino' && popup.kind === 'object'"
        class="floating-popup popup-anchor-panel-right popup-speed-grid"
      >
        <button
          v-for="s in 21"
          :key="s - 1"
          class="floating-opt floating-opt-speed"
          :class="{ 'floating-opt-selected': s - 1 === toolConfig.dino.speed }"
          :title="`Speed ${s - 1}`"
          @click="pickDinoSpeed(s - 1)"
        >
          {{ s - 1 }}
        </button>
      </div>

      <!--
        Dino-color popup. Panel-level for the same right-edge reason
        as the speed grid: with 8 seats the colour row is wider than
        the dino cluster, so right-aligning to the panel keeps every
        button on-screen.
      -->
      <div
        v-if="popup && popup.tool === 'dino' && popup.kind === 'color'"
        class="floating-popup popup-anchor-panel-right"
      >
        <button
          v-for="i in map?.metadata.playersNum || 1"
          :key="i"
          class="floating-opt"
          :class="{ 'floating-opt-selected': i - 1 === toolConfig.dino.player }"
          :title="`Player ${i}`"
          @click="pickDinoColor(i - 1)"
        >
          <span class="color-swatch" :style="{ background: getPlayerColor(i - 1) }"></span>
        </button>
      </div>

      <!--
        Building popups moved out of the cluster so they share the same
        `bottom: 100%` anchor (relative to the panel) the dino popups
        use, putting all four at the same vertical coordinate. Their
        horizontal centres are pinned to fixed px offsets from the
        panel's right edge — see `.popup-anchor-building-{type,color}`
        in the CSS for the math.
      -->
      <div
        v-if="popup && popup.tool === 'building' && popup.kind === 'object'"
        class="floating-popup popup-anchor-building-type"
      >
        <button
          v-for="t in BUILDING_TYPES"
          :key="t"
          class="floating-opt"
          :class="{ 'floating-opt-selected': t === toolConfig.building._type }"
          :title="t"
          @click="pickBuildingType(t)"
        >
          <img :src="getImagePath(buildingOptionImg(t))" :alt="t" />
        </button>
      </div>
      <div
        v-if="popup && popup.tool === 'building' && popup.kind === 'color'"
        class="floating-popup popup-anchor-panel-right"
      >
        <button
          class="floating-opt"
          :class="{ 'floating-opt-selected': toolConfig.building.player === null }"
          title="Neutral"
          @click="pickBuildingColor(null)"
        >
          <span class="color-swatch color-swatch-neutral"></span>
        </button>
        <button
          v-for="i in map?.metadata.playersNum || 1"
          :key="i"
          class="floating-opt"
          :class="{ 'floating-opt-selected': i - 1 === toolConfig.building.player }"
          :title="`Player ${i}`"
          @click="pickBuildingColor(i - 1)"
        >
          <span class="color-swatch" :style="{ background: getPlayerColor(i - 1) }"></span>
        </button>
      </div>
    </div>

    <!--
      Cell context menu — right-click a cell with at least one object
      to open. Up to four actions, each one opens a picker (below)
      that applies its choice DIRECTLY to the cell (no toolConfig
      involvement). Positioned at the cursor via fixed coordinates;
      the document-click listener in `mounted` dismisses it when the
      user clicks outside.
    -->
    <div
      v-if="cellMenu"
      class="cell-context-menu"
      :style="{ top: `${cellMenu.screenY}px`, left: `${cellMenu.screenX}px` }"
    >
      <button
        v-if="cellMenuCell?.building"
        class="cell-menu-item"
        @click="openCellPicker('building-type')"
      >
        Change building type
      </button>
      <button
        v-if="cellMenuCell?.building && cellMenuCell.building._type === 'base'"
        class="cell-menu-item"
        @click="openCellPicker('tower-color')"
      >
        Change tower color
      </button>
      <button
        v-if="cellMenuCell?.unit"
        class="cell-menu-item"
        @click="openCellPicker('unit-color')"
      >
        Change unit color
      </button>
      <button
        v-if="cellMenuCell?.unit"
        class="cell-menu-item"
        @click="openCellPicker('unit-speed')"
      >
        Change unit speed
      </button>
    </div>

    <!--
      Cell pickers. Same `.floating-popup` plate as the tool-button
      popups so they look identical, but the click handlers apply
      changes to the right-clicked cell (not the toolConfig). Each
      auto-closes on selection.
    -->
    <div
      v-if="cellPicker?.kind === 'building-type' && cellPickerCell?.building"
      class="floating-popup cell-picker"
      :style="{ top: `${cellPicker.screenY}px`, left: `${cellPicker.screenX}px` }"
    >
      <button
        v-for="t in BUILDING_TYPES"
        :key="t"
        class="floating-opt"
        :class="{ 'floating-opt-selected': t === cellPickerCell.building._type }"
        :title="t"
        @click="applyCellBuildingType(t)"
      >
        <img :src="getImagePath(cellBuildingTypeImg(t))" :alt="t" />
      </button>
    </div>
    <div
      v-if="cellPicker?.kind === 'tower-color' && cellPickerCell?.building"
      class="floating-popup cell-picker"
      :style="{ top: `${cellPicker.screenY}px`, left: `${cellPicker.screenX}px` }"
    >
      <button
        class="floating-opt"
        :class="{ 'floating-opt-selected': cellPickerCell.building.player === null }"
        title="Neutral"
        @click="applyCellTowerColor(null)"
      >
        <span class="color-swatch color-swatch-neutral"></span>
      </button>
      <button
        v-for="i in map?.metadata.playersNum || 1"
        :key="i"
        class="floating-opt"
        :class="{ 'floating-opt-selected': i - 1 === cellPickerCell.building.player }"
        :title="`Player ${i}`"
        @click="applyCellTowerColor(i - 1)"
      >
        <span class="color-swatch" :style="{ background: getPlayerColor(i - 1) }"></span>
      </button>
    </div>
    <div
      v-if="cellPicker?.kind === 'unit-color' && cellPickerCell?.unit"
      class="floating-popup cell-picker"
      :style="{ top: `${cellPicker.screenY}px`, left: `${cellPicker.screenX}px` }"
    >
      <button
        v-for="i in map?.metadata.playersNum || 1"
        :key="i"
        class="floating-opt"
        :class="{ 'floating-opt-selected': i - 1 === cellPickerCell.unit.player }"
        :title="`Player ${i}`"
        @click="applyCellUnitColor(i - 1)"
      >
        <span class="color-swatch" :style="{ background: getPlayerColor(i - 1) }"></span>
      </button>
    </div>
    <div
      v-if="cellPicker?.kind === 'unit-speed' && cellPickerCell?.unit"
      class="floating-popup cell-picker popup-speed-grid"
      :style="{ top: `${cellPicker.screenY}px`, left: `${cellPicker.screenX}px` }"
    >
      <button
        v-for="s in 21"
        :key="s - 1"
        class="floating-opt floating-opt-speed"
        :class="{ 'floating-opt-selected': s - 1 === cellPickerCell.unit.movePoints }"
        :title="`Speed ${s - 1}`"
        @click="applyCellUnitSpeed(s - 1)"
      >
        {{ s - 1 }}
      </button>
    </div>

    <!--
      Gear menu overlay — mirrors GameMenuOverlay shape exactly:
      ingame_menu_border.png outer plate + ingame_menu_texture.png inner
      panel, h2 in black, button row at the bottom with small_button.png
      buttons + 22x22 icons. Content panel hosts the parameters form.
    -->
    <div v-if="gearOpen" class="gear-menu-overlay" @click.self="closeGearMenu">
      <div class="menu-content">
        <div class="menu-inner">
          <!--
            Icon-only form. Same icon vocabulary as `MapEditorListPage`
            and `SavedMapsPage` so a setting's meaning is consistent
            between browsing and editing. Text labels removed per spec
            (except scenario name + description, which are free-form).
            Click a toggle icon to flip its boolean — the icon swap is
            the only feedback (matches the savedMaps preview tiles).
          -->
          <div class="params-scroll">
            <label class="field">
              <input v-model="map.name" type="text" placeholder="Scenario name" />
            </label>
            <label class="field">
              <textarea v-model="entry.description" rows="3" placeholder="Description"></textarea>
            </label>

            <div class="settings-grid">
              <!-- Dimensions: icon + value + pencil edit button -->
              <div class="setting-row setting-row-edit">
                <span class="setting-icon">
                  <img :src="getImagePath('field_icon')" alt="Dimensions" />
                </span>
                <span class="setting-value">
                  {{ map.metadata.width }}×{{ map.metadata.height }}
                </span>
                <button
                  class="edit-btn"
                  :class="{ 'edit-btn-active': resizeOpen }"
                  title="Resize"
                  @click="resizeOpen = !resizeOpen"
                >
                  ✎
                </button>
              </div>

              <!-- Players: icon + total + pencil edit button -->
              <div class="setting-row setting-row-edit">
                <span class="setting-icon">
                  <img :src="getImagePath('human_icon')" alt="Players" />
                </span>
                <span class="setting-value">{{ map.metadata.playersNum }}</span>
                <button
                  class="edit-btn"
                  :class="{ 'edit-btn-active': playersOpen }"
                  title="Update players"
                  @click="playersOpen = !playersOpen"
                >
                  ✎
                </button>
              </div>

              <!-- Speed range: icon + min - max -->
              <div class="setting-row">
                <span class="setting-icon">
                  <img :src="getImagePath('speed_icon')" alt="Speed" />
                </span>
                <input
                  v-model.number="map.settings.minSpeed"
                  type="number"
                  min="1"
                  max="20"
                  class="num-input"
                  title="Min speed"
                />
                <span class="dash">–</span>
                <input
                  v-model.number="map.settings.maxSpeed"
                  type="number"
                  min="1"
                  max="20"
                  class="num-input"
                  title="Max speed"
                />
              </div>

              <!-- Max units -->
              <div class="setting-row">
                <span class="setting-icon">
                  <img :src="getImagePath('dino_icon')" alt="Max units" />
                </span>
                <input
                  v-model.number="map.settings.maxUnitsNum"
                  type="number"
                  min="0"
                  max="50"
                  class="num-input"
                />
              </div>

              <!-- Unit modifier -->
              <div class="setting-row">
                <span class="setting-icon">
                  <img :src="getImagePath('dino_icon_plus')" alt="Unit modifier" />
                </span>
                <input
                  v-model.number="map.settings.unitModifier"
                  type="number"
                  min="1"
                  max="20"
                  class="num-input"
                />
              </div>

              <!-- Max bases -->
              <div class="setting-row">
                <span class="setting-icon">
                  <img :src="getImagePath('tower_icon')" alt="Max bases" />
                </span>
                <input
                  v-model.number="map.settings.maxBasesNum"
                  type="number"
                  min="0"
                  max="50"
                  class="num-input"
                />
              </div>

              <!-- Base modifier -->
              <div class="setting-row">
                <span class="setting-icon">
                  <img :src="getImagePath('tower_icon_plus')" alt="Base modifier" />
                </span>
                <input
                  v-model.number="map.settings.baseModifier"
                  type="number"
                  min="1"
                  max="20"
                  class="num-input"
                />
              </div>

              <!-- Fog of war (clickable icon toggle) + radius input -->
              <div class="setting-row">
                <button
                  class="setting-icon setting-icon-btn"
                  :title="map.settings.enableFogOfWar ? 'Fog on' : 'Fog off'"
                  @click="map.settings.enableFogOfWar = !map.settings.enableFogOfWar"
                >
                  <img
                    :src="getImagePath(map.settings.enableFogOfWar ? 'closed_eye' : 'open_eye')"
                    alt="Fog of war"
                  />
                </button>
                <template v-if="map.settings.enableFogOfWar">
                  <span class="setting-icon">
                    <img :src="getImagePath('radius_icon')" alt="Fog radius" />
                  </span>
                  <input
                    v-model.number="map.settings.fogOfWarRadius"
                    type="number"
                    min="1"
                    max="10"
                    class="num-input"
                  />
                </template>
              </div>

              <!-- Visibility/speed relation (toggle) + threshold -->
              <div class="setting-row">
                <button
                  class="setting-icon setting-icon-btn"
                  :title="
                    map.settings.visibilitySpeedRelation
                      ? 'Visibility scales with speed'
                      : 'Fixed visibility'
                  "
                  @click="
                    map.settings.visibilitySpeedRelation = !map.settings.visibilitySpeedRelation
                  "
                >
                  <img
                    :src="
                      getImagePath(
                        map.settings.visibilitySpeedRelation
                          ? 'visibility_speed_relation_icon'
                          : 'visibility_speed_no_relation_icon'
                      )
                    "
                    alt="Visibility/speed relation"
                  />
                </button>
                <input
                  v-if="map.settings.visibilitySpeedRelation"
                  v-model.number="map.settings.speedMinVisibility"
                  type="number"
                  min="1"
                  max="20"
                  class="num-input"
                  title="Speed/visibility threshold"
                />
              </div>

              <!-- Kill at birth (clickable icon toggle) -->
              <div class="setting-row">
                <button
                  class="setting-icon setting-icon-btn"
                  :title="map.settings.killAtBirth ? 'Kill at birth on' : 'Kill at birth off'"
                  @click="map.settings.killAtBirth = !map.settings.killAtBirth"
                >
                  <img
                    :src="
                      getImagePath(
                        map.settings.killAtBirth ? 'dino_birth_kill_icon' : 'dino_birth_icon'
                      )
                    "
                    alt="Kill at birth"
                  />
                </button>
              </div>

              <!-- Hide enemy speed (clickable icon toggle) -->
              <div class="setting-row">
                <button
                  class="setting-icon setting-icon-btn"
                  :title="map.settings.hideEnemySpeed ? 'Enemy speed hidden' : 'Enemy speed shown'"
                  @click="map.settings.hideEnemySpeed = !map.settings.hideEnemySpeed"
                >
                  <img
                    :src="
                      getImagePath(
                        map.settings.hideEnemySpeed ? 'hide_speed_icon' : 'show_speed_icon'
                      )
                    "
                    alt="Hide enemy speed"
                  />
                </button>
              </div>
            </div>
          </div>

          <!--
            Save-time validation error — same scope rules as GameSetup's
            error block (per-field range + cross-field invariants). The
            message is set by `save()` when `validateSettings()` returns
            non-null; cleared on a successful save, on closeGearMenu, or
            implicitly when the user edits the offending value and saves
            again. Preamble on line 1, the specific reason on line 2 —
            the lead-in stays constant so the eye can latch on to it
            while the variable part reads like a familiar form error.
          -->
          <div v-if="errorMessage" class="menu-error">
            <div>Game cannot be saved because of an error:</div>
            <div>{{ errorMessage }}</div>
          </div>

          <!--
            Bottom button row — mirrors GameMenuOverlay exactly:
            small_button.png 26x26 buttons with 22x22 icons. Order
            matches the in-game menu (back, +, −, save, exit).
          -->
          <div class="menu-buttons">
            <button class="menu-btn" @click="closeGearMenu" title="Back">
              <img class="btn-icon btn-icon-resume" :src="getImagePath('arrow')" alt="Back" />
            </button>
            <button class="menu-btn" @click="save" title="Save">
              <img class="btn-icon" :src="getImagePath('save_icon')" alt="Save" />
            </button>
            <button class="menu-btn" @click="exitEditor" title="Exit">
              <img class="btn-icon" :src="getImagePath('exit_icon')" alt="Exit" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-if="confirmExit"
      message="Discard unsaved changes and exit?"
      confirm-label="Discard"
      cancel-label="Stay"
      :handle-confirm="discardAndExit"
      :handle-cancel="() => (confirmExit = false)"
    />

    <ConfirmDialog
      v-if="confirmDropPlayers"
      :message="confirmDropPlayersMessage"
      confirm-label="Apply"
      cancel-label="Cancel"
      :handle-confirm="confirmAndApplyPlayersUpdate"
      :handle-cancel="() => (confirmDropPlayers = null)"
    />

    <!--
      Resize and players dialogs. Centered modals on `error_plate.png`
      (same plate the in-game `SaveMapDialog` / `ConfirmDialog` use):
      titled header, icon + value inputs, then explicit "Apply" /
      "Cancel" text buttons matching the dark-pill button style from
      both built-in dialogs. Sits at z-index 10090 so it paints over
      the gear menu overlay.
    -->
    <div v-if="resizeOpen" class="param-dialog-backdrop" @click.self="cancelResize">
      <div class="param-dialog">
        <div class="param-dialog-title">Resize map</div>
        <div class="param-dialog-row">
          <span class="setting-icon">
            <img :src="getImagePath('field_icon')" alt="" />
          </span>
          <input v-model.number="newWidth" type="number" min="5" max="50" class="num-input" />
          <span class="dash">×</span>
          <input v-model.number="newHeight" type="number" min="5" max="50" class="num-input" />
        </div>
        <div v-if="resizeError" class="param-dialog-error">{{ resizeError }}</div>
        <div class="param-dialog-actions">
          <button class="param-dialog-btn" @click="applyResize">Apply</button>
          <button class="param-dialog-btn" @click="cancelResize">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Update-players dialog. Single total → 1 human + rest bots split. -->
    <div v-if="playersOpen" class="param-dialog-backdrop" @click.self="cancelPlayersUpdate">
      <div class="param-dialog">
        <div class="param-dialog-title">Update players</div>
        <div class="param-dialog-row">
          <span class="setting-icon">
            <img :src="getImagePath('human_icon')" alt="" />
          </span>
          <input v-model.number="newTotalPlayers" type="number" min="1" max="8" class="num-input" />
        </div>
        <div v-if="playersError" class="param-dialog-error">{{ playersError }}</div>
        <div class="param-dialog-actions">
          <button class="param-dialog-btn" @click="applyPlayersUpdate">Apply</button>
          <button class="param-dialog-btn" @click="cancelPlayersUpdate">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import emitter from '@/game/eventBus'
import { DEFAULT_CELL_SIZE, GAME_STATES, MAX_CELL_SIZE, MIN_CELL_SIZE } from '@/game/const'
import { getImagePath, getPlayerColor } from '@/game/helpers'
import {
  getAnyEditorEntry,
  saveAnyEditorEntry,
  resizeMap,
  updatePlayerCounts,
  playerCountChangeWouldDrop,
} from '@/game/mapEditorStorage'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'

const TOOLS = [
  { id: 'terrain', label: 'Terrain' },
  { id: 'building', label: 'Building' },
  { id: 'dino', label: 'Dino' },
  { id: 'eraser', label: 'Eraser' },
]

// Available building types for the floating popup. Mirrors the list
// in `scenariosData.js` so the editor's vocabulary stays consistent.
const BUILDING_TYPES = ['base', 'habitation', 'temple', 'well', 'storage', 'obelisk']

// Two terrain kinds, with a representative preview asset for each
// (used by the terrain-kind floating popup).
const TERRAIN_OPTIONS = [
  { value: 'empty', label: 'Empty', preview: 'empty1' },
  { value: 'mountain', label: 'Mountain', preview: 'mountain1' },
]

// Settings limits — mirror `GameSetup.LIMITS` so the editor enforces
// the same per-field ranges the random-map setup page does. Keep these
// two lists in sync when one changes; cross-field invariants (max ≥
// min, threshold ≥ minSpeed, total ≤ 8) live in `validateSettings`.
const LIMITS = {
  width: { min: 5, max: 50, label: 'Width' },
  height: { min: 5, max: 50, label: 'Height' },
  minSpeed: { min: 1, max: 20, label: 'Min speed' },
  maxSpeed: { min: 1, max: 20, label: 'Max speed' },
  speedMinVisibility: { min: 1, max: 20, label: 'Speed/visibility threshold' },
  maxUnitsNum: { min: 0, max: 50, label: 'Max units' },
  maxBasesNum: { min: 0, max: 50, label: 'Max bases' },
  fogOfWarRadius: { min: 1, max: 10, label: 'Fog radius' },
  unitModifier: { min: 1, max: 20, label: 'Unit modifier' },
  baseModifier: { min: 1, max: 20, label: 'Base modifier' },
}

// Fair random texture rolls. Built-in scenarios use a deterministic
// formula (scenariosData.js) so the same scenario looks identical on
// every page load — but the *editor* is the one place a designer
// actively wants visual variety, so we roll fresh per cell on map
// creation and re-roll on every terrain-change click (including
// mountain-over-mountain), the same way `createFieldEngine.js` rolls
// when it builds a random map.
function emptyIdx() {
  return 1 + Math.floor(Math.random() * 9)
}
function mountainIdx() {
  // Only `mountain1.webp` … `mountain5.webp` ship; `cellStyle` mirrors
  // 6..9 → 4..1 defensively, but staying in 1..5 keeps the preview
  // honest (same convention scenariosData.js uses).
  return 1 + Math.floor(Math.random() * 5)
}

export default {
  name: 'MapEditorCanvasPage',
  components: { ConfirmDialog },
  props: {
    scenarioId: { type: String, required: true },
  },
  data() {
    return {
      entry: null,
      isLoading: true,
      dirty: false,
      gearOpen: false,
      resizeOpen: false,
      playersOpen: false,
      newWidth: 20,
      newHeight: 20,
      // Single "total players" input — the engine still tracks
      // humans/bots separately, but the editor surfaces only the total
      // and fixes the split at 1 human + (total - 1) bots per spec.
      newTotalPlayers: 2,
      confirmExit: false,
      // Holds `{ humans, bots }` while the user confirms a destructive
      // player-count reduction. null when no confirm is pending.
      confirmDropPlayers: null,
      // Validation feedback. `errorMessage` shows above the gear menu's
      // button row when Save fails the LIMITS / cross-field checks;
      // `resizeError` / `playersError` are scoped to their dialogs so a
      // bad input there doesn't muddy the main menu.
      errorMessage: '',
      resizeError: '',
      playersError: '',
      cellSize: DEFAULT_CELL_SIZE,
      MIN_CELL_SIZE,
      MAX_CELL_SIZE,
      TOOLS,
      activeTool: 'terrain',
      toolConfig: {
        terrain: { kind: 'mountain' },
        building: { _type: 'base', player: null },
        dino: { player: 0, speed: 1 },
      },
      // Drag-paint state. `isPainting` is true between mousedown and
      // the matching window mouseup; `lastPaintedKey` ("x,y") dedups
      // consecutive `mouseenter` events on the same cell so dragging
      // a few pixels inside one cell doesn't re-trigger the tool. It
      // also seeds with the start cell on mousedown so the first
      // mouseenter on an adjacent cell isn't a no-op.
      isPainting: false,
      lastPaintedKey: null,
      // Floating-popup state for Building/Dino wide buttons.
      // `null` when no popup is open; otherwise `{ tool: 'building' |
      // 'dino', kind: 'object' | 'color' }`. The wide button shows the
      // popup if its tool+kind matches. Dismissed by clicking outside,
      // by picking an option, or by opening a different popup.
      popup: null,
      BUILDING_TYPES,
      TERRAIN_OPTIONS,
      // Cell-level right-click menu + its follow-up picker. Each
      // carries the target `{ x, y }` plus the cursor's `screenX/Y`
      // so we can render the menu next to the click. `cellPicker.kind`
      // is one of: 'building-type' | 'tower-color' | 'unit-color' |
      // 'unit-speed'. Both null when nothing is open.
      cellMenu: null,
      cellPicker: null,
    }
  },
  computed: {
    map() {
      return this.entry?.map || null
    },
    boardWidthPx() {
      return this.map ? `${this.cellSize * this.map.metadata.width}px` : '0px'
    },
    boardHeightPx() {
      return this.map ? `${this.cellSize * this.map.metadata.height}px` : '0px'
    },
    labelFontSize() {
      return Math.max(8, Math.round(this.cellSize * 0.3))
    },
    buildingToolPreviewImg() {
      const cfg = this.toolConfig.building
      if (cfg._type === 'base' && cfg.player !== null) return `base${cfg.player + 1}`
      return cfg._type
    },
    // Swatch shown on the color half of the wide building button. Only
    // `base` honours ownership in the engine, so non-base types always
    // render as neutral gray regardless of what's stored in `player`.
    buildingColorSwatch() {
      const cfg = this.toolConfig.building
      if (cfg._type !== 'base' || cfg.player === null) return '#ccc'
      return getPlayerColor(cfg.player)
    },
    // Reactive accessors for the cell that's currently under the
    // right-click context menu / cell picker. Using a computed (rather
    // than caching the cell in `cellMenu`/`cellPicker`) keeps the menu
    // honest if some other code path mutates the cell — and gives us
    // `null` automatically when the menu/picker is closed.
    cellMenuCell() {
      if (!this.cellMenu || !this.map) return null
      return this.map.field[this.cellMenu.x]?.[this.cellMenu.y] || null
    },
    cellPickerCell() {
      if (!this.cellPicker || !this.map) return null
      return this.map.field[this.cellPicker.x]?.[this.cellPicker.y] || null
    },
    fieldT() {
      // Transpose field[x][y] → rows[y][x] for the GameGrid-shaped
      // template (cell_line per y, inline-block cell per x).
      if (!this.map) return []
      const w = this.map.metadata.width
      const h = this.map.metadata.height
      const rows = []
      for (let y = 0; y < h; y++) {
        const row = []
        for (let x = 0; x < w; x++) row.push(this.map.field[x][y])
        rows.push(row)
      }
      return rows
    },
    confirmDropPlayersMessage() {
      if (!this.confirmDropPlayers) return ''
      // Surface only the total — the editor doesn't expose the
      // human/bot split anywhere else (locked at 1 human + rest bots),
      // so calling it out here would be the only place that does.
      const { humans, bots } = this.confirmDropPlayers
      const total = humans + bots
      return (
        `Reducing to ${total} player${total === 1 ? '' : 's'} will drop units and demote ` +
        `player-owned bases of removed players to neutral. Continue?`
      )
    },
  },
  mounted() {
    this.loadEntry()
    window.addEventListener('beforeunload', this.beforeUnload)
    // Window-level mouseup so releasing the button OFF the grid still
    // ends the stroke. Without this the user could drag off the grid,
    // release, come back, and the brush would keep painting on any
    // mouseenter.
    window.addEventListener('mouseup', this.onPaintEnd)
    // Outside-click handler for the floating popups. `click` (not
    // mousedown) so it runs AFTER any inner option-button click, which
    // already sets popup=null on selection.
    document.addEventListener('click', this.handleOutsidePopupClick)
  },
  beforeUnmount() {
    window.removeEventListener('beforeunload', this.beforeUnload)
    window.removeEventListener('mouseup', this.onPaintEnd)
    document.removeEventListener('click', this.handleOutsidePopupClick)
  },
  watch: {
    scenarioId() {
      this.loadEntry()
    },
    entry: {
      deep: true,
      handler() {
        if (!this.isLoading) this.dirty = true
      },
    },
  },
  methods: {
    getImagePath,
    loadEntry() {
      this.isLoading = true
      // `getAnyEditorEntry` returns built-ins (with overrides applied)
      // or user scenarios — both surface as the same `{ id, description,
      // map, isBuiltin }` shape. The deep-clone below means edits stay
      // local until Save writes them back to the right storage bucket.
      const fresh = getAnyEditorEntry(this.scenarioId)
      if (!fresh) {
        emitter.emit('goToPage', GAME_STATES.mapEditor)
        return
      }
      this.entry = JSON.parse(JSON.stringify(fresh))
      this.dirty = false
      this.newWidth = this.entry.map.metadata.width
      this.newHeight = this.entry.map.metadata.height
      this.newTotalPlayers = this.entry.map.metadata.playersNum
      this.cellSize = this.computeDefaultCellSize()
      const maxPlayer = this.entry.map.metadata.playersNum - 1
      if (this.toolConfig.dino.player > maxPlayer) this.toolConfig.dino.player = 0
      this.$nextTick(() => {
        this.isLoading = false
      })
    },
    computeDefaultCellSize() {
      if (!this.map) return DEFAULT_CELL_SIZE
      if (typeof window === 'undefined') return DEFAULT_CELL_SIZE
      const w = this.map.metadata.width
      const h = this.map.metadata.height
      const availW = Math.max(200, window.innerWidth - 32)
      const availH = Math.max(200, window.innerHeight - 64)
      const fit = Math.min(Math.floor(availW / w), Math.floor(availH / h))
      // Snap to the same 10-step grid the zoom buttons use so further
      // +/- presses keep cellSize on {10, 20, 30, 40, 50, 60, 70} — no
      // off-grid values that the user can't escape from.
      const snapped = Math.floor(fit / 10) * 10
      return Math.max(MIN_CELL_SIZE, Math.min(DEFAULT_CELL_SIZE, snapped || MIN_CELL_SIZE))
    },
    terrainImage(terrain) {
      const kind = terrain.kind
      let idx = terrain.idx ?? 1
      if (kind === 'mountain' && idx > 5) idx = 10 - idx
      return `${kind}${idx}`
    },
    buildingImage(building) {
      if (building._type === 'base' && building.player !== null) {
        return `base${building.player + 1}`
      }
      return building._type
    },
    // ---- Floating popups (tool options) -----------------------------------
    getPlayerColor,
    openPopup(tool, kind) {
      this.activeTool = tool
      this.popup = { tool, kind }
    },
    buildingOptionImg(type) {
      // Show the player-coloured base when picking under an already-
      // selected owner; otherwise the neutral sprite.
      const cfg = this.toolConfig.building
      if (type === 'base' && cfg.player !== null) return `base${cfg.player + 1}`
      return type
    },
    pickBuildingType(type) {
      // Keep the previously-picked owner on the toolConfig even when
      // switching to a non-base type. The engine still forces neutral
      // at apply time (see `applyTool`), and `buildingColorSwatch`
      // shows gray while a non-base type is active — but the picked
      // colour returns automatically when the user switches back to
      // base. Saves the user from re-picking their colour every time.
      this.toolConfig.building._type = type
      this.popup = null
    },
    pickBuildingColor(player) {
      this.toolConfig.building.player = player
      this.popup = null
    },
    pickDinoColor(player) {
      this.toolConfig.dino.player = player
      this.popup = null
    },
    pickDinoSpeed(speed) {
      this.toolConfig.dino.speed = speed
      this.popup = null
    },
    pickTerrainKind(kind) {
      this.toolConfig.terrain.kind = kind
      this.popup = null
    },
    // ---- Cell context menu + cell-targeted pickers ------------------------
    onCellContextMenu(event, x, y) {
      // Always swallow the browser context menu on cells; only OPEN
      // our menu when there's something on the cell to modify.
      event.preventDefault()
      // Close any other open menu/picker first.
      this.popup = null
      this.cellPicker = null
      const cell = this.map?.field?.[x]?.[y]
      if (!cell || (!cell.building && !cell.unit)) {
        this.cellMenu = null
        return
      }
      this.cellMenu = { x, y, screenX: event.clientX, screenY: event.clientY }
      this.$nextTick(this.clampCellOverlays)
    },
    openCellPicker(kind) {
      if (!this.cellMenu) return
      const { x, y, screenX, screenY } = this.cellMenu
      this.cellMenu = null
      this.cellPicker = { x, y, kind, screenX, screenY }
      this.$nextTick(this.clampCellOverlays)
    },
    // Pulls the cell context menu / cell picker back inside the
    // viewport when they'd otherwise extend past the right or bottom
    // edge. Runs after Vue mounts the new DOM (nextTick) so we can
    // read the rendered size. Position is updated on the reactive
    // `cellMenu` / `cellPicker` state so the next render uses the
    // clamped coords — no inline-style hack needed.
    clampCellOverlays() {
      this.clampOverlayKey('cellMenu', document.querySelector('.cell-context-menu'))
      this.clampOverlayKey('cellPicker', document.querySelector('.cell-picker'))
    },
    clampOverlayKey(key, el) {
      if (!el || !this[key]) return
      const r = el.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const margin = 4
      let x = this[key].screenX
      let y = this[key].screenY
      // If the overlay extends past the right or bottom edge, pull it
      // back by exactly the overflow amount. Then clamp to a small
      // left/top margin so it never disappears under the opposite
      // edge either (matters when the popup is wider than the viewport
      // — though in practice none of ours are).
      if (r.right > vw - margin) x -= r.right - (vw - margin)
      if (r.bottom > vh - margin) y -= r.bottom - (vh - margin)
      if (x < margin) x = margin
      if (y < margin) y = margin
      if (x !== this[key].screenX || y !== this[key].screenY) {
        this[key] = { ...this[key], screenX: x, screenY: y }
      }
    },
    // Preview image for the building-type picker options. Mirrors
    // `buildingOptionImg` but reads owner from the cell (not the
    // building tool's config).
    cellBuildingTypeImg(type) {
      const b = this.cellPickerCell?.building
      if (type === 'base' && b?.player !== null && b?.player !== undefined) {
        return `base${b.player + 1}`
      }
      return type
    },
    applyCellBuildingType(type) {
      const cell = this.cellPickerCell
      if (cell?.building) {
        cell.building._type = type
        // Engine rule: non-base buildings are always neutral.
        if (type !== 'base') cell.building.player = null
      }
      this.cellPicker = null
    },
    applyCellTowerColor(player) {
      const cell = this.cellPickerCell
      if (cell?.building && cell.building._type === 'base') cell.building.player = player
      this.cellPicker = null
    },
    applyCellUnitColor(player) {
      const cell = this.cellPickerCell
      if (cell?.unit) {
        cell.unit.player = player
        cell.unit._type = `dino${player + 1}`
      }
      this.cellPicker = null
    },
    applyCellUnitSpeed(speed) {
      const cell = this.cellPickerCell
      if (cell?.unit) cell.unit.movePoints = speed
      this.cellPicker = null
    },
    handleOutsidePopupClick(e) {
      // Close on any left-click outside the popup. Right-clicks don't
      // dismiss — that's what swaps between an object popup and a
      // color popup on the same tool. The `click` event fires after
      // any inner click handler resolves, so an option-button click
      // sets popup=null itself before this runs (no race).
      if (!this.popup && !this.cellMenu && !this.cellPicker) return
      // Clicks inside any floating popup OR inside the cell context
      // menu shouldn't dismiss — they're navigating into/out of one.
      if (e.target.closest('.floating-popup')) return
      if (e.target.closest('.cell-context-menu')) return
      this.popup = null
      this.cellMenu = null
      this.cellPicker = null
    },
    // ---- Cell painting ----------------------------------------------------
    onPaintStart(x, y) {
      // If a cell menu / cell picker is open, treat this left-click as
      // "dismiss menu" rather than "paint" — same UX the document
      // click handler would produce, but BEFORE the cell gets painted.
      if (this.cellMenu || this.cellPicker) {
        this.cellMenu = null
        this.cellPicker = null
        return
      }
      this.isPainting = true
      this.lastPaintedKey = `${x},${y}`
      this.applyTool(x, y)
    },
    onPaintMove(x, y) {
      if (!this.isPainting) return
      const key = `${x},${y}`
      // Dedup — mouseenter can fire multiple times on the same cell if
      // the pointer wobbles near a boundary; only apply when we cross
      // into a new cell.
      if (this.lastPaintedKey === key) return
      this.lastPaintedKey = key
      this.applyTool(x, y)
    },
    onPaintEnd() {
      this.isPainting = false
      this.lastPaintedKey = null
    },
    applyTool(x, y) {
      const cell = this.map.field[x][y]
      const tool = this.activeTool
      if (tool === 'terrain') {
        const kind = this.toolConfig.terrain.kind
        if (kind === 'mountain' && (cell.building || cell.unit)) return
        // Re-roll texture every click — even mountain-over-mountain
        // gets a fresh idx so repeated taps visibly cycle the variant.
        cell.terrain = {
          kind,
          idx: kind === 'mountain' ? mountainIdx() : emptyIdx(),
        }
      } else if (tool === 'building') {
        if (cell.terrain.kind === 'mountain') return
        const cfg = this.toolConfig.building
        cell.building = {
          _type: cfg._type,
          player: cfg._type === 'base' ? cfg.player : null,
        }
      } else if (tool === 'dino') {
        if (cell.terrain.kind === 'mountain') return
        const cfg = this.toolConfig.dino
        cell.unit = {
          _type: `dino${cfg.player + 1}`,
          player: cfg.player,
          movePoints: cfg.speed,
        }
      } else if (tool === 'eraser') {
        cell.terrain = { kind: 'empty', idx: emptyIdx() }
        cell.building = null
        cell.unit = null
      }
    },
    // ---- Validation -------------------------------------------------------
    // Mirror of `GameSetup.isInputValid` — same LIMITS check + the
    // three cross-field invariants (max≥min speed, threshold≥minSpeed
    // when fog+vis/speed relation are on, total players ≤8). Returns
    // null if everything's OK or a human-readable error string.
    validateSettings() {
      if (!this.map) return null
      const s = this.map.settings
      const m = this.map.metadata
      // Per-field range check. `width`/`height` live in metadata, the
      // rest in settings — flatten both into one pass.
      const fields = { ...s, width: m.width, height: m.height }
      for (const key in LIMITS) {
        const v = fields[key]
        const lim = LIMITS[key]
        // Skip fields the toggle gates off — `fogOfWarRadius` and
        // `speedMinVisibility` only matter when their parent toggle is
        // on, same exception GameSetup makes.
        if (key === 'fogOfWarRadius' && !s.enableFogOfWar) continue
        if (key === 'speedMinVisibility' && !s.visibilitySpeedRelation) continue
        if (!Number.isInteger(v) || v < lim.min || v > lim.max) {
          return `${lim.label} should be an integer between ${lim.min} and ${lim.max}.`
        }
      }
      if (m.humanPlayersNum + m.botPlayersNum > 8) {
        return 'Total number of players should not exceed 8.'
      }
      if (s.maxSpeed < s.minSpeed) {
        return 'Max speed should be greater than or equal to min speed.'
      }
      if (s.enableFogOfWar && s.visibilitySpeedRelation && s.speedMinVisibility < s.minSpeed) {
        return 'Speed/visibility threshold should be greater than or equal to min speed.'
      }
      return null
    },
    // ---- Gear menu actions ------------------------------------------------
    save() {
      if (!this.entry) return
      const err = this.validateSettings()
      if (err) {
        this.errorMessage = err
        return
      }
      this.errorMessage = ''
      // Routes through the unified accessor — writes to the built-in
      // override bucket if `entry.isBuiltin`, else to user storage.
      saveAnyEditorEntry(this.entry)
      this.dirty = false
    },
    closeGearMenu() {
      this.gearOpen = false
      this.resizeOpen = false
      this.playersOpen = false
      // Clear stale validation messages so they don't surprise the user
      // next time the menu opens.
      this.errorMessage = ''
      this.resizeError = ''
      this.playersError = ''
    },
    exitEditor() {
      if (this.dirty) {
        this.confirmExit = true
        return
      }
      emitter.emit('goToPage', GAME_STATES.mapEditor)
    },
    discardAndExit() {
      this.dirty = false
      this.confirmExit = false
      emitter.emit('goToPage', GAME_STATES.mapEditor)
    },
    applyResize() {
      const w = Number(this.newWidth)
      const h = Number(this.newHeight)
      // Same LIMITS.{width,height} bounds the gear-menu validator uses;
      // surface the error inside the dialog rather than silently
      // clamping so the user can correct their input.
      if (
        !Number.isInteger(w) ||
        w < LIMITS.width.min ||
        w > LIMITS.width.max ||
        !Number.isInteger(h) ||
        h < LIMITS.height.min ||
        h > LIMITS.height.max
      ) {
        this.resizeError = `Width and height should be integers between ${LIMITS.width.min} and ${LIMITS.width.max}.`
        return
      }
      this.resizeError = ''
      resizeMap(this.entry.map, w, h)
      this.resizeOpen = false
      this.cellSize = this.computeDefaultCellSize()
    },
    cancelResize() {
      this.resizeOpen = false
      this.resizeError = ''
      this.newWidth = this.map.metadata.width
      this.newHeight = this.map.metadata.height
    },
    applyPlayersUpdate() {
      // Editor surfaces a single total; fix the split at 1 human + rest
      // bots per current product decision. (The underlying schema still
      // tracks the two separately, which matters if multiplayer ever
      // serves an editor scenario.)
      const total = Number(this.newTotalPlayers)
      if (!Number.isInteger(total) || total < 1 || total > 8) {
        this.playersError = 'Players should be an integer between 1 and 8.'
        return
      }
      this.playersError = ''
      const humans = 1
      const bots = total - 1
      if (playerCountChangeWouldDrop(this.entry.map, humans, bots)) {
        this.confirmDropPlayers = { humans, bots }
        return
      }
      this.installPlayersUpdate(humans, bots)
    },
    confirmAndApplyPlayersUpdate() {
      const { humans, bots } = this.confirmDropPlayers
      this.confirmDropPlayers = null
      this.installPlayersUpdate(humans, bots)
    },
    installPlayersUpdate(humans, bots) {
      updatePlayerCounts(this.entry.map, humans, bots)
      // Keep the dino tool's owner in range so the next dino click
      // doesn't reference a dropped player.
      if (this.toolConfig.dino.player >= humans + bots) {
        this.toolConfig.dino.player = 0
      }
      // Same for the building tool's base owner.
      if (
        this.toolConfig.building._type === 'base' &&
        this.toolConfig.building.player !== null &&
        this.toolConfig.building.player >= humans + bots
      ) {
        this.toolConfig.building.player = null
      }
      this.playersOpen = false
    },
    cancelPlayersUpdate() {
      this.playersOpen = false
      this.playersError = ''
      this.newTotalPlayers = this.map.metadata.playersNum
    },
    zoom(delta) {
      this.cellSize = Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, this.cellSize + delta))
    },
    beforeUnload(e) {
      if (this.dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    },
  },
}
</script>

<style scoped>
.editor-canvas-page {
  position: relative;
  background-image: url('/images/background.png');
  background-size: cover;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.game-grid-container {
  width: 100vw;
  height: calc(100vh - 40px);
  overflow: auto;
  position: relative;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.game-grid-container::-webkit-scrollbar {
  display: none;
}

.board-wrapper-container {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  min-width: max(100vw, var(--board-width, 100vw));
  min-height: max(calc(100vh - 40px), var(--board-height, 100vh));
}

.board-wrapper {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
}

/* `.board`, `.cell_line`, `.cell` and `.terrainImg` follow GameGrid /
   GameCell exactly: no per-cell border, no gaps, terrain rendered as a
   sized <img>, overlay images positioned absolutely on top. */
.board {
  position: relative;
  border: solid 2px;
  color: #2c3e50;
  box-sizing: content-box;
}

.cell_line {
  display: block;
  line-height: 0;
}

.cell {
  position: relative;
  display: inline-block;
  user-select: none;
  cursor: pointer;
}

.cell:hover {
  outline: 2px solid #ffd34d;
  outline-offset: -2px;
  z-index: 2;
}

.terrainImg {
  vertical-align: top;
  pointer-events: none;
}

.overlayImg {
  position: absolute;
  pointer-events: none;
}

/* Mirrors `GameUnit.movePointsLabel` — white plate, black text, 4px
   rounded corners, tight horizontal padding. The font-size /
   line-height come from the template's inline `:style` (driven by
   `labelFontSize`), same dynamic-sizing path GameUnit uses, so the
   badge looks identical in the editor preview and in the live game. */
.cell-speed {
  position: absolute;
  right: 2px;
  bottom: 2px;
  background-color: white;
  color: black;
  border-radius: 4px;
  padding-left: 1px;
  padding-right: 1px;
  font-weight: bold;
  pointer-events: none;
  user-select: none;
}

/* ---- Bottom panel — mirrors InfoPanel ---------------------------------- */

.editor-bottom-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  margin: 0 auto;
  max-width: 400px;
  height: 40px;
  padding: 2px 0 4px;
  background-image: url('/images/panel.png');
  background-size: 100% 100%;
  overflow: visible;
  z-index: 1;
}

.inner-info-panel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 9px;
  overflow: visible;
}

.info-block {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* `.infoBtn` clones the in-game InfoPanel's button. 26×26 small button
   image, transparent background, no border, 22×22 inner image. Tool
   buttons add `.toolBtn` for the active-state ring. */
button.infoBtn {
  padding: 0;
  user-select: none;
  background-image: url('/images/small_button.png');
  background-color: transparent;
  background-size: 100% 100%;
  border: none;
  width: 26px;
  height: 26px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  vertical-align: text-bottom;
}

button.infoBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.infoBtn:active {
  transform: scale(0.95);
}

.curPlayerImage {
  width: 22px;
  height: 22px;
  position: relative;
}

.toolBtn-active {
  /* Subtle gold halo to mark the active tool without growing the
     button (in-game buttons never change size to signal state). */
  filter: drop-shadow(0 0 4px #ffd34d) drop-shadow(0 0 2px #ffd34d);
}

/* Same white/black palette as `.cell-speed` (which mirrors the
   in-game `GameUnit.movePointsLabel`) — kept tiny since the dino
   tool button is only 26 px. */
.tool-speed-badge {
  position: absolute;
  right: -3px;
  bottom: -2px;
  background-color: white;
  color: black;
  font-size: 9px;
  line-height: 1;
  font-weight: bold;
  padding: 1px 3px;
  border-radius: 4px;
}

.tool-eraser {
  font-size: 18px;
  font-weight: bold;
  color: #000;
  line-height: 1;
}

/* ---- Tool cluster (Building / Dino) ---------------------------------- */

/* A simple inline group: a square `.infoBtn` followed by a small
   `.color-square`. Popups for this cluster are rendered at the
   bottom-panel level (not inside the cluster) so they share the same
   vertical anchor with the dino popups. */
.tool-cluster {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

/* Standalone colour swatch sitting next to the button. Square plate,
   1 px black border, no `small_button.png` so it's visually distinct
   from the button it modifies. Cursor + interactive states match the
   rest of the panel. */
.color-square {
  display: inline-block;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid #000;
  border-radius: 3px;
  cursor: pointer;
}

.color-square:active {
  transform: scale(0.95);
}

.color-swatch {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid #000;
}

.color-swatch-neutral {
  background: #ccc;
}

/* ---- Floating popup -------------------------------------------------- */

/* Bare row of option buttons floating just above the bottom panel,
   `bottom: 100%` against the panel itself so all popups (building +
   dino) share the same vertical coordinate. z-index keeps them above
   the panel. */
.floating-popup {
  position: absolute;
  bottom: 100%;
  display: flex;
  gap: 4px;
  padding-bottom: 8px;
  z-index: 20;
}

/*
  Horizontal anchors: each popup centres above a specific control on
  the bottom panel using a fixed distance from the panel's RIGHT edge.
  Numbers are derived from the panel's layout:
    panel right padding (9) → eraser (26) → gap (6) → dino cluster (51)
    → gap (6) → building cluster (51) → …
  Going right-to-left, centres land at the offsets below. Translating
  the popup by +50% of its own width puts its centre on that offset
  regardless of how wide the popup actually grows.
*/
.popup-anchor-terrain {
  /* Terrain button centre — first item in the right group:
     9 + 26 + 6 + 51 + 6 + 51 + 6 + 13 = 168 from panel right. */
  right: 168px;
  transform: translateX(50%);
}

.popup-anchor-building-type {
  /* Building button centre: 9 + 26 + 6 + 51 + 6 + 22 + 3 + 13 = 136 */
  right: 136px;
  transform: translateX(50%);
}
/* The building-color popup uses `.popup-anchor-panel-right` (like the
   dino popups) instead of centring above its swatch — with 8 seats
   the colour row is wider than the cluster and would overflow off
   the left side. */

/* Pins the popup's right edge to the panel's right edge so wider
   popups (dino-speed 3×7 grid, dino-color row at high seat counts)
   never overflow off-screen. The 9px inset matches the panel's
   right padding. */
.popup-anchor-panel-right {
  right: 9px;
  bottom: 100%;
  left: auto;
  transform: none;
}

/* Layout-only variant: 3 rows × 7 cols for the 0–20 speed picker.
   Positioning comes from `.popup-anchor-panel-right`. */
.popup-speed-grid {
  display: grid;
  grid-template-columns: repeat(7, 28px);
  grid-auto-rows: 28px;
  gap: 4px;
  padding-bottom: 8px;
}

.floating-opt {
  background-image: url('/images/small_button.png');
  background-color: transparent;
  background-size: 100% 100%;
  border: none;
  width: 28px;
  height: 28px;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.floating-opt:active {
  transform: scale(0.95);
}

.floating-opt img {
  width: 22px;
  height: 22px;
}

/* Speed-pick variant: a numeric label instead of an icon. */
.floating-opt-speed {
  color: #000;
  font-weight: bold;
  font-size: 14px;
  font-family: inherit;
  line-height: 1;
}

/* ---- Cell right-click context menu ----------------------------------- */

/* Small vertical list of action labels rendered at the cursor when
   the user right-clicks a cell with at least one object. Uses the
   editor's brown plate so it blends with the rest of the UI; sits at
   the same z-index as the floating popups (30) so it paints above the
   bottom panel and the gear menu. Width is capped so a long label
   doesn't make it stretch awkwardly. */
.cell-context-menu {
  position: fixed;
  z-index: 30;
  display: flex;
  flex-direction: column;
  background-color: rgba(94, 62, 38, 0.95);
  border: 1px solid #5e3e26;
  border-radius: 4px;
  min-width: 150px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.cell-menu-item {
  background: transparent;
  border: none;
  color: #fff;
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  padding: 6px 12px;
  cursor: pointer;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.cell-menu-item:hover {
  background-color: rgba(146, 104, 70, 0.85);
}

/* Cell pickers share `.floating-popup` style, but they're positioned
   at the right-click cursor (fixed coords on `top` / `left`) rather
   than docked to the bottom panel. The base `.floating-popup` already
   has `position: absolute` and `bottom: 100%` for the panel-docked
   case — `.cell-picker` overrides to absolute-by-cursor positioning
   without inheriting the bottom-anchor. */
.cell-picker {
  position: fixed;
  bottom: auto;
  z-index: 30;
}

/* Highlights the option whose value matches the current toolConfig.
   Same gold drop-shadow halo `.toolBtn-active` uses on the cluster.
   Stacked three times with increasing blur so the glow really reads
   against the map background under the popup — a single drop-shadow
   at 4px gets lost on the brown panel/canvas tones. */
.floating-opt-selected {
  filter: drop-shadow(0 0 2px #ffd34d) drop-shadow(0 0 4px #ffd34d) drop-shadow(0 0 8px #ffd34d);
}

/* ---- Gear menu overlay — mirrors GameMenuOverlay ----------------------- */

.gear-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 10080;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow-y: auto;
}

.menu-content {
  position: relative;
  background-image: url('/images/ingame_menu_border.png');
  background-size: cover;
  background-position: center;
  background-repeat: repeat;
  width: 100%;
  max-width: min(90vw, 600px);
  max-height: 90vh;
  padding: 10px;
  border-radius: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  box-sizing: border-box;
  overflow: hidden;
}

.menu-inner {
  background-image: url('/images/ingame_menu_texture.png');
  background-size: cover;
  background-position: center;
  background-repeat: repeat;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.3);
  padding: clamp(16px, 2vh, 32px);
  max-height: calc(90vh - 40px);
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 2vh, 20px);
  overflow: hidden;
  box-sizing: border-box;
  color: #000;
}

.menu-content h2 {
  margin: 0;
  color: #000;
  font-size: clamp(20px, 5vh, 28px);
  text-align: center;
  flex-shrink: 0;
  font-weight: bold;
}

.params-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.menu-inner h3 {
  margin: 14px 0 6px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #000;
  opacity: 0.85;
}

/* Name + description are the only free-form fields; everything else
   uses the icon grid below. */
.field {
  display: flex;
  margin-bottom: 8px;
}

/*
  Inputs in the editor menu use the warm tan + black-border palette from
  GameSetup (`input.inputNumber`: `background-color: #deae88; border:
  black solid 1px`), so the form reads as part of the same family of
  in-game forms instead of a stark white island on the parchment.
*/
.field input,
.field textarea {
  width: 100%;
  background: #deae88;
  color: #000;
  border: 1px solid #000;
  border-radius: 4px;
  padding: 6px 8px;
  font-family: inherit;
}

/* Icon grid — same vocabulary as `MapEditorListPage.editor-settings`
   and `SavedMapsPage.saved-maps-settings`. Each row is icon + input
   (or icon-only for toggles), laid out as auto-fill cells. */
.settings-grid {
  display: grid;
  /* 150px column min — the speed row is the widest content (icon + min
     input + dash + max input) and won't fit in less even with the
     shrunken `.num-input`. Anything below 150 ellipsises that row. */
  grid-template-columns: repeat(auto-fill, minmax(133px, 1fr));
  gap: 6px 12px;
  margin: 8px 0;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  color: #000;
  font-size: 13px;
}

.setting-row-edit {
  /* Pencil button needs its own column on the right. */
  justify-content: flex-start;
}

.setting-icon {
  /* Same plate shape as the SavedMapsPage settings row — `icon.png`
     background, 20px box with a 14px inner image. Use `flex-shrink: 0`
     so the icon doesn't squeeze if the value wraps. */
  background-image: url('/images/icon.png');
  background-size: contain;
  background-repeat: no-repeat;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  border: none;
}

.setting-icon img {
  width: 22px;
  height: 22px;
}

/* Toggle icons reuse the plate but render as buttons. The icon swap
   (closed_eye ↔ open_eye, etc.) is the only state cue — no halo or
   ring needed, since the asset itself encodes on/off. The `…-off`
   modifier (dimmed grayscale) is kept around for toggles that lack a
   paired off-asset; nothing currently uses it. */
.setting-icon-btn {
  cursor: pointer;
  background-color: transparent;
}

.setting-icon-btn:hover {
  filter: brightness(1.1);
}

.setting-icon-btn:active {
  transform: scale(0.95);
}

.setting-icon-btn-off {
  opacity: 0.4;
  filter: grayscale(0.6);
}

.setting-value {
  font-weight: bold;
  color: #000;
}

.num-input {
  /* Tan + black border palette (see comment on `.field input`).
     `border-box` + tighter horizontal padding so the rendered width
     stays at 34px even with the 1px border; the speed row's two
     inputs + dash then fit comfortably inside the 150px column. */
  min-width: 43px;
  box-sizing: border-box;
  background: #deae88;
  color: #000;
  border: 1px solid #000;
  border-radius: 4px;
  padding: 3px 4px;
  font-family: inherit;
  font-size: 13px;
}

.dash {
  font-weight: bold;
  font-size: 14px;
  color: #000;
}

/* Pencil edit button next to dimensions/players values. */
.edit-btn {
  background: #926846;
  color: #fff;
  border: 1px solid #5e3e26;
  border-radius: 4px;
  width: 24px;
  height: 24px;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  line-height: 1;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
}

.edit-btn:hover {
  background: #b0815a;
}

.edit-btn-active {
  background: #5e3e26;
}

/* Resize/players modal — centered `error_plate.png` plate, same look
   the in-game SaveMapDialog uses, so the editor's "modify a thing"
   prompts feel like the rest of the app. Sits above the gear menu
   overlay but below `ConfirmDialog` (10090) so a follow-up confirm
   (e.g. "reducing players will drop units…") paints on top of this
   dialog rather than getting hidden behind it. */
.param-dialog-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 10080;
  display: flex;
  align-items: center;
  justify-content: center;
}

.param-dialog {
  background-image: url('/images/error_plate.png');
  background-size: 100% 100%;
  padding: 28px 24px 24px;
  color: #000;
  width: 300px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}

.param-dialog-title {
  font-weight: bold;
  font-size: 16px;
  color: #000;
}

.param-dialog-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.param-dialog-actions {
  display: flex;
  gap: 8px;
}

/* Text buttons. Same dark semi-transparent pill that
   `SaveMapDialog.save-map-btn` and `ConfirmDialog.confirm-dialog-btn`
   use, so every modal in the editor matches the rest of the app. */
.param-dialog-btn {
  display: inline-block;
  margin: 0;
  background-color: rgba(0, 0, 0, 0.5);
  color: #fff;
  border: none;
  padding: 8px 18px;
  border-radius: 5px;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
}

.param-dialog-btn:hover {
  background-color: rgba(0, 0, 0, 0.65);
}

.apply-btn {
  background-image: url('/images/small_button.png');
  background-color: transparent;
  background-size: 100% 100%;
  border: none;
  width: 26px;
  height: 26px;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.apply-btn img {
  width: 18px;
  height: 18px;
}

.apply-btn:active {
  transform: scale(0.95);
}

/* Validation error message shown above the gear menu's button row.
   Same red as `SaveMapDialog.save-map-error` so all in-game forms speak
   the same dialect for "fix this before continuing". */
.menu-error {
  color: #a00;
  font-size: 12px;
  text-align: center;
  margin: 0 12px 4px;
  flex-shrink: 0;
}

/* Same look for the resize/players dialogs' inline error line. */
.param-dialog-error {
  color: #a00;
  font-size: 12px;
  text-align: center;
}

/* Bottom button row — same as GameMenuOverlay's `.menu-buttons`. */
.menu-buttons {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 4px;
  flex-shrink: 0;
  position: relative;
  top: -10px;
}

.menu-btn {
  padding: 0;
  user-select: none;
  background-image: url('/images/small_button.png');
  background-color: transparent;
  background-size: 100% 100%;
  border: none;
  width: 26px;
  height: 26px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-btn:active {
  transform: scale(0.95);
}

.menu-btn .btn-icon {
  width: 22px;
  height: 22px;
  margin-left: 1px;
  margin-top: 1px;
}

.menu-btn .btn-icon-resume {
  transform: scaleX(-1);
}
</style>
