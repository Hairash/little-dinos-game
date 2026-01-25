from django.db import transaction
from django.utils import timezone

from game.models import Game, GamePlayer, Move
from game.services.move_validation import apply_move_to_cell, validate_move
from game.services.unit_production import restore_and_produce_units
from game.services.visibility import calculate_visibility

BUILDING_TYPES = {
    "BASE": "base",
    "HABITATION": "habitation",
    "TEMPLE": "temple",
    "WELL": "well",
    "STORAGE": "storage",
    "OBELISK": "obelisk",
}


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
        # print(f"[DEBUG] apply_move_txn: game={game}")
        # print(f"[DEBUG] apply_move_txn: game.field={game.field}")
        # print(f"[DEBUG] apply_move_txn: game.settings={game.settings}")
        # print(f"[DEBUG] apply_move_txn: game.turn_player_id={game.turn_player_id}")
        # print(f"[DEBUG] apply_move_txn: game.turn_player={game.turn_player}")
        # print(f"[DEBUG] apply_move_txn: game.turn_player_id={game.turn_player_id}")
        # print(f"[DEBUG] apply_move_txn: game.status={game.status}")
        # print(f"[DEBUG] apply_move_txn: game.players={game.players}")

        # membership guard
        if not GamePlayer.objects.filter(game=game, player_id=user_id).exists():
            return False, {"code": "NOT_IN_GAME", "msg": "Join first"}

        # Check if game has ended
        if game.status == "ended":
            return False, {"code": "GAME_ENDED", "msg": "Game has ended"}

        # idempotency: if we already processed this client_seq, return the last tick/patch
        if Move.objects.filter(game=game, player_id=user_id, client_seq=client_seq).exists():
            # print(f"[DEBUG] apply_move_txn: idempotency: move already processed")
            return True, {"patch": {}, "server_tick": now_ms()}  # or return cached patch

        # ---- your game rules here ----
        # Example: ensure it's this user's turn
        # We access turn_player_id directly (not turn_player FK) to avoid issues
        if game.turn_player_id and game.turn_player_id != user_id:
            return False, {"code": "NOT_YOUR_TURN", "msg": "Wait for your turn"}

        # Get player order for validation
        try:
            game_player = GamePlayer.objects.get(game=game, player_id=user_id)
            player_order = game_player.order
        except GamePlayer.DoesNotExist:
            return False, {"code": "NOT_IN_GAME", "msg": "Player not in game"}

        # Validate and apply the move
        field = game.field if game.field else []
        settings = game.settings if game.settings else {}
        width = settings.get("width", 20)
        height = settings.get("height", 20)
        enable_fog_of_war = settings.get("enableFogOfWar", True)
        fog_of_war_radius = settings.get("fogOfWarRadius", 3)
        # For multiplayer games, scout mode is always enabled
        # This means players can only move within their visible area
        # If fog of war is disabled, all cells are visible (isHidden=False), so they can move anywhere
        enable_scout_mode = True

        # print(f"[DEBUG] apply_move_txn: user_id={user_id}, player_order={player_order}")
        # print(f"[DEBUG] Field dimensions: width={width}, height={height}, field structure: {len(field)} columns")
        # if len(field) > 0:
        # print(f"[DEBUG] First column has {len(field[0])} rows")

        # Calculate visibility for the player making the move
        # This ensures we validate moves based on what the player can actually see
        # Include scout-revealed coordinates in visibility calculation
        scout_revealed_coords = (
            game_player.scout_revealed_coords if game_player.scout_revealed_coords else None
        )
        if enable_fog_of_war:
            visible_coords = calculate_visibility(
                field,
                width,
                height,
                player_order,
                fog_of_war_radius,
                enable_fog_of_war,
                scout_revealed_coords,
            )
            # Create a copy of the field with isHidden set correctly for this player
            field_for_validation = []
            for x in range(width):
                col = []
                for y in range(height):
                    if (x, y) in visible_coords:
                        # Cell is visible - copy it and set isHidden=False
                        cell = dict(field[x][y]) if isinstance(field[x][y], dict) else field[x][y]
                        if isinstance(cell, dict):
                            cell["isHidden"] = False
                        col.append(cell)
                    else:
                        # Cell is hidden - create placeholder with isHidden=True
                        cell = dict(field[x][y]) if isinstance(field[x][y], dict) else field[x][y]
                        if isinstance(cell, dict):
                            cell = dict(cell)  # Make a copy
                            cell["isHidden"] = True
                        col.append(cell)
                field_for_validation.append(col)
        else:
            # Fog of war disabled - all cells are visible
            field_for_validation = []
            for x in range(width):
                col = []
                for y in range(height):
                    cell = dict(field[x][y]) if isinstance(field[x][y], dict) else field[x][y]
                    if isinstance(cell, dict):
                        cell = dict(cell)  # Make a copy
                        cell["isHidden"] = False
                    col.append(cell)
                field_for_validation.append(col)

        from_coords = payload.get("fromCoords")
        to_coords = payload.get("toCoords")

        if not from_coords or not to_coords:
            return False, {"code": "INVALID_MOVE", "msg": "Missing fromCoords or toCoords"}

        # Validate move - scout mode is always enabled for multiplayer
        # Use field_for_validation which has isHidden set correctly for this player
        is_valid, error_msg = validate_move(
            field_for_validation,
            width,
            height,
            from_coords,
            to_coords,
            player_order,
            enable_scout_mode,
        )
        if not is_valid:
            return False, {"code": "INVALID_MOVE", "msg": error_msg}

        # Apply move
        building_captured, cells_changed = apply_move_to_cell(
            field,
            from_coords[0],
            from_coords[1],
            to_coords[0],
            to_coords[1],
            player_order,
            settings,
        )

        # Create patch with full field (frontend expects full field for now)
        # TODO: Optimize to send only changed cells and merge on frontend
        patch = {
            "field": field,  # Send full field for now
            "lastMove": payload,
        }
        if building_captured:
            patch["buildingCaptured"] = True

        # Don't advance turn after a move - turn only advances on "End Turn"
        # Keep currentPlayer in patch so clients know it's still this player's turn
        patch["currentPlayer"] = player_order

        # Persist changes to DB
        tick = now_ms()

        # 1. Save the move to history
        Move.objects.create(
            game=game, player_id=user_id, payload=payload, client_seq=client_seq, server_tick=tick
        )

        # 2. Update field only (don't change turn_player - that only happens on End Turn)
        game.field = field  # Field was updated in-place by apply_move_to_cell

        # 3. Check if game has ended (only 1 player remains)
        winner_order = check_game_ended(
            field, width, height, len(GamePlayer.objects.filter(game=game))
        )
        if winner_order is not None:
            # Game ended - update status and include winner in patch
            game.status = "ended"
            game.save(update_fields=["field", "status"])
            patch["gameEnded"] = True
            patch["winner"] = winner_order
            # Get winner's user_id for display
            try:
                winner_player = GamePlayer.objects.get(game=game, order=winner_order)
                patch["winnerId"] = winner_player.player_id
                patch["winnerUsername"] = winner_player.player.username
            except GamePlayer.DoesNotExist:
                pass
        else:
            game.save(update_fields=["field"])

        return True, {"patch": patch, "server_tick": tick}


