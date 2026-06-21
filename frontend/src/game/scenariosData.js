// Built-in scenarios — pre-designed canonical maps with a story hook.
//
// Each scenario builds a Map JSON (mapSchema.js v1) at module-load
// time and exposes it through SCENARIOS. ScenariosPage feeds the
// selected entry's `.map` to `startGame` exactly the way the saved-map
// flow does, so the runtime path is identical to launching from a
// localStorage saved map.
//
// Adding a scenario: append one entry to SCENARIOS. The helpers below
// (mountain/hLine/vLine/fillRect/building/unit) are intentionally
// minimal — compose maps procedurally so the intent stays readable.

import { MAP_SCHEMA_VERSION, SETTINGS_FIELDS } from '@/game/mapSchema'

// Shared defaults for every scenario. Per-scenario settings overrides
// merge on top of this — keep this list to settings that make
// scenarios feel like *scenarios* (fog on, sensible production caps,
// undo allowed). Mirrors INITIAL_SETTINGS shape but tuned for hand-
// built maps where buildingRates are irrelevant (no random gen).
// `enableScoutMode` is intentionally not here — it is not part of the
// canonical Map schema (SETTINGS_FIELDS strips it) and the legacy
// permissive mode (units moving through fog) is not a playable option
// in scenarios. ScenariosPage.vue forces the modern "fog blocks
// movement" rule at the startGame boundary.
const SCENARIO_DEFAULTS = {
  enableFogOfWar: true,
  fogOfWarRadius: 3,
  visibilitySpeedRelation: true,
  minSpeed: 1,
  maxSpeed: 5,
  speedMinVisibility: 7,
  maxUnitsNum: 5,
  maxBasesNum: 3,
  unitModifier: 3,
  baseModifier: 3,
  buildingRates: { base: 0, habitation: 0, temple: 0, well: 0, storage: 0, obelisk: 0 },
  hideEnemySpeed: false,
  killAtBirth: true,
  enableUndo: true,
}

function pickSettings(settings) {
  const out = {}
  for (const key of SETTINGS_FIELDS) {
    if (settings[key] !== undefined) out[key] = settings[key]
  }
  return out
}

// Deterministic texture indices so a scenario looks the same every
// launch. Empty cells have 9 variants (idx 1..9), mountain cells 5
// (idx 1..5, see MapPreview comment on the 6..9 → 4..1 mirror).
function emptyIdx(x, y) {
  return 1 + ((x * 7 + y * 3) % 9)
}
function mountainIdx(x, y) {
  return 1 + ((x + 2 * y) % 5)
}

function emptyField(width, height) {
  const field = []
  for (let x = 0; x < width; x++) {
    const col = []
    for (let y = 0; y < height; y++) {
      col.push({
        terrain: { kind: 'empty', idx: emptyIdx(x, y) },
        building: null,
        unit: null,
      })
    }
    field.push(col)
  }
  return field
}

function inBounds(field, x, y) {
  return x >= 0 && y >= 0 && x < field.length && y < field[0].length
}

function mountain(field, x, y) {
  if (!inBounds(field, x, y)) return
  // Don't overwrite a building/unit with terrain.
  if (field[x][y].building || field[x][y].unit) return
  field[x][y].terrain = { kind: 'mountain', idx: mountainIdx(x, y) }
}

function clear(field, x, y) {
  if (!inBounds(field, x, y)) return
  field[x][y].terrain = { kind: 'empty', idx: emptyIdx(x, y) }
}

function hLine(field, x1, x2, y) {
  for (let x = x1; x <= x2; x++) mountain(field, x, y)
}
function vLine(field, x, y1, y2) {
  for (let y = y1; y <= y2; y++) mountain(field, x, y)
}
function fillRect(field, x1, y1, x2, y2) {
  for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) mountain(field, x, y)
}
function clearRect(field, x1, y1, x2, y2) {
  for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) clear(field, x, y)
}

