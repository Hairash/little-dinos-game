"""
Pathfinding service for unit moves.

Mirrors `WaveEngine.getPath` on the frontend: 4-neighbour BFS that records
parents and reconstructs the cell-by-cell path. Used by the consumer to attach
the move's path to the outgoing patch so clients can animate the walk.
"""

from collections import deque

from game.services.move_validation import get_neighbours, get_wave_field


def compute_path(
    field,
    width: int,
    height: int,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    move_points: int,
    enable_scout_mode: bool = True,
) -> list[list[int]] | None:
    """
    Compute the BFS path from (x0, y0) to (x1, y1).

    Returns a list of [x, y] coords including both endpoints, or None if the
    destination is unreachable within `move_points`.
    """
    if x0 == x1 and y0 == y1:
        return [[x0, y0]]

    wave_field = get_wave_field(field, width, height, enable_scout_mode)
    wave_field[x0][y0] = 0
    parents: dict[tuple[int, int], tuple[int, int]] = {}
    queue = deque([(x0, y0)])

    while queue:
        x, y = queue.popleft()
        s = wave_field[x][y] + 1
        if s > move_points:
            break
        for nx, ny in get_neighbours(wave_field, x, y, width, height):
            # Treat the destination as reachable even if it would otherwise be
            # filtered out by the wave field (kept for parity with the JS BFS).
            if nx == x1 and ny == y1:
                parents[(nx, ny)] = (x, y)
                out = [[nx, ny]]
                key: tuple[int, int] | None = (x, y)
                while key is not None:
                    px, py = key
                    out.append([px, py])
                    key = parents.get(key)
                out.reverse()
                return out
            if wave_field[nx][ny] is None:
                wave_field[nx][ny] = s
                parents[(nx, ny)] = (x, y)
                queue.append((nx, ny))

    return None
