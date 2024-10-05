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
export function createNewUnit(player, minSpeed, maxSpeed, avgVisibility, visibilitySpeedRelation, curSpeed=null) {
  let movePoints;
  if (curSpeed) {
    movePoints = curSpeed;
  }
  else {
    movePoints = minSpeed + Math.floor(Math.random() * (maxSpeed - minSpeed + 1));
  }
  let visibility = avgVisibility;
  if (visibilitySpeedRelation) {
    visibility = calculateUnitVisibility(movePoints, minSpeed, maxSpeed, avgVisibility);
  }
  console.log(`Speed: ${movePoints}, visibility: ${visibility}`);
  return new Models.Unit(
    player,
    // TODO: make fair dict with images
    `dino${player + 1}`,
    movePoints,
    visibility,
  );
}

function calculateUnitVisibility(movePoints, minSpeed, maxSpeed, avgVisibility) {
  console.log(`Speed: ${movePoints}, minSpeed: ${minSpeed}, maxSpeed: ${maxSpeed}, avgVisibility: ${avgVisibility}`);
  if (movePoints > maxSpeed) {
    return 1;
  }
  if (minSpeed === maxSpeed) {
    return avgVisibility;
  }
  const minVisibility = 1;
  const maxVisibility = 2 * avgVisibility - minVisibility;
  console.log(`minVisibility: ${minVisibility}, maxVisibility: ${maxVisibility}`);

  const normalizedSpeed = (movePoints - minSpeed) / (maxSpeed - minSpeed);
  console.log(`normalizedSpeed: ${normalizedSpeed}`);
  const adjustedSpeed = adjustSpeed(normalizedSpeed);
  console.log(`adjustedSpeed: ${adjustedSpeed}`);
  const visibility = minVisibility + Math.round((maxVisibility - minVisibility) * adjustedSpeed);
  console.log(`Speed: ${movePoints}, visibility: ${visibility}`);
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