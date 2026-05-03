import { describe, it, expect } from 'vitest';
import { computeFieldDiff, applyFieldDiff } from '../src/game/fieldDiff';

// Helper to create a simple cell
function createCell(unit = null, building = null, isHidden = false) {
  return {
    terrain: { kind: 'empty' },
    unit: unit,
    building: building,
    isHidden: isHidden,
  };
}

// Helper to create a unit
function createUnit(player, movePoints = 3, hasMoved = false) {
  return {
    player: player,
    _type: 'dino',
    movePoints: movePoints,
    visibility: 3,
    hasMoved: hasMoved,
  };
}

// Helper to create a building
function createBuilding(player, type = 'base') {
  return {
    player: player,
    _type: type,
  };
}

// Helper to create a 3x3 empty field
function createEmptyField(width = 3, height = 3) {
  const field = [];
  for (let x = 0; x < width; x++) {
    const col = [];
    for (let y = 0; y < height; y++) {
      col.push(createCell());
    }
    field.push(col);
  }
  return field;
}

describe('computeFieldDiff', () => {
  it('returns empty array when fields are identical', () => {
    const field1 = createEmptyField();
    const field2 = structuredClone(field1);

    const diff = computeFieldDiff(field1, field2, 3, 3);

    expect(diff).toEqual([]);
  });

  it('detects unit movement (source and destination cells)', () => {
    const oldField = createEmptyField();
    oldField[0][0].unit = createUnit(0);

    const newField = structuredClone(oldField);
    newField[0][0].unit = null;
    newField[1][0].unit = createUnit(0, 2, true); // Moved unit with reduced movePoints

    const diff = computeFieldDiff(oldField, newField, 3, 3);

    expect(diff).toHaveLength(2);
    // Source cell should have the original unit
    const sourceCell = diff.find((d) => d.x === 0 && d.y === 0);
    expect(sourceCell).toBeDefined();
    expect(sourceCell.cell.unit).toBeTruthy();
    expect(sourceCell.cell.unit.player).toBe(0);
    expect(sourceCell.cell.unit.hasMoved).toBe(false);

    // Destination cell should be empty in original
    const destCell = diff.find((d) => d.x === 1 && d.y === 0);
    expect(destCell).toBeDefined();
    expect(destCell.cell.unit).toBeNull();
  });

  it('detects unit kill (3 cells: source, dest, killed)', () => {
    const oldField = createEmptyField();
    oldField[0][0].unit = createUnit(0); // Attacker
    oldField[1][1].unit = createUnit(1); // Enemy to be killed

    const newField = structuredClone(oldField);
    newField[0][0].unit = null; // Attacker moved
    newField[1][0].unit = createUnit(0, 2, true); // Attacker new position
    newField[1][1].unit = null; // Enemy killed (adjacent to attacker)

    const diff = computeFieldDiff(oldField, newField, 3, 3);

    expect(diff).toHaveLength(3);
    // Source cell (attacker original position)
    expect(diff.some((d) => d.x === 0 && d.y === 0)).toBe(true);
    // Destination cell (where attacker moved)
    expect(diff.some((d) => d.x === 1 && d.y === 0)).toBe(true);
    // Killed unit cell
    const killedCell = diff.find((d) => d.x === 1 && d.y === 1);
    expect(killedCell).toBeDefined();
    expect(killedCell.cell.unit).toBeTruthy();
    expect(killedCell.cell.unit.player).toBe(1);
  });

  it('detects building capture', () => {
    const oldField = createEmptyField();
    oldField[1][1].building = createBuilding(1); // Enemy building
    oldField[0][0].unit = createUnit(0); // Attacker

    const newField = structuredClone(oldField);
    newField[0][0].unit = null;
    newField[1][1].unit = createUnit(0, 2, true); // Unit moved to building
    newField[1][1].building = createBuilding(0); // Building captured

    const diff = computeFieldDiff(oldField, newField, 3, 3);

    // Should include the captured building cell
    const capturedCell = diff.find((d) => d.x === 1 && d.y === 1);
    expect(capturedCell).toBeDefined();
    expect(capturedCell.cell.building.player).toBe(1); // Original owner
  });

  it('ignores isHidden changes (visibility only)', () => {
    const oldField = createEmptyField();
    oldField[0][0].isHidden = true;

    const newField = structuredClone(oldField);
    newField[0][0].isHidden = false; // Only visibility changed

    const diff = computeFieldDiff(oldField, newField, 3, 3);

    // isHidden changes should not be included in diff
    expect(diff).toEqual([]);
  });

  it('detects unit movePoints change', () => {
    const oldField = createEmptyField();
    oldField[0][0].unit = createUnit(0, 3, false);

    const newField = structuredClone(oldField);
    newField[0][0].unit = createUnit(0, 2, true); // Same position but different state

    const diff = computeFieldDiff(oldField, newField, 3, 3);

    expect(diff).toHaveLength(1);
    expect(diff[0].x).toBe(0);
    expect(diff[0].y).toBe(0);
    expect(diff[0].cell.unit.movePoints).toBe(3);
    expect(diff[0].cell.unit.hasMoved).toBe(false);
  });
});

