import Models from './models'

class WaveEngine {
  constructor(field, width, height) {
    this.field = field;
    this.width = width;
    this.height = height;
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
        const curCell = wave.shift();
        const [x, y] = curCell;
        const s = waveField[x][y] + 1;
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
    const neighbours = [];
    if (x > 0 && field[x - 1][y] !== -1)
      neighbours.push([x - 1, y]);
    if (x < field.length - 1 && field[x + 1][y] !== -1)
      neighbours.push([x + 1, y]);
    if (y > 0 && field[x][y - 1] !== -1)
      neighbours.push([x, y - 1]);
    if (y < field[0].length - 1 && field[x][y + 1] !== -1)
      neighbours.push([x, y + 1]);
    return neighbours;
  }
}

export {
  WaveEngine,
}
