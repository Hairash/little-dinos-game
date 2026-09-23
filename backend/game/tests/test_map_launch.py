"""Tests for launching multiplayer games from custom maps.

Covers the lobby map-pick sync (`set_game_map`), the join capacity block,
`start_game`'s map validation + seat reconciliation, the explicit-speed
hydration rule, and the localStorage-bound `map_saved` payload.
"""

import json

import pytest

from game.consumers import _save_map_txn
from game.models import Game, GamePlayer
from game.services.map_snapshot import (
    hydrate_field_for_game,
    occupied_seats,
    reconcile_seats,
)
from server.utils.jwt import generate_jwt_token


def make_canonical_map(
    name="Test Map", width=6, height=6, seats=2, humans=1, placed=None, capacity=None
):
    """Minimal valid canonical map: one base + one unit per placed seat.

    `seats` is the declared colour capacity; `placed` (default: all of
    them) lists the seats that actually own something on the field —
    that's what makes a seat playable.
    """
    capacity = capacity if capacity is not None else seats
    placed = list(range(seats)) if placed is None else placed
    field = [
        [
            {"terrain": {"kind": "empty", "idx": 1}, "building": None, "unit": None}
            for _ in range(height)
        ]
        for _ in range(width)
    ]
    for i, s in enumerate(placed):
        field[i][0]["building"] = {"player": s, "_type": "base"}
        field[i][1]["unit"] = {"player": s, "_type": f"dino{s + 1}"}
    return {
        "version": 1,
        "name": name,
        "metadata": {
            "playersNum": capacity,
            "humanPlayersNum": humans,
            "botPlayersNum": capacity - humans,
            "width": width,
            "height": height,
        },
        "settings": {
            "minSpeed": 1,
            "maxSpeed": 3,
            "enableFogOfWar": True,
            "fogOfWarRadius": 2,
            "visibilitySpeedRelation": False,
            "speedMinVisibility": 2,
            "maxUnitsNum": 5,
            "maxBasesNum": 3,
            "unitModifier": 3,
            "baseModifier": 3,
            "killAtBirth": True,
            "hideEnemySpeed": False,
            "enableUndo": True,
        },
        "field": field,
        "players": [{"_type": "human" if i < humans else "bot"} for i in range(capacity)],
    }


def headers_for(user):
    return {"HTTP_AUTHORIZATION": f"Bearer {generate_jwt_token(user)}"}


@pytest.fixture
def lobby(db, user, user2):
    """A ready game with creator (order 0) + one joiner (order 1)."""
    game = Game.objects.create(game_code="maplobby")
    GamePlayer.objects.create(game=game, player=user, order=0)
    GamePlayer.objects.create(game=game, player=user2, order=1)
    game.turn_player = user
    game.save(update_fields=["turn_player"])
    return game


class TestReconcileSeats:
    def test_drops_units_and_demotes_bases_of_trimmed_seats(self):
        m = make_canonical_map(seats=4)
        reconcile_seats(m["field"], [0, 1])
        # Seats 0/1 untouched.
        assert m["field"][0][0]["building"]["player"] == 0
        assert m["field"][1][1]["unit"]["player"] == 1
        # Seats 2/3: units dropped, bases demoted to neutral.
        assert m["field"][2][1]["unit"] is None
        assert m["field"][3][1]["unit"] is None
        assert m["field"][2][0]["building"] is not None
        assert m["field"][2][0]["building"]["player"] is None
        assert m["field"][3][0]["building"]["player"] is None

    def test_non_base_buildings_are_untouched(self):
        m = make_canonical_map(seats=2)
        m["field"][4][4]["building"] = {"player": None, "_type": "temple"}
        reconcile_seats(m["field"], [0])
        assert m["field"][4][4]["building"]["_type"] == "temple"


class TestOccupiedSeats:
    def test_returns_the_sparse_placed_seats(self):
        # 7 colour slots, only blue/yellow/purple placed.
        m = make_canonical_map(capacity=7, placed=[0, 3, 6])
        assert occupied_seats(m["field"]) == [0, 3, 6]

    def test_base_only_and_unit_only_seats_both_count(self):
        m = make_canonical_map(capacity=4, placed=[0])
        m["field"][2][2]["building"] = {"player": 2, "_type": "base"}
        m["field"][3][3]["unit"] = {"player": 3, "_type": "dino4"}
        assert occupied_seats(m["field"]) == [0, 2, 3]

    def test_neutral_buildings_never_count(self):
        m = make_canonical_map(capacity=4, placed=[0])
        m["field"][4][4]["building"] = {"player": None, "_type": "temple"}
        assert occupied_seats(m["field"]) == [0]

    def test_empty_map_has_no_seats(self):
        m = make_canonical_map(capacity=4, placed=[])
        assert occupied_seats(m["field"]) == []


