import Models from './models'

// TODO: Make one file with all engines
class FieldEngine {
  constructor(playersNum, width, height, sectorsNum) {
    this.playersNum = playersNum;
    this.width = width;
    this.height = height;
    this.sectorsNum = sectorsNum;
  }

  generateField() {
    const field = [];
    // const terrainTypesArr = Object.values(Models.TerrainTypes);
    for (let x = 0; x < this.width; x++) {
      const col = [];
      for (let y = 0; y < this.height; y++) {
        const r = Math.random();
        // const terrain = terrainTypesArr[Math.floor(r * terrainTypesArr.length)];
        // TODO: Make a fair terrain generation
        const terrain = r > 0.75 ? Models.TerrainTypes.MOUNTAIN : Models.TerrainTypes.EMPTY
        const cell = {
          terrain: terrain,
        }
        // if (r < 0.05) cell.unit = new Models.Unit(0, 'dino1', Math.round(r * 1000) % 10 + 1);
        // else if (r < 0.1) cell.unit = new Models.Unit(1, 'dino2', Math.round(r * 1000) % 10 + 1);
        col.push(cell);
      }
      field.push(col);
    }
    // Set units
    const sectors = [];
    for (let player = 0; player < this.playersNum; player++) {
      let x = Math.floor(Math.random() * this.width);
      let y = Math.floor(Math.random() * this.height);
      let [sectorX, sectorY] = this.getSector(x, y);
      while (field[x][y].terrain === Models.TerrainTypes.MOUNTAIN || !this.validateSector(sectorX, sectorY, sectors)) {
        x = Math.floor(Math.random() * this.width);
        y = Math.floor(Math.random() * this.height);
        [sectorX, sectorY] = this.getSector(x, y);
      }
      // console.log(sectorX, sectorY);
      sectors.push([sectorX, sectorY]);
      field[x][y].building = new Models.Building(
        player,
        Models.BuildingTypes.BASE,
      );
      field[x][y].unit = this.createNewUnit(player);
    }
    // Set buildings
    let failCtr = 0;
    for (let building = 0; building < this.width * this.height * 0.03; building++) {
      let x = Math.floor(Math.random() * this.width);
      let y = Math.floor(Math.random() * this.height);
      while (field[x][y].terrain === Models.TerrainTypes.MOUNTAIN || !this.noBuildingsInDistance(field, x, y, 5)) {
        x = Math.floor(Math.random() * this.width);
        y = Math.floor(Math.random() * this.height);
        failCtr++;
        if (failCtr > 100) {
          x = null;
          y = null;
          break;
        }
      }
      if (x !== null && y !== null)
        field[x][y].building = new Models.Building(null, Models.BuildingTypes.BASE);
    }
    // console.log(field);
    return field;
  }

  createNewUnit(player) {
    /*
    Unit map:
    1..10 - regular dinos
    11 - destructor
    */

    const unitTypeNum = Math.ceil(Math.random() * 11);
    let unitType;
    let movePoints;
    if (unitTypeNum >= 1 && unitTypeNum <= 10) {
      unitType = 'dino';
      movePoints = unitTypeNum;
    } else if (unitTypeNum === 11) {
      unitType = 'destructor';
      movePoints = 1;
    }

    return new Models.Unit(
      player,
      // TODO: make fair dict with images
      unitType,
      movePoints,
    )
  }

  getSector(x, y) {
    return [Math.floor(x * this.sectorsNum / this.width), Math.floor(y * this.sectorsNum / this.height)]
  }

  validateSector(x, y, sectors) {
    // console.log(x, y, sectors);
    if (!(x === 0 || x === this.sectorsNum - 1 || y === 0 || y === this.sectorsNum - 1)) return false;
    for (let sector of sectors) {
      if (this.sectorsDistance([x, y], sector) < 2) return false;
    }
    return true;
  }

  sectorsDistance(s1, s2) {
    const [s1X, s1Y] = s1;
    const [s2X, s2Y] = s2;
    return Math.max(Math.abs(s1X - s2X), Math.abs(s1Y - s2Y));
  }

  noBuildingsInDistance(field, x, y, r) {
    console.log(x, y, r);
    for (let curX = x - r; curX <= x + r; curX++) {
      if (curX < 0 || curX >= this.width) continue;
      for (let curY = y - r; curY <= y + r; curY++) {
        if (curY < 0 || curY >= this.height) continue;
        if (Math.abs(curX - x) + Math.abs(curY - y) > r) continue;
        console.log(curX, curY);
        console.log(field[curX][curY]);
        if (field[curX][curY].building) return false;
      }
    }
    return true;
  }

  killNeighbours(field, x, y, player) {
    // console.log('Kill')
    const neighbours = this.getNeighbours(field, x, y);
    for (const neighbour of neighbours) {
      const [curX, curY] = neighbour;
      if (field[curX][curY].unit && field[curX][curY].unit.player !== player) {
        delete(field[curX][curY].unit);
      }
    }
  }

  getNeighbours(field, x, y) {
    const neighbours = [];
    if (x > 0 && field[x - 1][y].terrain !== Models.TerrainTypes.MOUNTAIN)
      neighbours.push([x - 1, y]);
    if (x < this.width - 1 && field[x + 1][y].terrain !== Models.TerrainTypes.MOUNTAIN)
      neighbours.push([x + 1, y]);
    if (y > 0 && field[x][y - 1].terrain !== Models.TerrainTypes.MOUNTAIN)
      neighbours.push([x, y - 1]);
    if (y < this.height - 1 && field[x][y + 1].terrain !== Models.TerrainTypes.MOUNTAIN)
      neighbours.push([x, y + 1]);
    return neighbours;
  }
}

export {
  FieldEngine,
}
