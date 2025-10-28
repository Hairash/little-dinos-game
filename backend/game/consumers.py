from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from .models import Game
from .services import apply_move_txn

def room(game_code): return f"game_{game_code}"

class GameConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.game_code = self.scope["url_route"]["kwargs"]["game_code"]
        self.user = self.scope.get("user", AnonymousUser())
        await self.accept()
        await self.channel_layer.group_add(room(self.game_code), self.channel_name)

        # Send full initial state (sync or async – choose one)
        state = await self._get_full_state()  # async helper below
        await self.send_json({"t":"joined","gameCode": self.game_code, "state": state})

    async def receive_json(self, msg, **_):
        if msg.get("t") != "move":
            return await self.send_json({"t":"err","code":"UNKNOWN"})
        payload = msg.get("payload", {})
        client_seq = msg.get("clientSeq", 0)
        print(f'self.user: {self.user.__dict__}')
        user_id = getattr(self.user, "id", None)

        ok, res = await database_sync_to_async(apply_move_txn)(
            self.game_code, user_id, payload, client_seq
        )
        if not ok:
            return await self.send_json({"t":"err", **res})

        await self.channel_layer.group_send(
            room(self.game_code),
            {"type":"patch","patch": res["patch"], "serverTick": res["server_tick"]}
        )

    async def patch(self, event):
        await self.send_json({"t":"state","gameCode": self.game_code,
                              "patch": event["patch"], "serverTick": event["serverTick"]})

    async def disconnect(self, code):
        await self.channel_layer.group_discard(room(self.game_code), self.channel_name)

    # ---- async read helper ----
    @database_sync_to_async
    def _get_full_state(self):
        g = Game.objects.get(game_code=self.game_code)
        # Return exactly the shape your client expects
        return {"turn": g.state.get("turn"), "board": g.state.get("board", []), "moves": g.state.get("moves", [])}
