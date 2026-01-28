import { describe, it, expect, beforeEach } from 'vitest';
import { CreateFieldEngine } from '@/game/createFieldEngine';
import Models from '@/game/models';

describe('CreateFieldEngine', () => {
  // Default test configuration
  const defaultConfig = {
    playersNum: 2,
    width: 20,
    height: 20,
    sectorsNum: 3,
    minSpeed: 3,
    maxSpeed: 5,
    speedMinVisibility: 2,
    fogOfWarRadius: 3,
    visibilitySpeedRelation: true,
    buildingRates: {
      [Models.BuildingTypes.HABITATION]: 2,
      [Models.BuildingTypes.TEMPLE]: 1,
      [Models.BuildingTypes.WELL]: 1,
      [Models.BuildingTypes.STORAGE]: 1,
      [Models.BuildingTypes.OBELISK]: 1,
    },
  };

  function createEngine(overrides = {}) {
    const config = { ...defaultConfig, ...overrides };
    return new CreateFieldEngine(
      config.playersNum,
      config.width,
      config.height,
      config.sectorsNum,
      config.minSpeed,
      config.maxSpeed,
      config.speedMinVisibility,
      config.fogOfWarRadius,
      config.visibilitySpeedRelation,
      config.buildingRates,
    );
  }

  // Helper to create a simple field for testing
  function createTestField(width, height, mountainPositions = []) {
    const field = [];
    for (let x = 0; x < width; x++) {
      const col = [];
      for (let y = 0; y < height; y++) {
        const isMountain = mountainPositions.some(([mx, my]) => mx === x && my === y);
        const terrain = isMountain ? Models.TerrainTypes.MOUNTAIN : Models.TerrainTypes.EMPTY;
        col.push(new Models.Cell({ kind: terrain, idx: 1 }));
      }
      field.push(col);
    }
    return field;
  }

  describe('getBuildingPositions', () => {
    it('returns empty array when no buildings exist', () => {
      const engine = createEngine({ width: 5, height: 5 });
      const field = createTestField(5, 5);

      const positions = engine.getBuildingPositions(field);

      expect(positions).toEqual([]);
    });

    it('collects all building positions including player bases', () => {
      const engine = createEngine({ width: 5, height: 5 });
      const field = createTestField(5, 5);

      // Add player base
      field[0][0].building = new Models.Building(0, Models.BuildingTypes.BASE);
      // Add neutral buildings
      field[2][2].building = new Models.Building(null, Models.BuildingTypes.TEMPLE);
      field[4][4].building = new Models.Building(null, Models.BuildingTypes.WELL);

      const positions = engine.getBuildingPositions(field);

      expect(positions).toHaveLength(3);
      expect(positions).toContainEqual([0, 0]);
      expect(positions).toContainEqual([2, 2]);
      expect(positions).toContainEqual([4, 4]);
    });
  });

  describe('allTargetsReached', () => {
    it('returns true when all targets have wave value 0', () => {
      const engine = createEngine({ width: 5, height: 5 });
      const wField = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ];
      const targets = [[0, 0], [2, 2], [4, 4]];

      expect(engine.allTargetsReached(wField, targets)).toBe(true);
    });

    it('returns false when any target has wave value > 0', () => {
      const engine = createEngine({ width: 5, height: 5 });
      const wField = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0],  // Target at [2,2] has value 1
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ];
      const targets = [[0, 0], [2, 2], [4, 4]];

      expect(engine.allTargetsReached(wField, targets)).toBe(false);
    });

    it('returns true for empty targets list', () => {
      const engine = createEngine({ width: 5, height: 5 });
      const wField = [
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
      ];
      const targets = [];

      expect(engine.allTargetsReached(wField, targets)).toBe(true);
    });
  });

  describe('getMaxNumCell', () => {
    it('returns the target with highest wave value', () => {
      const engine = createEngine({ width: 5, height: 5 });
      const field = createTestField(5, 5);
      const wField = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 2, 0, 0],  // Highest at [2,2]
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1],  // Second at [4,4]
      ];
      const targets = [[0, 0], [2, 2], [4, 4]];

      const result = engine.getMaxNumCell(wField, field, targets);

      expect(result.num).toBe(2);
      expect(result.cell).toEqual([2, 2]);
    });

    it('returns num=0 when all targets are reachable', () => {
      const engine = createEngine({ width: 5, height: 5 });
      const field = createTestField(5, 5);
      const wField = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ];
      const targets = [[0, 0], [2, 2], [4, 4]];

      const result = engine.getMaxNumCell(wField, field, targets);

      expect(result.num).toBe(0);
    });

    it('ignores mountain cells when finding max', () => {
      const engine = createEngine({ width: 5, height: 5 });
      const field = createTestField(5, 5, [[2, 2]]);  // Mountain at [2,2]
      const wField = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 5, 0, 0],  // High value but it's a mountain
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1],  // This should be selected
      ];
      const targets = [[0, 0], [2, 2], [4, 4]];

      const result = engine.getMaxNumCell(wField, field, targets);

      expect(result.num).toBe(1);
      expect(result.cell).toEqual([4, 4]);
    });
  });

  describe('generateField - building reachability', () => {
    it('generates a field where all buildings are reachable from player start', () => {
      const engine = createEngine();
      const field = engine.generateField();

      // Run wave from first player position
      const wField = engine.wave(field, engine.width, engine.height);
      const buildingPositions = engine.getBuildingPositions(field);

      // All buildings should have wave value 0 (reachable without crossing mountains)
      for (const [x, y] of buildingPositions) {
        expect(wField[x][y]).toBe(0);
      }
    });

    it('generates a field where players can reach each other', () => {
      const engine = createEngine();
      const field = engine.generateField();

      // Run wave from first player position
      const wField = engine.wave(field, engine.width, engine.height);

      // All start positions should be reachable
      for (const [x, y] of engine.startPositions) {
        expect(wField[x][y]).toBe(0);
      }
    });

    it('places buildings on non-mountain cells', () => {
      const engine = createEngine();
      const field = engine.generateField();
      const buildingPositions = engine.getBuildingPositions(field);

      for (const [x, y] of buildingPositions) {
        expect(field[x][y].terrain.kind).not.toBe(Models.TerrainTypes.MOUNTAIN);
      }
    });
  });

  describe('makeFieldLinked', () => {
    it('removes mountains to create paths to all buildings', () => {
      const engine = createEngine({ width: 5, height: 5, playersNum: 1 });

      // Create field with a building blocked by mountains
      // Layout:
      // P . M . B
      // . . M . .
      // . . M . .
      // . . M . .
      // . . M . .
      const field = createTestField(5, 5, [
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]  // Wall of mountains
      ]);

      // Player at [0,0]
      field[0][0].building = new Models.Building(0, Models.BuildingTypes.BASE);
      engine.startPositions.push([0, 0]);

      // Building at [4,0] (blocked by mountains)
      field[4][0].building = new Models.Building(null, Models.BuildingTypes.TEMPLE);

      // Before fix: building is not reachable
      let wField = engine.wave(field, 5, 5);
      expect(wField[4][0]).toBeGreaterThan(0);

      // Apply fix
      engine.makeFieldLinked(field);

      // After fix: building should be reachable
      wField = engine.wave(field, 5, 5);
      expect(wField[4][0]).toBe(0);

      // At least one mountain should have been removed
      const mountainCount = [
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]
      ].filter(([x, y]) => field[x][y].terrain.kind === Models.TerrainTypes.MOUNTAIN).length;
      expect(mountainCount).toBeLessThan(5);
    });
  });
});
