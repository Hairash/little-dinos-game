from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from .models import Game, GamePlayer
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
        print(f"[DEBUG] GameConsumer.connect: game_code={self.game_code}, user_id={self.user_id}, user={self.user}, is_authenticated={getattr(self.user, 'is_authenticated', False)}")
        await self.accept()
        await self.channel_layer.group_add(room(self.game_code), self.channel_name)

        # Send full initial state (field, settings, players, current turn)
        state = await self._get_full_state(self.user_id)  # async helper below
        await self.send_json(
            {"t": "joined", "gameCode": self.game_code, "gameState": state}
        )

    async def receive_json(self, msg, **_):
        if msg.get("t") != "move":
            return await self.send_json({"t": "err", "code": "UNKNOWN"})
        payload = msg.get("payload", {})
        client_seq = msg.get("clientSeq", 0)
        print(f"self.user: {self.user.__dict__}")
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
            return await self.send_json({"t": "err", **res})

        await self.channel_layer.group_send(
            room(self.game_code),
            {"type": "patch", "patch": res["patch"], "serverTick": res["server_tick"]},
        )

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

    async def disconnect(self, code):
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
                print(f"[DEBUG] _get_full_state: user_id={user_id}, player_order={player_order}, username={game_player.player.username}")
                print(f"[DEBUG] All players in game: {all_players}")
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
            print(f"[DEBUG] Filtering field for player_order={player_order}, enable_fog_of_war={enable_fog_of_war}, game_ended={game_ended}")
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
        }
    
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
                    print(f"[DEBUG] _filter_patch_for_player: user_id={user_id}, player_order={player_order}, scout_revealed_coords={scout_revealed_coords}, game_ended={game_ended}")
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
