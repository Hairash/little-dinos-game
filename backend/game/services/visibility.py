"""
Visibility service - calculates which cells are visible to a player
based on their units, buildings, and fog of war settings.
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


def calculate_visibility(field, width, height, player_order, fog_of_war_radius, enable_fog_of_war, scout_revealed_coords=None):
    """
    Calculate which cells are visible to a specific player.
    
    Args:
        field: 2D array of cells
        width: Field width
        height: Field height
        player_order: Player's order/index (0, 1, 2, ...)
        fog_of_war_radius: Base visibility radius
        enable_fog_of_war: Whether fog of war is enabled
        scout_revealed_coords: Optional list of coordinates revealed by scout actions, format: [[x1, y1], [x2, y2], ...]
    
    Returns:
        set: Set of visible cell coordinates as tuples (x, y)
    """
    if not enable_fog_of_war:
        # If fog of war is disabled, all cells are visible
        return {(x, y) for x in range(width) for y in range(height)}
    
    visible_coords = set()
    player_units_found = []
    player_buildings_found = []
    
    # Find all player's units and buildings
    for x in range(width):
        for y in range(height):
            cell = field[x][y]
            if not cell:
                continue
            
            # Check if this cell has player's unit or building
            has_player_unit = (
                cell.get('unit') and 
                cell['unit'].get('player') == player_order
            )
            has_player_building = (
                cell.get('building') and 
                cell['building'].get('player') == player_order
            )
            
            if has_player_unit:
                player_units_found.append((x, y))
            if has_player_building:
                player_buildings_found.append((x, y))
            
            if not (has_player_unit or has_player_building):
                continue
            
            # Calculate visibility radius for this cell
            fog_radius = 0
            
            # Units provide visibility based on their visibility stat
            if has_player_unit:
                unit = cell['unit']
                unit_visibility = unit.get('visibility', fog_of_war_radius)
                fog_radius = max(fog_radius, unit_visibility)
            
            # Bases provide base fog of war radius
            if has_player_building:
                building = cell['building']
                if building.get('_type') == BUILDING_TYPES['BASE']:
                    fog_radius = max(fog_radius, fog_of_war_radius)
            
            # Add all cells within visibility radius (square/Chebyshev distance)
            # If visibility radius is 3, see all cells from (x-3, y-3) to (x+3, y+3)
            for cur_x in range(x - fog_radius, x + fog_radius + 1):
                for cur_y in range(y - fog_radius, y + fog_radius + 1):
                    if 0 <= cur_x < width and 0 <= cur_y < height:
                        # Square visibility - include all cells in the square
                        visible_coords.add((cur_x, cur_y))
    
    # Add scout-revealed coordinates if provided
    if scout_revealed_coords:
        for coord in scout_revealed_coords:
            if isinstance(coord, (list, tuple)) and len(coord) == 2:
                x, y = coord[0], coord[1]
                if 0 <= x < width and 0 <= y < height:
                    visible_coords.add((x, y))
    
    # print(f"[DEBUG] calculate_visibility: player_order={player_order}, found {len(player_units_found)} units at {player_units_found}, {len(player_buildings_found)} buildings at {player_buildings_found}, scout_revealed={len(scout_revealed_coords) if scout_revealed_coords else 0}, visible_cells={len(visible_coords)}")
    
    return visible_coords


def filter_field_for_player(field, width, height, player_order, fog_of_war_radius, enable_fog_of_war, scout_revealed_coords=None):
    """
    Filter field to only include cells visible to the player.
    Hidden cells are replaced with None or a placeholder.
    
    Args:
        field: 2D array of cells
        width: Field width
        height: Field height
        player_order: Player's order/index
        fog_of_war_radius: Base visibility radius
        enable_fog_of_war: Whether fog of war is enabled
    
    Returns:
        list: Filtered 2D array with hidden cells as None or masked
    """
    visible_coords = calculate_visibility(field, width, height, player_order, fog_of_war_radius, enable_fog_of_war, scout_revealed_coords)
    
    # Create filtered field
    filtered_field = []
    for x in range(width):
        col = []
        for y in range(height):
            if (x, y) in visible_coords:
                # Cell is visible - include it and ensure isHidden is False
                if isinstance(field[x][y], dict):
                    cell = dict(field[x][y])  # Create a shallow copy
                    cell['isHidden'] = False
                    col.append(cell)
                else:
                    col.append(field[x][y])
            else:
                # Cell is hidden - create a placeholder
                # We still need to maintain field structure, so create a hidden cell
                hidden_cell = {
                    'terrain': {
                        'kind': TERRAIN_TYPES['EMPTY'],
                        'idx': 1,
                    },
                    'building': None,
                    'unit': None,
                    'isHidden': True,
                }
                col.append(hidden_cell)
        filtered_field.append(col)
    
    return filtered_field

