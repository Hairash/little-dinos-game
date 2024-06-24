const TerrainTypes = {
    EMPTY: 'empty',
    MOUNTAIN: 'mountain',
};

const BuildingTypes = {
    BASE: 'base',
};

const PlayerTypes = {
    HUMAN: 'human',
    BOT: 'bot',
};

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

class Player {
    constructor(_type) {
        this._type = _type;
        this.killed = 0;
        this.lost = 0;
        this.score = 0;
        this.active = true;
        this.informed_lose = false;
    }
}

export default {
    TerrainTypes,
    BuildingTypes,
    PlayerTypes,
    Cell,
    Unit,
    Building,
    Player,
};
