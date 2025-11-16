import json
import secrets
from django.http import JsonResponse
from django.db.models import Max
from django.db import transaction
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Game, GamePlayer
from .services.field import generate_field


@require_http_methods(["GET"])
def index(request):
    """Index page."""
    return render(request, 'index.html', context={
        'user': request.user if request.user.is_authenticated else None,
    })


@csrf_exempt  # DEV ONLY; replace with proper CSRF handling in prod
@login_required
@require_http_methods(["POST"])
def create_game(request):
    """Create a new game."""
    game_code = secrets.token_hex(4)
    # Initialize with turn=0 (not None) for consistency
    g = Game.objects.create(game_code=game_code)
    # Optionally add the requester as player 1 if authenticated
    if request.user.is_authenticated:
        GamePlayer.objects.create(game=g, player=request.user, order=0)
        g.turn_player = request.user
        g.save(update_fields=["turn_player"])
    
    # Broadcast initial player list to any connected clients
    channel_layer = get_channel_layer()
    if channel_layer:
        game_dict = g.to_dict()
        async_to_sync(channel_layer.group_send)(
            f"lobby_{game_code}",
            {
                "type": "player_update",
                "players": game_dict["players"],
            }
        )
    
    return JsonResponse({"gameCode": game_code})


@csrf_exempt  # DEV ONLY; replace with proper CSRF handling in prod
@login_required
@require_http_methods(["POST"])
def join_game(request, game_code):
    """Join a game."""
    game = Game.objects.get(game_code=game_code)
    if game.status != "ready":
        return JsonResponse({"error": "Game is not ready"}, status=400)
    
    # Check if player already joined
    existing = GamePlayer.objects.filter(game=game, player=request.user).first()
    if existing:
        return JsonResponse({"message": "Already in game"})
    
    # Get the next order number
    # Use select_for_update to prevent race conditions
    with transaction.atomic():
        max_order = GamePlayer.objects.filter(game=game).aggregate(
            max_order=Max('order')
        )['max_order']
        if max_order is None:
            next_order = 0
        else:
            next_order = max_order + 1
        
        # Double-check: ensure this order doesn't already exist (safety check)
        existing_order = GamePlayer.objects.filter(game=game, order=next_order).exists()
        if existing_order:
            # Find the first available order
            existing_orders = set(GamePlayer.objects.filter(game=game).values_list('order', flat=True))
            next_order = 0
            while next_order in existing_orders:
                next_order += 1
        
        GamePlayer.objects.create(game=game, player=request.user, order=next_order)
    
    # Reload game to get fresh players list
    game.refresh_from_db()
    
    # Broadcast player update to all connected clients
    channel_layer = get_channel_layer()
    if channel_layer:
        game_dict = game.to_dict()
        async_to_sync(channel_layer.group_send)(
            f"lobby_{game_code}",
            {
                "type": "player_update",
                "players": game_dict["players"],
            }
        )
    
    return JsonResponse({"message": "Joined game"})


@csrf_exempt  # DEV ONLY; replace with proper CSRF handling in prod
@login_required
@require_http_methods(["POST"])
def start_game(request, game_code):
    """Start a game."""
    print(f"Starting game {game_code}")
    initial_settings = request.body.decode('utf-8')
    print(f"Initial settings: {initial_settings}")
    game = Game.objects.get(game_code=game_code)
    if game.status != "ready":
        return JsonResponse({"error": "Game is not ready"}, status=400)
    game.status = "playing"
    settings_dict = json.loads(initial_settings)
    settings_dict['humanPlayersNum'] = GamePlayer.objects.filter(game=game).count()
    # TODO: Get bot players number
    settings_dict['botPlayersNum'] = 0
    game.settings = settings_dict
    game.field = generate_field(settings_dict)
    game.save(update_fields=["status", "settings", "field"])
    
    # Broadcast game state to all connected players in lobby
    # Note: Don't send field here - each player will get their filtered field when connecting to GameConsumer
    channel_layer = get_channel_layer()
    if channel_layer:
        # Create game state without field for security (each player gets filtered field from GameConsumer)
        game_state = {
            "gameCode": game.game_code,
            "status": game.status,
            "settings": game.settings,
            # field is NOT included - players will get filtered field from GameConsumer
            "turnPlayer": game.turn_player.username if game.turn_player else None,
            "players": [
                {
                    "id": gp.player.id,
                    "username": gp.player.username,
                    "order": gp.order,
                }
                for gp in game.players.select_related("player").order_by("order")
            ],
        }
        print(f"Broadcasting game started to lobby (without field): {game_state}")
        # Broadcast to lobby WebSocket group (players are connected to lobby)
        async_to_sync(channel_layer.group_send)(
            f"lobby_{game_code}",
            {
                "type": "game_started",
                "gameCode": game_code,
                "gameState": game_state,
            }
        )
    
    # Return response without field (field is only sent via GameConsumer)
    return JsonResponse({"message": "Started game", "game": game_state})


@login_required
@require_http_methods(["GET"])
def get_game(request, game_code):
    """Get a game."""
    game = Game.objects.get(game_code=game_code)
    return JsonResponse(game.to_dict())


@login_required
@require_http_methods(["GET"])
def get_active_games(request):
    """Get active (unfinished) games the user has joined."""
    # Find all games where:
    # 1. User is a player
    # 2. Game status is 'playing' (not 'ready' or 'ended')
    try:
        # Get limit parameter (default 10, 'all' means no limit)
        limit_param = request.GET.get('limit')
        
        game_players_query = GamePlayer.objects.filter(
            player=request.user,
            game__status='playing'
        ).select_related('game').order_by('-game__created_at')
        
        # Get total count before limiting
        total_count = game_players_query.count()
        
        # Apply limit: default to 10, or use 'all' to get everything
        if limit_param == 'all' or limit_param == 'null':
            # Load all games (no limit)
            game_players = game_players_query
        else:
            # Use provided limit or default to 10
            limit = int(limit_param) if limit_param else 10
            game_players = game_players_query[:limit]
        
        games = []
        for game_player in game_players:
            game = game_player.game
            games.append({
                "gameCode": game.game_code,
                "status": game.status,
                "settings": game.settings,
                "turnPlayer": game.turn_player.username if game.turn_player else None,
                "players": [
                    {
                        "id": gp.player.id,
                        "username": gp.player.username,
                        "order": gp.order,
                    }
                    for gp in game.players.select_related("player").order_by("order")
                ],
            })
        
        return JsonResponse({
            "games": games,
            "total": total_count,
            "hasMore": total_count > len(games)
        })
    except Exception as e:
        print(f"Error getting active games: {e}")
        return JsonResponse({"games": [], "total": 0, "hasMore": False})
