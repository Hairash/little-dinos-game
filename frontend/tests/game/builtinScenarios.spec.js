import { describe, it, expect } from 'vitest'

import { SCENARIOS, getScenarioById } from '@/game/scenarios'
import { validateMap } from '@/game/mapSchema'

// Built-ins are wrapper-format JSON files in src/game/scenarios/ loaded
// by the folder glob. These tests pin the contract: every file yields a
// valid canonical map, ids keep their historical (prefix-stripped) form,
// and the numeric filename prefixes control the picker order.
describe('built-in scenarios folder', () => {
  it('loads all ten shipped scenarios', () => {
    expect(SCENARIOS.length).toBe(10)
  })

  it('keeps the historical curated order and prefix-free ids', () => {
    expect(SCENARIOS[0].id).toBe('ambush')
    expect(SCENARIOS[SCENARIOS.length - 1].id).toBe('island-hop')
    for (const s of SCENARIOS) {
      expect(s.id).not.toMatch(/^\d+-/)
    }
  })

  it('every entry has a description and a valid canonical map', () => {
    for (const s of SCENARIOS) {
      expect(s.description.length).toBeGreaterThan(0)
      expect(() => validateMap(s.map)).not.toThrow()
      expect(s.map.metadata.playersNum).toBe(s.map.players.length)
    }
  })

  it('getScenarioById resolves ids and misses cleanly', () => {
    expect(getScenarioById('ambush')).not.toBeNull()
    expect(getScenarioById('nope')).toBeNull()
  })
})
