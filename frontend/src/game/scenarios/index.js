// Built-in ("default") scenarios — one file per scenario in this folder.
//
// Each file is the same wrapper format the Map Editor's Export produces
// (`{ kind: 'little-dinos-scenario', version, description, map }`), so
// adding a default scenario is just dropping an exported file here — no
// code changes. Both `.json` and `.ldm` filenames are picked up.
//
// Built-ins are read-only: they never appear in the Map Editor and there
// is no override layer (custom copies live in the editor's own storage).
//
// Filenames may carry a numeric prefix to control the picker order —
// files are sorted by name, so zero-pad it (`09`, `10`) or the sort goes
// lexicographic on you. Any separator works after the digits: both
// `01-ambush.json` and `01 Wild world.json` are fine. The prefix is
// stripped from the entry id, so renumbering a file to reorder the list
// doesn't change its identity.
const files = import.meta.glob(['./*.json', './*.ldm'], {
  eager: true,
  query: '?raw',
  import: 'default',
})

function entryFromFile(filePath, raw) {
  const parsed = JSON.parse(raw)
  const base = filePath.replace(/^\.\//, '').replace(/\.(json|ldm)$/i, '')
  // Require a separator after the digits so a name that is genuinely
  // numeric (`2048.json`) keeps its id instead of being stripped to ''.
  const id = base.replace(/^\d+[\s._-]+/, '') || base
  return {
    id,
    description: parsed.description || '',
    map: parsed.map,
  }
}

export const SCENARIOS = Object.keys(files)
  .sort()
  .map(filePath => entryFromFile(filePath, files[filePath]))

export function getScenarioById(id) {
  return SCENARIOS.find(s => s.id === id) || null
}
