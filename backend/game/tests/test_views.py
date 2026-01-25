"""
Tests for game API endpoints.
"""

import pytest

from game.models import Game, GamePlayer
from server.utils.jwt import generate_jwt_token


class TestCreateGame:
    def test_create_game_requires_auth(self, api_client):
        response = api_client.post("/games/")
        assert response.status_code == 401

    def test_create_game_success(self, api_client, auth_headers):
        response = api_client.post("/games/", **auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "gameCode" in data
        assert len(data["gameCode"]) == 8  # secrets.token_hex(4) = 8 chars

    def test_create_game_adds_creator_as_player(self, api_client, auth_headers, user, db):
        response = api_client.post("/games/", **auth_headers)
        game_code = response.json()["gameCode"]

        game = Game.objects.get(game_code=game_code)
        players = GamePlayer.objects.filter(game=game)
        assert players.count() == 1
        first_player = players.first()
        assert first_player is not None
        assert first_player.player == user
        assert first_player.order == 0

    def test_create_game_sets_turn_player(self, api_client, auth_headers, user, db):
        response = api_client.post("/games/", **auth_headers)
        game_code = response.json()["gameCode"]

        game = Game.objects.get(game_code=game_code)
        assert game.turn_player == user


class TestJoinGame:
    @pytest.fixture
    def game(self, user, db):
        game = Game.objects.create(game_code="testcode")
        GamePlayer.objects.create(game=game, player=user, order=0)
        game.turn_player = user
        game.save(update_fields=["turn_player"])
        return game

    def test_join_game_requires_auth(self, api_client, game):
        response = api_client.post(f"/games/{game.game_code}/join/")
        assert response.status_code == 401

    def test_join_game_success(self, api_client, game, user2):
        token = generate_jwt_token(user2)
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        response = api_client.post(f"/games/{game.game_code}/join/", **headers)
        assert response.status_code == 200

        # Verify player was added
        assert GamePlayer.objects.filter(game=game, player=user2).exists()

    def test_join_game_already_joined(self, api_client, game, auth_headers):
        # User is already in game (from fixture)
        response = api_client.post(f"/games/{game.game_code}/join/", **auth_headers)
        assert response.status_code == 200
        assert "Already" in response.json()["message"]

    def test_join_game_assigns_correct_order(self, api_client, game, user2):
        token = generate_jwt_token(user2)
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        api_client.post(f"/games/{game.game_code}/join/", **headers)

        player2 = GamePlayer.objects.get(game=game, player=user2)
        assert player2.order == 1  # Second player gets order 1


class TestLeaveGame:
    @pytest.fixture
    def game_with_two_players(self, user, user2, db):
        game = Game.objects.create(game_code="leavecode")
        GamePlayer.objects.create(game=game, player=user, order=0)
        GamePlayer.objects.create(game=game, player=user2, order=1)
        game.turn_player = user
        game.save(update_fields=["turn_player"])
        return game

    def test_leave_game_success(self, api_client, game_with_two_players, user2):
        token = generate_jwt_token(user2)
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        response = api_client.post(f"/games/{game_with_two_players.game_code}/leave/", **headers)
        assert response.status_code == 200
        assert not GamePlayer.objects.filter(game=game_with_two_players, player=user2).exists()

    def test_leave_game_not_in_game(self, api_client, user, db):
        game = Game.objects.create(game_code="notincode")
        token = generate_jwt_token(user)
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        response = api_client.post(f"/games/{game.game_code}/leave/", **headers)
        assert response.status_code == 400

    def test_cannot_leave_started_game(self, api_client, game_with_two_players, user2):
        game_with_two_players.status = "playing"
        game_with_two_players.save()

        token = generate_jwt_token(user2)
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        response = api_client.post(f"/games/{game_with_two_players.game_code}/leave/", **headers)
        assert response.status_code == 400


class TestGetGame:
    @pytest.fixture
    def game(self, user, db):
        game = Game.objects.create(game_code="getcode")
        GamePlayer.objects.create(game=game, player=user, order=0)
        game.turn_player = user
        game.save(update_fields=["turn_player"])
        return game

    def test_get_game_requires_auth(self, api_client, game):
        response = api_client.get(f"/games/{game.game_code}/")
        assert response.status_code == 401

    def test_get_game_success(self, api_client, game, auth_headers):
        response = api_client.get(f"/games/{game.game_code}/", **auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["gameCode"] == game.game_code

    def test_get_game_not_participant(self, api_client, game, user2):
        token = generate_jwt_token(user2)
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        response = api_client.get(f"/games/{game.game_code}/", **headers)
        assert response.status_code == 403

    def test_get_game_not_found(self, api_client, auth_headers):
        response = api_client.get("/games/nonexistent/", **auth_headers)
        assert response.status_code == 404


class TestGetActiveGames:
    def test_get_active_games_requires_auth(self, api_client):
        response = api_client.get("/games/active/")
        assert response.status_code == 401

    def test_get_active_games_empty(self, api_client, auth_headers, db):
        response = api_client.get("/games/active/", **auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["games"] == []
        assert data["total"] == 0

    def test_get_active_games_returns_playing_games(self, api_client, auth_headers, user, db):
        # Create a playing game
        game = Game.objects.create(game_code="active1", status="playing")
        GamePlayer.objects.create(game=game, player=user, order=0)

        response = api_client.get("/games/active/", **auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["games"]) == 1
        assert data["games"][0]["gameCode"] == "active1"

    def test_get_active_games_excludes_ready_games(self, api_client, auth_headers, user, db):
        # Create a game in ready status (not started)
        game = Game.objects.create(game_code="ready1", status="ready")
        GamePlayer.objects.create(game=game, player=user, order=0)

        response = api_client.get("/games/active/", **auth_headers)
        assert response.status_code == 200
        assert len(response.json()["games"]) == 0

    def test_get_active_games_respects_limit(self, api_client, auth_headers, user, db):
        # Create multiple games
        for i in range(15):
            game = Game.objects.create(game_code=f"game{i:02d}", status="playing")
            GamePlayer.objects.create(game=game, player=user, order=0)

        response = api_client.get("/games/active/?limit=5", **auth_headers)
        data = response.json()
        assert len(data["games"]) == 5
        assert data["total"] == 15
        assert data["hasMore"] is True
