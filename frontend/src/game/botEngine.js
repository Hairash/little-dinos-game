// Responsible for bot moves

import { getNeighbours } from '@/game/helpers';
import Models from '@/game/models';

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
    // console.log('makeBotUnitMove');
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

    const reachableVisibleCoordsArr = this.enableFogOfWar ?
      this.getReachableVisibleCoordsArr(reachableCoordsArr) :
      reachableCoordsArr;

    // Always stay on enemy base
    // console.log(`${x}, ${y}: ${this.field[x][y].building?._type} ${this.field[x][y].building?.player} ${currentPlayer}`);
    if (
      this.field[x][y].building &&
      this.field[x][y].building._type === Models.BuildingTypes.BASE &&
      this.field[x][y].building.player !== null &&
      this.field[x][y].building.player !== currentPlayer
    ) {
      // console.log('stay on enemy base');
      return;
    }
    // Check is it occupying building (not own base or obelisk)
    const isOccupyingBuilding = (
      this.field[x][y].building &&
      this.field[x][y].building._type !== Models.BuildingTypes.OBELISK &&
      !(
        this.field[x][y].building._type === Models.BuildingTypes.BASE &&
        (
          this.field[x][y].building.player === null ||
          this.field[x][y].building.player === currentPlayer
        )
      )
    );
    let enemyCoords = this.findEnemy(reachableVisibleCoordsArr, visibilitySet, currentPlayer);
    // If no enemies arround, just stay there with 80% probability
    if (isOccupyingBuilding && !enemyCoords && Math.random() > 0.2) {
      // console.log('stay on occupying building');
      return;
    }

    // If occupying building and enemy is around, attack enemy with 50% probability or stay there
    if (isOccupyingBuilding && enemyCoords) {
      if (Math.random() > 0.5) {
        moveUnit(coords, enemyCoords);
        return;
      }
      return;
    }

    // Capture the base
    // TODO: Check if the base can be captured
    const habitationBuildingCoords = this.findFreeBuilding(reachableVisibleCoordsArr, currentPlayer, Models.BuildingTypes.HABITATION);
    if (habitationBuildingCoords && Math.random() > 0.5) {
      moveUnit(coords, habitationBuildingCoords);
      return;
    }
    const baseBuildingCoords = this.findFreeBuilding(reachableVisibleCoordsArr, currentPlayer, Models.BuildingTypes.BASE);
    if (baseBuildingCoords) {
      moveUnit(coords, baseBuildingCoords);
      return;
    }

    // Decide between captring other buildings or attacking enemy
    // TODO: Add max kill
    let buildingCoords = this.findFreeBuilding(reachableVisibleCoordsArr, currentPlayer);
    if (buildingCoords && enemyCoords) {
      if (Math.random() > 0.5) {
        buildingCoords = null;
      } else {
        enemyCoords = null;
      }
    }
    if (buildingCoords) {
      moveUnit(coords, buildingCoords);
      return;
    }
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

  findFreeBuilding(coordsArr, currentPlayer, buildingType=null) {
    return coordsArr.find(([x, y]) =>
      this.field[x][y].building &&
      this.field[x][y].building.player !== currentPlayer &&
      (!buildingType || this.field[x][y].building._type === buildingType)
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