function placeBuilding(field, x, y, type, player = null) {
  clear(field, x, y)
  field[x][y].building = { player, _type: type }
}

function placeUnit(field, x, y, player) {
  clear(field, x, y)
  field[x][y].unit = { player, _type: `dino${player + 1}` }
}

// Wrap a build() result into a canonical Map JSON.
function toScenarioMap(name, build, humanPlayersNum, botPlayersNum, settingsOverrides = {}) {
  const { field, width, height } = build()
  const playersNum = humanPlayersNum + botPlayersNum
  const players = []
  for (let i = 0; i < humanPlayersNum; i++) players.push({ _type: 'human' })
  for (let i = 0; i < botPlayersNum; i++) players.push({ _type: 'bot' })

  const merged = { ...SCENARIO_DEFAULTS, ...settingsOverrides }

  return {
    version: MAP_SCHEMA_VERSION,
    name,
    metadata: {
      playersNum,
      humanPlayersNum,
      botPlayersNum,
      width,
      height,
    },
    settings: pickSettings(merged),
    field,
    players,
  }
}

// --- Scenarios ---------------------------------------------------------------

// 1. Ambush — push from SW base to NE enemy through a mountain pass
// peppered with ambushers.
function buildAmbush() {
  const W = 20
  const H = 20
  const field = emptyField(W, H)
  // Diagonal mountain spurs forming a winding pass.
  fillRect(field, 3, 0, 4, 6)
  fillRect(field, 7, 3, 8, 9)
  fillRect(field, 11, 6, 12, 13)
  fillRect(field, 5, 11, 9, 12)
  mountain(field, 6, 5)
  mountain(field, 9, 8)
  mountain(field, 10, 11)

  // Player (SW corner)
  placeBuilding(field, 1, 14, 'base', 0)
  placeUnit(field, 1, 14, 0)
  placeUnit(field, 2, 14, 0)
  placeUnit(field, 1, 13, 0)

  // Ambushers (enemy units along the pass)
  placeUnit(field, 6, 8, 1)
  placeUnit(field, 9, 5, 1)
  placeUnit(field, 10, 10, 1)

  // Enemy stronghold (NE corner)
  placeBuilding(field, 14, 1, 'base', 1)
  placeUnit(field, 14, 1, 1)
  placeUnit(field, 13, 2, 1)

  return { field, width: W, height: H }
}

// 2. King of the Hill — race four players to a fortified hilltop.
function buildKingOfTheHill() {
  const W = 18,
    H = 18
  const field = emptyField(W, H)
  // Inner ring of mountains around the prize, with four cardinal gates.
  fillRect(field, 6, 6, 11, 11)
  clearRect(field, 7, 7, 10, 10)
  // Knock out the gates (one per side).
  clear(field, 8, 6)
  clear(field, 9, 6)
  clear(field, 8, 11)
  clear(field, 9, 11)
  clear(field, 6, 8)
  clear(field, 6, 9)
  clear(field, 11, 8)
  clear(field, 11, 9)

  // Central hilltop cluster — the prize.
  placeBuilding(field, 8, 8, 'base', null)
  placeBuilding(field, 9, 8, 'temple', null)
  placeBuilding(field, 8, 9, 'habitation', null)
  placeBuilding(field, 9, 9, 'temple', null)

  // Outer terrain — scatter a few mountains to shape approaches.
  fillRect(field, 3, 14, 5, 14)
  fillRect(field, 12, 3, 14, 3)
  mountain(field, 3, 3)
  mountain(field, 14, 14)

  // Four players at four corners.
  placeBuilding(field, 1, 1, 'base', 0)
  placeUnit(field, 1, 1, 0)
  placeUnit(field, 2, 1, 0)

  placeBuilding(field, 16, 1, 'base', 1)
  placeUnit(field, 16, 1, 1)
  placeUnit(field, 15, 1, 1)

  placeBuilding(field, 1, 16, 'base', 2)
  placeUnit(field, 1, 16, 2)
  placeUnit(field, 2, 16, 2)

  placeBuilding(field, 16, 16, 'base', 3)
  placeUnit(field, 16, 16, 3)
  placeUnit(field, 15, 16, 3)

  return { field, width: W, height: H }
}

