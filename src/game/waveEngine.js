import Models from './models';
// import utils from './utils';

// Contains functions related to path finding
class WaveEngine {
  constructor(field, width, height, fogOfWarRadius, enableScoutMode) {
    this.field = field;
    this.width = width;
    this.height = height;
    this.fogOfWarRadius = fogOfWarRadius;
    this.enableScoutMode = enableScoutMode;
  }

  getWaveField() {
    const waveField = [];
    for (let x = 0; x < this.width; x++) {
      let col = [];
      for (let y = 0; y < this.height; y++) {
        if (
          this.field[x][y].terrain === Models.TerrainTypes.EMPTY
          && !this.field[x][y].unit
          && !(
            this.enableScoutMode
            && this.field[x][y].isHidden
          )
          )
          col.push(null);
        else
          col.push(-1);
      }
      waveField.push(col);
    }
    return waveField;
  }

  getReachableCoordsArr(x0, y0, movePoints) {
    const waveField = this.getWaveField();
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

  // Check if unit can move from fromCoords to toCoords
  canMove(fromCoords, toCoords) {
    console.log('canMove start');
    const [x0, y0] = fromCoords;
    const [x1, y1] = toCoords;
    const unit = this.field[x0][y0].unit;
    if (this.field[x1][y1].terrain !== Models.TerrainTypes.EMPTY) return false;

    const res = this.canReach(x0, y0, x1, y1, unit.movePoints);
    console.log('canMove finish');
    return res;
  }

  canReach(x0, y0, x1, y1, movePoints) {
    const waveField = this.getWaveField();
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
}

export {
  WaveEngine,
};
