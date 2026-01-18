from functools import wraps
from django.http import JsonResponse
from django.contrib.auth.decorators import user_passes_test
from .jwt_utils import get_user_from_token


def login_required_json(view_func):
    """
    Decorator that returns 401 JSON instead of redirecting for unauthenticated users.
    Use this for API endpoints instead of @login_required.
    Supports JWT token authentication via Authorization header.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # Check JWT token from Authorization header first
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]  # Remove 'Bearer ' prefix
            user = get_user_from_token(token)
            if user:
                request.user = user  # Set user for the view
                return view_func(request, *args, **kwargs)
        
        # Fallback to session-based auth (for backward compatibility)
        if request.user.is_authenticated:
            return view_func(request, *args, **kwargs)
        
        return JsonResponse({"detail": "Authentication required"}, status=401)
    return _wrapped_view

