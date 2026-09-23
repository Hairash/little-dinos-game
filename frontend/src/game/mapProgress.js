// Which scenarios and saved maps the player has beaten in single-player.
//
// Same shape as the tutorial's completion store (`tutorialScenarios.js`):
// a `{ key: true }` dict in localStorage, read by the pickers to show a
// tick next to an entry. Purely cosmetic — nothing gates on it.
//
// Entries are keyed by TYPE + map name. Scenarios and saved maps live in
// different buckets and can legitimately share a name, so the prefix
// keeps a win on one from ticking the other. The name is what both
// pickers already display, so no id plumbing is needed.

const STORAGE_KEY = 'mapsWon.v1'

export function wonKey(name, isScenario) {
  return `${isScenario ? 'scenario' : 'map'}:${name}`
}

export function loadWonMaps() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (_e) {
    return {}
  }
}

export function markMapWon(name, isScenario) {
  if (!name) return
  try {
    const won = loadWonMaps()
    won[wonKey(name, isScenario)] = true
    localStorage.setItem(STORAGE_KEY, JSON.stringify(won))
  } catch (_e) {
    // A full or unavailable localStorage must never break a won game.
  }
}

export function isMapWon(name, isScenario) {
  return loadWonMaps()[wonKey(name, isScenario)] === true
}