class TestSparseSeatAssignment:
    def _start(self, api_client, lobby, user, initial_map):
        return api_client.post(
            f"/games/{lobby.game_code}/start/",
            data=json.dumps({"initialMap": initial_map}),
            content_type="application/json",
            **headers_for(user),
        )

    def test_joiners_take_the_placed_seats_keeping_their_colours(
        self, api_client, lobby, user, user2
    ):
        # 7 slots, blue/yellow/purple placed; two players joined.
        response = self._start(
            api_client, lobby, user, make_canonical_map(capacity=7, placed=[0, 3, 6])
        )
        assert response.status_code == 200
        creator = GamePlayer.objects.get(game=lobby, player=user)
        joiner = GamePlayer.objects.get(game=lobby, player=user2)
        # Creator keeps blue; the 2nd player plays YELLOW (seat 3), not a
        # renumbered seat 1 — the map's colours are preserved.
        assert creator.order == 0
        assert joiner.order == 3

    def test_unclaimed_placed_seats_are_trimmed_and_gaps_survive(
        self, api_client, lobby, user, user2
    ):
        self._start(api_client, lobby, user, make_canonical_map(capacity=7, placed=[0, 3, 6]))
        lobby.refresh_from_db()
        seats_left = occupied_seats(lobby.field)
        # Purple went unclaimed → removed. Blue + yellow remain, gap intact.
        assert seats_left == [0, 3]
        # Its base stayed on the field as a neutral tower.
        assert lobby.field[2][0]["building"]["player"] is None
        assert lobby.field[2][1]["unit"] is None

    def test_capacity_counts_placed_seats_not_declared_slots(
        self, api_client, lobby, user, user2, db
    ):
        from django.contrib.auth import get_user_model

        # 7 declared slots but only 2 placed, and 3 players joined.
        third = get_user_model().objects.create_user(username="fourth", password="TestPass123!")
        GamePlayer.objects.create(game=lobby, player=third, order=2)
        response = self._start(
            api_client, lobby, user, make_canonical_map(capacity=7, placed=[0, 3])
        )
        assert response.status_code == 400
        assert "supports 2 players" in response.json()["error"]
        lobby.refresh_from_db()
        assert lobby.status == "ready"

    def test_map_without_blue_is_rejected(self, api_client, lobby, user):
        response = self._start(
            api_client, lobby, user, make_canonical_map(capacity=7, placed=[3, 6])
        )
        assert response.status_code == 400
        assert "blue" in response.json()["error"]

    def test_map_with_nothing_placed_is_rejected(self, api_client, lobby, user):
        response = self._start(api_client, lobby, user, make_canonical_map(capacity=4, placed=[]))
        assert response.status_code == 400
        assert "no players" in response.json()["error"]


class TestHydrateExplicitSpeed:
    def _hydrate_unit(self, unit, settings_overrides=None):
        settings = {
            "minSpeed": 2,
            "fogOfWarRadius": 3,
            "visibilitySpeedRelation": True,
            "speedMinVisibility": 4,
        }
        settings.update(settings_overrides or {})
        field = [[{"terrain": {"kind": "empty", "idx": 1}, "building": None, "unit": unit}]]
        return hydrate_field_for_game(field, settings)[0][0]["unit"]

    def test_default_reseed_to_min_speed(self):
        unit = self._hydrate_unit({"player": 0, "_type": "dino1"})
        assert unit["movePoints"] == 2

    def test_explicit_speed_is_honoured(self):
        unit = self._hydrate_unit({"player": 0, "_type": "dino1", "movePoints": 7})
        assert unit["movePoints"] == 7

    def test_speed_zero_is_honoured_with_speed_one_visibility(self):
        zero = self._hydrate_unit({"player": 0, "_type": "dino1", "movePoints": 0})
        one = self._hydrate_unit({"player": 0, "_type": "dino1", "movePoints": 1})
        assert zero["movePoints"] == 0
        assert zero["visibility"] == one["visibility"]

        stale = self._hydrate_unit(
            {"player": 0, "_type": "dino1", "movePoints": 0, "visibility": 9}
        )
        assert stale["visibility"] == 9

    def test_explicit_visibility_wins(self):
        unit = self._hydrate_unit({"player": 0, "_type": "dino1", "movePoints": 1, "visibility": 9})
        assert unit["visibility"] == 9


