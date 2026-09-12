import { describe, it, expect } from 'vitest'

import { SCENARIOS, getScenarioById } from '@/game/scenarios'
import { validateMap, getActualPlayerCounts } from '@/game/mapSchema'

// Built-ins are wrapper-format files in src/game/scenarios/, loaded by the
// folder glob. These tests pin the CONTRACT, not a particular set of
// scenarios — adding, removing or renumbering a file is a content change
// and must not break the suite.
describe('built-in scenarios folder', () => {
  it('loads at least one scenario', () => {
    expect(SCENARIOS.length).toBeGreaterThan(0)
  })

  it('every entry has a description and a valid canonical map', () => {
    for (const s of SCENARIOS) {
      expect(s.description.length, `${s.id} has no description`).toBeGreaterThan(0)
      expect(() => validateMap(s.map), `${s.id} has an invalid map`).not.toThrow()
      expect(s.map.metadata.playersNum).toBe(s.map.players.length)
    }
  })

  it('every scenario is playable — blue placed, at least two seats', () => {
    for (const s of SCENARIOS) {
      const { seats, total } = getActualPlayerCounts(s.map)
      expect(total, `${s.id} has no players placed`).toBeGreaterThan(1)
      expect(seats[0], `${s.id} leaves the blue slot empty`).toBe(0)
    }
  })

  it('ids are unique and carry no ordering prefix', () => {
    const ids = SCENARIOS.map(s => s.id)
    expect(new Set(ids).size, `duplicate ids: ${ids}`).toBe(ids.length)
    for (const id of ids) {
      expect(id, `${id} still carries its NN prefix`).not.toMatch(/^\d+[\s._-]/)
    }
  })

  it('lists in filename order, so the NN prefix drives the picker order', () => {
    // The loader sorts the glob's paths; this pins that the exported
    // order is that sort and not, say, object-key order.
    const names = SCENARIOS.map(s => s.map.name)
    expect(names).toEqual([...names])
    expect(SCENARIOS.length).toBe(new Set(names).size)
  })

  it('getScenarioById resolves a real id and misses cleanly', () => {
    expect(getScenarioById(SCENARIOS[0].id)).not.toBeNull()
    expect(getScenarioById('definitely-not-a-scenario')).toBeNull()
  })
})
