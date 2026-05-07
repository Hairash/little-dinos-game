import { describe, it, expect, vi, beforeEach } from 'vitest'
import devTools from '@/game/devTools'

describe('devTools', () => {
  let consoleSpy

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  describe('showWave', () => {
    it('logs wave coordinates in formatted string', () => {
      const wave = [
        [0, 0],
        [1, 2],
        [3, 4],
      ]
      devTools.showWave(wave)

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('(0,0)')
      expect(output).toContain('(1,2)')
      expect(output).toContain('(3,4)')
    })

    it('handles empty wave', () => {
      devTools.showWave([])
      expect(consoleSpy).toHaveBeenCalledWith('')
    })

    it('handles single coordinate', () => {
      devTools.showWave([[5, 7]])
      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('(5,7)')
    })
  })

  describe('showField', () => {
    it('logs field as visual grid', () => {
      // Simple 2x2 field with values
      const field = [
        [1, 2],
        [3, 4],
      ]
      devTools.showField(field)

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0]
      // Field is transposed for display
      expect(output).toContain('1')
      expect(output).toContain('3')
    })

    it('displays null as dot', () => {
      const field = [
        [null, 1],
        [2, null],
      ]
      devTools.showField(field)

      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('.')
    })

    it('displays -1 as block character', () => {
      const field = [
        [-1, 0],
        [0, -1],
      ]
      devTools.showField(field)

      const output = consoleSpy.mock.calls[0][0]
      expect(output).toContain('█')
    })

    it('handles 3x3 field correctly', () => {
      const field = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]
      devTools.showField(field)

      expect(consoleSpy).toHaveBeenCalled()
      // Output should have 3 rows (newlines)
      const output = consoleSpy.mock.calls[0][0]
      const rows = output.trim().split('\n')
      expect(rows.length).toBe(3)
    })
  })
})
