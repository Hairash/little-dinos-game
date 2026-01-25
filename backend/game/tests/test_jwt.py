"""
Tests for JWT utility functions.
"""

from server.utils.jwt import decode_jwt_token, generate_jwt_token, get_user_from_token


class TestGenerateJwtToken:
    def test_generates_string_token(self, user):
        token = generate_jwt_token(user)
        assert isinstance(token, str)
        assert len(token) > 0

    def test_token_contains_user_id(self, user):
        token = generate_jwt_token(user)
        payload = decode_jwt_token(token)
        assert payload["user_id"] == user.id

    def test_token_contains_username(self, user):
        token = generate_jwt_token(user)
        payload = decode_jwt_token(token)
        assert payload["username"] == user.username

    def test_token_has_issued_at(self, user):
        token = generate_jwt_token(user)
        payload = decode_jwt_token(token)
        assert "iat" in payload
        assert isinstance(payload["iat"], int)

    def test_token_has_expiration(self, user):
        token = generate_jwt_token(user)
        payload = decode_jwt_token(token)
        assert "exp" in payload
        assert payload["exp"] > payload["iat"]


class TestDecodeJwtToken:
    def test_decode_valid_token(self, user):
        token = generate_jwt_token(user)
        payload = decode_jwt_token(token)
        assert payload is not None
        assert payload["user_id"] == user.id

    def test_decode_invalid_token_returns_none(self):
        assert decode_jwt_token("invalid.token.here") is None

    def test_decode_empty_token_returns_none(self):
        assert decode_jwt_token("") is None

    def test_decode_malformed_token_returns_none(self):
        assert decode_jwt_token("not-a-jwt") is None


class TestGetUserFromToken:
    def test_get_user_from_valid_token(self, user):
        token = generate_jwt_token(user)
        retrieved_user = get_user_from_token(token)
        assert retrieved_user is not None
        assert retrieved_user.id == user.id
        assert retrieved_user.username == user.username

    def test_get_user_from_invalid_token_returns_none(self):
        assert get_user_from_token("invalid") is None

    def test_get_user_from_empty_token_returns_none(self):
        assert get_user_from_token("") is None

    def test_get_user_from_deleted_user_returns_none(self, user):
        token = generate_jwt_token(user)
        user.delete()
        # Token is still valid but user doesn't exist
        assert get_user_from_token(token) is None
