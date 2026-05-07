import { describe, it, expect } from 'vitest'
import {
  copy2dArray,
  createPlayers,
  getNeighbours,
  createNewUnit,
  calculateUnitVisibility,
  normalizeField,
  getPlayerColor,
} from '@/game/helpers'
import Models from '@/game/models'

describe('helpers', () => {
  describe('copy2dArray', () => {
    it('creates a shallow copy of 2d array', () => {
      const original = [
        [1, 2],
        [3, 4],
      ]
      const copy = copy2dArray(original)

      expect(copy).toEqual(original)
      expect(copy).not.toBe(original)
      expect(copy[0]).not.toBe(original[0])
    })

    it('handles empty array', () => {
      expect(copy2dArray([])).toEqual([])
    })

    it('handles single row', () => {
      const original = [[1, 2, 3]]
      const copy = copy2dArray(original)
      expect(copy).toEqual([[1, 2, 3]])
    })
  })

  describe('createPlayers', () => {
    it('creates correct number of human players', () => {
      const players = createPlayers(2, 0)
      expect(players.length).toBe(2)
      expect(players[0]._type).toBe(Models.PlayerTypes.HUMAN)
      expect(players[1]._type).toBe(Models.PlayerTypes.HUMAN)
    })

    it('creates correct number of bot players', () => {
      const players = createPlayers(0, 3)
      expect(players.length).toBe(3)
      players.forEach(p => expect(p._type).toBe(Models.PlayerTypes.BOT))
    })

    it('creates mixed human and bot players', () => {
      const players = createPlayers(2, 2)
      expect(players.length).toBe(4)
      expect(players[0]._type).toBe('human')
      expect(players[1]._type).toBe('human')
      expect(players[2]._type).toBe('bot')
      expect(players[3]._type).toBe('bot')
    })

    it('creates players with default stats', () => {
      const players = createPlayers(1, 0)
      expect(players[0].killed).toBe(0)
      expect(players[0].lost).toBe(0)
      expect(players[0].score).toBe(0)
      expect(players[0].active).toBe(true)
    })
  })

  describe('getNeighbours', () => {
    function createEmptyField(width, height) {
      const field = []
      for (let x = 0; x < width; x++) {
        const col = []
        for (let y = 0; y < height; y++) {
          col.push(new Models.Cell({ kind: Models.TerrainTypes.EMPTY, idx: 1 }))
        }
        field.push(col)
      }
      return field
    }

    it('returns 4 neighbours for center cell', () => {
      const field = createEmptyField(3, 3)
      const neighbours = getNeighbours(field, 3, 3, 1, 1)

      expect(neighbours.length).toBe(4)
      expect(neighbours).toContainEqual([0, 1])
      expect(neighbours).toContainEqual([2, 1])
      expect(neighbours).toContainEqual([1, 0])
      expect(neighbours).toContainEqual([1, 2])
    })

    it('returns 2 neighbours for corner cell', () => {
      const field = createEmptyField(3, 3)
      const neighbours = getNeighbours(field, 3, 3, 0, 0)

      expect(neighbours.length).toBe(2)
      expect(neighbours).toContainEqual([1, 0])
      expect(neighbours).toContainEqual([0, 1])
    })

    it('excludes mountain terrain', () => {
      const field = createEmptyField(3, 3)
      // Make right neighbor a mountain
      field[2][1].terrain.kind = Models.TerrainTypes.MOUNTAIN

      const neighbours = getNeighbours(field, 3, 3, 1, 1)
      expect(neighbours.length).toBe(3)
      expect(neighbours).not.toContainEqual([2, 1])
    })

    it('returns 3 neighbours for edge cell', () => {
      const field = createEmptyField(3, 3)
      const neighbours = getNeighbours(field, 3, 3, 0, 1)

      expect(neighbours.length).toBe(3)
    })
  })

  describe('createNewUnit', () => {
    it('creates unit with player index', () => {
      const unit = createNewUnit(0, 1, 5, 7, 3, false)
      expect(unit.player).toBe(0)
    })

    it('creates unit with correct type based on player', () => {
      const unit0 = createNewUnit(0, 1, 5, 7, 3, false)
      const unit1 = createNewUnit(1, 1, 5, 7, 3, false)

      expect(unit0._type).toBe('dino1')
      expect(unit1._type).toBe('dino2')
    })

    it('creates unit with move points in range', () => {
      // With min=2, max=4, should get 2, 3, or 4
      for (let i = 0; i < 20; i++) {
        const unit = createNewUnit(0, 2, 4, 7, 3, false)
        expect(unit.movePoints).toBeGreaterThanOrEqual(2)
        expect(unit.movePoints).toBeLessThanOrEqual(4)
      }
    })

    it('applies speed modifier', () => {
      const unit = createNewUnit(0, 3, 3, 7, 3, false, 2)
      expect(unit.movePoints).toBe(5) // 3 + 2
    })

    it('sets visibility when relation disabled', () => {
      const unit = createNewUnit(0, 1, 5, 7, 4, false)
      expect(unit.visibility).toBe(4) // avgVisibility
    })

    it('calculates visibility when relation enabled', () => {
      const unit = createNewUnit(0, 1, 5, 5, 3, true)
      expect(unit.visibility).toBeGreaterThanOrEqual(1)
    })

    it('creates Unit instance', () => {
      const unit = createNewUnit(0, 1, 5, 7, 3, false)
      expect(unit).toBeInstanceOf(Models.Unit)
    })
  })

  describe('calculateUnitVisibility', () => {
    it('returns 1 for speed above max', () => {
      expect(calculateUnitVisibility(10, 1, 5, 3)).toBe(1)
    })

    it('returns avgVisibility when min equals max', () => {
      expect(calculateUnitVisibility(5, 5, 5, 4)).toBe(4)
    })

    it('returns value in valid range', () => {
      for (let speed = 1; speed <= 5; speed++) {
        const vis = calculateUnitVisibility(speed, 1, 5, 3)
        expect(vis).toBeGreaterThanOrEqual(1)
        expect(vis).toBeLessThanOrEqual(6) // maxVis = 2*avg - 1 = 5, allow some margin
      }
    })
  })

  describe('normalizeField', () => {
    it('returns null/undefined as-is', () => {
      expect(normalizeField(null)).toBeNull()
      expect(normalizeField(undefined)).toBeUndefined()
    })

    it('returns non-array as-is', () => {
      expect(normalizeField('not an array')).toBe('not an array')
    })

    it('converts plain cell objects', () => {
      const plainField = [
        [
          {
            terrain: { kind: 'empty', idx: 1 },
            building: null,
            unit: null,
            isHidden: false,
          },
        ],
      ]

      const normalized = normalizeField(plainField)
      expect(normalized[0][0].terrain.kind).toBe('empty')
      expect(normalized[0][0].isHidden).toBe(false)
    })

    it('converts unit objects to Unit instances', () => {
      const plainField = [
        [
          {
            terrain: { kind: 'empty', idx: 1 },
            building: null,
            unit: {
              player: 0,
              _type: 'dino1',
              movePoints: 3,
              visibility: 2,
              hasMoved: true,
            },
            isHidden: false,
          },
        ],
      ]

      const normalized = normalizeField(plainField)
      expect(normalized[0][0].unit).toBeInstanceOf(Models.Unit)
      expect(normalized[0][0].unit.player).toBe(0)
      expect(normalized[0][0].unit.hasMoved).toBe(true)
    })

    it('converts building objects to Building instances', () => {
      const plainField = [
        [
          {
            terrain: { kind: 'empty', idx: 1 },
            building: { player: 1, _type: 'base' },
            unit: null,
            isHidden: false,
          },
        ],
      ]

      const normalized = normalizeField(plainField)
      expect(normalized[0][0].building).toBeInstanceOf(Models.Building)
      expect(normalized[0][0].building.player).toBe(1)
    })

    it('handles null cells', () => {
      const plainField = [[null, { terrain: { kind: 'empty', idx: 1 } }]]
      const normalized = normalizeField(plainField)
      expect(normalized[0][0]).toBeNull()
    })

    it('defaults isHidden to true when undefined', () => {
      const plainField = [[{ terrain: { kind: 'empty', idx: 1 } }]]
      const normalized = normalizeField(plainField)
      expect(normalized[0][0].isHidden).toBe(true)
    })
  })

  describe('getPlayerColor', () => {
    it('returns blue for player 0', () => {
      expect(getPlayerColor(0)).toBe('#4A90E2')
    })

    it('returns mint for player 1', () => {
      expect(getPlayerColor(1)).toBe('#32cc67')
    })

    it('returns red for player 2', () => {
      expect(getPlayerColor(2)).toBe('#FF4444')
    })

    it('returns yellow for player 3', () => {
      expect(getPlayerColor(3)).toBe('#FFD700')
    })

    it('returns white for unknown player', () => {
      expect(getPlayerColor(99)).toBe('#ffffff')
      expect(getPlayerColor(-1)).toBe('#ffffff')
    })

    it('returns colors for all 8 players', () => {
      for (let i = 0; i < 8; i++) {
        const color = getPlayerColor(i)
        expect(color).not.toBe('#ffffff')
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
    })
  })
})