// 3. Last Stand — small player vs a dug-in enemy holding three bases.
function buildLastStand() {
  const W = 18,
    H = 18
  const field = emptyField(W, H)
  // Diagonal mountain ranges form chokepoints between the two camps.
  for (let i = 0; i < 8; i++) mountain(field, 6 + i, 4 + Math.floor(i / 2))
  for (let i = 0; i < 8; i++) mountain(field, 5 + i, 12 - Math.floor(i / 2))
  fillRect(field, 8, 8, 9, 9)

  // Player corner — small but with a habitation to grow (neutral: the
  // player claims its bonus by occupying it, same as random maps).
  placeBuilding(field, 1, 16, 'base', 0)
  placeBuilding(field, 3, 16, 'habitation', null)
  placeUnit(field, 1, 16, 0)
  placeUnit(field, 2, 16, 0)

  // Enemy stronghold — three bases + supporting temple.
  placeBuilding(field, 16, 1, 'base', 1)
  placeBuilding(field, 14, 1, 'base', 1)
  placeBuilding(field, 16, 3, 'base', 1)
  placeBuilding(field, 15, 2, 'temple', null)
  placeUnit(field, 16, 1, 1)
  placeUnit(field, 14, 1, 1)
  placeUnit(field, 16, 3, 1)
  placeUnit(field, 13, 2, 1)

  return { field, width: W, height: H }
}

// 4. No Tower — player has units but no base; must reach the neutral
// central tower before the enemy in the far corner overwhelms them.
function buildNoTower() {
  const W = 16,
    H = 16
  const field = emptyField(W, H)
  // Mountain ring around the central tower with two narrow entrances.
  fillRect(field, 6, 6, 9, 9)
  clearRect(field, 7, 7, 8, 8)
  clear(field, 7, 6)
  clear(field, 8, 9)
  // Scattered ridges between player and centre.
  hLine(field, 3, 6, 3)
  hLine(field, 9, 12, 12)
  vLine(field, 3, 4, 7)
  vLine(field, 12, 8, 11)

  // Neutral central tower (the prize).
  placeBuilding(field, 7, 7, 'base', null)
  placeBuilding(field, 8, 8, 'temple', null)

  // Player units, no base (NW corner).
  placeUnit(field, 1, 1, 0)
  placeUnit(field, 2, 1, 0)
  placeUnit(field, 1, 2, 0)
  placeUnit(field, 2, 2, 0)

  // Enemy with base (SE corner) — slow build-up.
  placeBuilding(field, 14, 14, 'base', 1)
  placeUnit(field, 14, 14, 1)
  placeUnit(field, 13, 14, 1)

  return { field, width: W, height: H }
}

// 5. Race to the Tower — symmetric two-player race for a neutral base.
function buildRaceToTheTower() {
  const W = 17,
    H = 13
  const field = emptyField(W, H)
  // Symmetric mountain wings.
  fillRect(field, 6, 2, 7, 3)
  fillRect(field, 9, 9, 10, 10)
  fillRect(field, 6, 9, 7, 10)
  fillRect(field, 9, 2, 10, 3)
  mountain(field, 8, 5)
  mountain(field, 8, 7)

  // Centre prize.
  placeBuilding(field, 8, 6, 'base', null)

  // Player west.
  placeBuilding(field, 1, 6, 'base', 0)
  placeUnit(field, 1, 6, 0)
  placeUnit(field, 1, 5, 0)
  placeUnit(field, 1, 7, 0)

  // Enemy east.
  placeBuilding(field, 15, 6, 'base', 1)
  placeUnit(field, 15, 6, 1)
  placeUnit(field, 15, 5, 1)
  placeUnit(field, 15, 7, 1)

  return { field, width: W, height: H }
}

