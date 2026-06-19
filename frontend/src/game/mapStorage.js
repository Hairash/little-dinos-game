// LocalStorage CRUD for single-player saved maps.
//
// Maps are kept under a single `savedMaps` key as
//   { [name]: canonicalMapJson }
// so list operations don't have to scan the whole localStorage namespace.
//
// Caller is responsible for producing a valid canonical Map (via
// `mapSchema.js#toCanonicalMap`). This module does not validate shape —
// `validateMap` is the boundary for that. The naming/postfix logic and
// the listing helpers live here.

const STORAGE_KEY = 'savedMaps'

function readAll() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(obj) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
}

// Returns the saved maps as an array, sorted newest-first by
// `metadata.savedAt`. Names that lack savedAt sort to the end.
export function listSavedMaps() {
  const all = readAll()
  const list = Object.values(all)
  return list.sort((a, b) => {
    const ta = a.metadata?.savedAt || ''
    const tb = b.metadata?.savedAt || ''
    return tb.localeCompare(ta)
  })
}

export function getSavedMap(name) {
  const all = readAll()
  return all[name] ?? null
}

export function mapNameExists(name) {
  return getSavedMap(name) !== null
}

// Persist a canonical Map. By default refuses to overwrite an existing
// name — call with { overwrite: true } to allow re-saving under the same
// name. Throws on conflict so the dialog can surface a clear error.
export function saveMap(map, { overwrite = false } = {}) {
  if (!map || !map.name) {
    throw new Error('saveMap: map.name is required')
  }
  const all = readAll()
  if (!overwrite && all[map.name]) {
    throw new Error(`Map "${map.name}" already exists`)
  }
  all[map.name] = map
  writeAll(all)
}

export function deleteSavedMap(name) {
  const all = readAll()
  if (!(name in all)) return
  delete all[name]
  writeAll(all)
}

// Build the default name `{players}-{w}x{h}-{YYYY-MM-DD}` and append
// `-N` if a map of that name already exists. Pure — caller supplies
// the date string so this stays deterministic for tests.
//
//   nextDefaultName(6, 20, 20, '2026-07-01')
//     → '6-20x20-2026-07-01'        (if free)
//     → '6-20x20-2026-07-01-1'      (if base name taken)
//     → '6-20x20-2026-07-01-2'      (if -1 also taken)
export function nextDefaultName(playersNum, width, height, dateStr) {
  const base = `${playersNum}-${width}x${height}-${dateStr}`
  if (!mapNameExists(base)) return base
  let n = 1
  while (mapNameExists(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

// Convenience for callers that want today's date in `YYYY-MM-DD`.
// Kept separate from `nextDefaultName` so the latter stays clock-free
// (tests pass an explicit date).
export function todayDateStr() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
