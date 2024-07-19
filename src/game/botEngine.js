// Responsible for bot moves

import { getNeighbours } from '@/game/helpers';

export class BotEngine {
  constructor(field, width, height, enableFogOfWar, fieldEngine, waveEngine) {
    this.field = field;
    this.width = width;
    this.height = height;
    this.enableFogOfWar = enableFogOfWar;
    this.fieldEngine = fieldEngine;
    this.waveEngine = waveEngine;
  }

  makeBotUnitMove(unitCoordsArr, currentPlayer, moveUnit) {
    console.log('makeBotUnitMove');
    // TODO: Add debug mode
    // Logic needed for debug
    // if (this.players[this.currentPlayer]._type !== Models.PlayerTypes.BOT) return;
    // if (this.state !== this.STATES.play) return;
    if (unitCoordsArr.length === 0) {
      this.processEndTurn();
      return;
    }
    const coords = unitCoordsArr.shift();
    let visibilitySet = this.enableFogOfWar ?
      this.fieldEngine.getCurrentVisibilitySet(currentPlayer) :
      new Set();
    visibilitySet = new Set(Array.from(visibilitySet).map(coords => JSON.stringify(coords)));
    // console.log(visibilitySet);

    const [x, y] = coords;
    const unit = this.field[x][y].unit;
    const reachableCoordsArr = this.waveEngine.getReachableCoordsArr(x, y, unit.movePoints);
    if (reachableCoordsArr.length === 0) return;
    // Capture the building
    const reachableVisibleCoordsArr = this.enableFogOfWar ?
      this.getReachableVisibleCoordsArr(reachableCoordsArr) :
      reachableCoordsArr;

    const buildingCoords = this.findFreeBuilding(reachableVisibleCoordsArr, currentPlayer);
    if (buildingCoords) {
      moveUnit(coords, buildingCoords);
      return;
    }
    // Atack enemy
    // TODO: Add max kill
    const enemyCoords = this.findEnemy(reachableVisibleCoordsArr, visibilitySet, currentPlayer);
    if (enemyCoords) {
      moveUnit(coords, enemyCoords);
      return;
    }
    // TODO: Move to the building
    // Random move
    // TODO: Random long move, avoid own buildings
    const idx = Math.floor(Math.random() * reachableCoordsArr.length);
    const toCoords = reachableCoordsArr[idx];
    moveUnit(coords, toCoords);
    // For debug?
    // this.$refs.gameGridRef.setVisibility();
  }

  getReachableVisibleCoordsArr(reachableCoordsArr) {
    return reachableCoordsArr.filter(([x, y]) => !this.field[x][y].isHidden);
  }

  findFreeBuilding(coordsArr, currentPlayer) {
    return coordsArr.find(([x, y]) =>
      this.field[x][y].building &&
      this.field[x][y].building.player !== currentPlayer
    );
  }

  findEnemy(coordsArr, visibilitySet, currentPlayer) {
    return coordsArr.find(([x, y]) =>
      this.isEnemyNeighbour(visibilitySet, x, y, currentPlayer)
    );
  }

  isEnemyNeighbour(visibilitySet, x, y, currentPlayer) {
    const neighbours = getNeighbours(this.field, this.width, this.height, x, y);
    // console.log(`neighbours: ${neighbours}`);
    const res = neighbours.find(([curX, curY]) =>
      (!this.enableFogOfWar || visibilitySet.has(JSON.stringify([curX, curY]))) &&
      this.field[curX][curY].unit &&
      this.field[curX][curY].unit.player !== currentPlayer
    );
    // console.log(res);
    return res;
  }
}
