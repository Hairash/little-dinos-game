import { describe, it, expect } from 'vitest';
import Models from '@/game/models';

describe('models', () => {
  describe('TerrainTypes', () => {
    it('has EMPTY terrain type', () => {
      expect(Models.TerrainTypes.EMPTY).toBe('empty');
    });

    it('has MOUNTAIN terrain type', () => {
      expect(Models.TerrainTypes.MOUNTAIN).toBe('mountain');
    });
  });

  describe('BuildingTypes', () => {
    it('has all building types', () => {
      expect(Models.BuildingTypes.BASE).toBe('base');
      expect(Models.BuildingTypes.HABITATION).toBe('habitation');
      expect(Models.BuildingTypes.TEMPLE).toBe('temple');
      expect(Models.BuildingTypes.WELL).toBe('well');
      expect(Models.BuildingTypes.STORAGE).toBe('storage');
      expect(Models.BuildingTypes.OBELISK).toBe('obelisk');
    });
  });

  describe('PlayerTypes', () => {
    it('has HUMAN player type', () => {
      expect(Models.PlayerTypes.HUMAN).toBe('human');
    });

    it('has BOT player type', () => {
      expect(Models.PlayerTypes.BOT).toBe('bot');
    });
  });

  describe('Cell', () => {
    it('creates cell with terrain', () => {
      const terrain = { kind: 'empty', idx: 1 };
      const cell = new Models.Cell(terrain);

      expect(cell.terrain).toEqual(terrain);
      expect(cell.building).toBeNull();
      expect(cell.unit).toBeNull();
      expect(cell.isHidden).toBe(true);
    });

    it('initializes with default hidden state', () => {
      const cell = new Models.Cell({ kind: 'mountain', idx: 2 });
      expect(cell.isHidden).toBe(true);
    });
  });

  describe('Unit', () => {
    it('creates unit with all properties', () => {
      const unit = new Models.Unit(0, 'dino1', 5, 3);

      expect(unit.player).toBe(0);
      expect(unit._type).toBe('dino1');
      expect(unit.movePoints).toBe(5);
      expect(unit.visibility).toBe(3);
      expect(unit.hasMoved).toBe(false);
    });

    it('initializes hasMoved as false', () => {
      const unit = new Models.Unit(1, 'dino2', 3, 2);
      expect(unit.hasMoved).toBe(false);
    });

    it('accepts different player values', () => {
      const unit0 = new Models.Unit(0, 'dino1', 3, 3);
      const unit1 = new Models.Unit(1, 'dino2', 3, 3);
      const unit2 = new Models.Unit(2, 'dino3', 3, 3);

      expect(unit0.player).toBe(0);
      expect(unit1.player).toBe(1);
      expect(unit2.player).toBe(2);
    });
  });

  describe('Building', () => {
    it('creates building with player and type', () => {
      const building = new Models.Building(0, 'base');

      expect(building.player).toBe(0);
      expect(building._type).toBe('base');
    });

    it('creates buildings of different types', () => {
      const base = new Models.Building(0, Models.BuildingTypes.BASE);
      const temple = new Models.Building(1, Models.BuildingTypes.TEMPLE);
      const well = new Models.Building(2, Models.BuildingTypes.WELL);

      expect(base._type).toBe('base');
      expect(temple._type).toBe('temple');
      expect(well._type).toBe('well');
    });
  });

  describe('Player', () => {
    it('creates human player', () => {
      const player = new Models.Player(Models.PlayerTypes.HUMAN);

      expect(player._type).toBe('human');
      expect(player.killed).toBe(0);
      expect(player.lost).toBe(0);
      expect(player.score).toBe(0);
      expect(player.active).toBe(true);
      expect(player.informed_lose).toBe(false);
      expect(player.scrollCoords).toEqual([0, 0]);
    });

    it('creates bot player', () => {
      const player = new Models.Player(Models.PlayerTypes.BOT);

      expect(player._type).toBe('bot');
      expect(player.active).toBe(true);
    });

    it('initializes with default scroll coordinates', () => {
      const player = new Models.Player('human');
      expect(player.scrollCoords).toEqual([0, 0]);
    });

    it('initializes stats at zero', () => {
      const player = new Models.Player('human');
      expect(player.killed).toBe(0);
      expect(player.lost).toBe(0);
      expect(player.score).toBe(0);
    });
  });
});
