import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from .models import Game, GamePlayer, Move
from .services.game_logic import (
    apply_end_turn_txn,
    apply_move_txn,
    apply_scout_txn,
    apply_undo_txn,
)
from .services.visibility import calculate_visibility, filter_field_for_player


def _compute_building_totals(field, width, height):
    """Count buildings of each type on the unfiltered field.

    Sent to every player so the menu's TOTAL row reflects the real map even
    under fog of war. Per-type totals don't reveal who occupies what — only
    that buildings of that type exist somewhere — so the enemy-occupancy
    breakdown stays hidden.
    """
    totals: dict[str, int] = {}
    if not field:
        return totals
    for x in range(width):
        if x >= len(field) or not field[x]:
            continue
        for y in range(height):
            if y >= len(field[x]):
                continue
            cell = field[x][y]
            if not isinstance(cell, dict):
                continue
            building = cell.get("building")
            if building and isinstance(building, dict):
                _type = building.get("_type")
                if _type:
                    totals[_type] = totals.get(_type, 0) + 1
    return totals


# Get logger for this module
logger = logging.getLogger(__name__)


def room(game_code):
    return f"game_{game_code}"


def lobby_room(game_code):
    return f"lobby_{game_code}"


class GameConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.game_code = self.scope["url_route"]["kwargs"]["game_code"]
        self.user = self.scope.get("user", AnonymousUser())
        self.user_id = getattr(self.user, "id", None)
        self.authenticated = False  # Track if authenticated via first message
        # Store player info for disconnect notification
        self.player_info = None
        if self.user_id:
            self.player_info = await self._get_player_info(self.user_id)
            self.authenticated = True
        logger.debug(
            f"GameConsumer.connect: game_code={self.game_code}, user_id={self.user_id}, player_info={self.player_info}, is_authenticated={getattr(self.user, 'is_authenticated', False)}"
        )
        await self.accept()

        # If not authenticated, wait for auth message
        if not self.user_id:
            # Send message requesting authentication
            await self.send_json({"t": "auth_required"})
            return

        await self.channel_layer.group_add(room(self.game_code), self.channel_name)

        # Check if this is a reconnection (game is already started and player is in the game)
        # We only broadcast reconnection if the game is in 'playing' status
        # (to avoid false positives on initial connection)
        if self.player_info:
            is_reconnection = await self._is_reconnection(self.user_id)
            if is_reconnection:
                logger.debug(
                    f"Player {self.player_info['username']} reconnected, broadcasting to others"
                )
                await self.channel_layer.group_send(
                    room(self.game_code),
                    {
                        "type": "player_reconnected",
                        "player": self.player_info,
                    },
                )

        # Send full initial state (field, settings, players, current turn)
        state = await self._get_full_state(self.user_id)  # async helper below
        await self.send_json({"t": "joined", "gameCode": self.game_code, "gameState": state})

    async def receive_json(self, msg, **_):
        logger.debug(f"receive_json: msg={msg}, authenticated={self.authenticated}")

        # Handle authentication message (more secure than query string)
        if msg.get("t") == "auth":
            if self.authenticated:
                # Already authenticated, ignore duplicate auth message
                logger.debug("Already authenticated, ignoring auth message")
                return

            token = msg.get("token")
            if token:
                from server.utils.jwt import get_user_from_token

                user = await database_sync_to_async(get_user_from_token)(token)
                if user:
                    self.user = user
                    self.user_id = user.id
                    self.authenticated = True
                    self.player_info = await self._get_player_info(self.user_id)
                    await self.channel_layer.group_add(room(self.game_code), self.channel_name)

                    # Check if this is a reconnection
                    if self.player_info:
                        is_reconnection = await self._is_reconnection(self.user_id)
                        if is_reconnection:
                            logger.debug(
                                f"Player {self.player_info['username']} reconnected, broadcasting to others"
                            )
                            await self.channel_layer.group_send(
                                room(self.game_code),
                                {
                                    "type": "player_reconnected",
                                    "player": self.player_info,
                                },
                            )

                    # Send initial state after authentication
                    state = await self._get_full_state(self.user_id)
                    await self.send_json(
                        {"t": "joined", "gameCode": self.game_code, "gameState": state}
                    )
                    return
                else:
                    await self.send_json(
                        {"t": "err", "code": "AUTH_FAILED", "message": "Invalid token"}
                    )
                    await self.close()
                    return
            else:
                await self.send_json(
                    {"t": "err", "code": "AUTH_REQUIRED", "message": "Token required"}
                )
                await self.close()
                return

        # Require authentication for all other messages
        if not self.authenticated:
            logger.warning("Message received but not authenticated, sending auth_required")
            await self.send_json(
                {"t": "err", "code": "AUTH_REQUIRED", "message": "Authentication required"}
            )
            return

        # Handle game move messages
        if msg.get("t") != "move":
            logger.warning(f"Unknown message type: {msg.get('t')}")
            return await self.send_json(
                {"t": "err", "code": "UNKNOWN", "message": f"Unknown message type: {msg.get('t')}"}
            )
        payload = msg.get("payload", {})
        client_seq = msg.get("clientSeq", 0)
        user_id = getattr(self.user, "id", None)

        # Check message type
        if payload.get("type") == "endTurn":
            ok, res = await database_sync_to_async(apply_end_turn_txn)(
                self.game_code, user_id, client_seq
            )
        elif payload.get("type") == "scout":
            ok, res = await database_sync_to_async(apply_scout_txn)(
                self.game_code, user_id, payload, client_seq
            )
            if not ok:
                return await self.send_json({"t": "err", **res})
            # Scout actions should only be sent to the initiating player
            # The patch is already filtered with revealed area in apply_scout_txn
            # Don't filter again - just send it directly
            return await self.send_json(
                {
                    "t": "state",
                    "gameCode": self.game_code,
                    "patch": res["patch"],
                    "serverTick": res["server_tick"],
                }
            )
        elif payload.get("type") == "undo":
            ok, res = await database_sync_to_async(apply_undo_txn)(
                self.game_code, user_id, client_seq
            )
            # Scout-undo is per-player (re-hides scout reveals, re-arms scout-mode UI).
            # Send to the initiator only — opponents must not see scout-mode signals.
            if ok and res.get("private"):
                return await self.send_json(
                    {
                        "t": "state",
                        "gameCode": self.game_code,
                        "patch": res["patch"],
                        "serverTick": res["server_tick"],
                    }
                )
        else:
            # Regular move
            ok, res = await database_sync_to_async(apply_move_txn)(
                self.game_code, user_id, payload, client_seq
            )

        if not ok:
            logger.warning(f"receive_json: error applying move: {res}")
            return await self.send_json({"t": "err", **res})

        logger.debug("receive_json: sending patch")
        try:
            await self.channel_layer.group_send(
                room(self.game_code),
                {"type": "patch", "patch": res["patch"], "serverTick": res["server_tick"]},
            )
        except Exception as e:
            logger.error(f"receive_json: error sending patch: {e}", exc_info=True)

    async def patch(self, event):
        # Filter patch field based on player's visibility if field is included
        patch = event["patch"]
        if "field" in patch and patch["field"]:
            # Get player's order and filter field
            filtered_patch = await self._filter_patch_for_player(patch, self.user_id)
            await self.send_json(
                {
                    "t": "state",
                    "gameCode": self.game_code,
                    "patch": filtered_patch,
                    "serverTick": event["serverTick"],
                }
            )
        else:
            # No field in patch, send as-is
            await self.send_json(
                {
                    "t": "state",
                    "gameCode": self.game_code,
                    "patch": patch,
                    "serverTick": event["serverTick"],
                }
            )

    async def player_disconnected(self, event):
        """Handle player disconnection broadcast - send to all connected clients."""
        logger.debug(
            f"player_disconnected handler: user_id={self.user_id}, event player={event.get('player')}"
        )
        # Don't send to the player who disconnected (they're already gone)
        # Only send to other players
        if self.user_id and event.get("player") and event["player"]["id"] != self.user_id:
            logger.debug(f"Sending player_disconnected message to user_id={self.user_id}")
            await self.send_json(
                {
                    "t": "player_disconnected",
                    "player": event["player"],
                }
            )
        else:
            logger.debug("Skipping player_disconnected (same player or no player info)")

    async def player_reconnected(self, event):
        """Handle player reconnection broadcast - send to all connected clients."""
        logger.debug(
            f"player_reconnected handler: user_id={self.user_id}, event player={event.get('player')}"
        )
        # Don't send to the player who reconnected (they already know)
        # Only send to other players
        if self.user_id and event.get("player") and event["player"]["id"] != self.user_id:
            logger.debug(f"Sending player_reconnected message to user_id={self.user_id}")
            await self.send_json(
                {
                    "t": "player_reconnected",
                    "player": event["player"],
                }
            )
        else:
            logger.debug("Skipping player_reconnected (same player or no player info)")

    async def disconnect(self, code):
        logger.debug(
            f"GameConsumer.disconnect: game_code={self.game_code}, user_id={self.user_id}, code={code}, player_info={self.player_info}"
        )
        # Broadcast player disconnection to other players
        # Use stored player_info if available, otherwise try to get it
        player_info = self.player_info
        if not player_info and self.user_id:
            try:
                player_info = await self._get_player_info(self.user_id)
                logger.debug(f"Player info retrieved in disconnect: {player_info}")
            except Exception as e:
                logger.warning(f"Error getting player info in disconnect: {e}", exc_info=True)

        if player_info:
            try:
                # Broadcast to all other players in the game
                logger.debug(
                    f"Broadcasting player_disconnected for {player_info['username']} to room {room(self.game_code)}"
                )
                await self.channel_layer.group_send(
                    room(self.game_code),
                    {
                        "type": "player_disconnected",
                        "player": player_info,
                    },
                )
                logger.debug("Broadcast sent successfully")
            except Exception as e:
                logger.error(f"Error in disconnect broadcast: {e}", exc_info=True)
        else:
            logger.debug("No player_info available for disconnect broadcast")

        await self.channel_layer.group_discard(room(self.game_code), self.channel_name)

    # ---- async read helper ----
    @database_sync_to_async
    def _get_full_state(self, user_id):
        g = Game.objects.get(game_code=self.game_code)

        # Get player's order for visibility filtering
        player_order = None
        if user_id:
            try:
                game_player = GamePlayer.objects.get(game=g, player_id=user_id)
                player_order = game_player.order
            except GamePlayer.DoesNotExist:
                logger.debug(f"_get_full_state: user_id={user_id}, GamePlayer not found")
        else:
            logger.debug("_get_full_state: user_id is None or not provided")

        # Get settings for fog of war configuration
        settings = g.settings if isinstance(g.settings, dict) else {}
        enable_fog_of_war = settings.get("enableFogOfWar", True)
        fog_of_war_radius = settings.get("fogOfWarRadius", 3)
        width = settings.get("width", 20)
        height = settings.get("height", 20)

        # Filter field based on player's visibility
        # Always filter the field to ensure isHidden is set correctly (even when fog of war is disabled)
        # If game has ended, show full field to all players
        field = g.field
        scout_revealed_coords = None
        game_ended = g.status == "ended"
        # If game ended, disable fog of war to show full field
        effective_fog_of_war = enable_fog_of_war and not game_ended

        if player_order is not None and field:
            # print(f"[DEBUG] Filtering field for player_order={player_order}, enable_fog_of_war={enable_fog_of_war}, game_ended={game_ended}")
            # Get scout-revealed coordinates for this player (only relevant when fog of war is enabled)
            if effective_fog_of_war:
                try:
                    game_player = GamePlayer.objects.get(game=g, player_id=user_id)
                    scout_revealed_coords = (
                        game_player.scout_revealed_coords
                        if game_player.scout_revealed_coords
                        else None
                    )
                except GamePlayer.DoesNotExist:
                    pass
            field = filter_field_for_player(
                field,
                width,
                height,
                player_order,
                fog_of_war_radius,
                effective_fog_of_war,
                scout_revealed_coords,
            )
        else:
            logger.debug(
                f"Not filtering field: player_order={player_order}, field_exists={field is not None}"
            )

        # Get current player order for turnPlayer
        current_player_order = None
        if g.turn_player:
            try:
                turn_game_player = GamePlayer.objects.get(game=g, player=g.turn_player)
                current_player_order = turn_game_player.order
            except GamePlayer.DoesNotExist:
                pass

        # Get last clientSeq for this player (for reconnection)
        last_client_seq = 0
        if user_id:
            last_move = (
                Move.objects.filter(game=g, player_id=user_id).order_by("-client_seq").first()
            )
            if last_move:
                last_client_seq = last_move.client_seq

        # Return exactly the shape your client expects
        return {
            "gameCode": g.game_code,
            "status": g.status,
            "settings": g.settings,
            "field": field,  # Filtered field based on player visibility
            "buildingTotals": _compute_building_totals(g.field, width, height),
            "turnPlayer": g.turn_player.username if g.turn_player else None,
            "currentPlayer": current_player_order,  # Player order (0, 1, 2, ...) whose turn it is
            "players": [
                {
                    "id": gp.player.id,
                    "username": gp.player.username,
                    "order": gp.order,
                }
                for gp in g.players.select_related("player").order_by("order")
            ],
            "lastClientSeq": last_client_seq,  # Last clientSeq for this player (for reconnection)
        }

    @database_sync_to_async
    def _get_player_info(self, user_id):
        """Get player info (username, id) for disconnection notification."""
        try:
            game = Game.objects.get(game_code=self.game_code)
            game_player = GamePlayer.objects.filter(game=game, player_id=user_id).first()
            if game_player:
                return {
                    "id": game_player.player.id,
                    "username": game_player.player.username,
                }
        except Exception as e:
            logger.warning(f"Error getting player info: {e}", exc_info=True)
        return None

    @database_sync_to_async
    def _is_reconnection(self, user_id):
        """Check if this is a reconnection (game is playing and player is in the game)."""
        try:
            game = Game.objects.get(game_code=self.game_code)
            # Only consider it a reconnection if:
            # 1. Game is already started (status='playing')
            # 2. Player is in the game
            if game.status == "playing":
                return GamePlayer.objects.filter(game=game, player_id=user_id).exists()
        except Exception as e:
            logger.warning(f"Error checking if reconnection: {e}", exc_info=True)
        return False

    @database_sync_to_async
    def _filter_patch_for_player(self, patch, user_id):
        """Filter patch field and animation path based on player's visibility."""
        has_field = "field" in patch and patch["field"]
        has_path = "path" in patch
        if not has_field and not has_path:
            return patch

        g = Game.objects.get(game_code=self.game_code)

        # Get player's order for visibility filtering
        player_order = None
        if user_id:
            try:
                game_player = GamePlayer.objects.get(game=g, player_id=user_id)
                player_order = game_player.order
            except GamePlayer.DoesNotExist:
                pass

        # Get settings for fog of war configuration
        settings = g.settings if isinstance(g.settings, dict) else {}
        enable_fog_of_war = settings.get("enableFogOfWar", True)
        fog_of_war_radius = settings.get("fogOfWarRadius", 3)
        width = settings.get("width", 20)
        height = settings.get("height", 20)

        # Filter field based on player's visibility
        # Always filter the field to ensure isHidden is set correctly (even when fog of war is disabled)
        # If game has ended, show full field to all players
        field = patch["field"]
        scout_revealed_coords = None
        # Check both game status and patch flag to ensure we show full field when game ends
        game_ended = g.status == "ended" or patch.get("gameEnded", False)
        # If game ended, disable fog of war to show full field
        effective_fog_of_war = enable_fog_of_war and not game_ended

        if player_order is not None:
            # Get scout-revealed coordinates for this player (only relevant when fog of war is enabled)
            # IMPORTANT: Refresh from DB to get the latest cleared coordinates
            if effective_fog_of_war:
                try:
                    game_player = GamePlayer.objects.get(game=g, player_id=user_id)
                    scout_revealed_coords = (
                        game_player.scout_revealed_coords
                        if game_player.scout_revealed_coords
                        else None
                    )
                    # print(f"[DEBUG] _filter_patch_for_player: user_id={user_id}, player_order={player_order}, scout_revealed_coords={scout_revealed_coords}, game_ended={game_ended}")
                except GamePlayer.DoesNotExist:
                    pass
            if has_field:
                field = filter_field_for_player(
                    field,
                    width,
                    height,
                    player_order,
                    fog_of_war_radius,
                    effective_fog_of_war,
                    scout_revealed_coords,
                )

        # Return patch with filtered field
        filtered_patch = patch.copy()
        if has_field:
            filtered_patch["field"] = field

        # Pre-move visibility hint emitted by `apply_move_txn`. Used by
        # both the path and the killed-cells slicers — we MUST use this in
        # preference to recomputing visibility against the post-move field
        # (a move that kills the recipient's unit would otherwise produce
        # an empty slice and the recipient would see no animation).
        pre_visibility_by_order = patch.get("_visibilityByOrder") or {}
        is_move_maker = user_id is not None and user_id == g.turn_player_id

        # Slice the move path against the recipient's visibility. The full
        # `path` is never sent to clients — only the per-recipient `pathSlice`.
        # The move-maker is allowed to see their entire walk; opponents only
        # see cells they can currently observe.
        if has_path:
            full_path = patch.get("path") or []
            if is_move_maker or not effective_fog_of_war or game_ended:
                path_slice = list(full_path)
            elif player_order is not None and str(player_order) in pre_visibility_by_order:
                visible_set = {tuple(c) for c in pre_visibility_by_order[str(player_order)]}
                path_slice = [c for c in full_path if tuple(c) in visible_set]
            elif player_order is not None and has_field:
                # Defensive fallback used only if the pre-move hint is missing
                # (e.g. fog-of-war off, or a patch from a code path that did
                # not attach the hint). Compute against the post-move filtered
                # field; this is correct as long as the recipient's visibility
                # didn't shrink during the move.
                visible_coords = calculate_visibility(
                    field,
                    width,
                    height,
                    player_order,
                    fog_of_war_radius,
                    effective_fog_of_war,
                    scout_revealed_coords,
                )
                path_slice = [c for c in full_path if tuple(c) in visible_coords]
            else:
                path_slice = []

            # Always strip the unfiltered path before sending to clients.
            filtered_patch.pop("path", None)
            if len(path_slice) >= 2 and patch.get("movingUnit"):
                filtered_patch["pathSlice"] = path_slice
                # movingUnit is already on filtered_patch via copy; keep it.
            else:
                # Nothing to animate — drop the moving-unit overlay too.
                filtered_patch.pop("movingUnit", None)

        # Slice `killedCells` against the same pre-move visibility hint —
        # we should only animate kills the recipient could see pre-move.
        # Otherwise the patch could leak the existence of an enemy unit in
        # a fogged cell (the death animation would render in fog).
        if "killedCells" in patch:
            full_killed = patch.get("killedCells") or []
            if is_move_maker or not effective_fog_of_war or game_ended:
                killed_slice = list(full_killed)
            elif player_order is not None and str(player_order) in pre_visibility_by_order:
                visible_set = {tuple(c) for c in pre_visibility_by_order[str(player_order)]}
                killed_slice = [c for c in full_killed if tuple(c) in visible_set]
            else:
                killed_slice = []
            if killed_slice:
                filtered_patch["killedCells"] = killed_slice
            else:
                filtered_patch.pop("killedCells", None)

        # Slice `births` per recipient. Each entry is `{coords, killedCoords}`
        # — we keep entries whose spawn cell is in the recipient's pre-
        # production visibility, and within those we trim each entry's
        # `killedCoords` to the same set (no point flashing damage on a
        # neighbour the recipient couldn't see).
        if "births" in patch:
            full_births = patch.get("births") or []
            if not effective_fog_of_war or game_ended:
                births_slice = [dict(b) for b in full_births]
            elif player_order is not None and str(player_order) in pre_visibility_by_order:
                visible_set = {tuple(c) for c in pre_visibility_by_order[str(player_order)]}
                births_slice = []
                for entry in full_births:
                    coords = entry.get("coords")
                    if not coords or tuple(coords) not in visible_set:
                        continue
                    kc = entry.get("killedCoords") or []
                    births_slice.append(
                        {
                            "coords": list(coords),
                            "killedCoords": [list(c) for c in kc if tuple(c) in visible_set],
                        }
                    )
            else:
                births_slice = []
            if births_slice:
                filtered_patch["births"] = births_slice
            else:
                filtered_patch.pop("births", None)

        # The visibility hint is internal — strip after we've used it for
        # path, killed-cells and births slicing.
        filtered_patch.pop("_visibilityByOrder", None)

        return filtered_patch


class LobbyConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for game lobby - handles player list updates."""

    async def connect(self):
        self.game_code = self.scope["url_route"]["kwargs"]["game_code"]
        self.user = self.scope.get("user", AnonymousUser())
        self.authenticated = getattr(self.user, "id", None) is not None
        await self.accept()

        # If not authenticated, wait for auth message
        if not self.authenticated:
            await self.send_json({"type": "auth_required"})
            return

        await self.channel_layer.group_add(lobby_room(self.game_code), self.channel_name)

        # Send initial players list
        players = await self._get_players()
        await self.send_json({"type": "players", "players": players})

    async def receive_json(self, content, **_):
        # Handle authentication message (more secure than query string)
        if content.get("type") == "auth" and not self.authenticated:
            token = content.get("token")
            if token:
                from server.utils.jwt import get_user_from_token

                user = await database_sync_to_async(get_user_from_token)(token)
                if user:
                    self.user = user
                    self.authenticated = True
                    await self.channel_layer.group_add(
                        lobby_room(self.game_code), self.channel_name
                    )
                    # Send initial players list after authentication
                    players = await self._get_players()
                    await self.send_json({"type": "players", "players": players})
                    return
                else:
                    await self.send_json({"type": "error", "message": "Invalid token"})
                    await self.close()
                    return
            else:
                await self.send_json({"type": "error", "message": "Token required"})
                await self.close()
                return

        # Require authentication for all other messages
        if not self.authenticated:
            await self.send_json({"type": "error", "message": "Authentication required"})
            return

    async def player_update(self, event):
        """Handle player list updates broadcast from views."""
        await self.send_json({"type": "players", "players": event["players"]})

    async def game_started(self, event):
        """Handle game started event - sends full game state to lobby players."""
        logger.info(f"Game started event: {event}")
        await self.send_json(
            {
                "type": "game_started",
                "gameCode": event["gameCode"],
                "gameState": event["gameState"],
            }
        )

    async def disconnect(self, code):
        await self.channel_layer.group_discard(lobby_room(self.game_code), self.channel_name)

    @database_sync_to_async
    def _get_players(self):
        """Get current players list for the game."""
        try:
            game = Game.objects.get(game_code=self.game_code)
            return [
                {
                    "id": gp.player.id,
                    "username": gp.player.username,
                    "order": gp.order,
                }
                for gp in game.players.select_related("player").order_by("order")
            ]
        except Game.DoesNotExist:
            return []
