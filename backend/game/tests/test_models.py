"""
Tests for Django models.
"""

import pytest
from django.contrib.auth import get_user_model
from django.db.utils import IntegrityError

from game.models import Game, GamePlayer, Move

User = get_user_model()


@pytest.mark.django_db
class TestGame:
    """Test Game model."""

    def test_create_game(self):
        """Can create a game."""
        game = Game.objects.create(
            game_code="test123", status="ready", settings={"width": 20, "height": 20}
        )
        assert game.game_code == "test123"
        assert game.status == "ready"
        assert game.settings == {"width": 20, "height": 20}

    def test_game_str(self):
        """Game string representation."""
        game = Game.objects.create(game_code="test123")
        assert str(game) == "Game test123"

    def test_game_to_dict(self, user):
        """Game serialization includes players."""
        game = Game.objects.create(game_code="test123", status="ready", turn_player=user)
        GamePlayer.objects.create(game=game, player=user, order=0)

        game_dict = game.to_dict()
        assert game_dict["gameCode"] == "test123"
        assert game_dict["status"] == "ready"
        assert game_dict["turnPlayer"] == user.username
        assert len(game_dict["players"]) == 1
        assert game_dict["players"][0]["username"] == user.username
        assert game_dict["players"][0]["order"] == 0

    def test_game_default_status(self):
        """Game defaults to ready status."""
        game = Game.objects.create(game_code="test123")
        assert game.status == "ready"


@pytest.mark.django_db
class TestGamePlayer:
    """Test GamePlayer model."""

    def test_create_game_player(self, game, user):
        """Can create a game player."""
        game_player = GamePlayer.objects.create(game=game, player=user, order=1)
        assert game_player.game == game
        assert game_player.player == user
        assert game_player.order == 1

    def test_game_player_str(self, game, user):
        """GamePlayer string representation."""
        game_player = GamePlayer.objects.create(game=game, player=user, order=0)
        assert str(game_player) == f"{user} in Game {game.game_code} (order 0)"

    def test_game_player_unique_together(self, game, user):
        """Cannot add same player to game twice."""
        GamePlayer.objects.create(game=game, player=user, order=0)

        with pytest.raises(IntegrityError):
            GamePlayer.objects.create(game=game, player=user, order=1)

    def test_game_player_unique_order(self, game, user, user2):
        """Cannot have two players with same order."""
        GamePlayer.objects.create(game=game, player=user, order=0)

        with pytest.raises(IntegrityError):
            GamePlayer.objects.create(game=game, player=user2, order=0)

    def test_game_player_scout_revealed_coords(self, game, user):
        """Can store scout revealed coordinates."""
        coords = [[1, 2], [3, 4], [5, 6]]
        game_player = GamePlayer.objects.create(
            game=game, player=user, order=0, scout_revealed_coords=coords
        )
        assert game_player.scout_revealed_coords == coords

    def test_game_player_default_scout_coords(self, game, user):
        """Scout revealed coords defaults to empty list."""
        game_player = GamePlayer.objects.create(game=game, player=user, order=0)
        assert game_player.scout_revealed_coords == []


@pytest.mark.django_db
class TestMove:
    """Test Move model."""

    def test_create_move(self, game, user):
        """Can create a move."""
        move = Move.objects.create(
            game=game,
            player=user,
            payload={"action": "move", "from": [0, 0], "to": [1, 1]},
            client_seq=1,
            server_tick=1234567890,
        )
        assert move.game == game
        assert move.player == user
        assert move.client_seq == 1
        assert move.payload == {"action": "move", "from": [0, 0], "to": [1, 1]}

    def test_move_str(self, game, user):
        """Move string representation."""
        move = Move.objects.create(
            game=game, player=user, payload={}, client_seq=42, server_tick=1234567890
        )
        assert str(move) == f"Move 42 by {user} in Game {game.game_code}"

    def test_move_unique_together(self, game, user):
        """Cannot create duplicate move (same game, player, client_seq)."""
        Move.objects.create(
            game=game, player=user, payload={}, client_seq=1, server_tick=1234567890
        )

        with pytest.raises(IntegrityError):
            Move.objects.create(
                game=game,
                player=user,
                payload={},
                client_seq=1,  # Same client_seq
                server_tick=1234567891,
            )

    def test_move_different_players_same_seq(self, game, user, user2):
        """Different players can have same client_seq."""
        Move.objects.create(
            game=game, player=user, payload={}, client_seq=1, server_tick=1234567890
        )
        # Should not raise - different players
        move2 = Move.objects.create(
            game=game, player=user2, payload={}, client_seq=1, server_tick=1234567891
        )
        assert move2.client_seq == 1
