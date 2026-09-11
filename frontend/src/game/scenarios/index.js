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
// Filenames may carry a numeric `NN-` prefix to control the picker order
// (globs sort alphabetically); the prefix is stripped from the entry id,
// so `01-ambush.json` keeps the historical id `ambush`.
const files = import.meta.glob(['./*.json', './*.ldm'], {
  eager: true,
  query: '?raw',
  import: 'default',
})

function entryFromFile(filePath, raw) {
  const parsed = JSON.parse(raw)
  const base = filePath.replace(/^\.\//, '').replace(/\.(json|ldm)$/i, '')
  return {
    id: base.replace(/^\d+-/, ''),
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
