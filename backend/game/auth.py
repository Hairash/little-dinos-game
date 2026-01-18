import json
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt  # for dev only; remove later
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.conf import settings
from .jwt_utils import generate_jwt_token

User = get_user_model()


def _body(request):
    try:
        return json.loads(request.body.decode() or "{}")
    except:
        return {}


@csrf_exempt  # DEV ONLY; replace with proper CSRF handling in prod
@require_POST
def signup(request):
    data = _body(request)
    username = data.get("username", "").strip()
    password = data.get("password", "")
    if not username or not password:
        return JsonResponse({"detail": "username and password required"}, status=400)
    if User.objects.filter(username=username).exists():
        return JsonResponse({"detail": "username taken"}, status=400)
    try:
        validate_password(password)
    except ValidationError as e:
        return JsonResponse({"detail": " ".join(e.messages)}, status=400)

    user = User.objects.create_user(username=username, password=password)
    
    # Generate JWT token
    token = generate_jwt_token(user)
    
    return JsonResponse(
        {"ok": True, "user": {"id": user.id, "username": user.username}, "token": token}
    )


@csrf_exempt  # DEV ONLY; replace with proper CSRF handling in prod
@require_POST
def signin(request):
    data = _body(request)
    user = authenticate(
        request, username=data.get("username", ""), password=data.get("password", "")
    )
    if not user:
        return JsonResponse({"detail": "invalid credentials"}, status=401)
    
    # Generate JWT token
    token = generate_jwt_token(user)
    
    return JsonResponse(
        {"ok": True, "user": {"id": user.id, "username": user.username}, "token": token}
    )


@csrf_exempt  # DEV ONLY; replace with proper CSRF handling in prod
@require_POST
def signout(request):
    # Clear session cookies for backward compatibility (users who signed in before JWT migration)
    if hasattr(request, 'session'):
        # Clear session data
        request.session.flush()
        # Also try to delete the session cookie explicitly
        logout(request)  # Django's logout clears session
    
    response = JsonResponse({"ok": True})
    
    # Explicitly delete session cookie (for backward compatibility)
    # This ensures old session cookies are cleared even if session was already cleared
    response.set_cookie(
        settings.SESSION_COOKIE_NAME,
        '',
        max_age=0,  # Expire immediately
        path=settings.SESSION_COOKIE_PATH,
        domain=settings.SESSION_COOKIE_DOMAIN,
        secure=settings.SESSION_COOKIE_SECURE,
        httponly=settings.SESSION_COOKIE_HTTPONLY,
        samesite=settings.SESSION_COOKIE_SAMESITE,
    )
    
    # Note: JWT token clearing is handled client-side (localStorage.removeItem)
    # JWT is stateless, so no server-side action needed for JWT
    
    return response


@csrf_exempt  # GET requests with credentials from different origin may need this
def whoami(request):
    # Check JWT token from Authorization header
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]  # Remove 'Bearer ' prefix
        from .jwt_utils import get_user_from_token
        user = get_user_from_token(token)
        if user:
            return JsonResponse(
                {
                    "auth": True,
                    "user": {"id": user.id, "username": user.username},
                }
            )
    
    # Fallback to session-based auth (for backward compatibility)
    if request.user.is_authenticated:
        return JsonResponse(
            {
                "auth": True,
                "user": {"id": request.user.id, "username": request.user.username},
            }
        )
    return JsonResponse({"auth": False})
