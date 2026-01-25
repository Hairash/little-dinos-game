"""
JWT utility functions for authentication.
"""

import time

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

JWT_SECRET = settings.JWT_SECRET_KEY
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_SECONDS = 365 * 24 * 60 * 60  # 1 year


def generate_jwt_token(user):
    """
    Generate a JWT token for a user.

    Args:
        user: Django User instance

    Returns:
        str: JWT token
    """
    payload = {
        "user_id": user.id,
        "username": user.username,
        "iat": int(time.time()),  # Issued at
        "exp": int(time.time()) + JWT_EXPIRATION_SECONDS,  # Expiration
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token


def decode_jwt_token(token):
    """
    Decode and validate a JWT token.

    Args:
        token: JWT token string

    Returns:
        dict: Decoded payload if valid, None if invalid
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_user_from_token(token):
    """
    Get User instance from JWT token.

    Args:
        token: JWT token string

    Returns:
        User: User instance if token is valid, None otherwise
    """
    payload = decode_jwt_token(token)
    if payload and "user_id" in payload:
        try:
            return User.objects.get(pk=payload["user_id"])
        except User.DoesNotExist:
            return None
    return None
