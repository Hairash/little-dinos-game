# little-men-game

Simple turn-based strategy on Vue.js.  
Move characters, fight, build new characters, collect the resources.  
All is simple.  


# MVP
Turn based game. Players do their turns one by one.  
Each player has units and bases. You lose when you lost the units and bases.  
The map is randomly generated. There are 2 types of terrain on the map: empty fields and unpassable mountains.  
Each player starts the game with the only base.  
Each unit has movements - how many cells it can move this turn (only by empty fields). Cells with units are unpassable too. In the end of the unit's movement all the enemies around it (4 directions) die. If the unit ends its movement on the cell with the base, it occupies the base.  
At the beginning of the turn every base produces a unit (with the random movements) if there is no unit on the base's field.  
Each turn the player may move any number of their units and then press the "End turn" button.  

## Additional features:
* Each next player starts game with additional unit (make sure it's far away from the enemies)
* Start with random number of bases/units
* Each base creates units with the certain movements
* At the end of unit's movement all the units around die (enemies and allies as well)
* In the end of turn unit may kill only one enemy - choose the direction of attack
* Fog of war
* Linked map


