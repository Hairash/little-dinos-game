"""Canonical Map JSON schema (v1) — Python side.

Mirrors ``frontend/src/game/mapSchema.js``. Keep field names and shapes in
sync; the cross-language fixture test asserts both sides decode the same
JSON.

The schema captures the *starting* state of a game — terrain, buildings,
units, player seat types, and the settings that drive generation/play.
Per-game runtime fields (fog, scores, hasMoved, ...) are stripped at the
canonical boundary so a saved map is a portable "map", not a save game.
"""

from typing import Any

from .field import calculate_unit_visibility

MAP_SCHEMA_VERSION = 1

# Stays in sync with the frontend SETTINGS_FIELDS list. Width/height and
# player counts live in metadata, not settings.
SETTINGS_FIELDS = [
    "sectorsNum",
    "enableFogOfWar",
    "fogOfWarRadius",
    "visibilitySpeedRelation",
    "speedMinVisibility",
    "minSpeed",
    "maxSpeed",
    "maxUnitsNum",
    "maxBasesNum",
    "unitModifier",
    "baseModifier",
    "buildingRates",
    "hideEnemySpeed",
    "killAtBirth",
    "enableUndo",
]


def _strip_unit(unit: dict | None) -> dict | None:
    if not unit:
        return None
    return {"player": unit["player"], "_type": unit["_type"]}


def _strip_building(building: dict | None) -> dict | None:
    if not building:
        return None
    return {"player": building["player"], "_type": building["_type"]}


def _strip_cell(cell: dict | None) -> dict | None:
    if not cell:
        return None
    return {
        "terrain": {"kind": cell["terrain"]["kind"], "idx": cell["terrain"]["idx"]},
        "building": _strip_building(cell.get("building")),
        "unit": _strip_unit(cell.get("unit")),
    }


def _strip_player(player: dict) -> dict:
    return {"_type": player["_type"]}


def _pick_settings(settings: dict) -> dict:
    return {k: settings[k] for k in SETTINGS_FIELDS if k in settings}


def to_canonical_map(
    *,
    field: list,
    settings: dict,
    players: list[dict],
    name: str,
    saved_at: str,
) -> dict:
    """Build a canonical Map dict from a server-side game snapshot.

    Args:
        field: 2D field array as stored in ``Game.field`` / ``Game.initial_field``.
        settings: Game settings dict (humanPlayersNum, botPlayersNum, ...).
        players: List of player dicts (each with at least ``_type``).
        name: Saved-map name.
        saved_at: ISO 8601 timestamp string (caller supplies; we don't read clock).
    """
    width = len(field)
    height = len(field[0]) if width > 0 else 0
    human_n = settings.get("humanPlayersNum", 0)
    bot_n = settings.get("botPlayersNum", 0)

    canonical_field = [[_strip_cell(field[x][y]) for y in range(height)] for x in range(width)]

    return {
        "version": MAP_SCHEMA_VERSION,
        "name": name,
        "metadata": {
            "playersNum": human_n + bot_n,
            "humanPlayersNum": human_n,
            "botPlayersNum": bot_n,
            "width": width,
            "height": height,
            "savedAt": saved_at,
        },
        "settings": _pick_settings(settings),
        "field": canonical_field,
        "players": [_strip_player(p) for p in players],
    }


def from_canonical_map(map_json: dict) -> dict:
    """Rehydrate game-startable structures from a canonical Map.

    Returns a dict ``{"field": ..., "players": ..., "settings": ..., "metadata": ...}``
    where ``settings`` is merged with width/height/playersNum so the caller
    can plug it straight into the same paths used by random-map creation.

    Raises ``ValueError`` on validation failure.
    """
    validate_map(map_json)

    m = map_json["metadata"]
    width, height = m["width"], m["height"]

    field: list[list[dict]] = []
    for x in range(width):
        col: list[dict] = []
        for y in range(height):
            src = map_json["field"][x][y]
            cell: dict[str, Any] = {
                "terrain": {"kind": src["terrain"]["kind"], "idx": src["terrain"]["idx"]},
                "building": None,
                "unit": None,
                "isHidden": True,
            }
            if src.get("building"):
                cell["building"] = {
                    "player": src["building"]["player"],
                    "_type": src["building"]["_type"],
                }
            if src.get("unit"):
                # movePoints / visibility get re-derived at game start; seed
                # with neutral values and let the engine recompute.
                cell["unit"] = {
                    "player": src["unit"]["player"],
                    "_type": src["unit"]["_type"],
                    "movePoints": 0,
                    "visibility": 0,
                    "hasMoved": False,
                }
            col.append(cell)
        field.append(col)

    players = [{"_type": p["_type"]} for p in map_json["players"]]

    settings = {
        **map_json["settings"],
        "width": width,
        "height": height,
        "humanPlayersNum": m["humanPlayersNum"],
        "botPlayersNum": m["botPlayersNum"],
    }

    return {"field": field, "players": players, "settings": settings, "metadata": m}


