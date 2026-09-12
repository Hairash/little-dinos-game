"""Turn rotation with eliminated players in a 3-player game.

An eliminated player becomes a spectator and must be skipped by the turn
rotation for the rest of the game — otherwise the remaining players would
wait forever on someone who can't move.
"""

import pytest
from django.contrib.auth import get_user_model

from game.models import Game, GamePlayer
from game.services.game_logic import (
    apply_end_turn_txn,
    apply_move_txn,
    check_game_ended,
    compute_next_player,
    get_active_players,
    get_playable_players,
)
from game.services.visibility import TERRAIN_TYPES


def blank_field(width, height):
    return [
        [
            {
                "terrain": {"kind": TERRAIN_TYPES["EMPTY"], "idx": 1},
                "building": None,
                "unit": None,
                "isHidden": True,
            }
            for _ in range(height)
        ]
        for _ in range(width)
    ]


def unit(player):
    return {
        "player": player,
        "_type": f"dino{player + 1}",
        "movePoints": 3,
        "visibility": 1,
        "hasMoved": False,
    }


@pytest.fixture
def user3(db):
    return get_user_model().objects.create_user(username="testuser3", password="TestPass123!")


@pytest.fixture
def three_player_game(db, user, user2, user3):
    """Seats 0/1/2, each with a base + a unit, far apart. Fog off."""
    width, height = 9, 9
    field = blank_field(width, height)
    for seat, (x, y) in enumerate([(0, 0), (4, 4), (8, 8)]):
        field[x][y]["building"] = {"player": seat, "_type": "base"}
        field[x][y]["unit"] = unit(seat)

    game = Game.objects.create(
        game_code="elim01",
        status="playing",
        turn_player=user,
        settings={
            "width": width,
            "height": height,
            "fogOfWarRadius": 1,
            "enableFogOfWar": False,
            "minSpeed": 1,
            "maxSpeed": 5,
            "maxUnitsNum": 5,
            "maxBasesNum": 3,
            "buildingRates": {"base": 0},
        },
        field=field,
    )
    GamePlayer.objects.create(game=game, player=user, order=0)
    GamePlayer.objects.create(game=game, player=user2, order=1)
    GamePlayer.objects.create(game=game, player=user3, order=2)
    return game


def wipe_seat(game, seat):
    """Remove everything belonging to `seat` — i.e. eliminate them."""
    field = game.field
    for col in field:
        for cell in col:
            if cell.get("unit") and cell["unit"]["player"] == seat:
                cell["unit"] = None
            if cell.get("building") and cell["building"]["player"] == seat:
                cell["building"] = None
    game.field = field
    game.save(update_fields=["field"])


class TestActivePlayers:
    def test_all_three_start_active(self, three_player_game):
        assert get_active_players(three_player_game.field, 9, 9) == {0, 1, 2}

    def test_wiping_a_seat_drops_it(self, three_player_game):
        wipe_seat(three_player_game, 1)
        assert get_active_players(three_player_game.field, 9, 9) == {0, 2}

    def test_a_base_alone_keeps_a_player_alive(self, three_player_game):
        field = three_player_game.field
        field[4][4]["unit"] = None  # seat 1 keeps only its base
        three_player_game.field = field
        assert 1 in get_active_players(three_player_game.field, 9, 9)

    def test_an_occupied_base_still_keeps_you_in_the_game(self, three_player_game):
        """Multiplayer treats a parked opponent as a stalemate, not a
        defeat — another player may drive them off and free the base, so
        the owner keeps their seat. (Single-player calls the same
        situation a loss; see FieldEngine.hasPlayableAssets.)"""
        field = three_player_game.field
        field[4][4]["unit"] = unit(0)  # seat 0's dino sits on seat 1's base
        three_player_game.field = field
        assert 1 in get_active_players(three_player_game.field, 9, 9)

    def test_losing_everything_does_drop_you(self, three_player_game):
        field = three_player_game.field
        field[4][4]["unit"] = None
        field[4][4]["building"] = None
        three_player_game.field = field
        assert 1 not in get_active_players(three_player_game.field, 9, 9)


