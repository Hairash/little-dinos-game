// Helpers related to field
import {getNeighbours} from "@/game/helpers";
import { SCORE_MOD } from "@/game/const";

export class FieldEngine {
  constructor(field, width, height, fogOfWarRadius, players) {
    this.field = field;
    this.width = width;
    this.height = height;
    this.fogOfWarRadius = fogOfWarRadius;
    this.players = players;
  }

  getCurrentVisibilitySet(player) {
    console.log('getCurrentVisibilitySet start');
    const visibleCoordsSet = new Set();
    const playerObjectCoords = this.getPlayerObjectCoords(player);
    for (const coords of playerObjectCoords) {
      const [x, y] = coords;
      let fogRadius = 0;
      if (this.field[x][y].unit) {
        // TODO: Make formula to calculate visibility fair. this.fogOfWarRadius should be median
        fogRadius = Math.max(fogRadius, 11 - this.field[x][y].unit.movePoints);
      }
      if (this.field[x][y].building) {
        fogRadius = Math.max(fogRadius, this.fogOfWarRadius);
      }
      console.log('%', fogRadius);
      for (let curX = x - fogRadius; curX <= x + fogRadius; curX++) {
        for (let curY = y - fogRadius; curY <= y + fogRadius; curY++) {
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

  isVisibleObj(x, y, currentPlayer, x0, y0, r) {
    const dist = Math.abs(x - x0) + Math.abs(y - y0);
    return (
      this.field[x][y].building && this.field[x][y].building.player === currentPlayer && dist <= this.fogOfWarRadius ||
      this.field[x][y].unit && this.field[x][y].unit.player === currentPlayer && dist <= r
    );
  }

  killNeighbours(field, x, y, curPlayer, countScore=true) {
    // console.log('Kill')
    const neighbours = getNeighbours(field, this.width, this.height, x, y);
    for (const neighbour of neighbours) {
      const [curX, curY] = neighbour;
      if (field[curX][curY].unit && field[curX][curY].unit.player !== curPlayer) {
        this.players[curPlayer].killed++;
        if (countScore) this.changeScore(curPlayer, SCORE_MOD.kill);
        this.players[field[curX][curY].unit.player].lost++;
        delete(field[curX][curY].unit);
      }
    }
  }

  changeScore(player, value) {
    this.players[player].score += value;
    if (this.players[player].score < 0) this.players[player].score = 0;
  }
}
