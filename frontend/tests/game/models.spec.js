import { describe, it, expect } from 'vitest'
import Models from '@/game/models'

describe('models', () => {
  describe('TerrainTypes', () => {
    it('has EMPTY terrain type', () => {
      expect(Models.TerrainTypes.EMPTY).toBe('empty')
    })

    it('has MOUNTAIN terrain type', () => {
      expect(Models.TerrainTypes.MOUNTAIN).toBe('mountain')
    })
  })

  describe('BuildingTypes', () => {
    it('has all building types', () => {
      expect(Models.BuildingTypes.BASE).toBe('base')
      expect(Models.BuildingTypes.HABITATION).toBe('habitation')
      expect(Models.BuildingTypes.TEMPLE).toBe('temple')
      expect(Models.BuildingTypes.WELL).toBe('well')
      expect(Models.BuildingTypes.STORAGE).toBe('storage')
      expect(Models.BuildingTypes.OBELISK).toBe('obelisk')
    })
  })

  describe('PlayerTypes', () => {
    it('has HUMAN player type', () => {
      expect(Models.PlayerTypes.HUMAN).toBe('human')
    })

    it('has BOT player type', () => {
      expect(Models.PlayerTypes.BOT).toBe('bot')
    })
  })

  describe('Cell', () => {
    it('creates cell with terrain', () => {
      const terrain = { kind: 'empty', idx: 1 }
      const cell = new Models.Cell(terrain)

      expect(cell.terrain).toEqual(terrain)
      expect(cell.building).toBeNull()
      expect(cell.unit).toBeNull()
      expect(cell.isHidden).toBe(true)
    })

    it('initializes with default hidden state', () => {
      const cell = new Models.Cell({ kind: 'mountain', idx: 2 })
      expect(cell.isHidden).toBe(true)
    })

    describe('fromJSON', () => {
      it('returns null for null input', () => {
        expect(Models.Cell.fromJSON(null)).toBeNull()
      })

      it('creates Cell instance from plain object', () => {
        const plainObj = {
          terrain: { kind: 'empty', idx: 1 },
          building: null,
          unit: null,
          isHidden: false,
        }
        const cell = Models.Cell.fromJSON(plainObj)

        expect(cell).toBeInstanceOf(Models.Cell)
        expect(cell.terrain).toEqual({ kind: 'empty', idx: 1 })
        expect(cell.building).toBeNull()
        expect(cell.unit).toBeNull()
        expect(cell.isHidden).toBe(false)
      })

      it('reconstructs nested Building and Unit', () => {
        const plainObj = {
          terrain: { kind: 'empty', idx: 1 },
          building: { player: 0, _type: 'base' },
          unit: { player: 1, _type: 'dino1', movePoints: 5, visibility: 3, hasMoved: true },
          isHidden: true,
        }
        const cell = Models.Cell.fromJSON(plainObj)

        expect(cell).toBeInstanceOf(Models.Cell)
        expect(cell.building).toBeInstanceOf(Models.Building)
        expect(cell.building.player).toBe(0)
        expect(cell.building._type).toBe('base')
        expect(cell.unit).toBeInstanceOf(Models.Unit)
        expect(cell.unit.player).toBe(1)
        expect(cell.unit.hasMoved).toBe(true)
      })

      it('defaults isHidden to true when missing', () => {
        const plainObj = { terrain: { kind: 'empty', idx: 1 } }
        const cell = Models.Cell.fromJSON(plainObj)
        expect(cell.isHidden).toBe(true)
      })
    })
  })

  describe('Unit', () => {
    it('creates unit with all properties', () => {
      const unit = new Models.Unit(0, 'dino1', 5, 3)

      expect(unit.player).toBe(0)
      expect(unit._type).toBe('dino1')
      expect(unit.movePoints).toBe(5)
      expect(unit.visibility).toBe(3)
      expect(unit.hasMoved).toBe(false)
    })

    it('initializes hasMoved as false', () => {
      const unit = new Models.Unit(1, 'dino2', 3, 2)
      expect(unit.hasMoved).toBe(false)
    })

    it('accepts different player values', () => {
      const unit0 = new Models.Unit(0, 'dino1', 3, 3)
      const unit1 = new Models.Unit(1, 'dino2', 3, 3)
      const unit2 = new Models.Unit(2, 'dino3', 3, 3)

      expect(unit0.player).toBe(0)
      expect(unit1.player).toBe(1)
      expect(unit2.player).toBe(2)
    })

    describe('fromJSON', () => {
      it('returns null for null input', () => {
        expect(Models.Unit.fromJSON(null)).toBeNull()
      })

      it('creates Unit instance from plain object', () => {
        const plainObj = {
          player: 2,
          _type: 'dino3',
          movePoints: 4,
          visibility: 2,
          hasMoved: true,
        }
        const unit = Models.Unit.fromJSON(plainObj)

        expect(unit).toBeInstanceOf(Models.Unit)
        expect(unit.player).toBe(2)
        expect(unit._type).toBe('dino3')
        expect(unit.movePoints).toBe(4)
        expect(unit.visibility).toBe(2)
        expect(unit.hasMoved).toBe(true)
      })

      it('defaults hasMoved to false when missing', () => {
        const plainObj = { player: 0, _type: 'dino1', movePoints: 3, visibility: 2 }
        const unit = Models.Unit.fromJSON(plainObj)
        expect(unit.hasMoved).toBe(false)
      })
    })
  })

  describe('Building', () => {
    it('creates building with player and type', () => {
      const building = new Models.Building(0, 'base')

      expect(building.player).toBe(0)
      expect(building._type).toBe('base')
    })

    it('creates buildings of different types', () => {
      const base = new Models.Building(0, Models.BuildingTypes.BASE)
      const temple = new Models.Building(1, Models.BuildingTypes.TEMPLE)
      const well = new Models.Building(2, Models.BuildingTypes.WELL)

      expect(base._type).toBe('base')
      expect(temple._type).toBe('temple')
      expect(well._type).toBe('well')
    })

    describe('fromJSON', () => {
      it('returns null for null input', () => {
        expect(Models.Building.fromJSON(null)).toBeNull()
      })

      it('creates Building instance from plain object', () => {
        const plainObj = { player: 1, _type: 'temple' }
        const building = Models.Building.fromJSON(plainObj)

        expect(building).toBeInstanceOf(Models.Building)
        expect(building.player).toBe(1)
        expect(building._type).toBe('temple')
      })
    })
  })

  describe('Player', () => {
    it('creates human player', () => {
      const player = new Models.Player(Models.PlayerTypes.HUMAN)

      expect(player._type).toBe('human')
      expect(player.killed).toBe(0)
      expect(player.lost).toBe(0)
      expect(player.score).toBe(0)
      expect(player.active).toBe(true)
      expect(player.informed_lose).toBe(false)
      expect(player.scrollCoords).toEqual([0, 0])
    })

    it('creates bot player', () => {
      const player = new Models.Player(Models.PlayerTypes.BOT)

      expect(player._type).toBe('bot')
      expect(player.active).toBe(true)
    })

    it('initializes with default scroll coordinates', () => {
      const player = new Models.Player('human')
      expect(player.scrollCoords).toEqual([0, 0])
    })

    it('initializes stats at zero', () => {
      const player = new Models.Player('human')
      expect(player.killed).toBe(0)
      expect(player.lost).toBe(0)
      expect(player.score).toBe(0)
    })

    describe('fromJSON', () => {
      it('returns null for null input', () => {
        expect(Models.Player.fromJSON(null)).toBeNull()
      })

      it('creates Player instance from plain object', () => {
        const plainObj = {
          _type: 'human',
          killed: 5,
          lost: 2,
          score: 100,
          active: true,
          informed_lose: false,
          scrollCoords: [10, 20],
        }
        const player = Models.Player.fromJSON(plainObj)

        expect(player).toBeInstanceOf(Models.Player)
        expect(player._type).toBe('human')
        expect(player.killed).toBe(5)
        expect(player.lost).toBe(2)
        expect(player.score).toBe(100)
        expect(player.active).toBe(true)
        expect(player.informed_lose).toBe(false)
        expect(player.scrollCoords).toEqual([10, 20])
      })

      it('defaults missing properties', () => {
        const plainObj = { _type: 'bot' }
        const player = Models.Player.fromJSON(plainObj)

        expect(player.killed).toBe(0)
        expect(player.lost).toBe(0)
        expect(player.score).toBe(0)
        expect(player.active).toBe(true)
        expect(player.informed_lose).toBe(false)
        expect(player.scrollCoords).toEqual([0, 0])
      })

      it('restores inactive player state', () => {
        const plainObj = { _type: 'human', active: false, informed_lose: true }
        const player = Models.Player.fromJSON(plainObj)

        expect(player.active).toBe(false)
        expect(player.informed_lose).toBe(true)
      })
    })
  })

  describe('Serialization round-trip', () => {
    it('Cell survives JSON round-trip', () => {
      const original = new Models.Cell({ kind: 'empty', idx: 1 })
      original.building = new Models.Building(0, 'base')
      original.unit = new Models.Unit(1, 'dino2', 4, 3)
      original.unit.hasMoved = true
      original.isHidden = false

      const serialized = JSON.stringify(original)
      const parsed = JSON.parse(serialized)
      const restored = Models.Cell.fromJSON(parsed)

      expect(restored).toBeInstanceOf(Models.Cell)
      expect(restored.building).toBeInstanceOf(Models.Building)
      expect(restored.unit).toBeInstanceOf(Models.Unit)
      expect(restored.terrain).toEqual(original.terrain)
      expect(restored.building.player).toBe(original.building.player)
      expect(restored.unit.hasMoved).toBe(true)
      expect(restored.isHidden).toBe(false)
    })

    it('Player survives JSON round-trip', () => {
      const original = new Models.Player('human')
      original.killed = 3
      original.score = 50
      original.scrollCoords = [5, 10]

      const serialized = JSON.stringify(original)
      const parsed = JSON.parse(serialized)
      const restored = Models.Player.fromJSON(parsed)

      expect(restored).toBeInstanceOf(Models.Player)
      expect(restored._type).toBe(original._type)
      expect(restored.killed).toBe(original.killed)
      expect(restored.score).toBe(original.score)
      expect(restored.scrollCoords).toEqual(original.scrollCoords)
    })
  })
})
