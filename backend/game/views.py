import json
import logging
import secrets

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models import Max
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from server.utils.decorators import login_required_json

from .models import Game, GamePlayer, SavedMap
from .services.field import generate_field
from .services.map_snapshot import (
    capture_initial_snapshot,
    hydrate_field_for_game,
    occupied_seats,
    reconcile_seats,
    validate_map,
)

# Get logger for this module
logger = logging.getLogger(__name__)

# Upper bound for the start-game request body. The uploaded map is
# client-supplied JSON (picked from the creator's local storage), so a
# hard cap keeps a hostile client from feeding the JSON parser a huge
# document. A 50×50 canonical map is ~150 KB; 3 MB is generous headroom.
MAX_START_PAYLOAD_BYTES = 3_000_000

# Dimension/seat bounds for uploaded maps. Mirrors the editor's LIMITS
# (5–50 per side) and the engine-wide 8-player asset cap.
MAP_DIMENSION_MIN = 5
MAP_DIMENSION_MAX = 50
MAP_PLAYERS_MAX = 8

# Scratch range used while re-assigning seats at start: `(game, order)` is
# unique, so rows are parked out of the way before taking their real seat.
# Well clear of any seat index and inside PositiveSmallInteger's range.
SEAT_PARKING_BASE = 1000


def _broadcast_lobby_state(game):
    """Push the lobby's shared state (players + picked map) to its WS group."""
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    game_dict = game.to_dict()
    async_to_sync(channel_layer.group_send)(
        f"lobby_{game.game_code}",
        {
            "type": "player_update",
            "players": game_dict["players"],
            "pickedMapName": game.picked_map_name,
            "pickedMapSeats": game.picked_map_seats,
        },
    )


@require_http_methods(["GET"])
def index(request):
    """Index page."""
    return render(
        request,
        "index.html",
        context={
            "user": request.user if request.user.is_authenticated else None,
        },
    )


# Note: @csrf_exempt is safe here because JWT authentication is used via Authorization header.
# CSRF attacks exploit cookie-based auth; JWT tokens sent in headers are not vulnerable to CSRF.
# We use JWT-only authentication (no session cookies), so CSRF protection is not needed.
@csrf_exempt
@login_required_json
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
    _broadcast_lobby_state(g)

    return JsonResponse({"gameCode": game_code})


# Note: @csrf_exempt is safe here because JWT authentication is used via Authorization header.
@csrf_exempt
@login_required_json
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

    # Capacity block: when the creator picked a map, the lobby can't
    # grow beyond the map's seat count. (Start re-validates as a safety
    # net for a map picked after the lobby already overfilled.)
    if game.picked_map_seats:
        joined = GamePlayer.objects.filter(game=game).count()
        if joined >= game.picked_map_seats:
            return JsonResponse(
                {
                    "error": (
                        f'Map "{game.picked_map_name}" supports {game.picked_map_seats} '
                        "players — the lobby is full. Ask the creator to pick a bigger map."
                    )
                },
                status=400,
            )

    # Get the next order number
    # Use select_for_update to prevent race conditions
    with transaction.atomic():
        max_order = GamePlayer.objects.filter(game=game).aggregate(max_order=Max("order"))[
            "max_order"
        ]
        next_order = 0 if max_order is None else max_order + 1

        # Double-check: ensure this order doesn't already exist (safety check)
        existing_order = GamePlayer.objects.filter(game=game, order=next_order).exists()
        if existing_order:
            # Find the first available order
            existing_orders = set(
                GamePlayer.objects.filter(game=game).values_list("order", flat=True)
            )
            next_order = 0
            while next_order in existing_orders:
                next_order += 1

        GamePlayer.objects.create(game=game, player=request.user, order=next_order)

    # Reload game to get fresh players list
    game.refresh_from_db()

    # Broadcast player update to all connected clients
    _broadcast_lobby_state(game)

    return JsonResponse({"message": "Joined game"})


