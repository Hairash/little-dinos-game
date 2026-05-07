import copy

from django.db import transaction
from django.utils import timezone

from game.models import Game, GamePlayer, Move
from game.services import undo_state as undo
from game.services.field_diff import apply_field_diff, compute_field_diff
from game.services.move_validation import apply_move_to_cell, validate_move
from game.services.path import compute_path
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

        # Capture field state BEFORE the move (for undo)
        field_before = copy.deepcopy(field)

        # Capture the moving unit and compute the BFS path. We use the
        # per-player `field_for_validation` (built above with correct
        # `isHidden` for the moving player) — not raw `game.field`, which
        # carries `isHidden=True` on every cell and would make the wave field
        # treat everything as impassable in scout mode. Same input as
        # `validate_move`, so any path it finds is one the move rules accept.
        moving_unit = None
        try:
            src_cell = field_before[from_coords[0]][from_coords[1]]
            if isinstance(src_cell, dict):
                moving_unit = src_cell.get("unit")
        except (IndexError, TypeError):
            moving_unit = None
        move_path = None
        if moving_unit:
            move_path = compute_path(
                field_for_validation,
                width,
                height,
                from_coords[0],
                from_coords[1],
                to_coords[0],
                to_coords[1],
                moving_unit.get("movePoints", 1),
                enable_scout_mode,
            )

        # Capture visibility BEFORE the move (for undo eligibility check)
        visible_coords_before = None
        if enable_fog_of_war:
            visible_coords_before = calculate_visibility(
                field,
                width,
                height,
                player_order,
                fog_of_war_radius,
                enable_fog_of_war,
                scout_revealed_coords,
            )

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

        # Compute diff for undo (what changed)
        undo_diff = compute_field_diff(field_before, field, width, height)

        # Check if new cells were revealed (undo is not allowed if so)
        can_undo = True
        if enable_fog_of_war:
            visible_coords_after = calculate_visibility(
                field,
                width,
                height,
                player_order,
                fog_of_war_radius,
                enable_fog_of_war,
                scout_revealed_coords,
            )
            # If any new coords are visible, undo is not allowed
            if visible_coords_after - visible_coords_before:
                can_undo = False
        # Note: If fog of war is disabled, undo is always allowed

        # Create patch with full field (frontend expects full field for now)
        # TODO: Optimize to send only changed cells and merge on frontend
        patch = {
            "field": field,  # Send full field for now
            "lastMove": payload,
            "canUndo": can_undo,  # Include undo eligibility in response
        }
        if building_captured:
            patch["buildingCaptured"] = True
        # Animation hints. Stored on the patch as the FULL path; the consumer
        # slices it per recipient before sending so we never leak cells the
        # recipient can't see.
        if move_path and len(move_path) >= 2 and moving_unit:
            patch["path"] = move_path
            patch["movingUnit"] = copy.deepcopy(moving_unit)
            # Per-player PRE-MOVE visibility, used by the consumer to slice the
            # path. Computing visibility against the post-move field would be
            # wrong: if this move kills a recipient's unit, their post-move
            # visibility shrinks past the very cells the killer just walked
            # through, the slice comes out empty, and the recipient sees no
            # animation at all — only their fog snapping shut. The pre-move
            # snapshot keeps the slice meaningful in that case.
            #
            # Sent as `_visibilityByOrder` (string-keyed for JSON portability
            # over the channel layer). The consumer strips this key from the
            # outgoing patch before forwarding to the client.
            if enable_fog_of_war:
                visibility_by_order: dict[str, list[list[int]]] = {}
                for gp in GamePlayer.objects.filter(game=game):
                    other_scout = gp.scout_revealed_coords if gp.scout_revealed_coords else None
                    other_visible = calculate_visibility(
                        field_before,
                        width,
                        height,
                        gp.order,
                        fog_of_war_radius,
                        enable_fog_of_war,
                        other_scout,
                    )
                    visibility_by_order[str(gp.order)] = [[c[0], c[1]] for c in other_visible]
                patch["_visibilityByOrder"] = visibility_by_order

        # Don't advance turn after a move - turn only advances on "End Turn"
        # Keep currentPlayer in patch so clients know it's still this player's turn
        patch["currentPlayer"] = player_order

        # Persist changes to DB
        tick = now_ms()

        # 1. Save the move to history
        Move.objects.create(
            game=game, player_id=user_id, payload=payload, client_seq=client_seq, server_tick=tick
        )

        # 2. Update field and undo state. A new move is the most recent action,
        # so set_move drops any pending scout-undo layer.
        game.field = field  # Field was updated in-place by apply_move_to_cell
        undo.set_move(game, diff=undo_diff, can_undo=can_undo)

        # 3. Check if game has ended (only 1 player remains)
        winner_order = check_game_ended(
            field, width, height, len(GamePlayer.objects.filter(game=game))
        )
        write_fields = ["field", "undo_state"]
        if winner_order is not None:
            # Game ended - clear undo state (no further actions are possible) and
            # align the wire signal so a single source of truth (`gameEnded`) gates
            # the undo UI. Otherwise the patch would carry a stale `canUndo: true`
            # next to `gameEnded: true` — server would still reject any undo via
            # the status check, but the contradictory signal is a foot-gun.
            undo.clear(game)
            patch["canUndo"] = False
            game.status = "ended"
            game.save(update_fields=[*write_fields, "status"])
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
            game.save(update_fields=write_fields)

        return True, {"patch": patch, "server_tick": tick}


