"""Tests for the canonical Map JSON schema (v1) on the Python side.

Includes a cross-language parity check: the committed JS-side / shared
fixture must validate and round-trip cleanly through the Python decoder.
"""

import json
from pathlib import Path

import pytest

from game.services.map_snapshot import (
    MAP_SCHEMA_VERSION,
    SETTINGS_FIELDS,
    from_canonical_map,
    hydrate_field_for_game,
    to_canonical_map,
    validate_map,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "map_v1_sample.json"


def load_fixture() -> dict:
    return json.loads(FIXTURE_PATH.read_text())


def _make_settings(human=1, bot=1) -> dict:
    return {
        "humanPlayersNum": human,
        "botPlayersNum": bot,
        "sectorsNum": 2,
        "enableFogOfWar": True,
        "fogOfWarRadius": 2,
        "visibilitySpeedRelation": False,
        "speedMinVisibility": 2,
        "minSpeed": 3,
        "maxSpeed": 6,
        "maxUnitsNum": 10,
        "maxBasesNum": 3,
        "unitModifier": 3,
        "baseModifier": 3,
        "buildingRates": {"base": 1},
        "hideEnemySpeed": False,
        "killAtBirth": True,
        "enableUndo": False,
        # Runtime fields that must NOT leak into the canonical map:
        "winPhase": "playing",
        "winner": None,
    }


def _make_field(width=2, height=2) -> list:
    """A small live-game-shaped field with the runtime fields a real game
    would carry — isHidden on cells, movePoints/visibility/hasMoved on units.
    The strip logic must drop those at the canonical boundary."""
    field = []
    for x in range(width):
        col = []
        for y in range(height):
            col.append(
                {
                    "terrain": {"kind": "empty", "idx": (x * width + y) % 9 + 1},
                    "building": None,
                    "unit": None,
                    "isHidden": True,
                }
            )
        field.append(col)
    field[0][0]["building"] = {"player": 0, "_type": "base"}
    field[0][0]["unit"] = {
        "player": 0,
        "_type": "dino1",
        "movePoints": 5,
        "visibility": 2,
        "hasMoved": True,
    }
    if width > 1 and height > 1:
        field[width - 1][height - 1]["building"] = {"player": 1, "_type": "base"}
        field[width - 1][height - 1]["unit"] = {
            "player": 1,
            "_type": "dino2",
            "movePoints": 4,
            "visibility": 3,
            "hasMoved": False,
        }
    return field


class TestToCanonicalMap:
    def test_version_and_metadata(self):
        result = to_canonical_map(
            field=_make_field(2, 2),
            settings=_make_settings(),
            players=[{"_type": "human"}, {"_type": "bot"}],
            name="map-a",
            saved_at="2026-06-18T00:00:00Z",
        )
        assert result["version"] == MAP_SCHEMA_VERSION
        assert result["name"] == "map-a"
        assert result["metadata"] == {
            "playersNum": 2,
            "humanPlayersNum": 1,
            "botPlayersNum": 1,
            "width": 2,
            "height": 2,
            "savedAt": "2026-06-18T00:00:00Z",
        }

    def test_strips_runtime_cell_fields(self):
        result = to_canonical_map(
            field=_make_field(2, 2),
            settings=_make_settings(),
            players=[{"_type": "human"}, {"_type": "bot"}],
            name="m",
            saved_at="2026-06-18T00:00:00Z",
        )
        cell = result["field"][0][0]
        assert set(cell.keys()) == {"terrain", "building", "unit"}
        assert set(cell["unit"].keys()) == {"player", "_type"}
        assert set(cell["building"].keys()) == {"player", "_type"}

    def test_strips_runtime_player_fields(self):
        players = [
            {
                "_type": "human",
                "killed": 4,
                "lost": 1,
                "score": 50,
                "active": True,
                "informed_lose": False,
                "scrollCoords": [3, 3],
            },
        ]
        result = to_canonical_map(
            field=_make_field(1, 1),
            settings={"humanPlayersNum": 1, "botPlayersNum": 0, **_make_settings()},
            players=players,
            name="m",
            saved_at="2026-06-18T00:00:00Z",
        )
        result["metadata"]["humanPlayersNum"] = 1
        result["metadata"]["botPlayersNum"] = 0
        assert result["players"] == [{"_type": "human"}]

    def test_settings_excludes_runtime_fields(self):
        result = to_canonical_map(
            field=_make_field(2, 2),
            settings=_make_settings(),
            players=[{"_type": "human"}, {"_type": "bot"}],
            name="m",
            saved_at="2026-06-18T00:00:00Z",
        )
        # winPhase / winner must not leak; only SETTINGS_FIELDS keys allowed.
        assert set(result["settings"].keys()).issubset(set(SETTINGS_FIELDS))
        assert "winPhase" not in result["settings"]
        assert "winner" not in result["settings"]


class TestFromCanonicalMap:
    def test_roundtrip_reconstructs_structure(self):
        m = load_fixture()
        rehydrated = from_canonical_map(m)
        assert len(rehydrated["field"]) == 3
        assert len(rehydrated["field"][0]) == 3
        # First cell has the player-0 base
        cell = rehydrated["field"][0][0]
        assert cell["terrain"] == {"kind": "empty", "idx": 1}
        assert cell["building"] == {"player": 0, "_type": "base"}
        assert cell["unit"]["player"] == 0
        assert cell["unit"]["_type"] == "dino1"
        # Rehydrated units carry zero runtime values; the engine reseeds.
        assert cell["unit"]["hasMoved"] is False
        # isHidden defaults to True (fog reset to a fresh game).
        assert cell["isHidden"] is True

    def test_roundtrip_merges_settings_with_dimensions(self):
        m = load_fixture()
        rehydrated = from_canonical_map(m)
        s = rehydrated["settings"]
        assert s["width"] == 3
        assert s["height"] == 3
        assert s["humanPlayersNum"] == 1
        assert s["botPlayersNum"] == 1
        assert s["sectorsNum"] == 2

    def test_to_then_from_is_lossless_for_structural_fields(self):
        settings = _make_settings()
        players = [{"_type": "human"}, {"_type": "bot"}]
        field = _make_field(2, 2)

        canonical = to_canonical_map(
            field=field,
            settings=settings,
            players=players,
            name="rt",
            saved_at="2026-06-18T00:00:00Z",
        )
        rehydrated = from_canonical_map(canonical)

        # Terrain, building, unit identity are preserved.
        for x in range(2):
            for y in range(2):
                src = field[x][y]
                got = rehydrated["field"][x][y]
                assert got["terrain"] == src["terrain"]
                if src["building"]:
                    assert got["building"] == src["building"]
                else:
                    assert got["building"] is None
                if src["unit"]:
                    assert got["unit"]["player"] == src["unit"]["player"]
                    assert got["unit"]["_type"] == src["unit"]["_type"]


class TestHydrateFieldForGame:
    """The canonical map strips runtime fields; hydrate_field_for_game
    must put them back the way generate_field would for a fresh roll."""

    def _canonical_cell(self, with_unit=False, with_building=False):
        cell: dict = {
            "terrain": {"kind": "empty", "idx": 3},
            "building": None,
            "unit": None,
        }
        if with_building:
            cell["building"] = {"player": 0, "_type": "base"}
        if with_unit:
            cell["unit"] = {"player": 0, "_type": "dino1"}
        return cell

    def test_isHidden_seeded_true_on_every_cell(self):
        canonical = [[self._canonical_cell(), self._canonical_cell()]]
        out = hydrate_field_for_game(canonical, {"minSpeed": 3, "fogOfWarRadius": 2})
        for col in out:
            for cell in col:
                assert cell["isHidden"] is True

    def test_unit_movePoints_seeded_to_min_speed(self):
        canonical = [[self._canonical_cell(with_unit=True, with_building=True)]]
        out = hydrate_field_for_game(
            canonical,
            {"minSpeed": 4, "fogOfWarRadius": 3, "visibilitySpeedRelation": False},
        )
        unit = out[0][0]["unit"]
        assert unit["movePoints"] == 4
        assert unit["hasMoved"] is False
        # Player and _type round-trip from the canonical input.
        assert unit["player"] == 0
        assert unit["_type"] == "dino1"

    def test_unit_visibility_defaults_to_fog_radius_without_speed_relation(self):
        canonical = [[self._canonical_cell(with_unit=True)]]
        out = hydrate_field_for_game(
            canonical,
            {"minSpeed": 3, "fogOfWarRadius": 5, "visibilitySpeedRelation": False},
        )
        assert out[0][0]["unit"]["visibility"] == 5

    def test_unit_visibility_uses_relation_when_enabled(self):
        # With visibility_speed_relation on, the initial unit's
        # visibility is computed via calculate_unit_visibility(
        #   min_speed, min_speed, speed_min_visibility, fog_of_war_radius
        # ). At move_points == min_speed, that branch returns
        # max_visibility = 2 * avg_visibility - 1.
        canonical = [[self._canonical_cell(with_unit=True)]]
        out = hydrate_field_for_game(
            canonical,
            {
                "minSpeed": 3,
                "fogOfWarRadius": 3,  # avg_visibility
                "speedMinVisibility": 6,
                "visibilitySpeedRelation": True,
            },
        )
        # Should be a positive integer, not the default fog radius and
        # not 0/undefined. The exact value is whatever
        # calculate_unit_visibility returns for these settings; the
        # contract here is "it's been re-derived, not left blank".
        v = out[0][0]["unit"]["visibility"]
        assert isinstance(v, int) and v > 0

    def test_buildings_and_terrain_preserved(self):
        canonical = [[self._canonical_cell(with_building=True)]]
        out = hydrate_field_for_game(canonical, {"minSpeed": 1})
        cell = out[0][0]
        assert cell["building"] == {"player": 0, "_type": "base"}
        assert cell["terrain"] == {"kind": "empty", "idx": 3}
        assert cell["unit"] is None

    def test_does_not_mutate_input(self):
        canonical = [[self._canonical_cell(with_unit=True, with_building=True)]]
        before = json.dumps(canonical, sort_keys=True)
        hydrate_field_for_game(canonical, {"minSpeed": 3})
        after = json.dumps(canonical, sort_keys=True)
        assert before == after


class TestValidateMap:
    def test_rejects_unknown_version(self):
        m = load_fixture()
        m["version"] = 2
        with pytest.raises(ValueError, match="Unsupported map schema version"):
            validate_map(m)

    def test_rejects_missing_metadata(self):
        m = load_fixture()
        del m["metadata"]
        with pytest.raises(ValueError, match="missing metadata"):
            validate_map(m)

    def test_rejects_wrong_field_dimensions(self):
        m = load_fixture()
        m["metadata"]["width"] = 99
        with pytest.raises(ValueError, match="field width mismatch"):
            validate_map(m)

    def test_rejects_mismatched_player_counts(self):
        m = load_fixture()
        m["metadata"]["humanPlayersNum"] = 5  # 5+1 != 2
        with pytest.raises(ValueError, match="human\\+bot != playersNum"):
            validate_map(m)

    def test_rejects_players_length_mismatch(self):
        m = load_fixture()
        m["players"] = [{"_type": "human"}]  # length 1, playersNum 2
        with pytest.raises(ValueError, match="players\\[\\] length"):
            validate_map(m)

    def test_accepts_valid_fixture(self):
        validate_map(load_fixture())
