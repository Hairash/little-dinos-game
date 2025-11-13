"""
Unit production and turn start logic.
Handles unit generation, hasMoved reset, and building bonuses.
"""

import random
from game.services.field import calculate_unit_visibility, BUILDING_TYPES, TERRAIN_TYPES


def create_new_unit(player_order, min_speed, max_speed, speed_min_visibility, fog_of_war_radius, 
                   visibility_speed_relation, speed_modifier=0):
    """
    Create a new unit for a player.
    
    Args:
        player_order: Player's order (0, 1, 2, ...)
        min_speed: Minimum move points
        max_speed: Maximum move points
        speed_min_visibility: Speed threshold for minimum visibility
        fog_of_war_radius: Base visibility radius
        visibility_speed_relation: Whether visibility depends on speed
        speed_modifier: Additional speed from temples
    
    Returns:
        dict: Unit object
    """
    move_points = min_speed + random.randint(0, max_speed - min_speed) + speed_modifier
    visibility = fog_of_war_radius
    
    if visibility_speed_relation:
        visibility = calculate_unit_visibility(
            move_points, min_speed, speed_min_visibility, fog_of_war_radius
        )
    
    return {
        'player': player_order,
        '_type': f'dino{player_order + 1}',
        'movePoints': move_points,
        'visibility': visibility,
        'hasMoved': False,
    }


def restore_and_produce_units(field, width, height, player_order, settings):
    """
    Restore units (reset hasMoved) and produce new units at BASE buildings.
    Also applies building bonuses (WELL increases speed, etc.).
    
    This is called at the start of a player's turn.
    
    Args:
        field: 2D array of cells
        width: Field width
        height: Field height
        player_order: Player's order (0, 1, 2, ...)
        settings: Game settings dict
    
    Returns:
        dict: Counters with buildingsNum, unitsNum, producedNum
    """
    buildings_num = 0
    units_num = 0
    produced_num = 0
    habitations_occupied = 0
    temples_occupied = 0
    units_to_create_coords = []
    
    min_speed = settings.get('minSpeed', 1)
    max_speed = settings.get('maxSpeed', 5)
    speed_min_visibility = settings.get('speedMinVisibility', 7)
    fog_of_war_radius = settings.get('fogOfWarRadius', 3)
    visibility_speed_relation = settings.get('visibilitySpeedRelation', True)
    max_units_num = settings.get('maxUnitsNum', 5)
    unit_modifier = settings.get('unitModifier', 3)
    kill_at_birth = settings.get('killAtBirth', False)
    
    # First pass: reset hasMoved for all units, count units/buildings, find empty bases, apply bonuses
    for x in range(width):
        for y in range(height):
            cell = field[x][y]
            if not cell:
                continue
            
            # Reset hasMoved for all units (not just this player's)
            # This matches the frontend behavior
            unit = cell.get('unit')
            if unit:
                unit['hasMoved'] = False
                # Count only this player's units
                if unit.get('player') == player_order:
                    units_num += 1
            
            # Process buildings
            building = cell.get('building')
            if building:
                building_type = building.get('_type')
                building_player = building.get('player')
                
                # Count BASE buildings owned by player
                if building_type == BUILDING_TYPES['BASE'] and building_player == player_order:
                    buildings_num += 1
                    # If base has no unit, mark for unit creation
                    if not unit:
                        units_to_create_coords.append((x, y))
                        produced_num += 1
                
                # Count occupied buildings and apply bonuses
                if unit and unit.get('player') == player_order:
                    if building_type == BUILDING_TYPES['HABITATION']:
                        habitations_occupied += 1
                    elif building_type == BUILDING_TYPES['TEMPLE']:
                        temples_occupied += 1
                    elif building_type == BUILDING_TYPES['WELL']:
                        # Increase unit's movePoints
                        unit['movePoints'] = unit.get('movePoints', min_speed) + 1
                        # Recalculate visibility if needed
                        if visibility_speed_relation:
                            unit['visibility'] = calculate_unit_visibility(
                                unit['movePoints'],
                                min_speed,
                                speed_min_visibility,
                                fog_of_war_radius
                            )
    
    # Second pass: create units at empty bases if under limit
    # Calculate max allowed units: base limit + habitations * modifier
    if max_units_num == 0:
        # No limit - create all units
        max_allowed_units = float('inf')
    else:
        max_allowed_units = max_units_num + habitations_occupied * unit_modifier
    
    # Only create units if we're under the limit
    if units_num + produced_num <= max_allowed_units:
        for x, y in units_to_create_coords:
            # Create unit with speed modifier from temples
            speed_modifier = temples_occupied  # Each temple increases speed by 1
            new_unit = create_new_unit(
                player_order,
                min_speed,
                max_speed,
                speed_min_visibility,
                fog_of_war_radius,
                visibility_speed_relation,
                speed_modifier
            )
            field[x][y]['unit'] = new_unit
            
            # Kill neighbors if killAtBirth is enabled
            if kill_at_birth:
                kill_neighbors_at_birth(field, width, height, x, y, player_order)
    
    return {
        'buildingsNum': buildings_num,
        'unitsNum': units_num,
        'producedNum': produced_num,
    }


def kill_neighbors_at_birth(field, width, height, x, y, player_order):
    """
    Kill enemy units in neighboring cells when a unit is born.
    This is called when killAtBirth is enabled.
    """
    neighbors = []
    if x > 0:
        neighbors.append((x - 1, y))
    if x < width - 1:
        neighbors.append((x + 1, y))
    if y > 0:
        neighbors.append((x, y - 1))
    if y < height - 1:
        neighbors.append((x, y + 1))
    
    for nx, ny in neighbors:
        neighbor_cell = field[nx][ny]
        neighbor_unit = neighbor_cell.get('unit')
        if neighbor_unit and neighbor_unit.get('player') != player_order:
            # Kill enemy unit
            neighbor_cell['unit'] = None

