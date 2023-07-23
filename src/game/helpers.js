// Functions that might be useful in any part of code

export function copy2dArray(arr) {
  return arr.map(innerArray => [...innerArray]);
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