export const TRANSITION_DELAY = 1;
export const CELL_SIZE = 30;
export const GAME_STATUS_FIELDS = [
  'winPhase',
  'winner',
  'humanPhase',
  'lastPlayerPhase',
  'lastPlayer',
];
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
  'enableScoutMode',
  'minSpeed',
  'maxSpeed',
  'maxUnitsNum',
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
