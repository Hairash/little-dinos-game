// Helpers related to field

import Models from '@/game/models';
import { createNewUnit, getNeighbours } from "@/game/helpers";
import { SCORE_MOD } from "@/game/const";

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
      maxBasesNum,
      killAtBirth,
      visibilitySpeedRelation,
  ) {
    this.field = field;
    this.width = width;
    this.height = height;
    this.fogOfWarRadius = fogOfWarRadius;
    this.players = players;
    this.minSpeed = minSpeed;
    this.maxSpeed = maxSpeed;
    this.maxUnitsNum = maxUnitsNum;
    this.maxBasesNum = maxBasesNum;
    this.killAtBirth = killAtBirth;
    this.visibilitySpeedRelation = visibilitySpeedRelation;
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
      if (this.field[x][y].building && this.field[x][y].building._type === Models.BuildingTypes.BASE) {
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
          (
              this.field[curX][curY].building &&
              this.field[curX][curY].building._type === Models.BuildingTypes.BASE &&
              this.field[curX][curY].building.player === player
          )
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
  }

  killNeighbours(x, y, curPlayer, countScore=true) {
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

  getBuildingsOccupied(curPlayer) {
    const buildings = {};
    for (let _type in Models.BuildingTypes) {
      buildings[Models.BuildingTypes[_type]] = 0;
    }

    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        if (this.field[x][y].building) {
          if (
              this.field[x][y].building._type === Models.BuildingTypes.BASE
          ) {
            if (this.field[x][y].building.player === curPlayer) {
              buildings[Models.BuildingTypes.BASE]++;
            }
          }
          else if (
              this.field[x][y].unit &&
              this.field[x][y].unit.player === curPlayer
          ) {
            buildings[this.field[x][y].building._type]++;
          }
        }
      }
    }

    return buildings;
  }

  captureBuildingIfNeeded(x1, y1, player) {
    const buildings = this.getBuildingsOccupied(player);
    // console.log('buildings', buildings);
    // console.log(buildings[Models.BuildingTypes.BASE]);
    // console.log(this.maxBasesNum + buildings[Models.BuildingTypes.STORAGE] * 3);
    // console.log(buildings[Models.BuildingTypes.BASE] < this.maxBasesNum + buildings[Models.BuildingTypes.STORAGE] * 3);
    if (
        this.field[x1][y1].building &&
        this.field[x1][y1].building._type === Models.BuildingTypes.BASE
    ) {
      if (
        !this.maxBasesNum ||
        buildings[Models.BuildingTypes.BASE] < this.maxBasesNum + buildings[Models.BuildingTypes.STORAGE] * 3
      ) {
        this.field[x1][y1].building.player = player;
        return true;
      }
      else {
        this.field[x1][y1].building.player = null;
        return false;
      }
    }
    return false;
  }

  restoreAndProduceUnits(curPlayer) {
    let buildingsNum = 0;
    let unitsNum = 0;
    let producedNum = 0;
    let habitationsOccupied = 0;
    let templesOccupied = 0;
    const unitsToCreateCoords = [];
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        if (this.field[x][y].unit) {
          this.field[x][y].unit.hasMoved = false;
          if (this.field[x][y].unit.player === curPlayer) {
            unitsNum++;
          }
        }
        if (this.field[x][y].building) {
          if (
              this.field[x][y].building._type === Models.BuildingTypes.BASE &&
              this.field[x][y].building.player === curPlayer
          ) {
            buildingsNum++;
            if (!this.field[x][y].unit) {
              unitsToCreateCoords.push([x, y]);
              producedNum++;
            }
          }
          else if (
              this.field[x][y].unit &&
              this.field[x][y].unit.player === curPlayer
          ) {
            if (this.field[x][y].building._type === Models.BuildingTypes.HABITATION) {
              habitationsOccupied++;
            }
            else if (this.field[x][y].building._type === Models.BuildingTypes.TEMPLE) {
              templesOccupied++;
            }
            else if (this.field[x][y].building._type === Models.BuildingTypes.WELL) {
              // TODO: Add limit ?
              this.field[x][y].unit.movePoints++;
            }
          }
        }
      }
    }
    if (!this.maxUnitsNum || unitsNum + producedNum <= this.maxUnitsNum + habitationsOccupied * 3) {
      for (let [x, y] of unitsToCreateCoords) {
        this.field[x][y].unit = createNewUnit(
            curPlayer,
            this.minSpeed,
            this.maxSpeed,
            this.fogOfWarRadius,
            this.visibilitySpeedRelation,
            this.minSpeed + templesOccupied,
        );
        if (this.killAtBirth) {
          // countScore=false to avoid double score calculation (here only kill)
          this.killNeighbours(x, y, curPlayer, false);
        }
      }
    }
    return {
      buildingsNum: buildingsNum,
      unitsNum: unitsNum,
      producedNum: producedNum,
    };
  }

  changeScore(player, value) {
    this.players[player].score += value;
    if (this.players[player].score < 0) this.players[player].score = 0;
  }
}
