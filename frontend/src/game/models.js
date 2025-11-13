const TerrainTypes = {
    EMPTY: 'empty',
    MOUNTAIN: 'mountain',
};

const BuildingTypes = {
    BASE: 'base',  // military - produce units
    HABITATION: 'habitation',  // increase units limit
    TEMPLE: 'temple',  // increase speed for generated units
    WELL: 'well',  // increase speed for current unit
    STORAGE: 'storage',  // increase bases limit
    OBELISK: 'obelisk',  // gives scouting
};

const PlayerTypes = {
    HUMAN: 'human',
    BOT: 'bot',
};

class Cell {
    // terrain is dict {kind: 'empty', idx: 1}
    constructor(terrain) {
        this.terrain = terrain;
        this.building = null;
        this.unit = null;
        this.isHidden = true;
    }
}

class Unit {
    constructor(player, _type, movePoints, visibility) {
        this.player = player;
        this._type = _type;
        this.movePoints = movePoints;
        this.visibility = visibility;
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
        this.scrollCoords = [0, 0];
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
