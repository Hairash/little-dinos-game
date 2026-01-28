"""
Tests for move validation service.
"""

from game.services.move_validation import (
    apply_move_to_cell,
    can_reach,
    get_wave_field,
    validate_move,
)
from game.services.visibility import TERRAIN_TYPES


class TestGetWaveField:
    """Test wave field generation."""

    def test_wave_field_all_passable(self, small_field):
        """All empty cells are passable."""
        field, width, height = small_field
        wave_field = get_wave_field(field, width, height, enable_scout_mode=False)

        for x in range(width):
            for y in range(height):
                assert wave_field[x][y] is None  # Passable

    def test_wave_field_mountains_impassable(self, small_field):
        """Mountains are impassable."""
        field, width, height = small_field
        field[2][2]["terrain"]["kind"] = TERRAIN_TYPES["MOUNTAIN"]

        wave_field = get_wave_field(field, width, height, enable_scout_mode=False)
        assert wave_field[2][2] == -1  # Impassable

    def test_wave_field_units_impassable(self, small_field):
        """Cells with units are impassable."""
        field, width, height = small_field
        field[2][2]["unit"] = {"player": 0, "_type": "dino1"}

        wave_field = get_wave_field(field, width, height, enable_scout_mode=False)
        assert wave_field[2][2] == -1  # Impassable

    def test_wave_field_hidden_cells_impassable_in_scout_mode(self, small_field):
        """Hidden cells are impassable in scout mode."""
        field, width, height = small_field
        field[2][2]["isHidden"] = True

        wave_field = get_wave_field(field, width, height, enable_scout_mode=True)
        assert wave_field[2][2] == -1  # Impassable

    def test_wave_field_hidden_cells_passable_without_scout_mode(self, small_field):
        """Hidden cells are passable without scout mode."""
        field, width, height = small_field
        field[2][2]["isHidden"] = True

        wave_field = get_wave_field(field, width, height, enable_scout_mode=False)
        assert wave_field[2][2] is None  # Passable


class TestCanReach:
    """Test pathfinding reachability."""

    def test_can_reach_adjacent(self, small_field):
        """Can reach adjacent cell."""
        field, width, height = small_field
        assert can_reach(field, width, height, 2, 2, 2, 3, move_points=1, enable_scout_mode=False)

    def test_can_reach_diagonal(self, small_field):
        """Can reach diagonal cell within move points."""
        field, width, height = small_field
        # Diagonal distance is 2 (Manhattan)
        assert can_reach(field, width, height, 2, 2, 3, 3, move_points=2, enable_scout_mode=False)

    def test_can_reach_too_far(self, small_field):
        """Cannot reach cell beyond move points."""
        field, width, height = small_field
        # Distance 5, but only 2 move points
        assert not can_reach(
            field, width, height, 0, 0, 4, 4, move_points=2, enable_scout_mode=False
        )

    def test_can_reach_blocked_by_mountain(self, small_field):
        """Cannot reach when completely surrounded by mountains."""
        field, width, height = small_field
        # Create a wall of mountains around (2,2) leaving only the source accessible
        # Block all paths from (2,2) to (4,4) by creating vertical wall
        for y in range(height):
            field[3][y]["terrain"]["kind"] = TERRAIN_TYPES["MOUNTAIN"]

        # Path blocked by mountain wall - can't reach (4,4) from (2,2)
        assert not can_reach(
            field, width, height, 2, 2, 4, 4, move_points=10, enable_scout_mode=False
        )

    def test_can_reach_blocked_by_unit(self, small_field):
        """Cannot reach when path is blocked by units."""
        field, width, height = small_field
        # Create a wall of units blocking the path
        for y in range(height):
            field[3][y]["unit"] = {"player": 1, "_type": "dino2"}

        # Path blocked by unit wall - can't reach (4,4) from (2,2)
        assert not can_reach(
            field, width, height, 2, 2, 4, 4, move_points=10, enable_scout_mode=False
        )

    def test_can_reach_same_cell(self, small_field):
        """Cannot move to same cell (not a valid move)."""
        field, width, height = small_field
        assert not can_reach(
            field, width, height, 2, 2, 2, 2, move_points=0, enable_scout_mode=False
        )