def apply_end_turn_txn(game_code: str, user_id: int, client_seq: int):
    """
    Transactional 'end turn':
    - Lock game row
    - Check membership + turn order
    - Reset hasMoved for current player's units
    - Advance to next player
    Returns: (ok, data|error)
    """
    with transaction.atomic():
        # Lock the game row
        game = Game.objects.select_for_update().get(game_code=game_code)

        # Membership guard
        if not GamePlayer.objects.filter(game=game, player_id=user_id).exists():
            return False, {"code": "NOT_IN_GAME", "msg": "Join first"}

        # Check if game has ended
        if game.status == "ended":
            return False, {"code": "GAME_ENDED", "msg": "Game has ended"}

        # Idempotency: if we already processed this client_seq, return the last tick/patch
        if Move.objects.filter(game=game, player_id=user_id, client_seq=client_seq).exists():
            return True, {"patch": {}, "server_tick": now_ms()}

        # Ensure it's this user's turn
        if game.turn_player_id and game.turn_player_id != user_id:
            return False, {"code": "NOT_YOUR_TURN", "msg": "Wait for your turn"}

        # Get player order
        try:
            GamePlayer.objects.get(game=game, player_id=user_id)
        except GamePlayer.DoesNotExist:
            return False, {"code": "NOT_IN_GAME", "msg": "Player not in game"}

        # Advance to next player first (we'll produce units for the next player)
        next_player_id = compute_next_player(game, user_id)

        # Clear scout-revealed coordinates for the current player (turn is ending)
        try:
            current_game_player = GamePlayer.objects.get(game=game, player_id=user_id)
            if current_game_player.scout_revealed_coords:
                current_game_player.scout_revealed_coords = []
                current_game_player.save(update_fields=["scout_revealed_coords"])
        except GamePlayer.DoesNotExist:
            pass

        # Get next player's order for unit production
        next_player_order = None
        if next_player_id:
            try:
                next_game_player = GamePlayer.objects.get(game=game, player_id=next_player_id)
                next_player_order = next_game_player.order
            except GamePlayer.DoesNotExist:
                pass

        field = game.field if game.field else []
        settings = game.settings if game.settings else {}
        width = settings.get("width", 20)
        height = settings.get("height", 20)

        # Produce units for the next player (whose turn is starting)
        # This also resets hasMoved for all units and applies building bonuses
        if next_player_order is not None:
            restore_and_produce_units(field, width, height, next_player_order, settings)
        else:
            # If no next player, just reset hasMoved for all units
            for x in range(width):
                for y in range(height):
                    cell = field[x][y]
                    unit = cell.get("unit")
                    if unit:
                        unit["hasMoved"] = False

        # Check if game has ended after unit production (new units can kill enemies at birth)
        winner_order = check_game_ended(
            field, width, height, len(GamePlayer.objects.filter(game=game))
        )

        # Persist changes to DB
        tick = now_ms()

        # 1. Save the end turn action to history
        Move.objects.create(
            game=game,
            player_id=user_id,
            payload={"type": "endTurn"},
            client_seq=client_seq,
            server_tick=tick,
        )

        # 2. Update field and turn player
        game.field = field
        game.turn_player_id = next_player_id

        # 3. Create patch with updated field and currentPlayer
        patch = {
            "field": field,  # Send full field with reset hasMoved flags
        }

        # Check if game ended after unit production
        if winner_order is not None:
            # Game ended - update status and include winner in patch
            game.status = "ended"
            game.save(update_fields=["field", "turn_player", "status"])
            patch["gameEnded"] = True
            patch["winner"] = winner_order
            # Get winner's user_id for display
            try:
                winner_player = GamePlayer.objects.get(game=game, order=winner_order)
                patch["winnerId"] = winner_player.player_id
                patch["winnerUsername"] = winner_player.player.username
            except GamePlayer.DoesNotExist:
                pass
        else:
            game.save(update_fields=["field", "turn_player"])

        # Add currentPlayer (order) to patch so clients know whose turn it is
        if next_player_id:
            try:
                next_player = GamePlayer.objects.get(game=game, player_id=next_player_id)
                patch["currentPlayer"] = next_player.order
            except GamePlayer.DoesNotExist:
                pass

        return True, {"patch": patch, "server_tick": tick}


