"""
Field diff utilities for undo functionality.
These functions compute and apply diffs between field states,
storing only the changed cells for memory efficiency.
"""

import copy


def compute_field_diff(old_field: list, new_field: list, width: int, height: int) -> list:
    """
    Compute the diff between two field states.
    Returns a list of cells that changed, storing the ORIGINAL values (from old_field).

    Args:
        old_field: Field state before the change
        new_field: Field state after the change
        width: Field width
        height: Field height

    Returns:
        List of {"x": x, "y": y, "cell": cell_data} dicts representing original cell states
    """
    diff = []

    for x in range(width):
        for y in range(height):
            old_cell = old_field[x][y]
            new_cell = new_field[x][y]

            if not cells_equal(old_cell, new_cell):
                # Store the original cell (deep copy to preserve state)
                diff.append(
                    {
                        "x": x,
                        "y": y,
                        "cell": copy.deepcopy(old_cell),
                    }
                )

    return diff


def cells_equal(cell_a: dict, cell_b: dict) -> bool:
    """
    Check if two cells are equal (same unit, building state).
    Note: We ignore isHidden as that's visibility, not game state.

    Args:
        cell_a: First cell to compare
        cell_b: Second cell to compare

    Returns:
        True if cells are equal
    """
    # Compare units
    unit_a = cell_a.get("unit")
    unit_b = cell_b.get("unit")

    if (unit_a is None) != (unit_b is None):
        return False
    if unit_a and unit_b:
        if unit_a.get("player") != unit_b.get("player"):
            return False
        if unit_a.get("movePoints") != unit_b.get("movePoints"):
            return False
        if unit_a.get("hasMoved") != unit_b.get("hasMoved"):
            return False

    # Compare buildings
    building_a = cell_a.get("building")
    building_b = cell_b.get("building")

    if (building_a is None) != (building_b is None):
        return False
    if building_a and building_b:
        if building_a.get("player") != building_b.get("player"):
            return False
        if building_a.get("_type") != building_b.get("_type"):
            return False

    return True


def apply_field_diff(field: list, diff: list) -> None:
    """
    Apply a diff to restore the field to a previous state.
    Modifies the field in place.

    Args:
        field: Current field to modify
        diff: List of {"x": x, "y": y, "cell": cell_data} dicts to restore
    """
    for item in diff:
        x = item["x"]
        y = item["y"]
        cell = item["cell"]

        # Restore the original cell (deep copy to avoid reference issues)
        field[x][y]["unit"] = copy.deepcopy(cell.get("unit"))
        field[x][y]["building"] = copy.deepcopy(cell.get("building"))
