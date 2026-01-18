import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "server.settings")

from django.core.asgi import get_asgi_application

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from game.routing import websocket_urlpatterns
from game.middleware import JWTAuthMiddleware

# Use JWT middleware for WebSocket authentication (works with iOS WebKit)
# Fallback to AuthMiddlewareStack for session-based auth if needed
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(websocket_urlpatterns)
    ),
})
