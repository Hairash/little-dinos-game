const TerrainTypes = {
    EMPTY: 'empty',
    MOUNTAIN: 'mountain',
}


class Cell {
    constructor(terrain) {
        this.unit = null;
        this.terrain = terrain;
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

export default {
    TerrainTypes, Cell, Unit,
}