class TestValidateMove:
    """Test move validation."""

    def test_validate_move_valid(self, small_field):
        """Valid move passes validation."""
        field, width, height = small_field
        field[2][2]["unit"] = {
            "player": 0,
            "_type": "dino1",
            "movePoints": 3,
            "hasMoved": False,
        }

        is_valid, error = validate_move(
            field,
            width,
            height,
            from_coords=(2, 2),
            to_coords=(2, 3),
            player_order=0,
            enable_scout_mode=False,
        )

        assert is_valid is True
        assert error is None

    def test_validate_move_no_unit_at_source(self, small_field):
        """Move fails if no unit at source."""
        field, width, height = small_field

        is_valid, error = validate_move(
            field,
            width,
            height,
            from_coords=(2, 2),
            to_coords=(2, 3),
            player_order=0,
            enable_scout_mode=False,
        )

        assert is_valid is False
        assert "No unit at source cell" in error

    def test_validate_move_wrong_player(self, small_field):
        """Move fails if unit belongs to different player."""
        field, width, height = small_field
        field[2][2]["unit"] = {
            "player": 1,  # Different player
            "_type": "dino2",
            "movePoints": 3,
            "hasMoved": False,
        }

        is_valid, error = validate_move(
            field,
            width,
            height,
            from_coords=(2, 2),
            to_coords=(2, 3),
            player_order=0,
            enable_scout_mode=False,
        )

        assert is_valid is False
        assert "does not belong to player" in error

    def test_validate_move_already_moved(self, small_field):
        """Move fails if unit already moved."""
        field, width, height = small_field
        field[2][2]["unit"] = {
            "player": 0,
            "_type": "dino1",
            "movePoints": 3,
            "hasMoved": True,  # Already moved
        }

        is_valid, error = validate_move(
            field,
            width,
            height,
            from_coords=(2, 2),
            to_coords=(2, 3),
            player_order=0,
            enable_scout_mode=False,
        )

        assert is_valid is False
        assert "already moved" in error

    def test_validate_move_destination_not_empty(self, small_field):
        """Move fails if destination has unit."""
        field, width, height = small_field
        field[2][2]["unit"] = {
            "player": 0,
            "_type": "dino1",
            "movePoints": 3,
            "hasMoved": False,
        }
        field[2][3]["unit"] = {"player": 1, "_type": "dino2"}

        is_valid, error = validate_move(
            field,
            width,
            height,
            from_coords=(2, 2),
            to_coords=(2, 3),
            player_order=0,
            enable_scout_mode=False,
        )

        assert is_valid is False
        assert "already has a unit" in error

    def test_validate_move_destination_mountain(self, small_field):
        """Move fails if destination is mountain."""
        field, width, height = small_field
        field[2][2]["unit"] = {
            "player": 0,
            "_type": "dino1",
            "movePoints": 3,
            "hasMoved": False,
        }
        field[2][3]["terrain"]["kind"] = TERRAIN_TYPES["MOUNTAIN"]

        is_valid, error = validate_move(
            field,
            width,
            height,
            from_coords=(2, 2),
            to_coords=(2, 3),
            player_order=0,
            enable_scout_mode=False,
        )

        assert is_valid is False
        assert "not empty" in error

    def test_validate_move_out_of_bounds(self, small_field):
        """Move fails if coordinates out of bounds."""
        field, width, height = small_field
        field[2][2]["unit"] = {
            "player": 0,
            "_type": "dino1",
            "movePoints": 3,
            "hasMoved": False,
        }

        is_valid, error = validate_move(
            field,
            width,
            height,
            from_coords=(10, 10),  # Out of bounds
            to_coords=(2, 3),
            player_order=0,
            enable_scout_mode=False,
        )

        assert is_valid is False
        assert "out of bounds" in error


class TestApplyMoveToCell:
    """Test applying moves to field."""

    def test_apply_move_basic(self, small_field):
        """Basic move moves unit and marks as moved."""
        field, width, height = small_field
        field[2][2]["unit"] = {
            "player": 0,
            "_type": "dino1",
            "movePoints": 3,
            "hasMoved": False,
        }

        building_captured, cells_changed = apply_move_to_cell(
            field, 2, 2, 2, 3, player_order=0, settings={}
        )

        assert field[2][2]["unit"] is None
        assert field[2][3]["unit"] is not None
        assert field[2][3]["unit"]["hasMoved"] is True
        assert building_captured is False
        assert (2, 2) in cells_changed
        assert (2, 3) in cells_changed

    def test_apply_move_captures_base(self, small_field):
        """Move to base captures it."""
        field, width, height = small_field
        field[2][2]["unit"] = {
            "player": 0,
            "_type": "dino1",
            "movePoints": 3,
            "hasMoved": False,
        }
        field[2][3]["building"] = {
            "player": None,
            "_type": "base",
        }

        settings = {"maxBasesNum": 0}  # No limit
        building_captured, cells_changed = apply_move_to_cell(
            field, 2, 2, 2, 3, player_order=0, settings=settings
        )

        assert building_captured is True
        assert field[2][3]["building"]["player"] == 0

    def test_apply_move_kills_neighbors(self, small_field):
        """Move kills neighboring enemy units."""
        field, width, height = small_field
        field[2][2]["unit"] = {
            "player": 0,
            "_type": "dino1",
            "movePoints": 3,
            "hasMoved": False,
        }
        # Place enemy unit to the right
        field[2][3]["unit"] = {
            "player": 1,
            "_type": "dino2",
        }
        # Place another enemy unit below
        field[3][2]["unit"] = {
            "player": 1,
            "_type": "dino2",
        }

        # Move to (1, 2) which will kill neighbor at (1, 3)
        field[1][2]["unit"] = None  # Clear destination
        field[1][3]["unit"] = {
            "player": 1,
            "_type": "dino2",
        }

        building_captured, cells_changed = apply_move_to_cell(
            field, 2, 2, 1, 2, player_order=0, settings={}
        )

        # Neighbor at (1, 3) should be killed
        assert field[1][3]["unit"] is None
        assert (1, 3) in cells_changed
