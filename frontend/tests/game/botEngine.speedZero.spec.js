import { describe, expect, it, vi } from 'vitest'
import { BotEngine } from '@/game/botEngine'

describe('BotEngine stationary units', () => {
  it('skips fog and move calculations for a speed-0 unit', async () => {
    const field = [[{ unit: { player: 1, movePoints: 0, visibility: 9 } }]]
    const fieldEngine = { getCurrentVisibilitySet: vi.fn() }
    const waveEngine = { getReachableCoordsArr: vi.fn() }
    const moveUnit = vi.fn()
    const bot = new BotEngine(field, 1, 1, true, fieldEngine, waveEngine)
    const coords = [[0, 0]]

    await bot.makeBotUnitMove(coords, 1, moveUnit)

    expect(coords).toEqual([])
    expect(fieldEngine.getCurrentVisibilitySet).not.toHaveBeenCalled()
    expect(waveEngine.getReachableCoordsArr).not.toHaveBeenCalled()
    expect(moveUnit).not.toHaveBeenCalled()
  })

  it('reuses stationary sight while refreshing moving-unit and base sight', async () => {
    const field = Array.from({ length: 3 }, () =>
      Array.from({ length: 3 }, () => ({ unit: null, isHidden: false }))
    )
    field[0][0].unit = { player: 1, movePoints: 0, visibility: 2 }
    field[1][1].unit = { player: 1, movePoints: 5, visibility: 2 }
    field[2][2].unit = { player: 1, movePoints: 5, visibility: 2 }
    const fieldEngine = {
      getCurrentVisibilitySet: vi.fn((_player, options) =>
        options?.includeMoving === false ? new Set([[0, 0]]) : new Set([[1, 1]])
      ),
    }
    const waveEngine = { getReachableCoordsArr: vi.fn(() => [[1, 1]]) }
    const bot = new BotEngine(field, 3, 3, true, fieldEngine, waveEngine)
    const findEnemy = vi.spyOn(bot, 'findEnemy').mockReturnValue(null)

    bot.prepareTurnVisibility(1)
    await bot.makeBotUnitMove([[1, 1]], 1, vi.fn())
    await bot.makeBotUnitMove([[2, 2]], 1, vi.fn())

    expect(fieldEngine.getCurrentVisibilitySet).toHaveBeenCalledTimes(3)
    expect(fieldEngine.getCurrentVisibilitySet).toHaveBeenNthCalledWith(1, 1, {
      includeMoving: false,
      includeBases: false,
    })
    expect(fieldEngine.getCurrentVisibilitySet).toHaveBeenNthCalledWith(2, 1, {
      includeStationary: false,
    })
    expect(bot.stationaryVisibility.coords.has('[0,0]')).toBe(true)
    expect(findEnemy).toHaveBeenCalledTimes(2)
    expect(findEnemy.mock.calls[0][1]).toEqual(new Set(['[0,0]', '[1,1]']))
  })
})
