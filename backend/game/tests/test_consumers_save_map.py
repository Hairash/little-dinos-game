"""Tests for the WS `save_map` server transaction.

Exercises the sync helper `_save_map_txn` directly (avoids spinning up a
full Channels test harness for what is otherwise a pure DB-side
operation).
"""

import pytest

from game.consumers import _save_map_txn
from game.models import Game, GamePlayer, SavedMap


@pytest.fixture
def started_game(db, user):
    """A game in 'playing' status with an initial_field snapshot."""
    field = [
        [{"terrain": {"kind": "empty", "idx": 1}, "building": None, "unit": None}] for _ in range(2)
    ]
    game = Game.objects.create(
        game_code="savemap_g",
        status="playing",
        settings={"humanPlayersNum": 1, "botPlayersNum": 0, "width": 2, "height": 1},
        field=field,
        initial_field=field,
    )
    GamePlayer.objects.create(game=game, player=user, order=0)
    return game


def test_happy_path_persists_canonical_map(started_game, user):
    ok, res = _save_map_txn(started_game.game_code, user.id, "my-map")
    assert ok, res
    assert res["name"] == "my-map"
    saved = SavedMap.objects.get(user=user, name="my-map")
    assert saved.data["version"] == 1
    assert saved.data["metadata"]["width"] == 2
    assert saved.data["metadata"]["height"] == 1
    assert saved.players_num == 1
    assert saved.width == 2
    assert saved.height == 1


def test_rejects_empty_name(started_game, user):
    ok, res = _save_map_txn(started_game.game_code, user.id, "   ")
    assert not ok
    assert "Name is required" in res["reason"]


def test_rejects_unknown_user(started_game):
    ok, res = _save_map_txn(started_game.game_code, None, "x")
    assert not ok
    assert "Not authenticated" in res["reason"]


def test_rejects_unknown_game(db, user):
    ok, res = _save_map_txn("does-not-exist", user.id, "x")
    assert not ok
    assert "not found" in res["reason"].lower()


def test_rejects_non_member(started_game, user2):
    ok, res = _save_map_txn(started_game.game_code, user2.id, "x")
    assert not ok
    assert "Not a member" in res["reason"]


def test_rejects_when_initial_field_missing(db, user):
    game = Game.objects.create(
        game_code="no_snapshot",
        status="playing",
        settings={"humanPlayersNum": 1, "botPlayersNum": 0},
        field=[[{"terrain": {"kind": "empty", "idx": 1}, "building": None, "unit": None}]],
        initial_field=None,
    )
    GamePlayer.objects.create(game=game, player=user, order=0)
    ok, res = _save_map_txn(game.game_code, user.id, "x")
    assert not ok
    assert "No starting snapshot" in res["reason"]


def test_rejects_duplicate_name(started_game, user):
    ok, _ = _save_map_txn(started_game.game_code, user.id, "dup")
    assert ok
    ok2, res2 = _save_map_txn(started_game.game_code, user.id, "dup")
    assert not ok2
    assert "already exists" in res2["reason"]
