# Game Rules

## Overview

Little Dinos is a turn-based strategy game where players control dinosaur units, capture towers, and eliminate opponents.

## Objective

Eliminate all other players by capturing their towers and destroying their units.

## Game Elements

### Units (Dinos)

Each player controls dinosaur units with these properties:

| Property | Description |
|----------|-------------|
| **Speed/Move Points** | How many cells the unit can move per turn (1-4) |
| **Player** | Which player owns the unit |
| **hasMoved** | Whether the unit has moved this turn |

Units can:
- Move to empty cells or cells with enemy units/buildings
- Attack adjacent enemies (automatic when moving into their cell)
- Capture enemy or neutral towers
- Only move once per turn

### Buildings

#### Tower (Base)

- **Function**: Produces 1 unit at the start of each turn
- **Capture**: Move a unit onto an enemy/neutral tower to capture it
- **Strategy**: More towers = more units = stronger army

#### Habitation

- **Function**: Increases your maximum unit limit
- **Modifier**: +3 units per Habitation owned
- **Note**: Stand on it with a unit to gain the bonus

#### Temple

- **Function**: Units produced by adjacent towers have +1 speed
- **Note**: Affects unit generation, not existing units

#### Well

- **Function**: Unit standing on it gains +1 speed for that turn
- **Temporary**: Bonus only lasts while on the Well

#### Storage

- **Function**: Increases your maximum tower limit
- **Modifier**: +3 towers per Storage owned
- **Note**: Required if you want to capture many towers

#### Obelisk

- **Function**: Allows "scouting" - reveal a hidden area of the map
- **Usage**: Select the Obelisk action, then click anywhere to reveal
- **Radius**: Reveals a 3x3 area (configurable)

### Terrain

#### Empty Field
- Passable by all units
- Green grass appearance

#### Mountain (Rock)
- **Impassable** - units cannot move through
- Blocks movement paths

## Turn Structure

1. **Start of Turn**:
   - Your towers produce new units (if under unit limit)
   - Units' move points are restored

2. **Your Actions**:
   - Move units (each unit moves once)
   - Capture buildings
   - Use Obelisks for scouting

3. **End Turn**:
   - Click the arrow button to end your turn
   - Next player's turn begins

## Combat

Combat is simple and automatic:

- Move your unit into a cell with an enemy unit
- The enemy unit is destroyed
- Your unit occupies the cell (and uses its move)

**No counter-attacks**: The attacking unit always wins.

## Fog of War

When enabled, you can only see:

- Areas around your units (including immobile speed-0 units, which see as far as speed-1 units)
- Areas around your bases
- Areas revealed by Obelisk scouting

Hidden areas appear darker and don't show enemy positions.

## Victory Conditions

You win when all other players are eliminated. A player is eliminated when
they have no units left and no tower they can still use.

**A tower with an enemy dino standing on it doesn't count as yours** for
this purpose — it produces nothing while they sit there. (An opponent can
park on your tower without capturing it when they've hit their own tower
limit.)

Single-player and multiplayer differ on purpose:

| | No units, every tower occupied |
|---|---|
| **Single-player** | You lose — there's nobody who could free the tower for you |
| **Multiplayer** | You stay in the game; another player may drive the occupier off. Your turns are skipped while you have nothing to move, and you rejoin the moment a tower frees up |

**Occupation is asymmetric.** It never loses the game for the occupied
player on its own — but it does *win* it for the occupier. Once every
rival is out of units with every tower of theirs sat on, nobody else can
ever move again, so the last player who can still act has won and the
rest have lost. This is the same in single-player and multiplayer: you
can't be knocked out by occupation alone in multiplayer, but you can be
finished off by it when you're the last one holding out.

## Game Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Map Size | 20x20 | Width and height of the game field |
| Players | 2 | Number of players (human + AI) |
| Fog of War | On | Whether hidden areas are enabled |
| Fog Radius | 3 | Base sight radius; unit sight may vary with speed |
| Unit Modifier | 3 | Units per Habitation |
| Tower Modifier | 3 | Towers per Storage |
| Min Speed | 1 | Minimum unit movement points |
| Max Speed | 4 | Maximum unit movement points |

## Tips & Strategy

### Early Game
- Capture neutral towers quickly
- Expand towards resources (Habitations, Storages)
- Don't overextend - keep units near your towers

### Mid Game
- Use Obelisks to scout enemy positions
- Balance unit production with tower captures
- Watch your unit/tower limits

### Late Game
- Coordinate attacks on enemy towers
- Cut off enemy production
- Protect your last towers

### General Tips
- Higher speed units are more valuable for quick captures
- Temples near towers create faster armies
- Wells can turn slow units into fast ones temporarily
- Don't ignore Storages - you need them to grow

## Multiplayer

In multiplayer games:
- Take turns in order (player 0, 1, 2, etc.)
- Wait for your turn (indicator shows current player)
- Connection status shown when players disconnect/reconnect
- Game state syncs automatically on reconnection
