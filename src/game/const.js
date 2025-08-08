export const TRANSITION_DELAY = 1;
// export const CELL_SIZE = 30;
export const GAME_STATUS_FIELDS = [
  'winPhase',
  'winner',
  'humanPhase',
  'lastPlayerPhase',
  'lastPlayer',
];

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
  'maxUnitsNum',
  'maxBasesNum',
  'unitModifier',
  'baseModifier',
  'buildingRates',
  'hideEnemySpeed',
  'killAtBirth',
  'enableUndo',
].concat(GAME_STATUS_FIELDS);

export const SCORE_MOD = {
  kill: 10,
  building: -3,
  produce: 0,
  move: 0,
  capture: 0,
  lose: 0,
  unit: 0,
};

export const ACTIONS = {
  scouting: 'scouting',
};

export const DEFAULT_BUILDING_RATES = {
  base: 3,
  habitation: 5,
  temple: 3,
  well: 2,
  storage: 3,
  obelisk: 2,
};

export const GAME_STATES = {
  menu: 'menu',
  setup: 'setup',
  game: 'game',
  help: 'help',
};

export const INITIAL_SETTINGS = {
  width: 20,
  height: 20,
  humanPlayersNum: 1,
  botPlayersNum: 3,
  scoresToWin: 0,
  // TODO: make them changeable ?
  sectorsNum: 4,
  enableFogOfWar: false,
  fogOfWarRadius: 3,
  enableScoutMode: true,
  visibilitySpeedRelation: true,
  minSpeed: 1,
  maxSpeed: 10,
  speedMinVisibility: 10,
  maxUnitsNum: 15,
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
};
