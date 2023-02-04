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
    Unit, Cell,
}
