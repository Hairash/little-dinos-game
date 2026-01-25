"""
Tests for authentication decorators.
"""


class TestLoginRequiredJson:
    def test_returns_401_without_auth(self, api_client):
        response = api_client.post("/games/")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    def test_returns_401_with_invalid_token(self, api_client):
        response = api_client.post("/games/", HTTP_AUTHORIZATION="Bearer invalid-token")
        assert response.status_code == 401

    def test_returns_401_with_malformed_header(self, api_client):
        # Missing "Bearer " prefix
        response = api_client.post("/games/", HTTP_AUTHORIZATION="some-token")
        assert response.status_code == 401

    def test_allows_with_valid_token(self, api_client, auth_headers):
        response = api_client.post("/games/", **auth_headers)
        # Should not be 401 - game creation should work
        assert response.status_code != 401

    def test_sets_user_on_request(self, api_client, auth_headers, user):
        # Create game endpoint uses request.user
        response = api_client.post("/games/", **auth_headers)
        assert response.status_code == 200
        data = response.json()
        # If game created, user was set correctly on request
        assert "gameCode" in data
