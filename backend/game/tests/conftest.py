"""
Pytest fixtures for game tests.
"""

import pytest
from django.contrib.auth import get_user_model

from server.utils.jwt import generate_jwt_token

User = get_user_model()


@pytest.fixture
def user(db):
    """Create a test user."""
    return User.objects.create_user(username="testuser", password="TestPass123!")


@pytest.fixture
def user2(db):
    """Create a second test user."""
    return User.objects.create_user(username="testuser2", password="TestPass123!")


@pytest.fixture
def auth_token(user):
    """Generate JWT token for test user."""
    return generate_jwt_token(user)


@pytest.fixture
def auth_headers(auth_token):
    """Return Authorization headers with Bearer token."""
    return {"HTTP_AUTHORIZATION": f"Bearer {auth_token}"}


@pytest.fixture
def api_client():
    """Return Django test client."""
    from django.test import Client

    return Client()


@pytest.fixture
def game(db, user):
    """Create a test game with a player."""
    from game.models import Game, GamePlayer

    game = Game.objects.create(
        game_code="test123", status="ready", turn_player=user, settings={"width": 20, "height": 20}
    )
    GamePlayer.objects.create(game=game, player=user, order=0)
    return game


@pytest.fixture
def game_without_player(db, user):
    """Create a test game without any players (for testing GamePlayer creation)."""
    from game.models import Game

    return Game.objects.create(
        game_code="test456", status="ready", turn_player=user, settings={"width": 20, "height": 20}
    )


@pytest.fixture
def small_field():
    """Create a small test field (5x5) for easier testing."""
    from game.services.visibility import TERRAIN_TYPES

    width, height = 5, 5
    field = []
    for _x in range(width):
        col = []
        for _y in range(height):
            cell = {
                "terrain": {
                    "kind": TERRAIN_TYPES["EMPTY"],
                    "idx": 1,
                },
                "building": None,
                "unit": None,
                "isHidden": False,
            }
            col.append(cell)
        field.append(col)
    return field, width, height