def validate_map(map_json: dict) -> None:
    """Validate the shape of a canonical Map dict. Raise ``ValueError`` on mismatch.

    Loud-fail on unknown version: a v1 reader must reject v2 rather than
    silently misinterpret it.
    """
    if not isinstance(map_json, dict):
        raise ValueError("Invalid map: not a dict")
    if map_json.get("version") != MAP_SCHEMA_VERSION:
        raise ValueError(
            f"Unsupported map schema version: {map_json.get('version')} "
            f"(this reader supports v{MAP_SCHEMA_VERSION})"
        )
    name = map_json.get("name")
    if not isinstance(name, str) or not name:
        raise ValueError("Invalid map: missing name")

    m = map_json.get("metadata")
    if not isinstance(m, dict):
        raise ValueError("Invalid map: missing metadata")
    width, height = m.get("width"), m.get("height")
    if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
        raise ValueError("Invalid map: bad dimensions")
    players_num = m.get("playersNum")
    if not isinstance(players_num, int) or players_num <= 0:
        raise ValueError("Invalid map: bad playersNum")
    if m.get("humanPlayersNum", 0) + m.get("botPlayersNum", 0) != players_num:
        raise ValueError("Invalid map: human+bot != playersNum")

    field = map_json.get("field")
    if not isinstance(field, list) or len(field) != width:
        raise ValueError("Invalid map: field width mismatch")
    for x in range(width):
        col = field[x]
        if not isinstance(col, list) or len(col) != height:
            raise ValueError(f"Invalid map: field height mismatch at x={x}")

    players = map_json.get("players")
    if not isinstance(players, list) or len(players) != players_num:
        raise ValueError("Invalid map: players[] length != playersNum")

    if not isinstance(map_json.get("settings"), dict):
        raise ValueError("Invalid map: missing settings")


def hydrate_field_for_game(canonical_field: list, settings: dict) -> list:
    """Build an engine-ready ``Game.field`` from a canonical Map's field array.

    The canonical schema deliberately strips per-cell runtime fields
    (``isHidden``) and per-unit runtime fields (``movePoints``,
    ``visibility``, ``hasMoved``). When a saved map is launched, those need
    to be reseeded to the same values ``generate_field`` would emit for a
    fresh game — otherwise units land on the board with undefined speed
    and broken visibility on turn 1 (the engine doesn't re-derive these
    until end-turn, so the first move misbehaves).

    Mirrors the unit initialisation in ``field.generate_field`` and the JS
    counterpart in ``DinoGame.vue``'s saved-map branch.
    """
    min_speed = settings.get("minSpeed", 1)
    fog_of_war_radius = settings.get("fogOfWarRadius", 3)
    visibility_speed_relation = settings.get("visibilitySpeedRelation", True)
    speed_min_visibility = settings.get("speedMinVisibility", 7)

    out: list[list[dict]] = []
    for col in canonical_field:
        new_col: list[dict] = []
        for src in col:
            cell: dict[str, Any] = {
                "terrain": {"kind": src["terrain"]["kind"], "idx": src["terrain"]["idx"]},
                "building": None,
                "unit": None,
                "isHidden": True,
            }
            if src.get("building"):
                cell["building"] = {
                    "player": src["building"]["player"],
                    "_type": src["building"]["_type"],
                }
            if src.get("unit"):
                move_points = min_speed
                visibility = fog_of_war_radius
                if visibility_speed_relation:
                    # Same odd call shape `generate_field` uses for the
                    # *initial* unit: speed_min_visibility takes the
                    # max_speed slot. Don't simplify without also
                    # changing the random-roll path.
                    visibility = calculate_unit_visibility(
                        move_points, min_speed, speed_min_visibility, fog_of_war_radius
                    )
                cell["unit"] = {
                    "player": src["unit"]["player"],
                    "_type": src["unit"]["_type"],
                    "movePoints": move_points,
                    "visibility": visibility,
                    "hasMoved": False,
                }
            new_col.append(cell)
        out.append(new_col)
    return out


def capture_initial_snapshot(game) -> None:
    """Copy ``game.field`` into ``game.initial_field`` once, before any move.

    Idempotent: a second call is a no-op so reconnects don't overwrite the
    snapshot. Mutates and saves the ``Game`` row.
    """
    if game.initial_field:
        return
    import copy

    game.initial_field = copy.deepcopy(game.field)
    game.save(update_fields=["initial_field"])
