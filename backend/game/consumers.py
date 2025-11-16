from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from .models import Game, GamePlayer, Move
from .services.general import apply_move_txn, apply_end_turn_txn, apply_scout_txn
from .services.visibility import filter_field_for_player


def room(game_code):
    return f"game_{game_code}"


def lobby_room(game_code):
    return f"lobby_{game_code}"


class GameConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.game_code = self.scope["url_route"]["kwargs"]["game_code"]
        self.user = self.scope.get("user", AnonymousUser())
        self.user_id = getattr(self.user, "id", None)
        # Store player info for disconnect notification
        self.player_info = None
        if self.user_id:
            self.player_info = await self._get_player_info(self.user_id)
        print(f"[DEBUG] GameConsumer.connect: game_code={self.game_code}, user_id={self.user_id}, player_info={self.player_info}, is_authenticated={getattr(self.user, 'is_authenticated', False)}")
        await self.accept()
        await self.channel_layer.group_add(room(self.game_code), self.channel_name)

        # Check if this is a reconnection (game is already started and player is in the game)
        # We only broadcast reconnection if the game is in 'playing' status
        # (to avoid false positives on initial connection)
        if self.player_info:
            is_reconnection = await self._is_reconnection(self.user_id)
            if is_reconnection:
                print(f"[DEBUG] Player {self.player_info['username']} reconnected, broadcasting to others")
                await self.channel_layer.group_send(
                    room(self.game_code),
                    {
                        "type": "player_reconnected",
                        "player": self.player_info,
                    }
                )

        # Send full initial state (field, settings, players, current turn)
        state = await self._get_full_state(self.user_id)  # async helper below
        await self.send_json(
            {"t": "joined", "gameCode": self.game_code, "gameState": state}
        )

    async def receive_json(self, msg, **_):
        print(f"[DEBUG] receive_json: msg={msg}")
        if msg.get("t") != "move":
            return await self.send_json({"t": "err", "code": "UNKNOWN"})
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
            return await self.send_json({
                "t": "state",
                "gameCode": self.game_code,
                "patch": res["patch"],
                "serverTick": res["server_tick"],
            })
        else:
            # Regular move
            ok, res = await database_sync_to_async(apply_move_txn)(
                self.game_code, user_id, payload, client_seq
            )
        
        if not ok:
            print(f"[DEBUG] receive_json: error applying move: {res}")
            return await self.send_json({"t": "err", **res})

        print(f"[DEBUG] receive_json: sending patch")
        try:
            await self.channel_layer.group_send(
                room(self.game_code),
                {"type": "patch", "patch": res["patch"], "serverTick": res["server_tick"]},
            )
        except Exception as e:
            print(f"[DEBUG] receive_json: error sending patch: {e}")

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
        print(f"[DEBUG] player_disconnected handler: user_id={self.user_id}, event player={event.get('player')}")
        # Don't send to the player who disconnected (they're already gone)
        # Only send to other players
        if self.user_id and event.get("player") and event["player"]["id"] != self.user_id:
            print(f"[DEBUG] Sending player_disconnected message to user_id={self.user_id}")
            await self.send_json({
                "t": "player_disconnected",
                "player": event["player"],
            })
        else:
            print(f"[DEBUG] Skipping player_disconnected (same player or no player info)")
    
    async def player_reconnected(self, event):
        """Handle player reconnection broadcast - send to all connected clients."""
        print(f"[DEBUG] player_reconnected handler: user_id={self.user_id}, event player={event.get('player')}")
        # Don't send to the player who reconnected (they already know)
        # Only send to other players
        if self.user_id and event.get("player") and event["player"]["id"] != self.user_id:
            print(f"[DEBUG] Sending player_reconnected message to user_id={self.user_id}")
            await self.send_json({
                "t": "player_reconnected",
                "player": event["player"],
            })
        else:
            print(f"[DEBUG] Skipping player_reconnected (same player or no player info)")

    async def disconnect(self, code):
        print(f"[DEBUG] GameConsumer.disconnect: game_code={self.game_code}, user_id={self.user_id}, code={code}, player_info={self.player_info}")
        # Broadcast player disconnection to other players
        # Use stored player_info if available, otherwise try to get it
        player_info = self.player_info
        if not player_info and self.user_id:
            try:
                player_info = await self._get_player_info(self.user_id)
                print(f"[DEBUG] Player info retrieved in disconnect: {player_info}")
            except Exception as e:
                print(f"[DEBUG] Error getting player info in disconnect: {e}")
        
        if player_info:
            try:
                # Broadcast to all other players in the game
                print(f"[DEBUG] Broadcasting player_disconnected for {player_info['username']} to room {room(self.game_code)}")
                await self.channel_layer.group_send(
                    room(self.game_code),
                    {
                        "type": "player_disconnected",
                        "player": player_info,
                    }
                )
                print(f"[DEBUG] Broadcast sent successfully")
            except Exception as e:
                print(f"[DEBUG] Error in disconnect broadcast: {e}")
                import traceback
                traceback.print_exc()
        else:
            print(f"[DEBUG] No player_info available for disconnect broadcast")
        
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
                # Debug: List all players in this game
                all_players = list(GamePlayer.objects.filter(game=g).order_by('order').values('player_id', 'player__username', 'order'))
                # print(f"[DEBUG] _get_full_state: user_id={user_id}, player_order={player_order}, username={game_player.player.username}")
                # print(f"[DEBUG] All players in game: {all_players}")
            except GamePlayer.DoesNotExist:
                print(f"[DEBUG] _get_full_state: user_id={user_id}, GamePlayer not found")
        else:
            print(f"[DEBUG] _get_full_state: user_id is None or not provided")
        
        # Get settings for fog of war configuration
        settings = g.settings if isinstance(g.settings, dict) else {}
        enable_fog_of_war = settings.get('enableFogOfWar', True)
        fog_of_war_radius = settings.get('fogOfWarRadius', 3)
        width = settings.get('width', 20)
        height = settings.get('height', 20)
        
        # Filter field based on player's visibility
        # Always filter the field to ensure isHidden is set correctly (even when fog of war is disabled)
        # If game has ended, show full field to all players
        field = g.field
        scout_revealed_coords = None
        game_ended = g.status == 'ended'
        # If game ended, disable fog of war to show full field
        effective_fog_of_war = enable_fog_of_war and not game_ended
        
        if player_order is not None and field:
            # print(f"[DEBUG] Filtering field for player_order={player_order}, enable_fog_of_war={enable_fog_of_war}, game_ended={game_ended}")
            # Get scout-revealed coordinates for this player (only relevant when fog of war is enabled)
            if effective_fog_of_war:
                try:
                    game_player = GamePlayer.objects.get(game=g, player_id=user_id)
                    scout_revealed_coords = game_player.scout_revealed_coords if game_player.scout_revealed_coords else None
                except GamePlayer.DoesNotExist:
                    pass
            field = filter_field_for_player(
                field, width, height, player_order, fog_of_war_radius, effective_fog_of_war, scout_revealed_coords
            )
        else:
            print(f"[DEBUG] Not filtering field: player_order={player_order}, field_exists={field is not None}")
        
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
            last_move = Move.objects.filter(game=g, player_id=user_id).order_by('-client_seq').first()
            if last_move:
                last_client_seq = last_move.client_seq
        
        # Return exactly the shape your client expects
        return {
            "gameCode": g.game_code,
            "status": g.status,
            "settings": g.settings,
            "field": field,  # Filtered field based on player visibility
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
            print(f"Error getting player info: {e}")
        return None
    
    @database_sync_to_async
    def _is_reconnection(self, user_id):
        """Check if this is a reconnection (game is playing and player is in the game)."""
        try:
            game = Game.objects.get(game_code=self.game_code)
            # Only consider it a reconnection if:
            # 1. Game is already started (status='playing')
            # 2. Player is in the game
            if game.status == 'playing':
                return GamePlayer.objects.filter(game=game, player_id=user_id).exists()
        except Exception as e:
            print(f"Error checking if reconnection: {e}")
        return False
    
    @database_sync_to_async
    def _filter_patch_for_player(self, patch, user_id):
        """Filter patch field based on player's visibility."""
        if "field" not in patch or not patch["field"]:
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
        enable_fog_of_war = settings.get('enableFogOfWar', True)
        fog_of_war_radius = settings.get('fogOfWarRadius', 3)
        width = settings.get('width', 20)
        height = settings.get('height', 20)
        
        # Filter field based on player's visibility
        # Always filter the field to ensure isHidden is set correctly (even when fog of war is disabled)
        # If game has ended, show full field to all players
        field = patch["field"]
        scout_revealed_coords = None
        # Check both game status and patch flag to ensure we show full field when game ends
        game_ended = g.status == 'ended' or patch.get("gameEnded", False)
        # If game ended, disable fog of war to show full field
        effective_fog_of_war = enable_fog_of_war and not game_ended
        
        if player_order is not None and field:
            # Get scout-revealed coordinates for this player (only relevant when fog of war is enabled)
            # IMPORTANT: Refresh from DB to get the latest cleared coordinates
            if effective_fog_of_war:
                try:
                    game_player = GamePlayer.objects.get(game=g, player_id=user_id)
                    scout_revealed_coords = game_player.scout_revealed_coords if game_player.scout_revealed_coords else None
                    # print(f"[DEBUG] _filter_patch_for_player: user_id={user_id}, player_order={player_order}, scout_revealed_coords={scout_revealed_coords}, game_ended={game_ended}")
                except GamePlayer.DoesNotExist:
                    pass
            field = filter_field_for_player(
                field, width, height, player_order, fog_of_war_radius, effective_fog_of_war, scout_revealed_coords
            )
        
        # Return patch with filtered field
        filtered_patch = patch.copy()
        filtered_patch["field"] = field
        return filtered_patch


class LobbyConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for game lobby - handles player list updates."""

    async def connect(self):
        self.game_code = self.scope["url_route"]["kwargs"]["game_code"]
        self.user = self.scope.get("user", AnonymousUser())
        await self.accept()
        await self.channel_layer.group_add(
            lobby_room(self.game_code), self.channel_name
        )

        # Send initial players list
        players = await self._get_players()
        await self.send_json({"type": "players", "players": players})

    async def player_update(self, event):
        """Handle player list updates broadcast from views."""
        await self.send_json({"type": "players", "players": event["players"]})

    async def game_started(self, event):
        """Handle game started event - sends full game state to lobby players."""
        print(f"Game started event: {event}")
        await self.send_json({
            "type": "game_started",
            "gameCode": event["gameCode"],
            "gameState": event["gameState"],
        })

    async def disconnect(self, code):
        await self.channel_layer.group_discard(
            lobby_room(self.game_code), self.channel_name
        )

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