def apply_scout_txn(game_code: str, user_id: int, payload: dict, client_seq: int):
    """
    Transactional, authoritative 'scout area' (obelisk reveal):
    - Lock game row
    - Check membership + turn order
    - Validate player has a unit on an obelisk
    - Reveal the area around target coordinates
    - Return patch with revealed area
    Returns: (ok, data|error)
    """
    with transaction.atomic():
        # Lock the game row
        game = Game.objects.select_for_update().get(game_code=game_code)

        # Membership guard
        if not GamePlayer.objects.filter(game=game, player_id=user_id).exists():
            return False, {"code": "NOT_IN_GAME", "msg": "Join first"}

        # Idempotency: if we already processed this client_seq, return the last tick/patch
        if Move.objects.filter(game=game, player_id=user_id, client_seq=client_seq).exists():
            return True, {"patch": {}, "server_tick": now_ms()}

        # Ensure it's this user's turn
        if game.turn_player_id and game.turn_player_id != user_id:
            return False, {"code": "NOT_YOUR_TURN", "msg": "Wait for your turn"}

        # Get player order
        try:
            game_player = GamePlayer.objects.get(game=game, player_id=user_id)
            player_order = game_player.order
        except GamePlayer.DoesNotExist:
            return False, {"code": "NOT_IN_GAME", "msg": "Player not in game"}

        # Get game settings
        settings = game.settings if game.settings else {}
        width = settings.get("width", 20)
        height = settings.get("height", 20)
        fog_of_war_radius = settings.get("fogOfWarRadius", 3)

        # Get target coordinates from payload
        target_coords = payload.get("targetCoords")
        if not target_coords or len(target_coords) != 2:
            return False, {"code": "INVALID_PAYLOAD", "msg": "Missing or invalid targetCoords"}

        target_x, target_y = target_coords[0], target_coords[1]

        # Validate coordinates are within bounds
        if target_x < 0 or target_x >= width or target_y < 0 or target_y >= height:
            return False, {"code": "INVALID_COORDS", "msg": "Target coordinates out of bounds"}

        # Get field
        field = game.field if game.field else []
        if not field or len(field) == 0:
            return False, {"code": "GAME_NOT_STARTED", "msg": "Game field not initialized"}

        # TODO: Make the check more precise
        # Validate that player has a unit on an obelisk
        has_unit_on_obelisk = False
        for x in range(width):
            for y in range(height):
                cell = field[x][y]
                if not cell:
                    continue
                unit = cell.get("unit")
                building = cell.get("building")
                if (
                    unit
                    and unit.get("player") == player_order
                    and building
                    and building.get("_type") == BUILDING_TYPES["OBELISK"]
                ):
                    has_unit_on_obelisk = True
                    break
            if has_unit_on_obelisk:
                break

        if not has_unit_on_obelisk:
            return False, {
                "code": "NO_OBELISK",
                "msg": "You must have a unit on an obelisk to scout",
            }

        # Get fog radius from payload (default to fogOfWarRadius)
        scout_radius = payload.get("fogRadius", fog_of_war_radius)

        # Reveal the area around target coordinates (square visibility)
        # Create a set of coordinates to reveal
        revealed_coords = set()
        for cur_x in range(target_x - scout_radius, target_x + scout_radius + 1):
            for cur_y in range(target_y - scout_radius, target_y + scout_radius + 1):
                if 0 <= cur_x < width and 0 <= cur_y < height:
                    revealed_coords.add((cur_x, cur_y))

        # IMPORTANT: Scout action should NOT modify the game field
        # It only reveals an area for the specific player
        # We send a partial patch that only updates the revealed cells
        # The client will merge this with their existing field

        # Calculate what the player can currently see (normal visibility, excluding scout-revealed)
        # We want to find what's newly revealed, so we calculate visibility without scout coords
        normal_visibility = calculate_visibility(
            field,
            width,
            height,
            player_order,
            fog_of_war_radius,
            settings.get("enableFogOfWar", True),
            None,  # Don't include scout coords yet
        )

        # Only include cells that are newly revealed (not already visible)
        newly_revealed_coords = revealed_coords - normal_visibility

        # Save revealed coordinates to GamePlayer (persist until turn ends)
        # Get current scout-revealed coordinates
        current_scout_coords = (
            game_player.scout_revealed_coords if game_player.scout_revealed_coords else []
        )
        # Convert to list of lists for JSON storage
        current_scout_set = {tuple(coord) for coord in current_scout_coords}
        # Add newly revealed coordinates
        updated_scout_set = current_scout_set | revealed_coords
        # Convert back to list of lists
        game_player.scout_revealed_coords = [list(coord) for coord in updated_scout_set]
        game_player.save(update_fields=["scout_revealed_coords"])

        # Create a partial field patch - only update newly revealed cells
        # Use None for cells that shouldn't be updated (client keeps existing values)
        revealed_field = []
        for x in range(width):
            row = []
            for y in range(height):
                if (x, y) in newly_revealed_coords:
                    # Newly revealed cell - include actual cell data
                    # Make sure isHidden is False
                    cell_data = dict(field[x][y]) if isinstance(field[x][y], dict) else field[x][y]
                    if isinstance(cell_data, dict):
                        cell_data = cell_data.copy()
                        cell_data["isHidden"] = False
                    row.append(cell_data)
                else:
                    # Don't update this cell - client keeps existing value
                    row.append(None)
            revealed_field.append(row)

        # Persist the scout action (for history, but doesn't modify game state)
        tick = now_ms()
        Move.objects.create(
            game=game, player_id=user_id, payload=payload, client_seq=client_seq, server_tick=tick
        )

        # NOTE: We do NOT save game.field here because scout doesn't modify the game state
        # The revealed area is only visible to this player, stored in GamePlayer.scout_revealed_coords

        # Create patch with partial field update (only newly revealed cells)
        patch = {
            "field": revealed_field,
        }

        # Keep currentPlayer the same (scouting doesn't change turn)
        if game.turn_player_id:
            try:
                current_player = GamePlayer.objects.get(game=game, player_id=game.turn_player_id)
                patch["currentPlayer"] = current_player.order
            except GamePlayer.DoesNotExist:
                pass

        return True, {"patch": patch, "server_tick": tick}