class TestSetGameMap:
    def test_creator_picks_a_map(self, api_client, lobby, user):
        response = api_client.post(
            f"/games/{lobby.game_code}/map/",
            data=json.dumps({"name": "My Map", "seats": 4}),
            content_type="application/json",
            **headers_for(user),
        )
        assert response.status_code == 200
        lobby.refresh_from_db()
        assert lobby.picked_map_name == "My Map"
        assert lobby.picked_map_seats == 4

    def test_non_creator_cannot_pick(self, api_client, lobby, user2):
        response = api_client.post(
            f"/games/{lobby.game_code}/map/",
            data=json.dumps({"name": "My Map", "seats": 4}),
            content_type="application/json",
            **headers_for(user2),
        )
        assert response.status_code == 403

    def test_clearing_reverts_to_random(self, api_client, lobby, user):
        lobby.picked_map_name = "Old"
        lobby.picked_map_seats = 3
        lobby.save()
        response = api_client.post(
            f"/games/{lobby.game_code}/map/",
            data=json.dumps({"name": None}),
            content_type="application/json",
            **headers_for(user),
        )
        assert response.status_code == 200
        lobby.refresh_from_db()
        assert lobby.picked_map_name is None
        assert lobby.picked_map_seats is None

    def test_invalid_seats_rejected(self, api_client, lobby, user):
        response = api_client.post(
            f"/games/{lobby.game_code}/map/",
            data=json.dumps({"name": "My Map", "seats": 99}),
            content_type="application/json",
            **headers_for(user),
        )
        assert response.status_code == 400


class TestJoinCapacity:
    def test_join_blocked_when_picked_map_is_full(self, api_client, lobby, db):
        from django.contrib.auth import get_user_model

        lobby.picked_map_name = "Duel Map"
        lobby.picked_map_seats = 2
        lobby.save()
        third = get_user_model().objects.create_user(username="third", password="TestPass123!")
        response = api_client.post(f"/games/{lobby.game_code}/join/", **headers_for(third))
        assert response.status_code == 400
        assert "Duel Map" in response.json()["error"]
        assert not GamePlayer.objects.filter(game=lobby, player=third).exists()

    def test_join_allowed_without_pick(self, api_client, lobby, db):
        from django.contrib.auth import get_user_model

        third = get_user_model().objects.create_user(username="third2", password="TestPass123!")
        response = api_client.post(f"/games/{lobby.game_code}/join/", **headers_for(third))
        assert response.status_code == 200


class TestStartGameFromMap:
    def _start(self, api_client, lobby, user, initial_map):
        return api_client.post(
            f"/games/{lobby.game_code}/start/",
            data=json.dumps({"initialMap": initial_map}),
            content_type="application/json",
            **headers_for(user),
        )

    def test_map_with_more_seats_than_joined_is_trimmed(self, api_client, lobby, user):
        response = self._start(api_client, lobby, user, make_canonical_map(seats=4))
        assert response.status_code == 200
        lobby.refresh_from_db()
        assert lobby.status == "playing"
        # Seats are the JOINED players, not the map metadata.
        assert lobby.settings["humanPlayersNum"] == 2
        assert lobby.settings["fromInitialMap"] is True
        # Seat 2/3 trimmed: units gone, bases neutral. Kept seats intact.
        assert lobby.field[2][1]["unit"] is None
        assert lobby.field[3][1]["unit"] is None
        assert lobby.field[2][0]["building"]["player"] is None
        assert lobby.field[0][1]["unit"]["player"] == 0
        assert lobby.field[1][0]["building"]["player"] == 1

    def test_more_joined_than_map_seats_refuses_to_start(self, api_client, lobby, user, db):
        from django.contrib.auth import get_user_model

        third = get_user_model().objects.create_user(username="third3", password="TestPass123!")
        GamePlayer.objects.create(game=lobby, player=third, order=2)
        response = self._start(api_client, lobby, user, make_canonical_map(seats=2))
        assert response.status_code == 400
        assert "supports 2 players" in response.json()["error"]
        lobby.refresh_from_db()
        assert lobby.status == "ready"

    def test_invalid_map_is_rejected_and_game_stays_ready(self, api_client, lobby, user):
        bad = make_canonical_map()
        bad["version"] = 99
        response = self._start(api_client, lobby, user, bad)
        assert response.status_code == 400
        lobby.refresh_from_db()
        assert lobby.status == "ready"

    def test_out_of_bounds_dimensions_rejected(self, api_client, lobby, user):
        big = make_canonical_map(width=60, height=6)
        response = self._start(api_client, lobby, user, big)
        assert response.status_code == 400
        assert "dimensions" in response.json()["error"].lower()

    def test_random_start_has_no_from_initial_map_flag(self, api_client, lobby, user):
        response = api_client.post(
            f"/games/{lobby.game_code}/start/",
            data=json.dumps({"width": 10, "height": 10, "minSpeed": 1, "maxSpeed": 3}),
            content_type="application/json",
            **headers_for(user),
        )
        assert response.status_code == 200
        lobby.refresh_from_db()
        assert "fromInitialMap" not in lobby.settings


