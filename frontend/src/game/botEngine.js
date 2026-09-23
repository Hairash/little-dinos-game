// Responsible for bot moves

import { getNeighbours } from '@/game/helpers'
import Models from '@/game/models'

export class BotEngine {
  constructor(field, width, height, enableFogOfWar, fieldEngine, waveEngine) {
    this.field = field
    this.width = width
    this.height = height
    this.enableFogOfWar = enableFogOfWar
    this.fieldEngine = fieldEngine
    this.waveEngine = waveEngine
    this.stationaryVisibility = null
  }

  prepareTurnVisibility(player) {
    this.stationaryVisibility = this.enableFogOfWar
      ? {
          player,
          coords: new Set(
            Array.from(
              this.fieldEngine.getCurrentVisibilitySet(player, {
                includeMoving: false,
                includeBases: false,
              })
            ).map(coords => JSON.stringify(coords))
          ),
        }
      : null
  }

  async makeBotUnitMove(unitCoordsArr, currentPlayer, moveUnit) {
    // console.log('makeBotUnitMove');
    // TODO: Add debug mode
    // Logic needed for debug
    // if (this.players[this.currentPlayer]._type !== Models.PlayerTypes.BOT) return;
    // if (this.state !== this.STATES.play) return;
    if (unitCoordsArr.length === 0) {
      this.processEndTurn()
      return
    }
    const coords = unitCoordsArr.shift()
    const [x, y] = coords
    // A unit may have been removed after its move was queued. Stationary
    // units need neither fog nor pathfinding work.
    const unit = this.field[x]?.[y]?.unit
    if (!unit || unit.movePoints <= 0) return
    const visibilitySet = new Set(
      this.stationaryVisibility?.player === currentPlayer ? this.stationaryVisibility.coords : []
    )
    if (this.enableFogOfWar) {
      const liveVisibility = this.fieldEngine.getCurrentVisibilitySet(
        currentPlayer,
        this.stationaryVisibility?.player === currentPlayer
          ? { includeStationary: false }
          : undefined
      )
      for (const coords of liveVisibility) visibilitySet.add(JSON.stringify(coords))
    }
    // console.log(visibilitySet);

    const reachableCoordsArr = this.waveEngine.getReachableCoordsArr(x, y, unit.movePoints)
    if (reachableCoordsArr.length === 0) return

    const reachableVisibleCoordsArr = this.enableFogOfWar
      ? this.getReachableVisibleCoordsArr(reachableCoordsArr)
      : reachableCoordsArr

    // Always stay on enemy base
    // console.log(`${x}, ${y}: ${this.field[x][y].building?._type} ${this.field[x][y].building?.player} ${currentPlayer}`);
    if (
      this.field[x][y].building &&
      this.field[x][y].building._type === Models.BuildingTypes.BASE &&
      this.field[x][y].building.player !== null &&
      this.field[x][y].building.player !== currentPlayer
    ) {
      // console.log('stay on enemy base');
      return
    }
    // Check is it occupying building (not own base or obelisk)
    const isOccupyingBuilding =
      this.field[x][y].building &&
      this.field[x][y].building._type !== Models.BuildingTypes.OBELISK &&
      !(
        this.field[x][y].building._type === Models.BuildingTypes.BASE &&
        (this.field[x][y].building.player === null ||
          this.field[x][y].building.player === currentPlayer)
      )
    let enemyCoords = this.findEnemy(reachableVisibleCoordsArr, visibilitySet, currentPlayer)
    // If no enemies arround, just stay there with 80% probability
    if (isOccupyingBuilding && !enemyCoords && Math.random() > 0.2) {
      // console.log('stay on occupying building');
      return
    }

    // If occupying building and enemy is around, attack enemy with 50% probability or stay there
    if (isOccupyingBuilding && enemyCoords) {
      if (Math.random() > 0.5) {
        await moveUnit(coords, enemyCoords)
        return
      }
      return
    }

    // Capture the base
    // TODO: Check if the base can be captured
    const habitationBuildingCoords = this.findFreeBuilding(
      reachableVisibleCoordsArr,
      currentPlayer,
      Models.BuildingTypes.HABITATION
    )
    if (habitationBuildingCoords && Math.random() > 0.5) {
      await moveUnit(coords, habitationBuildingCoords)
      return
    }
    const baseBuildingCoords = this.findFreeBuilding(
      reachableVisibleCoordsArr,
      currentPlayer,
      Models.BuildingTypes.BASE
    )
    if (baseBuildingCoords) {
      await moveUnit(coords, baseBuildingCoords)
      return
    }

    // Decide between captring other buildings or attacking enemy
    // TODO: Add max kill
    let buildingCoords = this.findFreeBuilding(reachableVisibleCoordsArr, currentPlayer)
    if (buildingCoords && enemyCoords) {
      if (Math.random() > 0.5) {
        buildingCoords = null
      } else {
        enemyCoords = null
      }
    }
    if (buildingCoords) {
      await moveUnit(coords, buildingCoords)
      return
    }
    if (enemyCoords) {
      await moveUnit(coords, enemyCoords)
      return
    }

    // TODO: Move to the building
    // Random move
    // TODO: Random long move, avoid own buildings
    const idx = Math.floor(Math.random() * reachableCoordsArr.length)
    const toCoords = reachableCoordsArr[idx]
    await moveUnit(coords, toCoords)
    // For debug?
    // this.$refs.gameGridRef.setVisibility();
  }

  getReachableVisibleCoordsArr(reachableCoordsArr) {
    return reachableCoordsArr.filter(([x, y]) => !this.field[x][y].isHidden)
  }

  findFreeBuilding(coordsArr, currentPlayer, buildingType = null) {
    return coordsArr.find(
      ([x, y]) =>
        this.field[x][y].building &&
        this.field[x][y].building.player !== currentPlayer &&
        (!buildingType || this.field[x][y].building._type === buildingType)
    )
  }

  findEnemy(coordsArr, visibilitySet, currentPlayer) {
    return coordsArr.find(([x, y]) => this.isEnemyNeighbour(visibilitySet, x, y, currentPlayer))
  }

  isEnemyNeighbour(visibilitySet, x, y, currentPlayer) {
    const neighbours = getNeighbours(this.field, this.width, this.height, x, y)
    // console.log(`neighbours: ${neighbours}`);
    const res = neighbours.find(
      ([curX, curY]) =>
        (!this.enableFogOfWar || visibilitySet.has(JSON.stringify([curX, curY]))) &&
        this.field[curX][curY].unit &&
        this.field[curX][curY].unit.player !== currentPlayer
    )
    // console.log(res);
    return res
  }
}
