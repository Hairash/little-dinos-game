// Responsible for generating new field
// Cannot use other engines, because other engines require field, but it doesn't exist until this one creates it

import Models from '@/game/models';
import { createNewUnit } from '@/game/helpers';

class CreateFieldEngine {
  constructor(playersNum, width, height, sectorsNum, minSpeed, maxSpeed, fogOfWarRadius, visibilitySpeedRelation) {
    this.playersNum = playersNum;
    this.width = width;
    this.height = height;
    this.sectorsNum = sectorsNum;
    this.minSpeed = minSpeed;
    this.maxSpeed = maxSpeed;
    this.fogOfWarRadius = fogOfWarRadius;
    this.visibilitySpeedRelation = visibilitySpeedRelation;
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
        const terrain = r > 0.75 ? Models.TerrainTypes.MOUNTAIN : Models.TerrainTypes.EMPTY;
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
      while (field[x][y].terrain.kind === Models.TerrainTypes.MOUNTAIN || !this.validateSector(sectorX, sectorY, sectors)) {
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
      field[x][y].unit = createNewUnit(
          player,
          this.minSpeed,
          this.maxSpeed,
          this.fogOfWarRadius,
          this.visibilitySpeedRelation,
      );
    }
    // Set buildings
    let failCtr = 0;
    for (let building = 0; building < this.width * this.height * 0.03; building++) {
      let x = Math.floor(Math.random() * this.width);
      let y = Math.floor(Math.random() * this.height);
      while (field[x][y].terrain.kind === Models.TerrainTypes.MOUNTAIN || !this.noBuildingsInDistance(field, x, y, 5)) {
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
}

export {
  CreateFieldEngine,
};
