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

    static fromJSON(obj) {
        if (!obj) return null;
        const cell = new Cell(obj.terrain);
        cell.building = Building.fromJSON(obj.building);
        cell.unit = Unit.fromJSON(obj.unit);
        cell.isHidden = obj.isHidden ?? true;
        return cell;
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

    static fromJSON(obj) {
        if (!obj) return null;
        const unit = new Unit(obj.player, obj._type, obj.movePoints, obj.visibility);
        unit.hasMoved = obj.hasMoved ?? false;
        return unit;
    }
}

class Building {
    constructor(player, _type) {
        this.player = player;
        this._type = _type;
    }

    static fromJSON(obj) {
        if (!obj) return null;
        return new Building(obj.player, obj._type);
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

    static fromJSON(obj) {
        if (!obj) return null;
        const player = new Player(obj._type);
        player.killed = obj.killed ?? 0;
        player.lost = obj.lost ?? 0;
        player.score = obj.score ?? 0;
        player.active = obj.active ?? true;
        player.informed_lose = obj.informed_lose ?? false;
        player.scrollCoords = obj.scrollCoords ?? [0, 0];
        return player;
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
