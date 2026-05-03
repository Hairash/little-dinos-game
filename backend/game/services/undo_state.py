"""Helpers that own the schema of Game.undo_state.

The field stores at most one pending undo layer. JSON schema:

    None                                       — nothing to undo
    {"move":  {"diff": [...], "canUndo": bool}}  — pending move undo
    {"scout": {"coords": [[x,y], ...], "canUndo": bool}}  — pending scout undo

Move and scout layers are mutually exclusive in this codebase: picking a
scout target commits the move, replacing the move layer with a scout layer.
A new move drops any pending scout layer.

Always pair changes with `update_fields=[..., "undo_state"]` on save.
"""


def clear(game) -> None:
    game.undo_state = None


def set_move(game, *, diff: list, can_undo: bool) -> None:
    """Set the move-undo layer. Drops any pending scout layer."""
    game.undo_state = {"move": {"diff": diff, "canUndo": can_undo}}


def set_scout(game, *, coords: list, can_undo: bool) -> None:
    """Set the scout-undo layer. Drops the move layer (a scout commits the move)."""
    game.undo_state = {"scout": {"coords": coords, "canUndo": can_undo}}


def get_move(game) -> dict | None:
    return (game.undo_state or {}).get("move")


def get_scout(game) -> dict | None:
    return (game.undo_state or {}).get("scout")
