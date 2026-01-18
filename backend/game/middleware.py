"""
Custom WebSocket middleware for JWT authentication.
Supports both JWT tokens (for iOS WebKit) and session-based auth (fallback).

Security Note: We accept tokens from query string as a fallback, but prefer
Authorization header or first message authentication for better security.
Query strings can be logged and visible in browser history.
"""
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from .jwt_utils import get_user_from_token


@database_sync_to_async
def get_user_from_token_async(token):
    """Async wrapper for get_user_from_token."""
    return get_user_from_token(token)


class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware to authenticate WebSocket connections using JWT tokens.
    
    Security: Prefers Authorization header over query string.
    Query string tokens are less secure (can be logged, visible in history).
    For maximum security, use Authorization header or send token in first message.
    """
    async def __call__(self, scope, receive, send):
        # Only process WebSocket connections
        if scope['type'] == 'websocket':
            token = None
            
            # First, try Authorization header (most secure - not in logs/history)
            headers = dict(scope.get('headers', []))
            auth_header = headers.get(b'authorization', b'').decode()
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]
            
            # Fallback: query string (less secure but widely supported)
            # WARNING: Query strings are logged and visible in browser history
            # Only use this if Authorization header is not supported
            if not token:
                query_string = scope.get('query_string', b'').decode()
                if query_string:
                    params = dict(param.split('=') for param in query_string.split('&') if '=' in param)
                    token = params.get('token')
            
            # Validate token and set user
            if token:
                user = await get_user_from_token_async(token)
                if user:
                    scope['user'] = user
                else:
                    scope['user'] = AnonymousUser()
            else:
                # No token provided, use AnonymousUser
                # Consumer can authenticate via first message if needed
                scope['user'] = AnonymousUser()
        
        return await super().__call__(scope, receive, send)