// 6. Treasure Hunt — four guarded clusters of neutral buildings.
function buildTreasureHunt() {
  const W = 20,
    H = 20
  const field = emptyField(W, H)
  // Light mountain ridges to shape approaches to each corner.
  fillRect(field, 4, 4, 5, 5)
  fillRect(field, 14, 4, 15, 5)
  fillRect(field, 4, 14, 5, 15)
  fillRect(field, 14, 14, 15, 15)
  // Inner ring suggesting a hub.
  hLine(field, 7, 12, 9)
  hLine(field, 7, 12, 10)
  clear(field, 9, 9)
  clear(field, 9, 10)

  // Player base — central-ish.
  placeBuilding(field, 9, 9, 'base', 0)
  placeUnit(field, 9, 9, 0)
  placeUnit(field, 10, 10, 0)
  placeUnit(field, 9, 10, 0)

  // NW cluster — temples.
  placeBuilding(field, 1, 1, 'temple', null)
  placeBuilding(field, 2, 1, 'temple', null)
  placeBuilding(field, 1, 2, 'well', null)
  placeUnit(field, 3, 2, 1)
  placeUnit(field, 2, 3, 1)

  // NE cluster — habitations.
  placeBuilding(field, 17, 1, 'habitation', null)
  placeBuilding(field, 18, 1, 'habitation', null)
  placeBuilding(field, 18, 2, 'storage', null)
  placeUnit(field, 16, 2, 1)
  placeUnit(field, 17, 3, 1)

  // SW cluster — wells.
  placeBuilding(field, 1, 17, 'well', null)
  placeBuilding(field, 2, 18, 'well', null)
  placeBuilding(field, 1, 18, 'obelisk', null)
  placeUnit(field, 3, 17, 1)
  placeUnit(field, 2, 16, 1)

  // SE cluster — enemy stronghold + neutral supporting buildings the
  // bot will occupy.
  placeBuilding(field, 18, 18, 'base', 1)
  placeBuilding(field, 17, 18, 'storage', null)
  placeBuilding(field, 18, 17, 'temple', null)
  placeUnit(field, 18, 18, 1)
  placeUnit(field, 17, 17, 1)
  placeUnit(field, 16, 18, 1)

  return { field, width: W, height: H }
}

// 7. Mountain Pass — long narrow east-west corridor.
function buildMountainPass() {
  const W = 22,
    H = 11
  const field = emptyField(W, H)
  // Two thick mountain ranges hugging the north and south edges.
  fillRect(field, 0, 0, W - 1, 1)
  fillRect(field, 0, H - 2, W - 1, H - 1)
  // A few inner spurs so the corridor isn't a straight line.
  fillRect(field, 7, 2, 8, 4)
  fillRect(field, 13, 6, 14, 8)
  mountain(field, 10, 5)
  mountain(field, 11, 5)

  // Player west.
  placeBuilding(field, 1, 5, 'base', 0)
  placeUnit(field, 1, 5, 0)
  placeUnit(field, 2, 5, 0)
  placeUnit(field, 1, 4, 0)
  placeUnit(field, 1, 6, 0)

  // Enemy east.
  placeBuilding(field, W - 2, 5, 'base', 1)
  placeUnit(field, W - 2, 5, 1)
  placeUnit(field, W - 3, 5, 1)
  placeUnit(field, W - 2, 4, 1)
  placeUnit(field, W - 2, 6, 1)

  return { field, width: W, height: H }
}