class TestPlayableProbe:
    def test_a_unit_or_a_free_base_makes_you_playable(self, three_player_game):
        assert get_playable_players(three_player_game.field, 9, 9) == {0, 1, 2}

    def test_only_occupied_bases_means_nothing_to_do(self, three_player_game):
        field = three_player_game.field
        field[4][4]["unit"] = unit(0)  # seat 0 parked on seat 1's only base
        three_player_game.field = field
        playable = get_playable_players(three_player_game.field, 9, 9)
        assert 1 not in playable
        # ...but seat 1 has NOT lost the game.
        assert 1 in get_active_players(three_player_game.field, 9, 9)

    def test_a_free_base_alone_is_playable(self, three_player_game):
        field = three_player_game.field
        field[4][4]["unit"] = None  # seat 1 keeps only an empty base
        three_player_game.field = field
        assert 1 in get_playable_players(three_player_game.field, 9, 9)


class TestSkippingPlayersWhoCannotMove:
    def test_a_player_with_only_an_occupied_base_is_skipped(self, three_player_game, user, user3):
        field = three_player_game.field
        field[4][4]["unit"] = unit(0)  # seat 0 parked on seat 1's only base
        three_player_game.field = field
        three_player_game.save(update_fields=["field"])

        ok, res = apply_end_turn_txn(
            game_code=three_player_game.game_code, user_id=user.id, client_seq=1
        )
        assert ok, res
        three_player_game.refresh_from_db()
        # Seat 1 has nothing to move, so the turn goes on to seat 2 —
        # without declaring seat 1 out.
        assert three_player_game.turn_player_id == user3.id
        assert res["patch"]["currentPlayer"] == 2
        assert not res["patch"].get("newlyEliminated")

    def test_the_skipped_player_rejoins_once_their_base_is_free(
        self, three_player_game, user, user2, user3
    ):
        field = three_player_game.field
        field[4][4]["unit"] = unit(0)
        three_player_game.field = field
        three_player_game.save(update_fields=["field"])
        apply_end_turn_txn(game_code=three_player_game.game_code, user_id=user.id, client_seq=1)

        # The occupier leaves; seat 1 can spawn again.
        three_player_game.refresh_from_db()
        field = three_player_game.field
        field[4][4]["unit"] = None
        three_player_game.field = field
        three_player_game.save(update_fields=["field"])

        # Rotation wraps 2 → 0 → 1, so seat 1's turn comes round after
        # seat 0 plays. The point is that it comes round at all.
        apply_end_turn_txn(game_code=three_player_game.game_code, user_id=user3.id, client_seq=2)
        ok, res = apply_end_turn_txn(
            game_code=three_player_game.game_code, user_id=user.id, client_seq=3
        )
        assert ok, res
        three_player_game.refresh_from_db()
        assert three_player_game.turn_player_id == user2.id
        assert res["patch"]["currentPlayer"] == 1


