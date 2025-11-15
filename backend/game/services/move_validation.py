"""
Move validation and processing logic for game moves.
"""

TERRAIN_TYPES = {
    'EMPTY': 'empty',
    'MOUNTAIN': 'mountain',
}

BUILDING_TYPES = {
    'BASE': 'base',
    'HABITATION': 'habitation',
    'TEMPLE': 'temple',
    'WELL': 'well',
    'STORAGE': 'storage',
    'OBELISK': 'obelisk',
}


def get_neighbours(wave_field, x, y, width, height):
    """Get valid neighboring cells for wave algorithm."""
    neighbours = []
    if x > 0 and wave_field[x - 1][y] != -1:
        neighbours.append([x - 1, y])
    if x < width - 1 and wave_field[x + 1][y] != -1:
        neighbours.append([x + 1, y])
    if y > 0 and wave_field[x][y - 1] != -1:
        neighbours.append([x, y - 1])
    if y < height - 1 and wave_field[x][y + 1] != -1:
        neighbours.append([x, y + 1])
    return neighbours


def get_wave_field(field, width, height, enable_scout_mode=True):
    """
    Create a wave field for pathfinding.
    Returns a 2D array where:
    - None = passable cell (empty terrain, no unit, and visible if scout mode enabled)
    - -1 = impassable cell (mountain, has unit, or hidden in scout mode)
    
    For multiplayer games, scout mode is always enabled, so hidden cells are impassable.
    If fog of war is disabled, all cells are visible (isHidden=False), so they're passable.
    """
    wave_field = []
    for x in range(width):
        col = []
        for y in range(height):
            # Handle case where field might be filtered (hidden cells might be None or placeholder)
            if x >= len(field) or y >= len(field[x]) if x < len(field) else True:
                col.append(-1)
                continue
                
            cell = field[x][y]
            if cell is None:
                col.append(-1)
                continue
                
            terrain_kind = cell.get('terrain', {}).get('kind', 'empty')
            has_unit = cell.get('unit') is not None
            is_hidden = cell.get('isHidden', False)
            
            # Check if cell is passable:
            # 1. Terrain must be EMPTY
            # 2. No unit in the cell
            # 3. If scout mode is enabled, cell must not be hidden
            is_passable = (
                terrain_kind == TERRAIN_TYPES['EMPTY'] and 
                not has_unit and
                not (enable_scout_mode and is_hidden)
            )
            
            if is_passable:
                col.append(None)
            else:
                col.append(-1)
        wave_field.append(col)
    return wave_field


def can_reach(field, width, height, x0, y0, x1, y1, move_points, enable_scout_mode=False):
    """
    Check if destination (x1, y1) is reachable from (x0, y0) within move_points.
    Uses wave algorithm (BFS) to find shortest path.
    """
    # print(f"[DEBUG] can_reach: from=({x0},{y0}), to=({x1},{y1}), move_points={move_points}")
    wave_field = get_wave_field(field, width, height, enable_scout_mode)
    
    # Debug: check source and destination in wave field
    # if x0 < len(wave_field) and y0 < len(wave_field[x0]):
    #     print(f"[DEBUG] wave_field[{x0}][{y0}] = {wave_field[x0][y0]}")
    # if x1 < len(wave_field) and y1 < len(wave_field[x1]):
    #     print(f"[DEBUG] wave_field[{x1}][{y1}] = {wave_field[x1][y1]}")
    
    wave_field[x0][y0] = 0
    wave = [[x0, y0]]
    visited = set()
    visited.add((x0, y0))
    
    while wave:
        cur_cell = wave.pop(0)
        x, y = cur_cell
        s = wave_field[x][y] + 1
        
        if s > move_points:
            # print(f"[DEBUG] can_reach: exceeded move_points at step {s}")
            return False
        
        neighbours = get_neighbours(wave_field, x, y, width, height)
        # print(f"[DEBUG] can_reach: at ({x},{y}), step={s-1}, found {len(neighbours)} neighbours")
        
        for neighbour in neighbours:
            cur_x, cur_y = neighbour
            if cur_x == x1 and cur_y == y1:
                # print(f"[DEBUG] can_reach: found destination at step {s}")
                return True
            if (cur_x, cur_y) not in visited and (wave_field[cur_x][cur_y] is None or wave_field[cur_x][cur_y] > s):
                wave_field[cur_x][cur_y] = s
                wave.append([cur_x, cur_y])
                visited.add((cur_x, cur_y))
    
    # print(f"[DEBUG] can_reach: exhausted all possibilities, destination not reached")
    return False


