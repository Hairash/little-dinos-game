"""
Tests for visibility service - fog of war calculations.
"""

from game.services.visibility import (
    BUILDING_TYPES,
    TERRAIN_TYPES,
    calculate_visibility,
    filter_field_for_player,
)


def create_empty_cell():
    """Create an empty cell without unit or building."""
    return {
        "terrain": {"kind": TERRAIN_TYPES["EMPTY"], "idx": 1},
        "unit": None,
        "building": None,
    }


def create_cell_with_unit(player, visibility=3):
    """Create a cell with a unit."""
    cell = create_empty_cell()
    cell["unit"] = {
        "player": player,
        "_type": "dino1",
        "movePoints": 3,
        "visibility": visibility,
    }
    return cell


def create_cell_with_base(player):
    """Create a cell with a base building."""
    cell = create_empty_cell()
    cell["building"] = {
        "player": player,
        "_type": BUILDING_TYPES["BASE"],
    }
    return cell


def create_field(width, height):
    """Create an empty field."""
    return [[create_empty_cell() for _ in range(height)] for _ in range(width)]


class TestCalculateVisibility:
    def test_fog_disabled_shows_all(self):
        field = create_field(5, 5)
        visible = calculate_visibility(
            field, width=5, height=5, player_order=0, fog_of_war_radius=2, enable_fog_of_war=False
        )
        # All 25 cells should be visible
        assert len(visible) == 25

    def test_no_units_sees_nothing(self):
        field = create_field(5, 5)
        visible = calculate_visibility(
            field, width=5, height=5, player_order=0, fog_of_war_radius=2, enable_fog_of_war=True
        )
        assert len(visible) == 0

    def test_unit_provides_visibility(self):
        field = create_field(5, 5)
        # Place unit at center (2, 2) with visibility 2
        field[2][2] = create_cell_with_unit(player=0, visibility=2)

        visible = calculate_visibility(
            field, width=5, height=5, player_order=0, fog_of_war_radius=2, enable_fog_of_war=True
        )

        # Center should be visible
        assert (2, 2) in visible
        # Adjacent cells should be visible
        assert (2, 3) in visible
        assert (3, 2) in visible
        # Cells at distance 2 should be visible
        assert (0, 0) in visible
        assert (4, 4) in visible

    def test_unit_visibility_uses_unit_stat(self):
        field = create_field(7, 7)
        # Place unit at center (3, 3) with visibility 1
        field[3][3] = create_cell_with_unit(player=0, visibility=1)

        visible = calculate_visibility(
            field, width=7, height=7, player_order=0, fog_of_war_radius=3, enable_fog_of_war=True
        )

        # Center and adjacent should be visible
        assert (3, 3) in visible
        assert (3, 4) in visible
        assert (4, 3) in visible
        # But corners should NOT be visible (too far)
        assert (0, 0) not in visible
        assert (6, 6) not in visible

    def test_other_player_units_not_visible(self):
        field = create_field(5, 5)
        # Place enemy unit
        field[2][2] = create_cell_with_unit(player=1, visibility=3)

        visible = calculate_visibility(
            field, width=5, height=5, player_order=0, fog_of_war_radius=2, enable_fog_of_war=True
        )

        # Player 0 sees nothing
        assert len(visible) == 0

    def test_base_provides_visibility(self):
        field = create_field(5, 5)
        # Place base at (2, 2)
        field[2][2] = create_cell_with_base(player=0)

        visible = calculate_visibility(
            field, width=5, height=5, player_order=0, fog_of_war_radius=2, enable_fog_of_war=True
        )

        # Base provides fog_of_war_radius visibility
        assert (2, 2) in visible
        assert (2, 3) in visible
        assert (0, 0) in visible

    def test_scout_revealed_coords(self):
        field = create_field(10, 10)
        # No units - normally sees nothing

        scout_coords = [[0, 0], [9, 9], [5, 5]]
        visible = calculate_visibility(
            field,
            width=10,
            height=10,
            player_order=0,
            fog_of_war_radius=2,
            enable_fog_of_war=True,
            scout_revealed_coords=scout_coords,
        )

        # Scout-revealed cells should be visible
        assert (0, 0) in visible
        assert (9, 9) in visible
        assert (5, 5) in visible
        # Other cells should not
        assert (1, 1) not in visible

    def test_multiple_units_expand_visibility(self):
        field = create_field(10, 10)
        # Place units at opposite corners
        field[1][1] = create_cell_with_unit(player=0, visibility=1)
        field[8][8] = create_cell_with_unit(player=0, visibility=1)

        visible = calculate_visibility(
            field, width=10, height=10, player_order=0, fog_of_war_radius=2, enable_fog_of_war=True
        )

        # Both units' areas should be visible
        assert (1, 1) in visible
        assert (0, 0) in visible
        assert (8, 8) in visible
        assert (9, 9) in visible
        # Center should not be visible
        assert (5, 5) not in visible


class TestFilterFieldForPlayer:
    def test_visible_cells_not_hidden(self):
        field = create_field(5, 5)
        field[2][2] = create_cell_with_unit(player=0, visibility=2)

        filtered = filter_field_for_player(
            field, width=5, height=5, player_order=0, fog_of_war_radius=2, enable_fog_of_war=True
        )

        # Visible cells should have isHidden=False
        assert filtered[2][2]["isHidden"] is False
        assert filtered[2][3]["isHidden"] is False

    def test_hidden_cells_marked(self):
        field = create_field(10, 10)
        # Unit at corner with low visibility
        field[0][0] = create_cell_with_unit(player=0, visibility=1)

        filtered = filter_field_for_player(
            field, width=10, height=10, player_order=0, fog_of_war_radius=2, enable_fog_of_war=True
        )

        # Far corner should be hidden
        assert filtered[9][9]["isHidden"] is True
        # Hidden cells should have no unit/building info
        assert filtered[9][9]["unit"] is None
        assert filtered[9][9]["building"] is None

    def test_fog_disabled_shows_all(self):
        field = create_field(5, 5)

        filtered = filter_field_for_player(
            field, width=5, height=5, player_order=0, fog_of_war_radius=2, enable_fog_of_war=False
        )

        # All cells should be visible
        for x in range(5):
            for y in range(5):
                assert filtered[x][y]["isHidden"] is False

    def test_hidden_cells_have_empty_terrain(self):
        field = create_field(10, 10)
        field[0][0] = create_cell_with_unit(player=0, visibility=1)

        filtered = filter_field_for_player(
            field, width=10, height=10, player_order=0, fog_of_war_radius=2, enable_fog_of_war=True
        )

        # Hidden cells should still have terrain structure
        hidden_cell = filtered[9][9]
        assert hidden_cell["terrain"]["kind"] == TERRAIN_TYPES["EMPTY"]
        assert "idx" in hidden_cell["terrain"]

    def test_preserves_visible_cell_data(self):
        field = create_field(5, 5)
        field[2][2] = create_cell_with_unit(player=0, visibility=3)
        field[2][3] = create_cell_with_base(player=0)

        filtered = filter_field_for_player(
            field, width=5, height=5, player_order=0, fog_of_war_radius=2, enable_fog_of_war=True
        )

        # Unit data should be preserved
        assert filtered[2][2]["unit"] is not None
        assert filtered[2][2]["unit"]["player"] == 0
        # Building data should be preserved
        assert filtered[2][3]["building"] is not None
        assert filtered[2][3]["building"]["_type"] == BUILDING_TYPES["BASE"]
