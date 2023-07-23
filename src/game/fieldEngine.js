// Helpers related to field
export class FieldEngine {
  constructor(field, width, height, fogOfWarRadius) {
    this.field = field;
    this.width = width;
    this.height = height;
    this.fogOfWarRadius = fogOfWarRadius;
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
}