def check_game_ended(field, width, height, players_num: int) -> int | None:
    """
    Check if the game has ended (only 1 player remains).
    A player is eliminated if:
    - They have no units on the field
    - All their buildings are occupied by other players (building.player != their player order)

    Returns:
        int | None: The player order (0, 1, 2, ...) of the winner if game ended, None otherwise
    """
    # Count active players (players with units or unoccupied buildings)
    active_players = set()

    for x in range(width):
        for y in range(height):
            cell = field[x][y]
            if not cell:
                continue

            # Check units - if a player has units, they're still active
            unit = cell.get("unit")
            if unit and unit.get("player") is not None:
                active_players.add(unit["player"])

            # Check buildings - if a building belongs to a player and is not occupied by another player's unit, that player is active
            building = cell.get("building")
            if building and building.get("player") is not None:
                building_owner = building["player"]
                # If there's no unit on this building, or the unit belongs to the building owner, the owner is still active
                if not unit or (unit.get("player") == building_owner):
                    active_players.add(building_owner)

    # If only 1 player remains, game has ended
    if len(active_players) == 1:
        return list(active_players)[0]

    return None


def compute_next_player(game: Game, current_user_id: int) -> int | None:
    """
    Rotate to next player based on GamePlayer.order.
    """
    players = list(
        GamePlayer.objects.filter(game=game).order_by("order").values_list("player_id", flat=True)
    )
    if not players:
        return None
    try:
        idx = players.index(current_user_id)
        return players[(idx + 1) % len(players)]
    except ValueError:
        return players[0]
