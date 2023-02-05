const TerrainTypes = new Set([
    'wall',
    'empty',
])


class Cell {
    constructor(terrain) {
        this.unit = null;
        this.terrain = terrain;
    }
}

class Unit {
    constructor(player, _type) {
        this.player = player;
        this._type = _type;
    }
}

export default {
    TerrainTypes, Cell, Unit,
}