class TestSaveMapReturnsCanonical:
    def test_map_saved_payload_carries_the_full_map(self, db, user):
        game = Game.objects.create(game_code="savegame", status="playing")
        GamePlayer.objects.create(game=game, player=user, order=0)
        m = make_canonical_map(seats=1)
        game.settings = m["settings"]
        game.initial_field = hydrate_field_for_game(m["field"], m["settings"])
        game.save()

        ok, res = _save_map_txn("savegame", user.id, "local copy")
        assert ok
        # The client writes this straight into its localStorage bucket.
        assert res["map"]["version"] == 1
        assert res["map"]["name"] == "local copy"
        assert res["map"]["metadata"]["width"] == 6


class TestFirstTurnProduction:
    """The opening player must spawn at their empty towers like everyone
    else. Production normally runs in `apply_end_turn_txn` for the player
    whose turn is starting — but no turn ends before the first one, so
    `start_game` has to run it for the opening player itself."""

    def _start(self, api_client, lobby, user, initial_map):
        return api_client.post(
            f"/games/{lobby.game_code}/start/",
            data=json.dumps({"initialMap": initial_map}),
            content_type="application/json",
            **headers_for(user),
        )

    def test_the_opening_player_spawns_at_an_empty_tower(self, api_client, lobby, user):
        m = make_canonical_map(capacity=2, placed=[0, 1])
        # Seat 0 keeps its base but starts with no unit on it.
        m["field"][0][1]["unit"] = None
        response = self._start(api_client, lobby, user, m)
        assert response.status_code == 200
        lobby.refresh_from_db()
        # The base at [0][0] produced a defender for the opening player.
        assert lobby.field[0][0]["unit"] is not None
        assert lobby.field[0][0]["unit"]["player"] == 0

    def test_other_players_towers_are_untouched_at_start(self, api_client, lobby, user):
        m = make_canonical_map(capacity=2, placed=[0, 1])
        m["field"][1][1]["unit"] = None  # seat 1's base is empty too
        response = self._start(api_client, lobby, user, m)
        assert response.status_code == 200
        lobby.refresh_from_db()
        # Seat 1 spawns on THEIR turn, not on seat 0's.
        assert lobby.field[1][0]["unit"] is None

    def test_a_tower_that_already_holds_a_unit_produces_nothing_extra(
        self, api_client, lobby, user
    ):
        m = make_canonical_map(capacity=2, placed=[0, 1])
        # Seat 0's base already has its starter standing on it.
        m["field"][0][0]["unit"] = unit_at_base = {"player": 0, "_type": "dino1"}
        assert unit_at_base
        response = self._start(api_client, lobby, user, m)
        assert response.status_code == 200
        lobby.refresh_from_db()
        units = sum(
            1
            for col in lobby.field
            for cell in col
            if cell.get("unit") and cell["unit"]["player"] == 0
        )
        # The pre-placed starter at the base plus the one at [0][1]; the
        # occupied base adds nothing.
        assert units == 2

    def test_random_games_start_the_same_way(self, api_client, lobby, user):
        response = api_client.post(
            f"/games/{lobby.game_code}/start/",
            data=json.dumps({"width": 10, "height": 10, "minSpeed": 1, "maxSpeed": 3}),
            content_type="application/json",
            **headers_for(user),
        )
        assert response.status_code == 200
        lobby.refresh_from_db()
        assert lobby.status == "playing"
