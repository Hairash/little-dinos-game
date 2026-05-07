import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { animateMovePath } from '../src/game/moveAnimator'

function makeField(width, height) {
  const field = []
  for (let x = 0; x < width; x++) {
    const col = []
    for (let y = 0; y < height; y++) {
      col.push({ unit: null })
    }
    field.push(col)
  }
  return field
}

describe('animateMovePath', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('walks the unit cell-by-cell across the path', async () => {
    const field = makeField(5, 5)
    const unit = { player: 0, _type: 'dino' }
    field[0][0].unit = unit
    const path = [
      [0, 0],
      [1, 0],
      [2, 0],
    ]

    const promise = animateMovePath(field, path, unit, { delay: 100 })

    // First step happens synchronously before the first await sleep returns.
    await Promise.resolve()
    expect(field[1][0].unit).toBe(unit)
    expect(field[0][0].unit).toBeNull()

    // Advance past the first step's delay; second step kicks in.
    await vi.advanceTimersByTimeAsync(100)
    expect(field[2][0].unit).toBe(unit)
    expect(field[1][0].unit).toBeNull()

    // Final settle.
    await vi.advanceTimersByTimeAsync(100)
    await promise
    expect(field[2][0].unit).toBe(unit)
  })

  it('returns immediately for a zero/one-cell path (nothing to animate)', async () => {
    const field = makeField(2, 2)
    field[0][0].unit = { player: 0 }
    await animateMovePath(field, [[0, 0]], field[0][0].unit, { delay: 100 })
    // Unit should still be where it started.
    expect(field[0][0].unit).toEqual({ player: 0 })
  })

  it('skips the sleep when both endpoints of a step are invisible', async () => {
    const field = makeField(5, 5)
    const unit = { player: 0 }
    field[0][0].unit = unit
    const path = [
      [0, 0],
      [1, 0],
      [2, 0],
    ]

    const isVisible = () => false
    const promise = animateMovePath(field, path, unit, { delay: 100, isVisible })

    // No advancement of timers needed — both steps are invisible, no sleep awaited.
    await promise
    expect(field[2][0].unit).toBe(unit)
    expect(field[0][0].unit).toBeNull()
    expect(field[1][0].unit).toBeNull()
  })

  it('aborts mid-walk when isCancelled flips true', async () => {
    const field = makeField(5, 5)
    const unit = { player: 0 }
    field[0][0].unit = unit
    const path = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ]

    let cancelled = false
    const promise = animateMovePath(field, path, unit, {
      delay: 100,
      isCancelled: () => cancelled,
    })

    // After first step, flip the flag and advance; the loop should exit before mutating cell 2.
    await Promise.resolve()
    expect(field[1][0].unit).toBe(unit)
    cancelled = true
    await vi.advanceTimersByTimeAsync(100)
    await promise
    // Unit stayed at the cell where cancellation happened; later cells untouched.
    expect(field[1][0].unit).toBe(unit)
    expect(field[2][0].unit).toBeNull()
    expect(field[3][0].unit).toBeNull()
  })
})
