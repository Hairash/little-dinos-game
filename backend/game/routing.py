from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r"^ws/game/(?P<game_code>[A-Za-z0-9_-]+)/$", consumers.GameConsumer.as_asgi()),
    re_path(r"^ws/lobby/(?P<game_code>[A-Za-z0-9_-]+)/$", consumers.LobbyConsumer.as_asgi()),
]
