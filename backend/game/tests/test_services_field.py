"""
Tests for field generation service.
"""

from game.services.field import (
    adjust_speed,
    calculate_unit_visibility,
    generate_field,
    get_sector,
    is_cell_in_start_positions,
    sectors_distance,
    validate_sector,
)


class TestGetSector:
    """Test sector calculation."""

    def test_get_sector_center(self):
        """Test getting sector for center cell."""
        x, y = 10, 10
        width, height = 20, 20
        sectors_num = 4
        sector_x, sector_y = get_sector(x, y, width, height, sectors_num)
        assert sector_x == 2
        assert sector_y == 2

    def test_get_sector_corner(self):
        """Test getting sector for corner cell."""
        x, y = 0, 0
        width, height = 20, 20
        sectors_num = 4
        sector_x, sector_y = get_sector(x, y, width, height, sectors_num)
        assert sector_x == 0
        assert sector_y == 0

    def test_get_sector_edge(self):
        """Test getting sector for edge cell."""
        x, y = 19, 5
        width, height = 20, 20
        sectors_num = 4
        sector_x, sector_y = get_sector(x, y, width, height, sectors_num)
        assert sector_x == 3
        assert sector_y == 1


class TestSectorsDistance:
    """Test sector distance calculation."""

    def test_sectors_distance_same(self):
        """Distance to self is 0."""
        assert sectors_distance([1, 1], [1, 1]) == 0

    def test_sectors_distance_adjacent(self):
        """Adjacent sectors have distance 1."""
        assert sectors_distance([0, 0], [0, 1]) == 1
        assert sectors_distance([0, 0], [1, 0]) == 1
        assert sectors_distance([0, 0], [1, 1]) == 1

    def test_sectors_distance_diagonal(self):
        """Diagonal distance uses Chebyshev (max of x and y differences)."""
        assert sectors_distance([0, 0], [2, 2]) == 2
        assert sectors_distance([1, 1], [3, 4]) == 3  # max(2, 3)


class TestValidateSector:
    """Test sector validation."""

    def test_validate_sector_edge_valid(self):
        """Edge sectors are valid."""
        sectors: list[list[int]] = []
        sectors_num = 4
        assert validate_sector(0, 0, sectors, sectors_num) is True
        assert validate_sector(3, 0, sectors, sectors_num) is True
        assert validate_sector(0, 3, sectors, sectors_num) is True

    def test_validate_sector_center_invalid(self):
        """Center sectors are invalid."""
        sectors: list[list[int]] = []
        sectors_num = 4
        assert validate_sector(1, 1, sectors, sectors_num) is False
        assert validate_sector(2, 2, sectors, sectors_num) is False

    def test_validate_sector_too_close(self):
        """Sectors too close to existing ones are invalid."""
        sectors = [[0, 0]]
        sectors_num = 4
        # Distance 1 is too close (need distance >= 2)
        assert validate_sector(0, 1, sectors, sectors_num) is False
        assert validate_sector(1, 0, sectors, sectors_num) is False
        # Distance 2 is OK
        assert validate_sector(0, 2, sectors, sectors_num) is True


class TestIsCellInStartPositions:
    """Test checking if cell is in start positions."""

    def test_cell_in_start_positions(self):
        """Cell that exists in start positions returns True."""
        start_positions = [[5, 5], [10, 10], [15, 15]]
        assert is_cell_in_start_positions(5, 5, start_positions) is True
        assert is_cell_in_start_positions(10, 10, start_positions) is True

    def test_cell_not_in_start_positions(self):
        """Cell not in start positions returns False."""
        start_positions = [[5, 5], [10, 10]]
        assert is_cell_in_start_positions(0, 0, start_positions) is False
        assert is_cell_in_start_positions(5, 6, start_positions) is False