class TestRotationSkipsEliminated:
    def test_compute_next_player_skips_the_eliminated_seat(
        self, three_player_game, user, user2, user3
    ):
        # Seat 1 is out: 0 → 2, never 1.
        assert compute_next_player(three_player_game, user.id, {1}) == user3.id
        assert compute_next_player(three_player_game, user3.id, {1}) == user.id

    def test_end_turn_hands_the_turn_past_the_eliminated_seat(self, three_player_game, user, user3):
        wipe_seat(three_player_game, 1)
        ok, res = apply_end_turn_txn(
            game_code=three_player_game.game_code, user_id=user.id, client_seq=1
        )
        assert ok, res
        three_player_game.refresh_from_db()
        # Seat 1 skipped entirely — the turn goes straight to seat 2.
        assert three_player_game.turn_player_id == user3.id
        assert res["patch"]["currentPlayer"] == 2

    def test_the_skip_holds_for_later_rounds(self, three_player_game, user, user3):
        wipe_seat(three_player_game, 1)
        apply_end_turn_txn(game_code=three_player_game.game_code, user_id=user.id, client_seq=1)
        # Seat 2 ends their turn: back to seat 0, still skipping seat 1.
        ok, res = apply_end_turn_txn(
            game_code=three_player_game.game_code, user_id=user3.id, client_seq=2
        )
        assert ok, res
        three_player_game.refresh_from_db()
        assert three_player_game.turn_player_id == user.id
        assert res["patch"]["currentPlayer"] == 0

    def test_the_move_that_knocks_a_player_out_reports_it(self, three_player_game, user):
        """The consumer turns `newlyEliminated` into a per-recipient
        `youLose`, which is what flips that client into spectator mode —
        so the elimination has to be reported by the transaction that
        causes it, not noticed later."""
        # Seat 1 holds only a base; seat 0 walks onto it and captures.
        field = three_player_game.field
        field[4][4]["unit"] = None
        field[3][4]["unit"] = unit(0)
        three_player_game.field = field
        three_player_game.save(update_fields=["field"])

        ok, res = apply_move_txn(
            game_code=three_player_game.game_code,
            user_id=user.id,
            payload={"fromCoords": [3, 4], "toCoords": [4, 4]},
            client_seq=1,
        )
        assert ok, res
        assert res["patch"].get("newlyEliminated") == [1]

    def test_an_already_eliminated_seat_is_not_re_reported(self, three_player_game, user, user3):
        """`newlyEliminated` is a per-transaction diff. A player already
        out stays out without re-firing — the consumer keeps them a
        spectator via its own `is_already_spectator` check."""
        wipe_seat(three_player_game, 1)
        apply_end_turn_txn(game_code=three_player_game.game_code, user_id=user.id, client_seq=1)
        ok, res = apply_end_turn_txn(
            game_code=three_player_game.game_code, user_id=user3.id, client_seq=2
        )
        assert ok, res
        assert not res["patch"].get("newlyEliminated")

    def test_last_player_standing_ends_the_game(self, three_player_game, user):
        wipe_seat(three_player_game, 1)
        wipe_seat(three_player_game, 2)
        ok, res = apply_end_turn_txn(
            game_code=three_player_game.game_code, user_id=user.id, client_seq=1
        )
        assert ok, res
        assert res["patch"].get("winner") == 0 or res["patch"].get("gameEnded")


class TestWinningByOccupation:
    """Occupation is asymmetric: it never loses the game for the occupied
    player, but it can win it for the occupier. Once every rival is out of
    units with every tower of theirs sat on, nobody else can move again."""

    def test_the_sole_player_who_can_still_act_has_won(self, three_player_game):
        field = three_player_game.field
        # Seat 0 parks units on the other two seats' only towers.
        field[4][4]["unit"] = unit(0)
        field[8][8]["unit"] = unit(0)
        three_player_game.field = field

        # Nobody is "eliminated" — seats 1 and 2 still own their towers...
        assert get_active_players(field, 9, 9) == {0, 1, 2}
        # ...but only seat 0 can act, so seat 0 has won.
        assert get_playable_players(field, 9, 9) == {0}
        assert check_game_ended(field, 9, 9) == 0

    def test_an_unoccupied_tower_keeps_the_game_alive(self, three_player_game):
        field = three_player_game.field
        field[4][4]["unit"] = unit(0)  # seat 1 suppressed
        field[8][8]["unit"] = None  # seat 2 has a free tower — still in it
        three_player_game.field = field
        assert check_game_ended(field, 9, 9) is None

    def test_a_rival_with_units_keeps_the_game_alive(self, three_player_game):
        field = three_player_game.field
        field[4][4]["unit"] = unit(0)
        field[8][8]["unit"] = unit(0)
        field[2][2]["unit"] = unit(2)  # seat 2 still has a dino in the field
        three_player_game.field = field
        assert check_game_ended(field, 9, 9) is None

    def test_the_move_that_completes_the_occupation_ends_the_game(self, three_player_game, user):
        field = three_player_game.field
        # Seats 1 and 2 hold only towers, no units. Seat 0 already sits on
        # seat 2's; one step onto seat 1's finishes the job.
        field[4][4]["unit"] = None
        field[8][8]["unit"] = unit(0)
        field[3][4]["unit"] = unit(0)
        three_player_game.field = field
        three_player_game.save(update_fields=["field"])

        ok, res = apply_move_txn(
            game_code=three_player_game.game_code,
            user_id=user.id,
            payload={"fromCoords": [3, 4], "toCoords": [4, 4]},
            client_seq=1,
        )
        assert ok, res
        assert res["patch"].get("gameEnded") is True
        assert res["patch"].get("winner") == 0
