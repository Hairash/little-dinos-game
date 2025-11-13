from game.models import Game, GamePlayer, Move
from django.contrib import admin


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ["game_code", "created_at", "turn_player"]
    search_fields = ["game_code"]
    list_filter = ["created_at"]

@admin.register(GamePlayer)
class GamePlayerAdmin(admin.ModelAdmin):
    list_display = ["game", "player", "order"]
    search_fields = ["game__game_code", "player__username"]
    list_filter = ["game__created_at"]

@admin.register(Move)
class MoveAdmin(admin.ModelAdmin):
    list_display = ["game", "player", "payload", "client_seq", "server_tick", "created_at"]
    search_fields = ["game__game_code", "player__username"]
    list_filter = ["game__created_at", "created_at"]