// 8. Encirclement — three enemy outposts at the cardinal points.
function buildEncirclement() {
  const W = 18,
    H = 18
  const field = emptyField(W, H)
  // Inner walls forming a defensible "keep" for the player.
  hLine(field, 6, 11, 6)
  hLine(field, 6, 11, 11)
  vLine(field, 6, 7, 10)
  vLine(field, 11, 7, 10)
  // Knock holes in each wall.
  clear(field, 8, 6)
  clear(field, 9, 11)
  clear(field, 6, 8)
  clear(field, 11, 9)

  // Player keep (centre). Non-base buildings stay neutral — the engine
  // awards their bonus to whoever has a unit standing on them.
  placeBuilding(field, 8, 8, 'base', 0)
  placeBuilding(field, 9, 9, 'habitation', null)
  placeBuilding(field, 9, 8, 'temple', null)
  placeUnit(field, 8, 8, 0)
  placeUnit(field, 8, 9, 0)
  placeUnit(field, 9, 9, 0)

  // Three enemy outposts.
  placeBuilding(field, 8, 1, 'base', 1)
  placeUnit(field, 8, 1, 1)
  placeUnit(field, 7, 1, 1)

  placeBuilding(field, 16, 8, 'base', 2)
  placeUnit(field, 16, 8, 2)
  placeUnit(field, 16, 9, 2)

  placeBuilding(field, 8, 16, 'base', 3)
  placeUnit(field, 8, 16, 3)
  placeUnit(field, 9, 16, 3)

  return { field, width: W, height: H }
}

// 9. The Maze — heavy mountain pattern, two players at opposite ends.
function buildMaze() {
  const W = 18,
    H = 18
  const field = emptyField(W, H)
  // Maze-like walls — straight runs broken up so multiple paths exist.
  hLine(field, 0, 12, 3)
  hLine(field, 5, 17, 6)
  hLine(field, 0, 12, 9)
  hLine(field, 5, 17, 12)
  hLine(field, 0, 12, 15)
  vLine(field, 4, 0, 2)
  vLine(field, 8, 4, 5)
  vLine(field, 13, 10, 11)
  vLine(field, 4, 13, 14)
  vLine(field, 8, 16, 17)
  // Holes to ensure connectivity.
  clear(field, 6, 3)
  clear(field, 12, 6)
  clear(field, 2, 9)
  clear(field, 10, 12)
  clear(field, 8, 15)

  // Player (NW). Obelisk stays neutral — its scouting bonus applies to
  // whoever occupies it.
  placeBuilding(field, 1, 1, 'base', 0)
  placeUnit(field, 1, 1, 0)
  placeUnit(field, 2, 1, 0)
  placeBuilding(field, 1, 2, 'obelisk', null)

  // Enemy (SE).
  placeBuilding(field, 16, 16, 'base', 1)
  placeUnit(field, 16, 16, 1)
  placeUnit(field, 15, 16, 1)
  placeBuilding(field, 16, 15, 'temple', null)

  return { field, width: W, height: H }
}

// 10. Island Hop — three islands joined by narrow passes.
function buildIslandHop() {
  const W = 20,
    H = 16
  const field = emptyField(W, H)
  // Two vertical mountain bands dividing the map into three islands.
  fillRect(field, 6, 0, 7, H - 1)
  fillRect(field, 12, 0, 13, H - 1)
  // One narrow pass per band.
  clear(field, 6, 8)
  clear(field, 7, 8)
  clear(field, 12, 7)
  clear(field, 13, 7)
  // A few ridges per island for texture.
  fillRect(field, 2, 3, 3, 4)
  fillRect(field, 9, 11, 10, 12)
  fillRect(field, 16, 3, 17, 4)

  // Player (west island).
  placeBuilding(field, 2, 12, 'base', 0)
  placeUnit(field, 2, 12, 0)
  placeUnit(field, 3, 12, 0)
  placeUnit(field, 2, 11, 0)

  // Centre island — neutral prizes.
  placeBuilding(field, 9, 7, 'temple', null)
  placeBuilding(field, 10, 8, 'habitation', null)
  placeBuilding(field, 9, 8, 'well', null)

  // Enemy (east island).
  placeBuilding(field, 17, 12, 'base', 1)
  placeUnit(field, 17, 12, 1)
  placeUnit(field, 16, 12, 1)
  placeUnit(field, 17, 11, 1)

  return { field, width: W, height: H }
}

