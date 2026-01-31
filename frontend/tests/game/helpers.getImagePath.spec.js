import { describe, it, expect } from 'vitest'

describe('getImagePath', () => {
  it('exports getImagePath function', async () => {
    const { getImagePath } = await import('@/game/helpers')
    expect(typeof getImagePath).toBe('function')
  })

  it('getImagePath returns a valid path format', async () => {
    const { getImagePath } = await import('@/game/helpers')
    const path = getImagePath('test')

    // Should return either PNG or WebP path
    expect(path).toMatch(/^\/images\/test\.(png|webp)$/)
  })

  it('getImagePath handles names with numbers', async () => {
    const { getImagePath } = await import('@/game/helpers')
    const path = getImagePath('dino1')

    expect(path).toMatch(/^\/images\/dino1\.(png|webp)$/)
  })

  it('getImagePath handles complex names', async () => {
    const { getImagePath } = await import('@/game/helpers')
    const path = getImagePath('visibility_speed_relation_icon')

    expect(path).toMatch(/^\/images\/visibility_speed_relation_icon\.(png|webp)$/)
  })
})
