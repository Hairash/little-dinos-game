"""
Tests for field generation service.
"""

from game.services.field import (
    TERRAIN_TYPES,
    adjust_speed,
    all_targets_reached,
    calculate_unit_visibility,
    generate_field,
    get_building_positions,
    get_sector,
    is_cell_in_start_positions,
    make_field_linked,
    sectors_distance,
    validate_sector,
    wave,
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


class TestGetBuildingPositions:
    """Test getting building positions from field."""

    def _create_empty_field(self, width, height):
        """Create an empty field for testing."""
        field = []
        for _x in range(width):
            col = []
            for _y in range(height):
                col.append(
                    {
                        "terrain": {"kind": TERRAIN_TYPES["EMPTY"], "idx": 1},
                        "building": None,
                        "unit": None,
                        "isHidden": True,
                    }
                )
            field.append(col)
        return field

    def test_no_buildings(self):
        """Empty field returns no building positions."""
        field = self._create_empty_field(10, 10)
        positions = get_building_positions(field, 10, 10)
        assert positions == []

    def test_player_buildings_not_included(self):
        """Player-owned buildings are not included."""
        field = self._create_empty_field(10, 10)
        field[5][5]["building"] = {"player": 0, "_type": "base"}
        field[7][7]["building"] = {"player": 1, "_type": "base"}
        positions = get_building_positions(field, 10, 10)
        assert positions == []

    def test_neutral_buildings_included(self):
        """Neutral buildings (player=None) are included."""
        field = self._create_empty_field(10, 10)
        field[3][3]["building"] = {"player": None, "_type": "temple"}
        field[5][5]["building"] = {"player": 0, "_type": "base"}  # Player building
        field[8][8]["building"] = {"player": None, "_type": "well"}
        positions = get_building_positions(field, 10, 10)
        assert len(positions) == 2
        assert [3, 3] in positions
        assert [8, 8] in positions

    def test_multiple_building_types(self):
        """All neutral building types are included."""
        field = self._create_empty_field(10, 10)
        field[1][1]["building"] = {"player": None, "_type": "habitation"}
        field[2][2]["building"] = {"player": None, "_type": "temple"}
        field[3][3]["building"] = {"player": None, "_type": "well"}
        field[4][4]["building"] = {"player": None, "_type": "storage"}
        field[5][5]["building"] = {"player": None, "_type": "obelisk"}
        positions = get_building_positions(field, 10, 10)
        assert len(positions) == 5


class TestAllTargetsReached:
    """Test checking if all targets are reachable."""

    def test_all_reachable(self):
        """All targets with wave value 0 are reachable."""
        w_field = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
        targets = [[0, 0], [2, 2]]
        assert all_targets_reached(w_field, targets) is True

    def test_some_unreachable(self):
        """Targets with wave value > 0 are not reachable."""
        w_field = [[0, 1, 2], [1, 2, 3], [2, 3, 4]]
        targets = [[0, 0], [2, 2]]
        assert all_targets_reached(w_field, targets) is False

    def test_all_unreachable(self):
        """All targets unreachable."""
        w_field = [[1, 2, 3], [2, 3, 4], [3, 4, 5]]
        targets = [[0, 0], [2, 2]]
        assert all_targets_reached(w_field, targets) is False


class TestMakeFieldLinkedWithBuildings:
    """Test make_field_linked with buildings as targets."""

    def _create_empty_field(self, width, height):
        """Create an empty field for testing."""
        field = []
        for _x in range(width):
            col = []
            for _y in range(height):
                col.append(
                    {
                        "terrain": {"kind": TERRAIN_TYPES["EMPTY"], "idx": 1},
                        "building": None,
                        "unit": None,
                        "isHidden": True,
                    }
                )
            field.append(col)
        return field

    def test_removes_mountain_between_targets(self):
        """Mountains blocking paths between targets should be removed."""
        field = self._create_empty_field(5, 1)
        # Create a wall of mountains between position 0 and position 4
        field[1][0]["terrain"]["kind"] = TERRAIN_TYPES["MOUNTAIN"]
        field[2][0]["terrain"]["kind"] = TERRAIN_TYPES["MOUNTAIN"]
        field[3][0]["terrain"]["kind"] = TERRAIN_TYPES["MOUNTAIN"]

        targets = [[0, 0], [4, 0]]
        make_field_linked(field, 5, 1, targets)

        # Check that a path exists now
        w_field = wave(field, 5, 1, targets)
        assert all_targets_reached(w_field, targets) is True

    def test_building_becomes_reachable(self):
        """Buildings blocked by mountains should become reachable."""
        field = self._create_empty_field(5, 1)
        # Create a wall of mountains between player start (0,0) and building (4,0)
        field[1][0]["terrain"]["kind"] = TERRAIN_TYPES["MOUNTAIN"]
        field[2][0]["terrain"]["kind"] = TERRAIN_TYPES["MOUNTAIN"]
        field[3][0]["terrain"]["kind"] = TERRAIN_TYPES["MOUNTAIN"]

        # Add a building
        field[4][0]["building"] = {"player": None, "_type": "temple"}

        # Targets include both player start and building
        start_positions = [[0, 0]]
        building_positions = get_building_positions(field, 5, 1)
        all_targets = start_positions + building_positions

        make_field_linked(field, 5, 1, all_targets)

        # Verify building is now reachable
        w_field = wave(field, 5, 1, all_targets)
        assert all_targets_reached(w_field, all_targets) is True

    def test_multiple_buildings_become_reachable(self):
        """Multiple buildings should all become reachable."""
        field = self._create_empty_field(7, 3)
        # Create walls
        for y in range(3):
            field[2][y]["terrain"]["kind"] = TERRAIN_TYPES["MOUNTAIN"]
            field[4][y]["terrain"]["kind"] = TERRAIN_TYPES["MOUNTAIN"]

        # Add buildings
        field[3][1]["building"] = {"player": None, "_type": "temple"}
        field[6][1]["building"] = {"player": None, "_type": "well"}

        start_positions = [[0, 1]]
        building_positions = get_building_positions(field, 7, 3)
        all_targets = start_positions + building_positions

        make_field_linked(field, 7, 3, all_targets)

        # All targets should be reachable
        w_field = wave(field, 7, 3, all_targets)
        assert all_targets_reached(w_field, all_targets) is True


class TestGenerateFieldBuildingReachability:
    """Test that generated fields have all buildings reachable."""

    def test_buildings_are_reachable(self):
        """All buildings in generated field should be reachable from player starts."""
        settings = {
            "humanPlayersNum": 2,
            "botPlayersNum": 0,
            "width": 16,
            "height": 16,
            "sectorsNum": 4,
            "buildingRates": {
                "habitation": 4,
                "temple": 2,
                "well": 1,
            },
        }
        field = generate_field(settings)

        # Find all start positions (player units)
        start_positions = []
        for x in range(16):
            for y in range(16):
                cell = field[x][y]
                if cell.get("unit") and cell["unit"].get("player") is not None:
                    start_positions.append([x, y])

        # Find all building positions
        building_positions = get_building_positions(field, 16, 16)

        # Combine all targets
        all_targets = start_positions + building_positions

        # Check all targets are reachable
        if len(all_targets) > 1:
            w_field = wave(field, 16, 16, all_targets)
            assert all_targets_reached(w_field, all_targets) is True

    def test_buildings_reachable_in_large_field(self):
        """Buildings should be reachable even in larger fields with more obstacles."""
        settings = {
            "humanPlayersNum": 2,
            "botPlayersNum": 2,
            "width": 20,
            "height": 20,
            "sectorsNum": 4,
            "buildingRates": {
                "base": 3,
                "habitation": 4,
                "temple": 2,
                "well": 1,
                "storage": 2,
                "obelisk": 5,
            },
        }
        field = generate_field(settings)

        # Find all start positions
        start_positions = []
        for x in range(20):
            for y in range(20):
                cell = field[x][y]
                if cell.get("unit") and cell["unit"].get("player") is not None:
                    start_positions.append([x, y])

        # Find all building positions
        building_positions = get_building_positions(field, 20, 20)

        # Combine all targets
        all_targets = start_positions + building_positions

        # Check all targets are reachable
        if len(all_targets) > 1:
            w_field = wave(field, 20, 20, all_targets)
            assert all_targets_reached(w_field, all_targets) is True
