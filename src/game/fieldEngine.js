// Helpers related to field

import { createNewUnit, getNeighbours } from "@/game/helpers";

export class FieldEngine {
  constructor(
      field,
      width,
      height,
      fogOfWarRadius,
      players,
      minSpeed,
      maxSpeed,
      maxUnitsNum,
      killAtBirth,
      visibilitySpeedRelation,
      scoreMods,
  ) {
    this.field = field;
    this.width = width;
    this.height = height;
    this.fogOfWarRadius = fogOfWarRadius;
    this.players = players;
    this.minSpeed = minSpeed;
    this.maxSpeed = maxSpeed;
    this.maxUnitsNum = maxUnitsNum;
    this.killAtBirth = killAtBirth;
    this.visibilitySpeedRelation = visibilitySpeedRelation;
    this.scoreMods = scoreMods;
  }

  getCurrentVisibilitySet(player) {
    const visibleCoordsSet = new Set();
    const playerObjectCoords = this.getPlayerObjectCoords(player);
    for (const coords of playerObjectCoords) {
      const [x, y] = coords;
      let fogRadius = 0;
      if (this.field[x][y].unit) {
        fogRadius = Math.max(fogRadius, this.field[x][y].unit.visibility);
      }
      if (this.field[x][y].building) {
        fogRadius = Math.max(fogRadius, this.fogOfWarRadius);
      }
      // console.log('%', fogRadius);
      for (let curX = x - fogRadius; curX <= x + fogRadius; curX++) {
        for (let curY = y - fogRadius; curY <= y + fogRadius; curY++) {
          if (this.areExistingCoords(curX, curY)) {
            visibleCoordsSet.add([curX, curY]);
          }
        }
      }
    }
    return visibleCoordsSet;
  }

  getPlayerObjectCoords(player) {
    const coords = [];
    for (let curX = 0; curX < this.width; curX++) {
      for (let curY = 0; curY < this.height; curY++) {
        if (
          (this.field[curX][curY].unit && this.field[curX][curY].unit.player === player) ||
          (this.field[curX][curY].building && this.field[curX][curY].building.player === player)
        )
          coords.push([curX, curY]);
      }
    }
    return coords;
  }

  areExistingCoords(curX, curY) {
    return curX >= 0 && curX < this.width && curY >= 0 && curY < this.height;
  }

  getVisibleObjRadius(x, y, currentPlayer, x0, y0, r) {
    const vDist = Math.max(Math.abs(x - x0), Math.abs(y - y0));
    let res = 0;
    if (
        this.field[x][y].building &&
        this.field[x][y].building.player === currentPlayer &&
        vDist <= r + this.fogOfWarRadius
    ) {
      res = this.fogOfWarRadius;
    }
    if (
        this.field[x][y].unit &&
        this.field[x][y].unit.player === currentPlayer &&
        vDist <= r + this.field[x][y].unit.visibility
    ) {
      res = Math.max(res, this.field[x][y].unit.visibility);
    }
    return res;
  }

  moveUnit(x0, y0, x1, y1, unit) {
    unit.hasMoved = true;
    delete(this.field[x0][y0].unit);
    this.field[x1][y1].unit = unit;
    this.changeScore(unit.player, this.scoreMods.move);
  }

  killNeighbours(x, y, curPlayer, countScore=true) {
    const neighbours = getNeighbours(this.field, this.width, this.height, x, y);
    for (const neighbour of neighbours) {
      const [curX, curY] = neighbour;
      if (this.field[curX][curY].unit && this.field[curX][curY].unit.player !== curPlayer) {
        this.players[curPlayer].killed++;
        if (countScore) this.changeScore(curPlayer, this.scoreMods.kill);
        const enemyPlayer = this.field[curX][curY].unit.player;
        this.players[enemyPlayer].lost++;
        this.changeScore(enemyPlayer, this.scoreMods.lose);
        delete(this.field[curX][curY].unit);
      }
    }
  }

  captureBuildingIfNeeded(x1, y1, player) {
    let buildingOwner;
    if (this.field[x1][y1].building && (buildingOwner = this.field[x1][y1].building.player) !== player) {
      this.field[x1][y1].building.player = player;
      this.changeScore(player, this.scoreMods.capture);
      if (buildingOwner !== null) {
        this.changeScore(buildingOwner, this.scoreMods.leave);
      }
      return true;
    }
    return false;
  }

  restoreAndProduceUnits(curPlayer) {
    let buildingsNum = 0;
    let unitsNum = 0;
    let producedNum = 0;
    const unitsToCreateCoords = [];
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        if (this.field[x][y].unit) {
          this.field[x][y].unit.hasMoved = false;
          if (this.field[x][y].unit.player === curPlayer) {
            unitsNum++;
          }
        }
        if (this.field[x][y].building && this.field[x][y].building.player === curPlayer) {
          buildingsNum++;
          if (!this.field[x][y].unit) {
            unitsToCreateCoords.push([x, y]);
            producedNum++;
          }
        }
      }
    }
    if (!this.maxUnitsNum || unitsNum + producedNum <= this.maxUnitsNum) {
      for (let [x, y] of unitsToCreateCoords) {
        this.field[x][y].unit = createNewUnit(
            curPlayer,
            this.minSpeed,
            this.maxSpeed,
            this.fogOfWarRadius,
            this.visibilitySpeedRelation,
        );
        if (this.killAtBirth) {
          // countScore=false to avoid double score calculation (here only kill)
          this.killNeighbours(x, y, curPlayer, false);
        }
      }
    }
    else {
      producedNum = 0;
    }
    return {
      buildingsNum: buildingsNum,
      unitsNum: unitsNum,
      producedNum: producedNum,
    };
  }

  changeScore(player, value) {
    if (player === 0)
      console.log(`% ${value}`);
    this.players[player].score += value;
    if (this.players[player].score < 0) this.players[player].score = 0;
  }
}
