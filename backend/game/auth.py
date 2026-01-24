import json
from django.http import JsonResponse
from django.views.decorators.http import require_POST
# Note: @csrf_exempt is safe for auth endpoints because:
# 1. signin/signup: These issue JWT tokens, not cookies - no existing auth to protect
# 2. signout: JWT clearing is client-side only (stateless)
# CSRF attacks require existing authenticated sessions to exploit, which these endpoints don't use
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from .jwt_utils import generate_jwt_token

User = get_user_model()


def _body(request):
    try:
        return json.loads(request.body.decode() or "{}")
    except:
        return {}


@csrf_exempt  # Safe: endpoint issues tokens, no existing auth session to protect
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


@csrf_exempt  # Safe: endpoint issues tokens, no existing auth session to protect
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


@csrf_exempt  # Safe: JWT is stateless, no server-side state to destroy
@require_POST
def signout(request):
    # JWT tokens are stateless and cleared client-side (localStorage.removeItem)
    # No server-side action needed - just return success
    return JsonResponse({"ok": True})


@csrf_exempt  # Safe: GET request that only reads auth state, no state changes
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
    
    # No JWT token found or invalid token
    return JsonResponse({"auth": False})
