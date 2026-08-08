import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MapPreview from '@/components/game/MapPreview.vue'

function makeField(w, h) {
  const field = []
  for (let x = 0; x < w; x++) {
    const col = []
    for (let y = 0; y < h; y++) {
      col.push({ terrain: { kind: 'empty', idx: 1 }, building: null, unit: null })
    }
    field.push(col)
  }
  return field
}

describe('MapPreview fog-of-war masking', () => {
  it('masks to the viewing player’s visibility (relation off → radius = fogR)', () => {
    const map = {
      settings: { enableFogOfWar: true, fogOfWarRadius: 2, visibilitySpeedRelation: false },
      field: makeField(7, 7),
    }
    map.field[3][3].unit = { player: 0, _type: 'dino1', movePoints: 1 }
    const w = mount(MapPreview, { props: { map, viewingPlayer: 0 } })

    expect(w.vm.isVisible(3, 3)).toBe(true) // on the unit
    expect(w.vm.isVisible(3, 5)).toBe(true) // Chebyshev distance 2 == radius
    expect(w.vm.isVisible(3, 6)).toBe(false) // distance 3 > radius
    expect(w.vm.isVisible(0, 0)).toBe(false)
  })

  it('does not mask when no viewing player is given', () => {
    const map = {
      settings: { enableFogOfWar: true, fogOfWarRadius: 2, visibilitySpeedRelation: false },
      field: makeField(5, 5),
    }
    const w = mount(MapPreview, { props: { map } }) // viewingPlayer defaults to null
    expect(w.vm.visibleSet).toBeNull()
    expect(w.vm.isVisible(0, 0)).toBe(true)
  })

  it('does not mask when fog of war is disabled', () => {
    const map = {
      settings: { enableFogOfWar: false, fogOfWarRadius: 2 },
      field: makeField(5, 5),
    }
    const w = mount(MapPreview, { props: { map, viewingPlayer: 0 } })
    expect(w.vm.visibleSet).toBeNull()
  })

  // The speed-0 fix: a stationary dino must preview the SAME fog radius
  // as a speed-1 one (both collapse to normalizedSpeed 0). Mirrors the
  // in-game reseed so the picker preview matches what you'll actually play.
  it('previews the same radius for a speed-0 and a speed-1 dino', () => {
    const mapWithSpeed = mp => ({
      settings: {
        enableFogOfWar: true,
        fogOfWarRadius: 3,
        visibilitySpeedRelation: true,
        minSpeed: 1,
        speedMinVisibility: 7,
      },
      field: (() => {
        const f = makeField(15, 15)
        f[7][7].unit = { player: 0, _type: 'dino1', movePoints: mp }
        return f
      })(),
    })
    const w0 = mount(MapPreview, { props: { map: mapWithSpeed(0), viewingPlayer: 0 } })
    const w1 = mount(MapPreview, { props: { map: mapWithSpeed(1), viewingPlayer: 0 } })
    expect(w0.vm.visibleSet.size).toBeGreaterThan(1)
    expect(w0.vm.visibleSet.size).toBe(w1.vm.visibleSet.size)
  })
})
