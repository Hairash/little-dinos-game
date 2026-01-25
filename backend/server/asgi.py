import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "server.settings")

from django.core.asgi import get_asgi_application

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter

from game.routing import websocket_urlpatterns
from server.utils.middleware import JWTAuthMiddleware

# Use JWT middleware for WebSocket authentication (works with iOS WebKit)
# JWT-only authentication - no session-based auth
application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
    }
)
