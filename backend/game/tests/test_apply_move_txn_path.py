"""
Regression test for the multiplayer move-animation path emission.

The bug: server-generated multiplayer fields have `isHidden=True` on every
cell. Earlier, `apply_move_txn` ran `compute_path` against that raw field
in scout mode, which made the wave field treat every cell as impassable, so
no `path` was ever attached to the patch and clients never animated.

The fix: feed `compute_path` the per-player `field_for_validation` (which has
`isHidden=False` for cells the moving player can see) — same input used by
`validate_move`.
"""

import pytest

from game.models import Game, GamePlayer, Move
from game.services.game_logic import apply_move_txn
from game.services.visibility import TERRAIN_TYPES


@pytest.fixture
def two_player_game(db, user, user2):
    """A 2-player game with a field that has empty terrain everywhere
    and a unit for `user` at (0, 0). Settings disable fog of war so the
    setup stays minimal — the path emission must work in both modes."""
    width, height = 5, 5
    field = []
    for _x in range(width):
        col = []
        for _y in range(height):
            col.append(
                {
                    "terrain": {"kind": TERRAIN_TYPES["EMPTY"], "idx": 1},
                    "building": None,
                    "unit": None,
                    # Mirror what the server's generate_field actually writes.
                    "isHidden": True,
                }
            )
        field.append(col)
    field[0][0]["unit"] = {
        "player": 0,
        "_type": "dino1",
        "movePoints": 3,
        "visibility": 1,
        "hasMoved": False,
    }
    g = Game.objects.create(
        game_code="anim01",
        status="playing",
        turn_player=user,
        settings={
            "width": width,
            "height": height,
            "fogOfWarRadius": 1,
            "enableFogOfWar": False,  # all cells visible — keeps test small
            "minSpeed": 1,
            "maxSpeed": 5,
        },
        field=field,
    )
    GamePlayer.objects.create(game=g, player=user, order=0)
    GamePlayer.objects.create(game=g, player=user2, order=1)
    return g


def test_apply_move_txn_emits_path_and_moving_unit(two_player_game, user):
    """Patch carries the BFS path and the moving unit so clients can animate."""
    ok, res = apply_move_txn(
        game_code=two_player_game.game_code,
        user_id=user.id,
        payload={"fromCoords": [0, 0], "toCoords": [2, 0]},
        client_seq=1,
    )
    assert ok, res
    patch = res["patch"]
    assert "path" in patch, "patch must include the full BFS path for the consumer to slice"
    assert patch["path"][0] == [0, 0]
    assert patch["path"][-1] == [2, 0]
    assert len(patch["path"]) == 3
    assert "movingUnit" in patch
    assert patch["movingUnit"]["_type"] == "dino1"
    # Sanity: a Move record was written.
    assert Move.objects.filter(game=two_player_game, player=user, client_seq=1).exists()


def test_apply_move_txn_emits_path_with_fog_on_using_per_player_view(two_player_game, user):
    """With fog of war enabled, path is computed from `field_for_validation`
    (per-player view), not the raw isHidden=True field."""
    two_player_game.settings = {**two_player_game.settings, "enableFogOfWar": True}
    two_player_game.save(update_fields=["settings"])

    ok, res = apply_move_txn(
        game_code=two_player_game.game_code,
        user_id=user.id,
        payload={"fromCoords": [0, 0], "toCoords": [1, 0]},
        client_seq=2,
    )
    assert ok, res
    patch = res["patch"]
    # Before the fix this was missing because compute_path saw all cells as
    # impassable in scout mode (isHidden=True on the raw field).
    assert "path" in patch
    assert patch["path"] == [[0, 0], [1, 0]]


@pytest.fixture
def kill_scenario_game(db, user, user2):
    """5x5 board, fog ON.
    - user (player 0) has a unit at (4, 4) with visibility 4 — sees the whole board.
    - user2 (player 1) has a unit at (0, 4) with movePoints 3 — will walk to (3, 4).
      That destination is adjacent to (4, 4), so killNeighbours kills user's unit.

    Reproduces the scenario from the bug report: enemy walks up, kills our unit,
    and (under the old slicing logic) we see no animation because post-move
    visibility no longer covers the path the enemy took.
    """
    width, height = 5, 5
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
    # Player 0's unit (the one that will be killed). Visibility 4 makes the
    # whole board visible to player 0 pre-move.
    field[4][4]["unit"] = {
        "player": 0,
        "_type": "dino1",
        "movePoints": 3,
        "visibility": 4,
        "hasMoved": False,
    }
    # Player 1's unit (the killer). High visibility so scout-mode validation
    # accepts the multi-cell move to a far cell on this fog-on board.
    field[0][4]["unit"] = {
        "player": 1,
        "_type": "dino2",
        "movePoints": 3,
        "visibility": 4,
        "hasMoved": False,
    }
    g = Game.objects.create(
        game_code="kill01",
        status="playing",
        turn_player=user2,  # player 1's turn
        settings={
            "width": width,
            "height": height,
            "fogOfWarRadius": 2,
            "enableFogOfWar": True,
            "minSpeed": 1,
            "maxSpeed": 5,
        },
        field=field,
    )
    GamePlayer.objects.create(game=g, player=user, order=0)
    GamePlayer.objects.create(game=g, player=user2, order=1)
    return g


