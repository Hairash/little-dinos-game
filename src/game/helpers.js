// Functions that might be useful in any part of code
import Models from "@/game/models";

export function copy2dArray(arr) {
  return arr.map(innerArray => [...innerArray]);
}

// Create array with players
export function createPlayers(humanPlayersNum, botPlayersNum) {
  console.log(humanPlayersNum);
  let players = Array.from({ length: humanPlayersNum }, () => new Models.Player(Models.PlayerTypes.HUMAN));
  players = players.concat(Array.from({ length: botPlayersNum }, () => new Models.Player(Models.PlayerTypes.BOT)));
  console.log(players);
  // TODO: Shuffle it
  return players;
}

// Needed here because it is used in CreateFieldEngine and other engines
export function getNeighbours(field, width, height, x, y) {
  const neighbours = [];
  if (x > 0 && field[x - 1][y].terrain !== Models.TerrainTypes.MOUNTAIN)
    neighbours.push([x - 1, y]);
  if (x < width - 1 && field[x + 1][y].terrain !== Models.TerrainTypes.MOUNTAIN)
    neighbours.push([x + 1, y]);
  if (y > 0 && field[x][y - 1].terrain !== Models.TerrainTypes.MOUNTAIN)
    neighbours.push([x, y - 1]);
  if (y < height - 1 && field[x][y + 1].terrain !== Models.TerrainTypes.MOUNTAIN)
    neighbours.push([x, y + 1]);
  return neighbours;
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