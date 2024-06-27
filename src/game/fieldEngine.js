// Helpers related to field
import { createNewUnit, getNeighbours } from "@/game/helpers";
import { SCORE_MOD } from "@/game/const";

export class FieldEngine {
  constructor(field, width, height, fogOfWarRadius, players, minSpeed, maxSpeed) {
    this.field = field;
    this.width = width;
    this.height = height;
    this.fogOfWarRadius = fogOfWarRadius;
    this.players = players;
    this.minSpeed = minSpeed;
    this.maxSpeed = maxSpeed;
  }

  getCurrentVisibilitySet(player) {
    console.log('getCurrentVisibilitySet start');
    const visibleCoordsSet = new Set();
    const playerObjectCoords = this.getPlayerObjectCoords(player);
    for (const coords of playerObjectCoords) {
      const [x, y] = coords;
      for (let curX = x - this.fogOfWarRadius; curX <= x + this.fogOfWarRadius; curX++) {
        for (let curY = y - this.fogOfWarRadius; curY <= y + this.fogOfWarRadius; curY++) {
          if (this.areExistingCoords(curX, curY)) {
            visibleCoordsSet.add([curX, curY]);
            // console.log(curX, curY);
          }
        }
      }
    }
    console.log('getCurrentVisibilitySet finish');
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

  isVisibleObj(x, y, currentPlayer) {
    return (
      this.field[x][y].unit && this.field[x][y].unit.player === currentPlayer ||
      this.field[x][y].building && this.field[x][y].building.player === currentPlayer
    );
  }

  moveUnit(x0, y0, x1, y1, unit) {
    unit.hasMoved = true;
    delete(this.field[x0][y0].unit);
    this.field[x1][y1].unit = unit;
  }

  killNeighbours(x, y, curPlayer, countScore=true) {
    // console.log('Kill')
    const neighbours = getNeighbours(this.field, this.width, this.height, x, y);
    for (const neighbour of neighbours) {
      const [curX, curY] = neighbour;
      if (this.field[curX][curY].unit && this.field[curX][curY].unit.player !== curPlayer) {
        this.players[curPlayer].killed++;
        if (countScore) this.changeScore(curPlayer, SCORE_MOD.kill);
        this.players[this.field[curX][curY].unit.player].lost++;
        delete(this.field[curX][curY].unit);
      }
    }
  }

  captureBuildingIfNeeded(x1, y1, player) {
    if (this.field[x1][y1].building) this.field[x1][y1].building.player = player;
  }

  restoreAndProduceUnits(curPlayer) {
    let buildingsNum = 0;
    let unitsNum = 0;
    let producedNum = 0;
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
            this.field[x][y].unit = createNewUnit(curPlayer, this.minSpeed, this.maxSpeed);
            producedNum++;
            if (this.killAtBirth) {
              this.fieldEngine.killNeighbours(x, y, curPlayer, false);
            }
          }
        }
      }
    }
    return {
      buildingsNum: buildingsNum,
      unitsNum: unitsNum,
      producedNum: producedNum,
    }
  }

  changeScore(player, value) {
    this.players[player].score += value;
    if (this.players[player].score < 0) this.players[player].score = 0;
  }
}
