from django.db import transaction
from django.utils import timezone
from .models import Game, GamePlayer, Move

def now_ms() -> int:
    return int(timezone.now().timestamp() * 1000)

def apply_move_txn(game_code: str, user_id: int, payload: dict, client_seq: int):
    """
    Transactional, authoritative 'apply move':
    - Lock game row
    - Check membership + turn order
    - Idempotency with (game, player, client_seq)
    - Update state, persist move
    Returns: (ok, data|error)
    """
    with transaction.atomic():
        # lock the game row for this move
        # Note: Can't use select_related with select_for_update on nullable FK
        # This ensures row-level locking works correctly
        game = Game.objects.select_for_update().get(game_code=game_code)

        print(f'user_id: {user_id}')
        print(f'game: {game}')
        print(f'game.turn_player_id: {game.turn_player_id}')
        print(f'game.turn_player: {game.turn_player}')
        print(f'game.turn_player_id: {game.turn_player_id}')
        # membership guard
        if not GamePlayer.objects.filter(game=game, player_id=user_id).exists():
            return False, {"code": "NOT_IN_GAME", "msg": "Join first"}

        # idempotency: if we already processed this client_seq, return the last tick/patch
        if Move.objects.filter(game=game, player_id=user_id, client_seq=client_seq).exists():
            return True, {"patch": {}, "server_tick": now_ms()}  # or return cached patch

        # ---- your game rules here ----
        # Example: ensure it's this user's turn
        # We access turn_player_id directly (not turn_player FK) to avoid issues
        if game.turn_player_id and game.turn_player_id != user_id:
            return False, {"code": "NOT_YOUR_TURN", "msg": "Wait for your turn"}

        state = dict(game.state)  # copy
        # Apply the payload to compute a patch + next player
        patch = compute_patch_and_mutate(state, payload)  # <-- implement
        next_player_id = compute_next_player(game, current_user_id=user_id)  # <-- implement

        # Persist changes to DB
        tick = now_ms()
        
        # 1. Save the move to history
        Move.objects.create(
            game=game, 
            player_id=user_id, 
            payload=payload,
            client_seq=client_seq, 
            server_tick=tick
        )
        
        # 2. Update game state and turn player (this is what gets saved to the DB)
        game.state = state
        game.turn_player_id = next_player_id
        game.save(update_fields=["state", "turn_player"])  # Explicitly specify fields for performance
        
        return True, {"patch": patch, "server_tick": tick}

# --- helpers you’ll implement for your exact rules ---
def compute_patch_and_mutate(state: dict, payload: dict) -> dict:
    """
    Update 'state' in-place based on the move and return a minimal patch.
    Keep the patch small (only changed cells/units/turn, etc.).
    
    Args:
        state: The game state dict (will be modified in-place)
        payload: The move payload from client
    
    Returns:
        dict: A minimal patch describing what changed (only what the client needs)
    """
    # Get current turn (handle None case explicitly)
    # turn can be None for initial state
    current_turn = state.get("turn")
    if current_turn is None:
        current_turn = 0
    new_turn = current_turn + 1
    
    # Initialize moves list if needed
    if "moves" not in state:
        state["moves"] = []
    
    # Add the new move to state with metadata
    state["moves"].append({
        "turn": current_turn,
        "payload": payload
    })
    
    # Update turn counter
    state["turn"] = new_turn
    
    # Return minimal patch (only what changed)
    # Don't send the entire move list - client can accumulate locally
    patch = {
        "turn": new_turn,
        "lastMove": {
            "turn": current_turn,
            "payload": payload
        }
    }
    
    return patch

def compute_next_player(game: Game, current_user_id: int) -> int | None:
    """
    Rotate to next player based on GamePlayer.order.
    """
    players = list(GamePlayer.objects.filter(game=game).order_by("order").values_list("player_id", flat=True))
    if not players: return None
    try:
        idx = players.index(current_user_id)
        return players[(idx + 1) % len(players)]
    except ValueError:
        return players[0]