def apply_undo_txn(game_code: str, user_id: int, client_seq: int):
    """
    Transactional 'undo last move':
    - Lock game row
    - Check if undo is allowed (no new cells revealed)
    - Apply stored diff to restore field
    - Delete the last Move record
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

        # Idempotency: if we already processed this client_seq, return success
        if Move.objects.filter(game=game, player_id=user_id, client_seq=client_seq).exists():
            return True, {"patch": {}, "server_tick": now_ms()}

        # Ensure it's this user's turn
        if game.turn_player_id and game.turn_player_id != user_id:
            return False, {"code": "NOT_YOUR_TURN", "msg": "Wait for your turn"}

        # Get player order (needed for both undo paths)
        try:
            game_player = GamePlayer.objects.get(game=game, player_id=user_id)
            player_order = game_player.order
        except GamePlayer.DoesNotExist:
            return False, {"code": "NOT_IN_GAME", "msg": "Player not in game"}

        # Scout-undo takes priority: if a scout layer exists, revert just the scout.
        # The move was committed when the scout fired, so there is no chained move
        # undo to fall back to (set_scout dropped it).
        scout_layer = undo.get_scout(game)
        if scout_layer is not None:
            if not scout_layer["canUndo"]:
                return False, {"code": "UNDO_NOT_ALLOWED", "msg": "Cannot undo this scout"}

            unrevealed = [list(c) for c in scout_layer["coords"]]
            # Drop the unrevealed coords from the player's persisted scout reveals
            # so subsequent server-side visibility calculations re-hide them.
            current_scout = {tuple(c) for c in (game_player.scout_revealed_coords or [])}
            current_scout -= {tuple(c) for c in scout_layer["coords"]}
            game_player.scout_revealed_coords = [list(c) for c in current_scout]
            game_player.save(update_fields=["scout_revealed_coords"])

            undo.clear(game)
            game.save(update_fields=["undo_state"])

            tick = now_ms()
            Move.objects.create(
                game=game,
                player_id=user_id,
                payload={"type": "undo"},
                client_seq=client_seq,
                server_tick=tick,
            )
            patch = {
                "unrevealedCoords": unrevealed,
                # Tell the client to re-enter scout-target-selection mode. The
                # unit stays on the obelisk; only the scout choice is reverted.
                "reenterScoutMode": True,
                "undoApplied": True,
                # Move below was committed when scout fired; nothing to chain into.
                "canUndo": False,
                "currentPlayer": player_order,
            }
            # Private: scout-undo affects only this player's view (revealed coords
            # and scout-mode UI). Mirrors the apply_scout_txn delivery rule —
            # never broadcast scout/scout-undo to opponents.
            return True, {"patch": patch, "server_tick": tick, "private": True}

        # Move-undo path
        move_layer = undo.get_move(game)
        if move_layer is None or not move_layer["canUndo"]:
            return False, {"code": "UNDO_NOT_ALLOWED", "msg": "Cannot undo this move"}

        # Apply diff to restore field
        field = game.field if game.field else []
        apply_field_diff(field, move_layer["diff"])

        # Clear undo state (prevents double-undo)
        game.field = field
        undo.clear(game)
        game.save(update_fields=["field", "undo_state"])

        # Delete the last move record (the one being undone)
        last_move = (
            Move.objects.filter(game=game, player_id=user_id)
            .exclude(payload__type="endTurn")  # Don't delete end turn moves
            .exclude(payload__type="scout")  # Don't delete scout moves
            .exclude(payload__type="undo")  # Don't delete undo moves
            .order_by("-server_tick")
            .first()
        )
        if last_move:
            last_move.delete()

        # Save the undo action to history
        tick = now_ms()
        Move.objects.create(
            game=game,
            player_id=user_id,
            payload={"type": "undo"},
            client_seq=client_seq,
            server_tick=tick,
        )

        # Create patch with restored field
        patch = {
            "field": field,
            "undoApplied": True,
            "canUndo": False,  # Can't undo again after undo
            "currentPlayer": player_order,
        }

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

        # 2. Update field, turn player, and clear undo state at turn end.
        game.field = field
        game.turn_player_id = next_player_id
        undo.clear(game)

        # 3. Create patch with updated field and currentPlayer
        patch = {
            "field": field,  # Send full field with reset hasMoved flags
            "canUndo": False,  # Undo not available at start of turn
        }

        end_turn_fields = ["field", "turn_player", "undo_state"]

        # Check if game ended after unit production
        if winner_order is not None:
            # Game ended - update status and include winner in patch
            game.status = "ended"
            game.save(update_fields=[*end_turn_fields, "status"])
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
            game.save(update_fields=end_turn_fields)

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

        # Picking a scout target commits the move. set_scout drops the move-undo
        # layer: from this point the only undoable action is the scout choice itself.
        scout_can_undo = len(newly_revealed_coords) == 0
        undo.set_scout(
            game,
            coords=[list(c) for c in newly_revealed_coords],
            can_undo=scout_can_undo,
        )
        game.save(update_fields=["undo_state"])

        patch = {
            "field": revealed_field,
            "canUndo": scout_can_undo,
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