// --- Registry ----------------------------------------------------------------

export const SCENARIOS = [
  {
    id: 'ambush',
    description:
      'Push from your base in the southwest to the enemy stronghold in the northeast, threading a winding mountain pass. Enemy ambushers wait along the way — use your visibility carefully and clear them before they overrun you.',
    map: toScenarioMap('Ambush', buildAmbush, 1, 1, { enableUndo: true }),
  },
  {
    id: 'king-of-the-hill',
    description:
      'Four armies race to a fortified hilltop ringed by mountains with four narrow gates. A cluster of temples and habitations inside makes whoever holds it nearly unstoppable. Take it first, or break it before someone else does.',
    map: toScenarioMap('King of the Hill', buildKingOfTheHill, 1, 3, {
      enableFogOfWar: false,
    }),
  },
  {
    id: 'last-stand',
    description:
      'You hold one corner of the map; a dug-in enemy with three bases holds the opposite corner. Mountain ranges form natural chokepoints to defend. Outlast their assault — or strike now, while they are still gathering.',
    map: toScenarioMap('Last Stand', buildLastStand, 1, 1, {
      maxUnitsNum: 6,
    }),
  },
  {
    id: 'no-tower',
    description:
      'You start with four units, but no base. A neutral tower waits in the centre of the map, walled in by mountains with only narrow entrances. Capture it before the enemy in the far corner builds an army you cannot match.',
    map: toScenarioMap('No Tower', buildNoTower, 1, 1, {}),
  },
  {
    id: 'race-to-the-tower',
    description:
      'A neutral tower stands in the middle of the map. You and the enemy start equidistant; whoever claims it first will out-produce the other. Open ground — no fog — so move fast and commit.',
    map: toScenarioMap('Race to the Tower', buildRaceToTheTower, 1, 1, {
      enableFogOfWar: false,
      minSpeed: 2,
    }),
  },
  {
    id: 'treasure-hunt',
    description:
      'Four corners of the map hold clusters of neutral buildings — temples, wells, habitations, storages. Each is guarded by patrols from the enemy stronghold in the southeast. Carve through them to grow your army, then take the boss.',
    map: toScenarioMap('Treasure Hunt', buildTreasureHunt, 1, 1, {
      maxUnitsNum: 6,
    }),
  },
  {
    id: 'mountain-pass',
    description:
      'A narrow east-west corridor walled in by mountain ranges. You hold the west, the enemy holds the east. There is nowhere to hide — only the line in front of you. Hold the centre.',
    map: toScenarioMap('Mountain Pass', buildMountainPass, 1, 1, {}),
  },
  {
    id: 'encirclement',
    description:
      'You are surrounded. Three enemy outposts at the north, east and south each have a base and a handful of units. Break out before they grind you down — or pick them off one by one from your fortified keep in the centre.',
    map: toScenarioMap('Encirclement', buildEncirclement, 1, 3, {
      maxUnitsNum: 7,
    }),
  },
  {
    id: 'the-maze',
    description:
      'A labyrinth of mountain walls separates you from the enemy. Many paths exist, but most twist. Scout aggressively, find the shortest route, and cut off the routes they take to reach you.',
    map: toScenarioMap('The Maze', buildMaze, 1, 1, {
      fogOfWarRadius: 2,
    }),
  },
  {
    id: 'island-hop',
    description:
      'The map is split into three islands by mountain barriers, joined by narrow passes. The middle island holds neutral buildings worth taking. Cross the passes, claim the prizes, and dislodge the enemy from their island.',
    map: toScenarioMap('Island Hop', buildIslandHop, 1, 1, {}),
  },
]

export function getScenarioById(id) {
  return SCENARIOS.find(s => s.id === id) || null
}
