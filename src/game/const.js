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
  'scoreMods',
  'sectorsNum',
  'enableFogOfWar',
  'fogOfWarRadius',
  // 'enableScoutMode',  // Removed
  'visibilitySpeedRelation',
  'minSpeed',
  'maxSpeed',
  'maxUnitsNum',
  'hideEnemySpeed',
  'killAtBirth',
  'enableUndo',
].concat(GAME_STATUS_FIELDS);
