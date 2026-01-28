import math
import random

MOUNTAIN_RATIO = 0.75  # Ratio of cells that will be empty (others - mountains)

TERRAIN_TYPES = {
    "EMPTY": "empty",
    "MOUNTAIN": "mountain",
}

BUILDING_TYPES = {
    "BASE": "base",
    "HABITATION": "habitation",
    "TEMPLE": "temple",
    "WELL": "well",
    "STORAGE": "storage",
    "OBELISK": "obelisk",
}


def generate_field(settings: dict) -> list:
    """Generate a field based on the settings."""
    players_num = settings.get("humanPlayersNum", 1) + settings.get("botPlayersNum", 0)
    width = settings.get("width", 20)
    height = settings.get("height", 20)
    sectors_num = settings.get("sectorsNum", 4)
    min_speed = settings.get("minSpeed", 1)
    speed_min_visibility = settings.get("speedMinVisibility", 7)
    fog_of_war_radius = settings.get("fogOfWarRadius", 3)
    visibility_speed_relation = settings.get("visibilitySpeedRelation", True)
    building_rates = settings.get("buildingRates", {})

    start_positions: list[list[int]] = []

    # Generate base terrain
    field: list[list[dict]] = []
    for _x in range(width):
        col: list[dict] = []
        for _y in range(height):
            r = random.random()
            terrain_kind = (
                TERRAIN_TYPES["MOUNTAIN"] if r > MOUNTAIN_RATIO else TERRAIN_TYPES["EMPTY"]
            )
            cell = {
                "terrain": {
                    "kind": terrain_kind,
                    "idx": math.ceil(random.random() * 9),
                },
                "building": None,
                "unit": None,
                "isHidden": True,
            }
            col.append(cell)
        field.append(col)

    # Set units and bases for players
    sectors: list[list[int]] = []
    for player in range(players_num):
        x = random.randint(0, width - 1)
        y = random.randint(0, height - 1)
        sector_x, sector_y = get_sector(x, y, width, height, sectors_num)

        try_ctr = 0
        while (
            field[x][y]["terrain"]["kind"] == TERRAIN_TYPES["MOUNTAIN"]
            or is_cell_in_start_positions(x, y, start_positions)
            or (not validate_sector(sector_x, sector_y, sectors, sectors_num) and try_ctr < 100)
        ):
            x = random.randint(0, width - 1)
            y = random.randint(0, height - 1)
            sector_x, sector_y = get_sector(x, y, width, height, sectors_num)
            if field[x][y]["terrain"]["kind"] != TERRAIN_TYPES[
                "MOUNTAIN"
            ] and not is_cell_in_start_positions(x, y, start_positions):
                try_ctr += 1

        sectors.append([sector_x, sector_y])
        field[x][y]["building"] = {
            "player": player,
            "_type": BUILDING_TYPES["BASE"],
        }

        # Create unit
        move_points = min_speed  # Initial unit gets min_speed
        visibility = fog_of_war_radius
        if visibility_speed_relation:
            # Note: In JS, speedMinVisibility is passed as maxSpeed parameter to calculateUnitVisibility
            visibility = calculate_unit_visibility(
                move_points, min_speed, speed_min_visibility, fog_of_war_radius
            )

        field[x][y]["unit"] = {
            "player": player,
            "_type": f"dino{player + 1}",
            "movePoints": move_points,
            "visibility": visibility,
            "hasMoved": False,
        }
        start_positions.append([x, y])

    # Set buildings BEFORE making field linked so they become reachable too
    min_distance = 5
    for building_type, rate in building_rates.items():
        if rate == 0:
            continue
        average = 2**rate
        min_buildings = math.floor(average / 2)
        max_buildings = math.ceil(average * 1.5)
        buildings_num = max(
            1,
            math.floor(
                (random.random() * (max_buildings - min_buildings + 1) + min_buildings)
                * width
                * height
                * 0.0025
            ),
        )

        for _building_ctr in range(buildings_num):
            if min_distance < 0:
                break
            fail_ctr = 0
            x = random.randint(0, width - 1)
            y = random.randint(0, height - 1)
            while field[x][y]["terrain"]["kind"] == TERRAIN_TYPES[
                "MOUNTAIN"
            ] or not no_buildings_in_distance(field, x, y, min_distance, width, height):
                x = random.randint(0, width - 1)
                y = random.randint(0, height - 1)
                fail_ctr += 1
                if fail_ctr > 100:
                    min_distance -= 1
                    fail_ctr = 0
                    if min_distance < 0:
                        print(
                            f"Warning: Cannot place {building_type} building, all the cells are occupied"
                        )
                        x = -1  # Use -1 instead of None to indicate invalid
                        y = -1
                        break

            if x >= 0 and y >= 0:
                field[x][y]["building"] = {
                    "player": None,
                    "_type": building_type,
                }

    # Make field linked (ensure all players AND buildings can reach each other)
    building_positions = get_building_positions(field, width, height)
    all_targets = start_positions + building_positions
    if len(all_targets) > 1:
        make_field_linked(field, width, height, all_targets)

    return field


