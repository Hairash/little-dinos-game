// Functions that might be useful in any part of code

import Models from "@/game/models";

export function copy2dArray(arr) {
  return arr.map(innerArray => [...innerArray]);
}

// Create array with players
export function createPlayers(humanPlayersNum, botPlayersNum) {
  let players = Array.from({ length: humanPlayersNum }, () => new Models.Player(Models.PlayerTypes.HUMAN));
  players = players.concat(Array.from({ length: botPlayersNum }, () => new Models.Player(Models.PlayerTypes.BOT)));
  // TODO: Shuffle it
  return players;
}

// Needed here because it is used in CreateFieldEngine and other engines
export function getNeighbours(field, width, height, x, y) {
  const neighbours = [];
  if (x > 0 && field[x - 1][y].terrain.kind !== Models.TerrainTypes.MOUNTAIN)
    neighbours.push([x - 1, y]);
  if (x < width - 1 && field[x + 1][y].terrain.kind !== Models.TerrainTypes.MOUNTAIN)
    neighbours.push([x + 1, y]);
  if (y > 0 && field[x][y - 1].terrain.kind !== Models.TerrainTypes.MOUNTAIN)
    neighbours.push([x, y - 1]);
  if (y < height - 1 && field[x][y + 1].terrain.kind !== Models.TerrainTypes.MOUNTAIN)
    neighbours.push([x, y + 1]);
  return neighbours;
}

// Generate new unit
export function createNewUnit(
  player,
  minSpeed,
  maxSpeed,
  speedMinVisibility,
  avgVisibility,
  visibilitySpeedRelation,
  speedModifier=0,
) {
  // console.log(
  //   `Creating new unit for player ${player} with minSpeed: ${minSpeed}, maxSpeed: ${maxSpeed},
  //    speedMinVisibility: ${speedMinVisibility}, avgVisibility: ${avgVisibility},
  //    visibilitySpeedRelation: ${visibilitySpeedRelation}, speedModifier: ${speedModifier}`,
  // );
  const movePoints = minSpeed + Math.floor(Math.random() * (maxSpeed - minSpeed + 1)) + speedModifier;
  let visibility = avgVisibility;
  if (visibilitySpeedRelation) {
    visibility = calculateUnitVisibility(movePoints, minSpeed, speedMinVisibility, avgVisibility);
  }
  // console.log(`Speed: ${movePoints}, visibility: ${visibility}`);
  return new Models.Unit(
    player,
    // TODO: make fair dict with images
    `dino${player + 1}`,
    movePoints,
    visibility,
  );
}

export function calculateUnitVisibility(movePoints, minSpeed, maxSpeed, avgVisibility) {
  // console.log(`Speed: ${movePoints}, minSpeed: ${minSpeed}, maxSpeed: ${maxSpeed}, avgVisibility: ${avgVisibility}`);
  if (movePoints > maxSpeed) {
    return 1;
  }
  if (minSpeed === maxSpeed) {
    return avgVisibility;
  }
  const minVisibility = 1;
  const maxVisibility = 2 * avgVisibility - minVisibility;

  const normalizedSpeed = (movePoints - minSpeed) / (maxSpeed - minSpeed);
  const adjustedSpeed = adjustSpeed(normalizedSpeed);
  const visibility = minVisibility + Math.round((maxVisibility - minVisibility) * adjustedSpeed);
  return visibility;
}

// Takes number 0..1 and returns number 0..1
function adjustSpeed(x) {
  const factor = 2;
  const shift = 0.05;
  // return 1 - x;
  // cot((normalizedSpeed * factor + (1 - factor) / 2) * Math.PI) / cot((1 - factor) / 2);
  return (-Math.tan((x - 1 / 2) * factor) / Math.tan(1 / 2 * factor) + 1) / 2 - shift;
}

// // Test
// const minSpeed = 1;
// const maxSpeed = 10;
// for (let i = minSpeed; i < maxSpeed + 1; i++) {
//   console.log(calculateUnitVisibility(i, minSpeed, maxSpeed, 3));
// }


// Convert plain objects from backend/JSON to model instances
export function normalizeField(field) {
  if (!field || !Array.isArray(field)) {
    return field;
  }
  
  return field.map(col => {
    if (!Array.isArray(col)) {
      return col;
    }
    return col.map(cellData => {
      if (!cellData) {
        return cellData;
      }
      
      // Create a new cell-like object with normalized data
      const cell = {
        terrain: cellData.terrain || { kind: Models.TerrainTypes.EMPTY, idx: 1 },
        building: null,
        unit: null,
        isHidden: cellData.isHidden !== undefined ? cellData.isHidden : true,
      };
      
      // Convert building if present
      if (cellData.building) {
        cell.building = new Models.Building(
          cellData.building.player,
          cellData.building._type
        );
      }
      
      // Convert unit if present
      if (cellData.unit) {
        cell.unit = new Models.Unit(
          cellData.unit.player,
          cellData.unit._type,
          cellData.unit.movePoints,
          cellData.unit.visibility
        );
        // Preserve hasMoved state
        if (cellData.unit.hasMoved !== undefined) {
          cell.unit.hasMoved = cellData.unit.hasMoved;
        }
      }
      
      return cell;
    });
  });
}

// Needed for scale in future
// calculateCellSize() {
//   const windowWidth = window.innerWidth;
//   const windowHeight = window.innerHeight;
//   const maxWidth = windowWidth / this.width;
//   const maxHeight = windowHeight / this.height;
//   this.cellSize = Math.floor(Math.min(maxWidth, maxHeight));
//   this.cssProps = {
//     cellHeight: `${this.cellSize}px`,
//     lineWidth: `${(this.cellSize + 2) * this.width}px`,
//     boardHeight: `${(this.cellSize + 2) * this.height + 35}px`,  // Board height + bottom info label height
//   };
// },

const PLAYER_COLOR_MAP = {
  0: '#4A90E2',      // 1 - blue
  1: '#32cc67',      // 2 - mint
  2: '#FF4444',      // 3 - red
  3: '#FFD700',      // 4 - yellow
  4: '#8B5CF6',      // 5 - violet
  5: '#00FFFF',      // 6 - cyan
  6: '#9B59B6',      // 7 - purple
  7: '#2E7D32',      // 8 - dark green
};

export function getPlayerColor(order) {
  return PLAYER_COLOR_MAP[order] || '#ffffff';
}

// WebP support detection (runs once at module load)
let supportsWebP = false
if (typeof window !== 'undefined') {
  const canvas = document.createElement('canvas')
  if (canvas.getContext && canvas.getContext('2d')) {
    supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
  }
}

/**
 * Get the optimal image path (WebP if supported, PNG fallback)
 * @param {string} baseName - Image name without extension
 * @returns {string} Full image path
 */
export function getImagePath(baseName) {
  const ext = supportsWebP ? 'webp' : 'png'
  return `/images/${baseName}.${ext}`
}
