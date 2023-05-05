import Models from './models'
// import utils from './utils'

class WaveEngine {
  constructor(field, width, height, fogOfWarRadius) {
    this.field = field;
    this.width = width;
    this.height = height;
    this.fogOfWarRadius = fogOfWarRadius;
  }

  getReachableCoordsArr(x0, y0, movePoints) {
    const waveField = [];
    for (let x = 0; x < this.width; x++) {
      let col = [];
      for (let y = 0; y < this.height; y++) {
        if (this.field[x][y].terrain === Models.TerrainTypes.EMPTY && !this.field[x][y].unit)
          col.push(null);
        else
          col.push(-1);
      }
      waveField.push(col);
    }

    const reachableCoordsArr = [];
    waveField[x0][y0] = 0;
    const wave = [[x0, y0]];
    while (wave.length > 0) {
      // utils.showWave(wave);
      // utils.showField(waveField);
      const curCell = wave.shift();
      const [x, y] = curCell;
      const s = waveField[x][y] + 1;
      // console.log(s);
      if (s > movePoints) break;
      for (const neighbour of this.getNeighbours(waveField, x, y)) {
        const [curX, curY] = neighbour;
        if (waveField[curX][curY] === null) {
          waveField[curX][curY] = s;
          wave.push([curX, curY]);
          reachableCoordsArr.push([curX, curY]);
        }
      }
    }
    return reachableCoordsArr;
  }

  canReach(x0, y0, x1, y1, movePoints) {
    const waveField = [];
    for (let x = 0; x < this.width; x++) {
      let col = [];
      for (let y = 0; y < this.height; y++) {
        if (this.field[x][y].terrain === Models.TerrainTypes.EMPTY && !this.field[x][y].unit)
          col.push(null);
        else
          col.push(-1);
      }
      waveField.push(col);
    }

    waveField[x0][y0] = 0;
    const wave = [[x0, y0]];
    while (wave.length > 0) {
      // utils.showWave(wave);
      // utils.showField(waveField);
      const curCell = wave.shift();
      const [x, y] = curCell;
      const s = waveField[x][y] + 1;
      // console.log(s);
      if (s > movePoints) return false;
      for (const neighbour of this.getNeighbours(waveField, x, y)) {
        const [curX, curY] = neighbour;
        if (curX === x1 && curY === y1) return true;
        if (waveField[curX][curY] === null || waveField[curX][curY] > s) {
          waveField[curX][curY] = s;
          wave.push([curX, curY]);
        }
      }
    }
    return false;
  }

  getNeighbours(field, x, y) {
    // console.log('getNeighbours start');
    const neighbours = [];
    if (x > 0 && field[x - 1][y] !== -1)
      neighbours.push([x - 1, y]);
    if (x < field.length - 1 && field[x + 1][y] !== -1)
      neighbours.push([x + 1, y]);
    if (y > 0 && field[x][y - 1] !== -1)
      neighbours.push([x, y - 1]);
    if (y < field[0].length - 1 && field[x][y + 1] !== -1)
      neighbours.push([x, y + 1]);
    // console.log('getNeighbours finish');
    return neighbours;
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
}

export {
  WaveEngine,
}
