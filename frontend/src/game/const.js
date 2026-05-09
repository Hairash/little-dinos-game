export const TRANSITION_DELAY = 1

// Per-step delay for unit move animation, in milliseconds.
// Single source of truth so we can tune from one place when we move to
// smoother interpolation or walk-cycle frames later.
export const MOVE_ANIMATION_DELAY = 100

// Duration of the unit-death animation (damage flash + fade-out), in
// milliseconds. Independent of MOVE_ANIMATION_DELAY so the death cadence
// can be tuned separately. Used for every cause of death — neighbour-kill
// at the end of a move *and* kill-at-birth when a freshly-produced unit
// spawns next to enemies at the start of a turn.
export const DEATH_ANIMATION_DELAY = 300

// Auto-scroll the viewport to the unit's starting cell before each move
// animation. The scroll always centres the cell (smooth, awaits
// `scrollend`) so the user is looking at the action before it begins.
// Kept as a module-level constant so we can wire a user-facing toggle
// later without touching call-sites — replace the read with a settings/
// store lookup.
export const SCROLL_TO_MOVES = true

// Auto-scroll the viewport to each spawn cell before its fade-in. Same
// "always centre" semantics as SCROLL_TO_MOVES.
export const SCROLL_TO_BIRTHS = true

// Per-birth lingering delay in ms. Same shape as MOVE_ANIMATION_DELAY but
// independent so the cadence can be tuned. Acts as the death-animation
// window for that birth's kill-at-birth victims; pick >= DEATH_ANIMATION_DELAY
// if you want the fade-out to fully complete before the camera moves on.
export const BIRTH_ANIMATION_DELAY = 1000

// Cell size constants for zoom levels
export const MIN_CELL_SIZE = 10
export const MAX_CELL_SIZE = 70
export const DEFAULT_CELL_SIZE = 30
export const DEFAULT_BORDER_WIDTH = 3 // Border width at default cell size
export const GAME_STATUS_FIELDS = [
  'winPhase',
  'winner',
  'humanPhase',
  'lastPlayerPhase',
  'lastPlayer',
]

// TODO: Refactor fields, make all in one place - name, toSave (true/false), type (number, bool), min/max, ...
export const FIELDS_TO_SAVE = [
  'field',
  'humanPlayersNum',
  'botPlayersNum',
  'players',
  'width',
  'height',
  // 'scoresToWin',  // Removed
  'sectorsNum',
  'enableFogOfWar',
  'fogOfWarRadius',
  // 'enableScoutMode',  // Removed
  'visibilitySpeedRelation',
  'minSpeed',
  'maxSpeed',
  'speedMinVisibility',
  'maxUnitsNum',
  'maxBasesNum',
  'unitModifier',
  'baseModifier',
  'buildingRates',
  'hideEnemySpeed',
  'killAtBirth',
  'enableUndo',
].concat(GAME_STATUS_FIELDS)

export const SCORE_MOD = {
  kill: 10,
  building: -3,
  produce: 0,
  move: 0,
  capture: 0,
  lose: 0,
  unit: 0,
}

export const ACTIONS = {
  scouting: 'scouting',
}

export const DEFAULT_BUILDING_RATES = {
  base: 3,
  habitation: 4,
  temple: 2,
  well: 1,
  storage: 2,
  obelisk: 5,
}

export const GAME_STATES = {
  login: 'login',
  lobby: 'lobby',
  menu: 'menu',
  setup: 'setup',
  game: 'game',
  help: 'help',
}

export const INITIAL_SETTINGS = {
  width: 20,
  height: 20,
  humanPlayersNum: 1,
  botPlayersNum: 3,
  scoresToWin: 0,
  // TODO: make them changeable ?
  sectorsNum: 4,
  enableFogOfWar: true,
  fogOfWarRadius: 3,
  enableScoutMode: true,
  visibilitySpeedRelation: true,
  minSpeed: 1,
  maxSpeed: 5,
  speedMinVisibility: 7,
  maxUnitsNum: 5,
  maxBasesNum: 3,
  unitModifier: 3,
  baseModifier: 3,
  buildingRates: {
    base: 0,
    habitation: 0,
    temple: 0,
    well: 0,
    storage: 0,
    obelisk: 0,
  },
  hideEnemySpeed: false,
  killAtBirth: true,
}

export const MULTIPLAYER_INITIAL_SETTINGS = {
  ...INITIAL_SETTINGS,
  width: 16,
  height: 16,
  humanPlayersNum: 2,
  botPlayersNum: 0,
  // minSpeed: 5,
  // minVisibilitySpeed: 5,
  // fogOfWarRadius: 2,
  buildingRates: DEFAULT_BUILDING_RATES,
}
