import { describe, it, expect } from 'vitest'
import { WaveEngine } from '../src/game/waveEngine'
import Models from '../src/game/models'

function emptyCell() {
  return {
    terrain: { kind: Models.TerrainTypes.EMPTY, idx: 1 },
    unit: null,
    building: null,
    isHidden: false,
  }
}

function mountainCell() {
  return {
    terrain: { kind: Models.TerrainTypes.MOUNTAIN, idx: 1 },
    unit: null,
    building: null,
    isHidden: false,
  }
}

function buildField(width, height, fillEmpty = true) {
  const field = []
  for (let x = 0; x < width; x++) {
    const col = []
    for (let y = 0; y < height; y++) {
      col.push(fillEmpty ? emptyCell() : mountainCell())
    }
    field.push(col)
  }
  return field
}

describe('WaveEngine.getPath', () => {
  it('returns single-cell path when start equals destination', () => {
    const field = buildField(5, 5)
    const wave = new WaveEngine(field, 5, 5, 3, false)
    expect(wave.getPath(2, 2, 2, 2, 5)).toEqual([[2, 2]])
  })

  it('returns adjacent-cell path for a one-step move', () => {
    const field = buildField(5, 5)
    const wave = new WaveEngine(field, 5, 5, 3, false)
    const path = wave.getPath(0, 0, 1, 0, 3)
    expect(path).toEqual([
      [0, 0],
      [1, 0],
    ])
  })

  it('returns ordered cell-by-cell path for a multi-step straight move', () => {
    const field = buildField(5, 5)
    const wave = new WaveEngine(field, 5, 5, 3, false)
    const path = wave.getPath(0, 0, 3, 0, 3)
    expect(path[0]).toEqual([0, 0])
    expect(path[path.length - 1]).toEqual([3, 0])
    // Each step moves by exactly one cell on exactly one axis (4-neighbour).
    for (let i = 1; i < path.length; i++) {
      const dx = Math.abs(path[i][0] - path[i - 1][0])
      const dy = Math.abs(path[i][1] - path[i - 1][1])
      expect(dx + dy).toBe(1)
    }
    expect(path.length).toBe(4)
  })

  it('returns null when destination is unreachable within move points', () => {
    const field = buildField(5, 5)
    const wave = new WaveEngine(field, 5, 5, 3, false)
    expect(wave.getPath(0, 0, 4, 4, 3)).toBeNull()
  })

  it('returns null when destination is blocked by terrain', () => {
    const field = buildField(5, 5)
    field[2][0] = mountainCell()
    field[2][1] = mountainCell()
    field[2][2] = mountainCell()
    field[2][3] = mountainCell()
    field[2][4] = mountainCell()
    const wave = new WaveEngine(field, 5, 5, 3, false)
    expect(wave.getPath(0, 0, 4, 0, 10)).toBeNull()
  })

  it('routes around obstacles when they exist', () => {
    const field = buildField(5, 5)
    field[1][0] = mountainCell() // block straight east path one row
    const wave = new WaveEngine(field, 5, 5, 3, false)
    const path = wave.getPath(0, 0, 2, 0, 5)
    expect(path).not.toBeNull()
    expect(path[0]).toEqual([0, 0])
    expect(path[path.length - 1]).toEqual([2, 0])
    // Path shouldn't traverse the mountain cell.
    expect(path.some(([x, y]) => x === 1 && y === 0)).toBe(false)
  })
})