def validate_move(field, width, height, from_coords, to_coords, player_order, enable_scout_mode=False):
    """
    Validate if a move is legal.
    
    Returns: (is_valid, error_message)
    """
    x0, y0 = from_coords
    x1, y1 = to_coords
    
    # print(f"[DEBUG] validate_move: from=({x0},{y0}), to=({x1},{y1}), player_order={player_order}, enable_scout_mode={enable_scout_mode}")
    
    # Check bounds
    if x0 < 0 or x0 >= width or y0 < 0 or y0 >= height:
        return False, f"Source coordinates out of bounds: ({x0},{y0}) not in [0-{width-1}],[0-{height-1}]"
    if x1 < 0 or x1 >= width or y1 < 0 or y1 >= height:
        return False, f"Destination coordinates out of bounds: ({x1},{y1}) not in [0-{width-1}],[0-{height-1}]"
    
    # Check field structure
    if x0 >= len(field) or y0 >= len(field[x0]):
        return False, f"Source cell out of field structure: field has {len(field)} columns, column {x0} has {len(field[x0]) if x0 < len(field) else 0} rows"
    if x1 >= len(field) or y1 >= len(field[x1]):
        return False, f"Destination cell out of field structure: field has {len(field)} columns, column {x1} has {len(field[x1]) if x1 < len(field) else 0} rows"
    
    source_cell = field[x0][y0]
    dest_cell = field[x1][y1]
    
    # print(f"[DEBUG] source_cell: {source_cell}")
    # print(f"[DEBUG] dest_cell: {dest_cell}")
    
    # Check source has a unit
    unit = source_cell.get('unit')
    if not unit:
        return False, "No unit at source cell"
    
    # print(f"[DEBUG] unit found: player={unit.get('player')}, movePoints={unit.get('movePoints')}, hasMoved={unit.get('hasMoved')}")
    
    # Check unit belongs to player
    if unit.get('player') != player_order:
        return False, f"Unit does not belong to player: unit.player={unit.get('player')}, expected={player_order}"
    
    # Check unit hasn't moved yet
    if unit.get('hasMoved', False):
        return False, "Unit has already moved this turn"
    
    # Check destination terrain is EMPTY
    dest_terrain = dest_cell.get('terrain', {}).get('kind', 'empty')
    if dest_terrain != TERRAIN_TYPES['EMPTY']:
        return False, f"Destination terrain is not empty: {dest_terrain}"
    
    # Check destination cell is empty (no unit)
    if dest_cell.get('unit') is not None:
        return False, "Destination cell already has a unit"
    
    # Check reachability
    move_points = unit.get('movePoints', 0)
    # print(f"[DEBUG] Checking reachability: move_points={move_points}, distance={abs(x1-x0) + abs(y1-y0)}")
    if not can_reach(field, width, height, x0, y0, x1, y1, move_points, enable_scout_mode):
        return False, "Destination is not reachable within unit's move points"
    
    return True, None


def apply_move_to_cell(field, x0, y0, x1, y1, player_order, settings):
    """
    Apply move to the field: move unit from (x0, y0) to (x1, y1).
    Also handles building capture and killing neighbors.
    Field is modified in-place.
    
    Returns: (building_captured, cells_changed)
    where cells_changed is a list of [(x, y)] coordinates that changed
    """
    source_cell = field[x0][y0]
    dest_cell = field[x1][y1]
    unit = source_cell['unit']
    
    # Mark unit as moved
    unit['hasMoved'] = True
    
    # Move unit
    dest_cell['unit'] = unit
    source_cell['unit'] = None
    
    # Track changed cells (for potential future optimization)
    cells_changed = [(x0, y0), (x1, y1)]
    
    # Handle building capture
    building_captured = False
    building = dest_cell.get('building')
    if building and building.get('_type') == BUILDING_TYPES['BASE']:
        # Check if player can capture (hasn't exceeded base limit)
        max_bases = settings.get('maxBasesNum', 0)
        if max_bases == 0:  # No limit
            building['player'] = player_order
            building_captured = True
        else:
            # Count current bases and storage buildings
            bases_count = 0
            storage_count = 0
            for x in range(len(field)):
                for y in range(len(field[x])):
                    cell = field[x][y]
                    b = cell.get('building')
                    if b:
                        if b.get('_type') == BUILDING_TYPES['BASE'] and b.get('player') == player_order:
                            bases_count += 1
                        elif b.get('_type') == BUILDING_TYPES['STORAGE']:
                            # Check if storage is occupied by player's unit
                            u = cell.get('unit')
                            if u and u.get('player') == player_order:
                                storage_count += 1
            
            base_modifier = settings.get('baseModifier', 3)
            max_allowed = max_bases + storage_count * base_modifier
            
            if bases_count < max_allowed:
                building['player'] = player_order
                building_captured = True
    
    # Kill neighboring enemy units
    neighbours = []
    if x1 > 0:
        neighbours.append([x1 - 1, y1])
    if x1 < len(field) - 1:
        neighbours.append([x1 + 1, y1])
    if y1 > 0:
        neighbours.append([x1, y1 - 1])
    if y1 < len(field[x1]) - 1:
        neighbours.append([x1, y1 + 1])
    
    for nx, ny in neighbours:
        neighbour_cell = field[nx][ny]
        neighbour_unit = neighbour_cell.get('unit')
        if neighbour_unit and neighbour_unit.get('player') != player_order:
            # Kill enemy unit
            neighbour_cell['unit'] = None
            cells_changed.append((nx, ny))
    
    return building_captured, cells_changed

