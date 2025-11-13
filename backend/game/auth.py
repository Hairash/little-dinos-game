import json
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt  # for dev only; remove later
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

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
    login(request, user)  # create session immediately
    return JsonResponse(
        {"ok": True, "user": {"id": user.id, "username": user.username}}
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
    login(request, user)
    return JsonResponse(
        {"ok": True, "user": {"id": user.id, "username": user.username}}
    )


@csrf_exempt  # DEV ONLY; replace with proper CSRF handling in prod
@require_POST
def signout(request):
    logout(request)
    return JsonResponse({"ok": True})


def whoami(request):
    if request.user.is_authenticated:
        return JsonResponse(
            {
                "auth": True,
                "user": {"id": request.user.id, "username": request.user.username},
            }
        )
    return JsonResponse({"auth": False})
