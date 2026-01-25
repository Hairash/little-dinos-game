"""
Tests for authentication endpoints (signup, signin, signout, whoami).
"""

import json


class TestSignup:
    def test_signup_success(self, api_client, db):
        response = api_client.post(
            "/auth/signup/",
            data=json.dumps({"username": "newuser", "password": "SecurePass123!"}),
            content_type="application/json",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert "token" in data
        assert "user" in data
        assert data["user"]["username"] == "newuser"

    def test_signup_returns_valid_token(self, api_client, db):
        response = api_client.post(
            "/auth/signup/",
            data=json.dumps({"username": "tokenuser", "password": "SecurePass123!"}),
            content_type="application/json",
        )
        data = response.json()
        token = data["token"]

        # Use the token to verify it works
        whoami_response = api_client.get("/auth/whoami/", HTTP_AUTHORIZATION=f"Bearer {token}")
        assert whoami_response.json()["auth"] is True

    def test_signup_duplicate_username(self, api_client, user):
        response = api_client.post(
            "/auth/signup/",
            data=json.dumps({"username": user.username, "password": "SecurePass123!"}),
            content_type="application/json",
        )
        assert response.status_code == 400
        assert "taken" in response.json()["detail"]

    def test_signup_missing_username(self, api_client, db):
        response = api_client.post(
            "/auth/signup/",
            data=json.dumps({"password": "SecurePass123!"}),
            content_type="application/json",
        )
        assert response.status_code == 400

    def test_signup_missing_password(self, api_client, db):
        response = api_client.post(
            "/auth/signup/",
            data=json.dumps({"username": "nopassuser"}),
            content_type="application/json",
        )
        assert response.status_code == 400

    def test_signup_weak_password(self, api_client, db):
        response = api_client.post(
            "/auth/signup/",
            data=json.dumps({"username": "weakuser", "password": "123"}),
            content_type="application/json",
        )
        assert response.status_code == 400


class TestSignin:
    def test_signin_success(self, api_client, user):
        response = api_client.post(
            "/auth/signin/",
            data=json.dumps({"username": "testuser", "password": "TestPass123!"}),
            content_type="application/json",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert "token" in data
        assert data["user"]["username"] == "testuser"

    def test_signin_returns_valid_token(self, api_client, user):
        response = api_client.post(
            "/auth/signin/",
            data=json.dumps({"username": "testuser", "password": "TestPass123!"}),
            content_type="application/json",
        )
        token = response.json()["token"]

        # Verify token works
        whoami_response = api_client.get("/auth/whoami/", HTTP_AUTHORIZATION=f"Bearer {token}")
        assert whoami_response.json()["auth"] is True

    def test_signin_invalid_username(self, api_client, db):
        response = api_client.post(
            "/auth/signin/",
            data=json.dumps({"username": "nonexistent", "password": "TestPass123!"}),
            content_type="application/json",
        )
        assert response.status_code == 401

    def test_signin_invalid_password(self, api_client, user):
        response = api_client.post(
            "/auth/signin/",
            data=json.dumps({"username": "testuser", "password": "wrongpassword"}),
            content_type="application/json",
        )
        assert response.status_code == 401

    def test_signin_empty_credentials(self, api_client, db):
        response = api_client.post(
            "/auth/signin/",
            data=json.dumps({"username": "", "password": ""}),
            content_type="application/json",
        )
        assert response.status_code == 401


class TestSignout:
    def test_signout_success(self, api_client):
        response = api_client.post("/auth/signout/")
        assert response.status_code == 200
        assert response.json()["ok"] is True


class TestWhoami:
    def test_whoami_authenticated(self, api_client, auth_headers, user):
        response = api_client.get("/auth/whoami/", **auth_headers)
        data = response.json()
        assert data["auth"] is True
        assert data["user"]["id"] == user.id
        assert data["user"]["username"] == user.username

    def test_whoami_not_authenticated(self, api_client):
        response = api_client.get("/auth/whoami/")
        data = response.json()
        assert data["auth"] is False
        assert "user" not in data

    def test_whoami_invalid_token(self, api_client):
        response = api_client.get("/auth/whoami/", HTTP_AUTHORIZATION="Bearer invalid-token")
        data = response.json()
        assert data["auth"] is False