def get_sector(x, y, width, height, sectors_num):
    """Get sector coordinates for a given cell position."""
    return [math.floor(x * sectors_num / width), math.floor(y * sectors_num / height)]


def validate_sector(x, y, sectors, sectors_num):
    """Validate that sector is on the edge and not too close to other sectors."""
    if not (x == 0 or x == sectors_num - 1 or y == 0 or y == sectors_num - 1):
        return False
    return all(sectors_distance([x, y], sector) >= 2 for sector in sectors)


def sectors_distance(s1, s2):
    """Calculate distance between two sectors."""
    s1_x, s1_y = s1
    s2_x, s2_y = s2
    return max(abs(s1_x - s2_x), abs(s1_y - s2_y))


def is_cell_in_start_positions(x, y, start_positions):
    """Check if cell is in start positions."""
    return any(pos[0] == x and pos[1] == y for pos in start_positions)


def get_building_positions(field, width, height):
    """Get positions of all non-player buildings (neutral buildings)."""
    positions = []
    for x in range(width):
        for y in range(height):
            building = field[x][y].get("building")
            if building and building.get("player") is None:
                positions.append([x, y])
    return positions


def no_buildings_in_distance(field, x, y, r, width, height):
    """Check if there are no buildings within distance r."""
    for cur_x in range(x - r, x + r + 1):
        if cur_x < 0 or cur_x >= width:
            continue
        for cur_y in range(y - r, y + r + 1):
            if cur_y < 0 or cur_y >= height:
                continue
            if abs(cur_x - x) + abs(cur_y - y) > r:
                continue
            if field[cur_x][cur_y]["building"]:
                return False
    return True


def make_field_linked(field, width, height, targets):
    """Ensure all targets (players and buildings) can reach each other by removing mountains.

    Args:
        field: The game field
        width: Field width
        height: Field height
        targets: List of [x, y] positions that must all be reachable from each other
    """
    w_field = wave(field, width, height, targets)

    # Check if all targets are already reachable
    if all_targets_reached(w_field, targets):
        return

    max_num_cell = get_max_num_cell(w_field, field, targets)
    max_num = max_num_cell["num"]
    max_cell = max_num_cell["cell"]

    # If no valid cell found or max_num is 0, all targets are reachable
    if not max_cell or max_num == 0:
        return

    start_x, start_y = max_cell

    while not all_targets_reached(w_field, targets) and max_num > 0:
        fix_wave(w_field, field, width, height, max_num, start_x, start_y)
        w_field = wave(field, width, height, targets)
        max_num_cell = get_max_num_cell(w_field, field, targets)
        max_num = max_num_cell["num"]
        max_cell = max_num_cell["cell"]

        # Check if we still have a valid cell to process
        if not max_cell or max_num == 0:
            break

        start_x, start_y = max_cell


def wave(field, width, height, targets):
    """Create wave field - number of walls from first target position to each other target.

    Args:
        field: The game field
        width: Field width
        height: Field height
        targets: List of [x, y] positions (players and buildings)

    Returns:
        A 2D array where each cell contains the number of mountains to cross to reach it.
    """
    w_field = []
    for _x in range(width):
        line = []
        for _y in range(height):
            line.append(999)  # MAX_INT equivalent
        w_field.append(line)

    start_x, start_y = targets[0]
    w_field[start_x][start_y] = 0
    queue = [[start_x, start_y]]

    while queue:
        cur_x, cur_y = queue.pop(0)
        neighbours = find_neighbours(cur_x, cur_y, width, height)
        for x, y in neighbours:
            prev_value = w_field[x][y]
            if field[x][y]["terrain"]["kind"] == TERRAIN_TYPES["MOUNTAIN"]:
                w_field[x][y] = min(w_field[x][y], w_field[cur_x][cur_y] + 1)
            else:
                w_field[x][y] = min(w_field[x][y], w_field[cur_x][cur_y])
            if w_field[x][y] < prev_value:
                queue.append([x, y])

    return w_field