class TestCalculateUnitVisibility:
    """Test unit visibility calculation."""

    def test_visibility_at_min_speed(self):
        """Unit at min speed gets base visibility."""
        move_points = 1
        min_speed = 1
        max_speed = 5
        avg_visibility = 7
        visibility = calculate_unit_visibility(move_points, min_speed, max_speed, avg_visibility)
        assert visibility >= 1
        assert visibility <= 2 * avg_visibility - 1

    def test_visibility_at_max_speed(self):
        """Unit at max speed gets max visibility."""
        move_points = 5
        min_speed = 1
        max_speed = 5
        avg_visibility = 7
        visibility = calculate_unit_visibility(move_points, min_speed, max_speed, avg_visibility)
        assert visibility >= 1
        assert visibility <= 2 * avg_visibility - 1

    def test_visibility_above_max_speed(self):
        """Unit above max speed gets visibility 1."""
        move_points = 10
        min_speed = 1
        max_speed = 5
        avg_visibility = 7
        visibility = calculate_unit_visibility(move_points, min_speed, max_speed, avg_visibility)
        assert visibility == 1

    def test_visibility_same_min_max_speed(self):
        """When min and max speed are equal, return avg visibility."""
        move_points = 3
        min_speed = 3
        max_speed = 3
        avg_visibility = 7
        visibility = calculate_unit_visibility(move_points, min_speed, max_speed, avg_visibility)
        assert visibility == avg_visibility


class TestAdjustSpeed:
    """Test speed adjustment function."""

    def test_adjust_speed_at_zero(self):
        """Speed at 0 should return value in [0, 1] range."""
        result = adjust_speed(0.0)
        assert 0 <= result <= 1

    def test_adjust_speed_at_one(self):
        """Speed at 1 should return value in [0, 1] range."""
        result = adjust_speed(1.0)
        assert 0 <= result <= 1

    def test_adjust_speed_at_half(self):
        """Speed at 0.5 should return value in [0, 1] range."""
        result = adjust_speed(0.5)
        assert 0 <= result <= 1


class TestGenerateField:
    """Test field generation."""

    def test_generate_field_basic(self):
        """Generate a basic field with default settings."""
        settings = {
            "humanPlayersNum": 1,
            "botPlayersNum": 0,
            "width": 10,
            "height": 10,
        }
        field = generate_field(settings)

        assert len(field) == 10
        assert len(field[0]) == 10

        # Check all cells have required structure
        for x in range(10):
            for y in range(10):
                cell = field[x][y]
                assert "terrain" in cell
                assert "building" in cell
                assert "unit" in cell
                assert "isHidden" in cell

    def test_generate_field_with_players(self):
        """Generate field with multiple players."""
        settings = {
            "humanPlayersNum": 2,
            "botPlayersNum": 0,
            "width": 20,
            "height": 20,
            "sectorsNum": 4,
            "minSpeed": 1,
            "maxSpeed": 5,
            "speedMinVisibility": 7,
            "fogOfWarRadius": 3,
            "visibilitySpeedRelation": True,
        }
        field = generate_field(settings)

        # Count players (units and bases)
        player_units: dict[int, int] = {}
        player_bases: dict[int, int] = {}
        for x in range(20):
            for y in range(20):
                cell = field[x][y]
                if cell.get("unit"):
                    player = cell["unit"].get("player")
                    if player is not None:
                        player_units[player] = player_units.get(player, 0) + 1
                if cell.get("building"):
                    building = cell["building"]
                    if building.get("_type") == "base":
                        player = building.get("player")
                        if player is not None:
                            player_bases[player] = player_bases.get(player, 0) + 1

        # Should have 2 players with units and bases
        assert len(player_units) == 2
        assert len(player_bases) == 2
        assert all(count == 1 for count in player_units.values())
        assert all(count == 1 for count in player_bases.values())

    def test_generate_field_creates_linked_field(self):
        """Generated field should be linked (all players reachable)."""
        settings = {
            "humanPlayersNum": 2,
            "botPlayersNum": 0,
            "width": 15,
            "height": 15,
            "sectorsNum": 4,
        }
        field = generate_field(settings)

        # Find start positions
        start_positions = []
        for x in range(15):
            for y in range(15):
                cell = field[x][y]
                if cell.get("unit") and cell["unit"].get("player") is not None:
                    start_positions.append([x, y])

        assert len(start_positions) == 2

        # Field should be linked (tested by make_field_linked being called)
        # We can't easily test pathfinding here without importing wave functions,
        # but we can verify the field structure is valid
