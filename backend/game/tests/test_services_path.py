"""
Tests for the BFS path computation used by the move animation.
"""

from game.services.path import compute_path
from game.services.visibility import TERRAIN_TYPES


class TestComputePath:
    def test_returns_single_cell_when_start_equals_destination(self, small_field):
        field, width, height = small_field
        path = compute_path(field, width, height, 2, 2, 2, 2, 5)
        assert path == [[2, 2]]

    def test_returns_adjacent_path_for_one_step_move(self, small_field):
        field, width, height = small_field
        path = compute_path(field, width, height, 0, 0, 1, 0, 3)
        assert path == [[0, 0], [1, 0]]

    def test_returns_ordered_cell_by_cell_path(self, small_field):
        field, width, height = small_field
        path = compute_path(field, width, height, 0, 0, 3, 0, 5)
        assert path is not None
        assert path[0] == [0, 0]
        assert path[-1] == [3, 0]
        # 4-neighbour: every step is one cell on exactly one axis.
        for i in range(1, len(path)):
            dx = abs(path[i][0] - path[i - 1][0])
            dy = abs(path[i][1] - path[i - 1][1])
            assert dx + dy == 1

    def test_returns_none_when_unreachable_within_move_points(self, small_field):
        field, width, height = small_field
        assert compute_path(field, width, height, 0, 0, 4, 4, 3) is None

    def test_routes_around_terrain_obstacle(self, small_field):
        field, width, height = small_field
        # Wall a column of mountains except for one detour row.
        for y in range(height):
            field[2][y]["terrain"]["kind"] = TERRAIN_TYPES["MOUNTAIN"]
        field[2][4]["terrain"]["kind"] = TERRAIN_TYPES["EMPTY"]

        path = compute_path(field, width, height, 0, 0, 4, 0, 20, enable_scout_mode=False)
        assert path is not None
        assert path[0] == [0, 0]
        assert path[-1] == [4, 0]
        # Path must not cross the mountain wall (except via the detour at y=4).
        for x, y in path:
            if x == 2:
                assert y == 4