def find_neighbours(x, y, width, height):
    """Get list of neighbors of cell."""
    neighbours = []
    if x > 0:
        neighbours.append([x - 1, y])
    if x < width - 1:
        neighbours.append([x + 1, y])
    if y > 0:
        neighbours.append([x, y - 1])
    if y < height - 1:
        neighbours.append([x, y + 1])
    return neighbours


def get_max_num_cell(w_field, field, targets):
    """Get target with max number of walls on the path to it.

    Args:
        w_field: The wave field
        field: The game field
        targets: List of [x, y] positions (players and buildings)

    Returns:
        dict with 'num' (max wave value) and 'cell' (coordinates [x, y]).
        If all targets are reachable (wave value 0), returns empty cell list.
    """
    max_val = 0
    max_cell = []
    for x, y in targets:
        # Skip if this position is a mountain (shouldn't happen, but safety check)
        if field[x][y]["terrain"]["kind"] == TERRAIN_TYPES["MOUNTAIN"]:
            continue
        cell_value = w_field[x][y]
        if cell_value > max_val:
            max_cell = [x, y]
            max_val = cell_value
    return {"num": max_val, "cell": max_cell}


def fix_wave(w_field, field, width, height, max_num, start_x, start_y):
    """Remove wall with highest wave value."""
    queue = [[start_x, start_y]]
    visited_cells = set()

    while queue:
        cur_x, cur_y = queue.pop(0)
        if f"{cur_x}, {cur_y}" in visited_cells:
            continue
        visited_cells.add(f"{cur_x}, {cur_y}")

        neighbours = find_neighbours(cur_x, cur_y, width, height)
        for x, y in neighbours:
            if w_field[x][y] != max_num:
                continue
            if field[x][y]["terrain"]["kind"] == TERRAIN_TYPES["MOUNTAIN"]:
                if fix_wall(w_field, field, width, height, max_num, x, y):
                    return
            else:
                if f"{x}, {y}" not in visited_cells:
                    queue.append([x, y])


def fix_wall(w_field, field, width, height, max_num, wall_x, wall_y):
    """Remove wall from cell if there is an N-1 wall nearby."""
    neighbours = find_neighbours(wall_x, wall_y, width, height)
    for x, y in neighbours:
        if w_field[x][y] == max_num - 1:
            field[wall_x][wall_y]["terrain"]["kind"] = TERRAIN_TYPES["EMPTY"]
            return True
    return False


def all_targets_reached(w_field, targets):
    """Check that all targets (players and buildings) have paths to each other.

    Args:
        w_field: The wave field
        targets: List of [x, y] positions (players and buildings)

    Returns:
        True if all targets can reach each other without crossing mountains.
    """
    return all(w_field[x][y] <= 0 for x, y in targets)


def calculate_unit_visibility(move_points, min_speed, max_speed, avg_visibility):
    """Calculate unit visibility based on move points and speed.

    Note: This matches the JavaScript signature where max_speed parameter
    actually receives speed_min_visibility value in the initial unit creation.
    """
    if move_points > max_speed:
        return 1
    if min_speed == max_speed:
        return avg_visibility

    min_visibility = 1
    max_visibility = 2 * avg_visibility - min_visibility

    normalized_speed = (
        (move_points - min_speed) / (max_speed - min_speed) if max_speed != min_speed else 0
    )
    adjusted_speed = adjust_speed(normalized_speed)
    visibility = min_visibility + round((max_visibility - min_visibility) * adjusted_speed)
    return visibility


def adjust_speed(x):
    """Takes number 0..1 and returns number 0..1."""
    factor = 2
    shift = 0.05
    result = (-math.tan((x - 1 / 2) * factor) / math.tan(1 / 2 * factor) + 1) / 2 - shift
    # Clamp to [0, 1] range to handle edge cases
    return max(0, min(1, result))
