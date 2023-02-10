const TerrainTypes = {
    EMPTY: 'empty',
    MOUNTAIN: 'mountain',
}

const BuildingTypes = {
    BASE: 'base',
}

class Cell {
    constructor(terrain) {
        this.terrain = terrain;
        this.building = null;
        this.unit = null;
    }
}

class Unit {
    constructor(player, _type, movePoints) {
        this.player = player;
        this._type = _type;
        this.movePoints = movePoints;
        this.hasMoved = false;
    }
}

class Building {
    constructor(player, _type) {
        this.player = player;
        this._type = _type;
    }
}

export default {
    TerrainTypes, BuildingTypes, Cell, Unit, Building,
}
