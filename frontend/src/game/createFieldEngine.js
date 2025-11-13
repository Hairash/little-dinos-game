// Responsible for generating new field
// Cannot use other engines, because other engines require field, but it doesn't exist until this one creates it

import Models from '@/game/models';
import { createNewUnit } from '@/game/helpers';

class CreateFieldEngine {
  static MOUNTAIN_RATIO = 0.75; // Ratio of cells that will be empty (others - mountains)

  constructor(
      playersNum,
      width,
      height,
      sectorsNum,
      minSpeed,
      maxSpeed,
      speedMinVisibility,
      fogOfWarRadius,
      visibilitySpeedRelation,
      buildingRates,
    ) {
    this.playersNum = playersNum;
    this.width = width;
    this.height = height;
    this.sectorsNum = sectorsNum;
    this.minSpeed = minSpeed;
    this.maxSpeed = maxSpeed;
    this.speedMinVisibility = speedMinVisibility;
    this.fogOfWarRadius = fogOfWarRadius;
    this.visibilitySpeedRelation = visibilitySpeedRelation;
    this.buildingRates = buildingRates;

    this.startPositions = [];  // Used for generation algorithm
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
        const terrain = r > CreateFieldEngine.MOUNTAIN_RATIO ? Models.TerrainTypes.MOUNTAIN : Models.TerrainTypes.EMPTY;
        const cell = new Models.Cell({
          kind: terrain,
          idx: Math.ceil(Math.random() * 9),
        });
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

      let tryCtr = 0;
      while (
        field[x][y].terrain.kind === Models.TerrainTypes.MOUNTAIN ||
        this.isCellInStartPositions(x, y) ||
        (!this.validateSector(sectorX, sectorY, sectors) && tryCtr < 100)
      ) {
        x = Math.floor(Math.random() * this.width);
        y = Math.floor(Math.random() * this.height);
        [sectorX, sectorY] = this.getSector(x, y);
        if (
          field[x][y].terrain.kind !== Models.TerrainTypes.MOUNTAIN && 
          !this.isCellInStartPositions(x, y)
        ) {
          tryCtr++;
        }
      }
      // console.log(sectorX, sectorY);
      sectors.push([sectorX, sectorY]);
      field[x][y].building = new Models.Building(
        player,
        Models.BuildingTypes.BASE,
      );
      field[x][y].unit = createNewUnit(
          player,
          this.minSpeed,
          this.minSpeed,
          this.speedMinVisibility,
          this.fogOfWarRadius,
          this.visibilitySpeedRelation,
          0,
      );
      this.startPositions.push([x, y]);
    }
    // console.log('start positions', this.startPositions);
    if (this.playersNum > 1) {
      this.makeFieldLinked(field);
    }
    // Set buildings
    let minDistance = 5;
    for (let buildingType in this.buildingRates) {
      if (this.buildingRates[buildingType] === 0) continue;
      const average = 2 ** (this.buildingRates[buildingType]);
      const min = Math.floor(average / 2);
      const max = Math.ceil(average * 1.5);
      // Take a random number of buildings for this type
      const buildingsNum = Math.max(
        1, Math.floor((Math.random() * (max - min + 1) + min) * this.width * this.height * 0.0025)
      );
      console.log(`${buildingType}: ${buildingsNum}`);
      for (let buildingCtr = 0; buildingCtr < buildingsNum; buildingCtr++) {
        if (minDistance < 0) break;
        let failCtr = 0;
        let x = Math.floor(Math.random() * this.width);
        let y = Math.floor(Math.random() * this.height);
        while (field[x][y].terrain.kind === Models.TerrainTypes.MOUNTAIN || !this.noBuildingsInDistance(field, x, y, minDistance)) {
          x = Math.floor(Math.random() * this.width);
          y = Math.floor(Math.random() * this.height);
          failCtr++;
          if (failCtr > 100) {
            minDistance--;
            // console.log(`failCtr=${failCtr}, minDistance=${minDistance}`);
            failCtr = 0;
            if (minDistance < 0) {
              console.warn(`Cannot place ${buildingType} building, all the cells are occupied`);
              x = null;
              y = null;
              break;
            }
          }
        }
        if (x !== null && y !== null) {
          // console.log(`placing ${buildingType} building at ${x}, ${y}`);
          field[x][y].building = new Models.Building(null, buildingType);
        }
      }
    }
    // console.log(field);
    // for (let x = 0; x < this.width; x++) {
    //   for (let y = 0; y < this.height; y++) {
    //     if (field[x][y].building && field[x][y].building.player !== null) {
    //       console.log(`${field[x][y].building.player} building at ${x}, ${y}`);
    //     }
    //   }
    // }
    return field;
  }

  getBuildingType() {
  const r = Math.random();
  const typesList = Object.keys(this.buildingRates);
  const cumulativeRates = typesList.reduce((acc, type) => {
    const lastRate = acc.length > 0 ? acc[acc.length - 1].rate : 0;
    acc.push({ type, rate: lastRate + this.buildingRates[type] });
    return acc;
  }, []);

  for (const { type, rate } of cumulativeRates) {
    if (r <= rate) {
      // console.log(`getBuildingType: ${r} ${type}`);
      return type;
    }
  }
}

  getSector(x, y) {
    return [Math.floor(x * this.sectorsNum / this.width), Math.floor(y * this.sectorsNum / this.height)];
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
    // console.log(x, y, r);
    for (let curX = x - r; curX <= x + r; curX++) {
      if (curX < 0 || curX >= this.width) continue;
      for (let curY = y - r; curY <= y + r; curY++) {
        if (curY < 0 || curY >= this.height) continue;
        if (Math.abs(curX - x) + Math.abs(curY - y) > r) continue;
        // console.log(curX, curY);
        // console.log(field[curX][curY]);
        if (field[curX][curY].building) return false;
      }
    }
    return true;
  }

  isCellInStartPositions(x, y) {
    return this.startPositions.some(el => el[0] === x && el[1] === y);
  }

  // Make field linked methods
  makeFieldLinked(field) {
    // console.log('makeFieldLinked');
    let wField = this.wave(field, this.width, this.height);
    let maxNumCell = this.getMaxNumCell(wField, field);
    // console.log('maxNumCell', maxNumCell);
    let maxNum = maxNumCell.num;
    let [startX, startY] = maxNumCell.cell;
    while (!this.allPlayersReached(wField) && maxNum > 0) {
      // console.log('fixWave', maxNum, startX, startY);
      this.fixWave(wField, field, this.width, this.height, maxNum, startX, startY);
      // console.log('wave');
      wField = this.wave(field, this.width, this.height);
      maxNumCell = this.getMaxNumCell(wField, field);
      // console.log('maxNumCell', maxNumCell);
      maxNum = maxNumCell.num;
      [startX, startY] = maxNumCell.cell;
    }
  }


  // Create wave field - number of walls from first player start pos to each other player's
  wave(field, width, height) {
    const wField = [];
    for (let x = 0; x < width; x++) {
      const line = [];
      for (let y = 0; y < height; y++) {
        // TODO: Push MAX_INT value
        line.push(999);
      }
      wField.push(line);
    }
    // TODO: Select random player to start algorithm
    const [startX, startY] = this.startPositions[0];
    wField[startX][startY] = 0;
    const queue = [[startX, startY]];
    while (queue.length > 0) {
      const [curX, curY] = queue.shift();
      const neighbours = this.findNeighbours(curX, curY, width, height);
      for (let neighbour of neighbours) {
        const [x, y] = neighbour;
        const prevValue = wField[x][y];
        if (field[x][y].terrain.kind === Models.TerrainTypes.MOUNTAIN) wField[x][y] = Math.min(wField[x][y], wField[curX][curY] + 1);
        else wField[x][y] = Math.min(wField[x][y], wField[curX][curY]);
        if (wField[x][y] < prevValue) queue.push([x, y]);
      }
    }
    return wField;
  }

  // TODO: Probably there some duplicated functions like this
  // Get list of neighbors of cell
  findNeighbours(x, y, width, height) {
    const neighbours = [];
    if (x > 0) neighbours.push([x - 1, y]);
    if (x < width - 1) neighbours.push([x + 1, y]);
    if (y > 0) neighbours.push([x, y - 1]);
    if (y < height - 1) neighbours.push([x, y + 1]);
    return neighbours;
  }

  // Get player with max number of walls on the path to them
  getMaxNumCell(wField, field) {
    let max = 0;
    let maxCell = [];
    for (let [x, y] of this.startPositions) {
      const cell = wField[x][y];
      if (field[x][y].terrain.kind !== Models.TerrainTypes.MOUNTAIN) {
        if (cell > max) {
          maxCell = [x, y];
          max = cell;
        }
      }
    }
    return {num: max, cell: maxCell};
  }

  // Remove wall with highest wave value
  fixWave(wField, field, width, height, maxNum, startX, startY) {
    // console.log(`Fix wave${maxNum} ${startX} ${startY}`);
    const queue = [[startX, startY]];
    const visitedCells = new Set();
    while(queue.length > 0) {
      // console.log('Queue:', JSON.stringify(queue));
      const [curX, curY] = queue.shift();
      if (visitedCells.has(`${curX}, ${curY}`)) continue;
      visitedCells.add(`${curX}, ${curY}`);

      const neighbours = this.findNeighbours(curX, curY, width, height);
      // TODO: Select random neighbour if there are several with the same value
      for (let [x, y] of neighbours) {
        if (wField[x][y] !== maxNum) continue;
        if (field[x][y].terrain.kind === Models.TerrainTypes.MOUNTAIN) {
          if (this.fixWall(wField, field, width, height, maxNum, x, y)) {
            return;
          }
        }
        else {
          const alreadyVisited = visitedCells.has(`${x}, ${y}`);
          if (!alreadyVisited) queue.push([x, y]);
        }
      }
    }
  }

  // Remove wall from cell if there is an N-1 wall nearby
  fixWall(wField, field, width, height, maxNum, wallX, wallY) {
    // console.log('fixWall', wallX, wallY);
    const neighbours = this.findNeighbours(wallX, wallY, width, height);
    // console.log('Wall neighbours:', neighbours);
    for (let neighbour of neighbours) {
      const [x, y] = neighbour;
      if (wField[x][y] === maxNum - 1) {
        field[wallX][wallY].terrain.kind = Models.TerrainTypes.EMPTY;
        // console.log('Wall fixed', wallX, wallY);
        return true;
      }
    }
    return false;
  }

  // Check that every player has path to each other
  allPlayersReached(wField) {
    for (let [x, y] of this.startPositions) {
      if (wField[x][y] > 0) return false;
    }
    return true;
  }
}

export {
  CreateFieldEngine,
};
