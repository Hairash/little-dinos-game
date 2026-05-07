/**
 * Field diff utilities for undo functionality.
 * These functions compute and apply diffs between field states,
 * storing only the changed cells for memory efficiency.
 */

/**
 * Compute the diff between two field states.
 * Returns an array of cells that changed, storing the ORIGINAL values (from oldField).
 *
 * @param {Array} oldField - Field state before the change
 * @param {Array} newField - Field state after the change
 * @param {number} width - Field width
 * @param {number} height - Field height
 * @returns {Array} Array of { x, y, cell } objects representing original cell states
 */
export function computeFieldDiff(oldField, newField, width, height) {
  const diff = []

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const oldCell = oldField[x][y]
      const newCell = newField[x][y]

      // Compare cells - check unit and building changes
      if (!cellsEqual(oldCell, newCell)) {
        // Store the original cell (deep clone to preserve state)
        // Use JSON.parse/stringify for compatibility with Vue reactive proxies
        diff.push({
          x,
          y,
          cell: JSON.parse(JSON.stringify(oldCell)),
        })
      }
    }
  }

  return diff
}

/**
 * Check if two cells are equal (same unit, building state).
 * Note: We ignore isHidden as that's visibility, not game state.
 *
 * @param {Object} cellA - First cell to compare
 * @param {Object} cellB - Second cell to compare
 * @returns {boolean} True if cells are equal
 */
function cellsEqual(cellA, cellB) {
  // Compare units
  const unitA = cellA.unit
  const unitB = cellB.unit

  if ((unitA === null || unitA === undefined) !== (unitB === null || unitB === undefined)) {
    return false
  }
  if (unitA && unitB) {
    if (unitA.player !== unitB.player) return false
    if (unitA.movePoints !== unitB.movePoints) return false
    if (unitA.hasMoved !== unitB.hasMoved) return false
  }

  // Compare buildings
  const buildingA = cellA.building
  const buildingB = cellB.building

  if (
    (buildingA === null || buildingA === undefined) !==
    (buildingB === null || buildingB === undefined)
  ) {
    return false
  }
  if (buildingA && buildingB) {
    if (buildingA.player !== buildingB.player) return false
    if (buildingA._type !== buildingB._type) return false
  }

  return true
}

/**
 * Apply a diff to restore the field to a previous state.
 * Modifies the field in place.
 *
 * @param {Array} field - Current field to modify
 * @param {Array} diff - Array of { x, y, cell } objects to restore
 */
export function applyFieldDiff(field, diff) {
  for (const { x, y, cell } of diff) {
    // Restore the original cell (deep clone to avoid reference issues)
    // Use JSON.parse/stringify for compatibility with Vue reactive proxies
    field[x][y].unit = cell.unit ? JSON.parse(JSON.stringify(cell.unit)) : null
    field[x][y].building = cell.building ? JSON.parse(JSON.stringify(cell.building)) : null
  }
}
