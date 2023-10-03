export const TRANSITION_DELAY = 1;
export const CELL_SIZE = 30;
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
  'hideEnemySpeed',
  'killAtBirth',
  'enableUndo',
];
export const SCORE_MOD = {
  kill: 10,
  building: -3,
  produce: 0,
  move: 0,
  capture: 0,
  lose: 0,
  unit: 0,
};
