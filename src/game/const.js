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
  'scoresToWin',
  'sectorsNum',
  'enableFogOfWar',
  'fogOfWarRadius',
  // 'enableScoutMode',  // Removed
  'visibilitySpeedRelation',
  'minSpeed',
  'maxSpeed',
  'maxUnitsNum',
  'maxBasesNum',
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