def test_pre_move_visibility_hint_attached(kill_scenario_game, user, user2):
    """The patch carries `_visibilityByOrder` keyed by player order, with a
    string key per player. This is the data the consumer slicer reads to
    avoid the post-move-shrinkage bug."""
    ok, res = apply_move_txn(
        game_code=kill_scenario_game.game_code,
        user_id=user2.id,
        payload={"fromCoords": [0, 4], "toCoords": [3, 4]},
        client_seq=1,
    )
    assert ok, res
    patch = res["patch"]
    assert "_visibilityByOrder" in patch
    assert "0" in patch["_visibilityByOrder"]
    assert "1" in patch["_visibilityByOrder"]
    # Each entry is a list of [x, y] pairs (JSON-friendly).
    visible_for_0 = patch["_visibilityByOrder"]["0"]
    assert isinstance(visible_for_0, list)
    assert all(isinstance(c, list) and len(c) == 2 for c in visible_for_0)


def test_pre_move_visibility_covers_killers_path_for_victim(kill_scenario_game, user, user2):
    """Regression: when the killing move would shrink the victim's post-move
    visibility (their unit just died), the recipient must STILL see the
    path the killer took. We check this by asserting the pre-move visibility
    hint for player 0 covers the cells the killer walks through, even though
    after the move player 0 has no units left at all.
    """
    ok, res = apply_move_txn(
        game_code=kill_scenario_game.game_code,
        user_id=user2.id,
        payload={"fromCoords": [0, 4], "toCoords": [3, 4]},
        client_seq=1,
    )
    assert ok, res
    patch = res["patch"]
    # Player 0's unit is dead in the post-move field — they have no remaining
    # source of visibility. Slicing against post-move would yield an empty set.
    field_after = patch["field"]
    has_player_0_units = any(
        cell.get("unit") and cell["unit"].get("player") == 0 for col in field_after for cell in col
    )
    assert not has_player_0_units, "player 0's unit should be dead after the move"

    # …but the pre-move hint for player 0 must include the cells the killer
    # walked through (which player 0's unit at (4,4) with visibility 4 saw).
    visible_for_0 = {tuple(c) for c in patch["_visibilityByOrder"]["0"]}
    path = patch["path"]
    # All path cells should be in the pre-move hint; that's what makes the
    # consumer's slice non-empty after the fix.
    for cell in path:
        assert tuple(cell) in visible_for_0, f"pre-move hint missing path cell {cell}"


def test_apply_move_txn_emits_killed_cells(kill_scenario_game, user2):
    """Patch carries `killedCells` listing the cells whose unit just died,
    so the client can play the death animation before merging the post-move
    field (which has them already removed)."""
    ok, res = apply_move_txn(
        game_code=kill_scenario_game.game_code,
        user_id=user2.id,
        payload={"fromCoords": [0, 4], "toCoords": [3, 4]},
        client_seq=1,
    )
    assert ok, res
    patch = res["patch"]
    assert "killedCells" in patch
    # The victim was at (4, 4) — adjacent to the killer's destination (3, 4).
    assert [4, 4] in patch["killedCells"]


def test_apply_end_turn_txn_emits_births_for_kill_at_birth(db, user, user2):
    """`apply_end_turn_txn` should attach `births` (per-birth list of
    {coords, killedCoords}) so the client can play the per-birth fade-in
    + per-birth death animation when the next player's turn begins."""
    from game.models import Game, GamePlayer
    from game.services.game_logic import apply_end_turn_txn

    width, height = 5, 5
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
    # Player 1 (user2) owns a base at (1, 0). When their turn begins, a
    # fresh unit spawns there. Player 0 has a unit at (1, 1) — adjacent —
    # which gets killed at birth.
    field[1][0]["building"] = {"player": 1, "_type": "base"}
    field[1][1]["unit"] = {
        "player": 0,
        "_type": "dino1",
        "movePoints": 1,
        "visibility": 1,
        "hasMoved": True,
    }
    g = Game.objects.create(
        game_code="killbirth01",
        status="playing",
        # turn_player is `user` (player 0); we end their turn so the next
        # player (user2 / player 1) starts and produces a unit.
        turn_player=user,
        settings={
            "width": width,
            "height": height,
            "fogOfWarRadius": 2,
            "enableFogOfWar": True,
            "minSpeed": 1,
            "maxSpeed": 5,
            "killAtBirth": True,
        },
        field=field,
    )
    GamePlayer.objects.create(game=g, player=user, order=0)
    GamePlayer.objects.create(game=g, player=user2, order=1)

    ok, res = apply_end_turn_txn(game_code=g.game_code, user_id=user.id, client_seq=1)
    assert ok, res
    patch = res["patch"]
    assert "births" in patch, "kill-at-birth should produce a `births` list so clients can animate"
    assert any(b["coords"] == [1, 0] for b in patch["births"]), patch["births"]
    spawn = next(b for b in patch["births"] if b["coords"] == [1, 0])
    assert spawn["killedCoords"] == [[1, 1]]


def test_visibility_hint_is_pre_move_not_post_move(kill_scenario_game, user, user2):
    """The hint must reflect PRE-move state. We verify by checking that
    player 0's pre-move visibility includes their unit's source cell (4, 4),
    which can no longer be a source of visibility post-move (unit is dead)."""
    ok, res = apply_move_txn(
        game_code=kill_scenario_game.game_code,
        user_id=user2.id,
        payload={"fromCoords": [0, 4], "toCoords": [3, 4]},
        client_seq=1,
    )
    assert ok, res
    visible_for_0 = {tuple(c) for c in res["patch"]["_visibilityByOrder"]["0"]}
    assert (4, 4) in visible_for_0, "pre-move hint must reflect victim's unit position"