# Note: @csrf_exempt is safe here because JWT authentication is used via Authorization header.
@csrf_exempt
@login_required_json
@require_http_methods(["POST"])
def leave_game(request, game_code):
    """Leave a game."""
    try:
        game = Game.objects.get(game_code=game_code)

        # Check if player is in the game
        game_player = GamePlayer.objects.filter(game=game, player=request.user).first()
        if not game_player:
            return JsonResponse({"message": "Not in game"}, status=400)

        # Only allow leaving if game is in 'ready' status (not started)
        if game.status != "ready":
            return JsonResponse({"error": "Cannot leave game that has started"}, status=400)

        # Remove player from game
        game_player.delete()

        # Reload game to get fresh players list
        game.refresh_from_db()

        # Broadcast player update to all connected clients
        _broadcast_lobby_state(game)

        return JsonResponse({"message": "Left game"})
    except Game.DoesNotExist:
        return JsonResponse({"error": "Game not found"}, status=404)
    except Exception as e:
        logger.error(f"Error leaving game: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)


# Note: @csrf_exempt is safe here because JWT authentication is used via Authorization header.
@csrf_exempt
@login_required_json
@require_http_methods(["POST"])
def set_game_map(request, game_code):
    """Sync the creator's lobby map pick (name + seat count) to the server.

    Body: ``{"name": "...", "seats": N}`` to pick a map, or ``{}`` /
    ``{"name": null}`` to revert to a random game. The full map JSON still
    travels with the start request — this endpoint only stores the
    lobby-visible summary so joiners see the choice and ``join_game`` can
    enforce the seat capacity.
    """
    try:
        game = Game.objects.get(game_code=game_code)
    except Game.DoesNotExist:
        return JsonResponse({"error": "Game not found"}, status=404)
    if game.status != "ready":
        return JsonResponse({"error": "Game is not ready"}, status=400)
    creator = GamePlayer.objects.filter(game=game, order=0).first()
    if not creator or creator.player != request.user:
        return JsonResponse({"error": "Only the game creator can pick a map"}, status=403)

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    name = payload.get("name")
    if name is None:
        game.picked_map_name = None
        game.picked_map_seats = None
    else:
        seats = payload.get("seats")
        if not isinstance(name, str) or not name.strip():
            return JsonResponse({"error": "Map name is required"}, status=400)
        if not isinstance(seats, int) or not (1 <= seats <= MAP_PLAYERS_MAX):
            return JsonResponse({"error": "Invalid seat count"}, status=400)
        # A pick below the current player count is allowed — the creator
        # may be about to ask someone to leave; start_game re-validates.
        game.picked_map_name = name.strip()[:120]
        game.picked_map_seats = seats
    game.save(update_fields=["picked_map_name", "picked_map_seats"])

    _broadcast_lobby_state(game)
    return JsonResponse(
        {
            "message": "Map selection updated",
            "pickedMapName": game.picked_map_name,
            "pickedMapSeats": game.picked_map_seats,
        }
    )


# Note: @csrf_exempt is safe here because JWT authentication is used via Authorization header.
@csrf_exempt
@login_required_json
@require_http_methods(["POST"])
def start_game(request, game_code):
    """Start a game."""
    logger.info(f"Starting game {game_code}")
    # The body may carry a full client-supplied map (`initialMap`) — cap
    # its size before handing it to the JSON parser.
    if len(request.body) > MAX_START_PAYLOAD_BYTES:
        return JsonResponse({"error": "Start payload is too large"}, status=400)
    initial_settings = request.body.decode("utf-8")
    logger.debug(f"Initial settings: {initial_settings}")

    try:
        game = Game.objects.get(game_code=game_code)
    except Game.DoesNotExist:
        return JsonResponse({"error": "Game not found"}, status=404)

    # Authorization check: only the game creator (order=0) can start the game
    creator = GamePlayer.objects.filter(game=game, order=0).first()
    if not creator or creator.player != request.user:
        return JsonResponse({"error": "Only the game creator can start the game"}, status=403)

    if game.status != "ready":
        return JsonResponse({"error": "Game is not ready"}, status=400)
    settings_dict = json.loads(initial_settings)
    joined_count = GamePlayer.objects.filter(game=game).count()
    settings_dict["humanPlayersNum"] = joined_count
    # TODO: Get bot players number
    settings_dict["botPlayersNum"] = 0

    # Saved-map launch: when the host picked a map via the lobby's "Load
    # Map" button, the client sends the full canonical Map under
    # `initialMap`. We use its field directly and merge its settings
    # over the request's settings so the game runs with the map's tuning.
    initial_map = settings_dict.pop("initialMap", None)
    if initial_map is not None:
        # Client-supplied JSON from the creator's local storage — never
        # trusted. Shape-validate plus engine bounds before anything
        # reads it, and refuse to start rather than hydrate garbage.
        try:
            validate_map(initial_map)
        except ValueError as e:
            return JsonResponse({"error": str(e)}, status=400)
        meta = initial_map["metadata"]
        if not (
            MAP_DIMENSION_MIN <= meta["width"] <= MAP_DIMENSION_MAX
            and MAP_DIMENSION_MIN <= meta["height"] <= MAP_DIMENSION_MAX
        ):
            return JsonResponse(
                {
                    "error": (
                        f"Map dimensions must be between {MAP_DIMENSION_MIN} "
                        f"and {MAP_DIMENSION_MAX}"
                    )
                },
                status=400,
            )
        if len(initial_map["players"]) > MAP_PLAYERS_MAX:
            return JsonResponse(
                {"error": f"Map supports at most {MAP_PLAYERS_MAX} players"}, status=400
            )
        # PLAYABLE seats, not the map's declared capacity: a designer can
        # leave slots empty, and whoever is assigned an empty slot would
        # start with nothing and be eliminated on turn 1.
        playable = occupied_seats(initial_map["field"])
        if not playable:
            return JsonResponse({"error": "This map has no players placed on it"}, status=400)
        # The creator is identified by `order == 0` everywhere, and below
        # each joiner is given a real map seat as their order — so seat 0
        # must be one of the playable seats or the creator would end up
        # without order 0. Designers always start from blue, so this is a
        # guard rail rather than a real constraint.
        if playable[0] != 0:
            return JsonResponse(
                {
                    "error": (
                        "This map's first player slot (blue) is empty — "
                        "multiplayer maps must place blue"
                    )
                },
                status=400,
            )
        # Seat capacity: joined players take the playable seats in join
        # order (creator first). More joiners than playable seats can't
        # start — somebody has to leave. (Join already blocks this when
        # the map was picked before the lobby filled; this is the safety
        # net for a map picked after.)
        if joined_count > len(playable):
            return JsonResponse(
                {
                    "error": (
                        f"This map supports {len(playable)} players but {joined_count} joined — "
                        "ask somebody to leave or pick a bigger map"
                    )
                },
                status=400,
            )
        # Server-side flag consumed by the client's in-game menu: games
        # seeded from a map never show the Save-map button (only random
        # maps are saveable). NOT part of the canonical map schema — it
        # must never round-trip into a saved map's settings.
        settings_dict["fromInitialMap"] = True
        # Map settings + dimensions override the lobby's. Seat counts do
        # NOT come from the map's metadata: the joined players ARE the
        # seats (extra map seats are trimmed below).
        settings_dict.update(initial_map.get("settings", {}) or {})
        settings_dict["humanPlayersNum"] = joined_count
        settings_dict["botPlayersNum"] = 0
        settings_dict["width"] = meta["width"]
        settings_dict["height"] = meta["height"]
        # Re-derive per-cell isHidden and per-unit movePoints/visibility/
        # hasMoved from settings — the canonical schema strips those so
        # the saved map stays portable, but the engine needs them seeded
        # before turn 1 or units land with undefined speed.
        field = hydrate_field_for_game(initial_map["field"], settings_dict)
        # Hand each joined player a real map seat, in join order: the
        # creator (order 0) keeps seat 0 = blue, the next joiner takes the
        # next PLAYABLE seat, and so on. Seats can be sparse — a map using
        # blue/yellow/purple is [0, 3, 6] — so the second player plays
        # yellow rather than being renumbered onto an empty mint slot.
        # `order` doubles as the seat index everywhere (ownership checks,
        # visibility filtering, colours), and `compute_next_player` walks
        # the rows rather than a dense range, so gaps rotate correctly.
        taken_seats = playable[:joined_count]
        rows = list(GamePlayer.objects.filter(game=game).order_by("order"))
        # Two passes through a parking range: `(game, order)` is unique,
        # so assigning seats directly could collide with a row that still
        # holds the target order. `order` is a positive field, so park
        # high (seats are ≤ 7) rather than negative.
        for idx, gp in enumerate(rows):
            gp.order = SEAT_PARKING_BASE + idx
            gp.save(update_fields=["order"])
        for gp, seat in zip(rows, taken_seats, strict=True):
            gp.order = seat
            gp.save(update_fields=["order"])
        # Playable seats nobody took are removed from the field (units
        # dropped, bases demoted to neutral). Without this their units
        # would sit on the board forever — turn rotation only walks
        # GamePlayer rows. Empty slots carry nothing to remove.
        reconcile_seats(field, taken_seats)
        game.field = field
    else:
        game.field = generate_field(settings_dict)

    game.status = "playing"
    game.settings = settings_dict
    game.save(update_fields=["status", "settings", "field"])
    # Snapshot the starting field once, before any move arrives. Idempotent —
    # safe even if a future code path re-enters this view.
    capture_initial_snapshot(game)

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
        logger.debug(f"Broadcasting game started to lobby (without field): {game_state}")
        # Broadcast to lobby WebSocket group (players are connected to lobby)
        async_to_sync(channel_layer.group_send)(
            f"lobby_{game_code}",
            {
                "type": "game_started",
                "gameCode": game_code,
                "gameState": game_state,
            },
        )

    # Return response without field (field is only sent via GameConsumer)
    return JsonResponse({"message": "Started game", "game": game_state})


@login_required_json
@require_http_methods(["GET"])
def get_game(request, game_code):
    """Get a game."""
    try:
        game = Game.objects.get(game_code=game_code)
    except Game.DoesNotExist:
        return JsonResponse({"error": "Game not found"}, status=404)

    # Authorization check: user must be a participant in the game
    is_participant = GamePlayer.objects.filter(game=game, player=request.user).exists()
    if not is_participant:
        return JsonResponse({"error": "You are not a participant in this game"}, status=403)

    return JsonResponse(game.to_dict())


@login_required_json
@require_http_methods(["GET"])
def get_active_games(request):
    """Get active (unfinished) games the user has joined."""
    # Find all games where:
    # 1. User is a player
    # 2. Game status is 'playing' (not 'ready' or 'ended')
    try:
        # Get limit parameter (default 10, 'all' means no limit)
        limit_param = request.GET.get("limit")

        game_players_query = (
            GamePlayer.objects.filter(player=request.user, game__status="playing")
            .select_related("game")
            .order_by("-game__created_at")
        )

        # Get total count before limiting
        total_count = game_players_query.count()

        # Apply limit: default to 10, or use 'all' to get everything
        if limit_param == "all" or limit_param == "null":
            # Load all games (no limit)
            game_players = game_players_query
        else:
            # Use provided limit or default to 10
            limit = int(limit_param) if limit_param else 10
            game_players = game_players_query[:limit]

        games = []
        for game_player in game_players:
            game = game_player.game
            games.append(
                {
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
                }
            )

        return JsonResponse(
            {"games": games, "total": total_count, "hasMore": total_count > len(games)}
        )
    except Exception as e:
        logger.error(f"Error getting active games: {e}", exc_info=True)
        return JsonResponse({"games": [], "total": 0, "hasMore": False})


@login_required_json
@require_http_methods(["GET"])
def list_saved_maps(request):
    """Return the current user's saved maps as a JSON array.

    Each entry is the full canonical Map document — the SavedMapsPage
    needs the field data to render the preview, so a thin list response
    isn't enough.
    """
    maps = SavedMap.objects.filter(user=request.user).order_by("-created_at")
    return JsonResponse({"savedMaps": [m.data for m in maps]})


@csrf_exempt
@login_required_json
@require_http_methods(["DELETE"])
def delete_saved_map(request, name):
    """Delete one of the current user's saved maps by name."""
    deleted, _ = SavedMap.objects.filter(user=request.user, name=name).delete()
    if not deleted:
        return JsonResponse({"error": "Saved map not found"}, status=404)
    return JsonResponse({"message": "Deleted"})