describe('applyFieldDiff', () => {
  it('restores field to original state', () => {
    // Create original field with unit at (0,0)
    const originalField = createEmptyField();
    originalField[0][0].unit = createUnit(0);

    // Create modified field with unit moved to (1,0)
    const modifiedField = structuredClone(originalField);
    modifiedField[0][0].unit = null;
    modifiedField[1][0].unit = createUnit(0, 2, true);

    // Compute diff (stores original cells)
    const diff = computeFieldDiff(originalField, modifiedField, 3, 3);

    // Apply diff to modified field - should restore original
    applyFieldDiff(modifiedField, diff);

    // Verify restoration
    expect(modifiedField[0][0].unit).toBeTruthy();
    expect(modifiedField[0][0].unit.player).toBe(0);
    expect(modifiedField[1][0].unit).toBeNull();
  });

  it('restores killed units', () => {
    const originalField = createEmptyField();
    originalField[0][0].unit = createUnit(0); // Attacker
    originalField[1][1].unit = createUnit(1); // Enemy

    const modifiedField = structuredClone(originalField);
    modifiedField[0][0].unit = null;
    modifiedField[1][0].unit = createUnit(0, 2, true);
    modifiedField[1][1].unit = null; // Enemy killed

    const diff = computeFieldDiff(originalField, modifiedField, 3, 3);
    applyFieldDiff(modifiedField, diff);

    // Enemy should be restored
    expect(modifiedField[1][1].unit).toBeTruthy();
    expect(modifiedField[1][1].unit.player).toBe(1);
  });

  it('restores building ownership', () => {
    const originalField = createEmptyField();
    originalField[1][1].building = createBuilding(1); // Enemy building

    const modifiedField = structuredClone(originalField);
    modifiedField[1][1].building = createBuilding(0); // Building captured
    modifiedField[1][1].unit = createUnit(0);

    const diff = computeFieldDiff(originalField, modifiedField, 3, 3);
    applyFieldDiff(modifiedField, diff);

    // Building should be restored to original owner
    expect(modifiedField[1][1].building.player).toBe(1);
    expect(modifiedField[1][1].unit).toBeNull();
  });

  it('handles empty diff', () => {
    const field = createEmptyField();
    field[0][0].unit = createUnit(0);

    const originalState = structuredClone(field);
    applyFieldDiff(field, []); // Empty diff

    // Field should be unchanged
    expect(field[0][0].unit).toBeTruthy();
    expect(field[0][0].unit.player).toBe(0);
  });

  it('creates deep copies to avoid reference issues', () => {
    const originalField = createEmptyField();
    originalField[0][0].unit = createUnit(0);

    const modifiedField = structuredClone(originalField);
    modifiedField[0][0].unit = null;

    const diff = computeFieldDiff(originalField, modifiedField, 3, 3);
    applyFieldDiff(modifiedField, diff);

    // Modify the diff's stored cell - should not affect restored field
    diff[0].cell.unit.player = 99;

    expect(modifiedField[0][0].unit.player).toBe(0); // Should still be 0
  });
});
