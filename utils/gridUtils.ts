import type { TileData, Grid } from '../types';

const GRID_SIZE = 4;
let tileIdCounter = 1;

/**
 * A simple seeded pseudo-random number generator (PRNG) using LCG algorithm.
 * This ensures that the sequence of "random" numbers is the same for a given seed,
 * making the game's tile generation deterministic and verifiable.
 */
export class SeededRandom {
  private seed: number;
  private readonly a = 1664525;
  private readonly c = 1013904223;
  private readonly m = 2 ** 32;

  constructor(seedStr: string) {
    // Simple hash function to turn a string seed into a starting number.
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      const char = seedStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    this.seed = hash;
  }

  /**
   * Generates the next pseudo-random number in the sequence.
   * @returns A floating-point number between 0 (inclusive) and 1 (exclusive).
   */
  public next(): number {
    this.seed = (this.a * this.seed + this.c) % this.m;
    return this.seed / this.m;
  }
}

const tilesToGrid = (tiles: TileData[]): Grid => {
  const grid: Grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
  tiles.forEach(tile => {
    if (tile && grid[tile.row] && grid[tile.row][tile.col] === null) {
      grid[tile.row][tile.col] = tile.value;
    }
  });
  return grid;
};

const getEmptyCells = (grid: Grid): { row: number; col: number }[] => {
  const emptyCells: { row: number; col: number }[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === null) {
        emptyCells.push({ row: r, col: c });
      }
    }
  }
  return emptyCells;
};

/**
 * Adds a new random tile (2 or 4) to an empty cell on the grid.
 * The position and value of the tile are determined by the provided PRNG.
 * @param tiles The current array of tiles.
 * @param prng The seeded random number generator instance.
 * @returns A new array of tiles including the newly added one.
 */
export const addRandomTile = (tiles: TileData[], prng: SeededRandom): TileData[] => {
  const grid = tilesToGrid(tiles);
  const emptyCells = getEmptyCells(grid);
  if (emptyCells.length === 0) return tiles;

  const cellIndex = Math.floor(prng.next() * emptyCells.length);
  const { row, col } = emptyCells[cellIndex];
  
  // The value is 2 with 90% probability, and 4 with 10% probability.
  const value = prng.next() < 0.9 ? 2 : 4;
  
  const newTile: TileData = { id: tileIdCounter++, value, row, col, isNew: true };
  return [...tiles, newTile];
};

/**
 * Generates the initial two tiles for a new game.
 * @param prng The seeded random number generator to ensure determinism.
 * @returns An object containing the array of initial tiles.
 */
export const generateInitialTiles = (prng: SeededRandom) => {
  tileIdCounter = 1;
  let initialTiles: TileData[] = [];
  initialTiles = addRandomTile(initialTiles, prng);
  initialTiles = addRandomTile(initialTiles, prng);
  return { initialTiles };
};

const rotateGrid = (grid: (TileData | null)[][]): (TileData | null)[][] => {
    const newGrid: (TileData | null)[][] = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            newGrid[c][GRID_SIZE - 1 - r] = grid[r][c];
        }
    }
    return newGrid;
};

const slideAndMergeRow = (row: (TileData | null)[]) => {
  const filtered = row.filter(Boolean) as TileData[];
  const mergedTiles: TileData[] = [];
  let scoreIncrease = 0;

  const newFiltered: TileData[] = [];
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i].value === filtered[i + 1].value) {
      const winner = filtered[i];
      const loser = filtered[i + 1];

      // Mutate the winner tile
      winner.value *= 2;
      winner.isMerged = true;
      scoreIncrease += winner.value;

      // Mark the loser for removal and animation
      loser.winnerId = winner.id;
      mergedTiles.push(loser);

      newFiltered.push(winner);
      i += 2; // Skip both tiles
    } else {
      newFiltered.push(filtered[i]);
      i += 1; // Move to next tile
    }
  }

  const newRow: (TileData | null)[] = Array(GRID_SIZE).fill(null);
  newFiltered.forEach((tile, index) => {
    tile.col = index;
    newRow[index] = tile;
  });

  return { newRow, scoreIncrease, mergedTiles };
};

export const move = (
    tiles: TileData[], 
    direction: 'up' | 'down' | 'left' | 'right'
) => {
    const workingTiles = tiles.map(t => ({ ...t, isNew: false, isMerged: false, winnerId: undefined }));

    let grid: (TileData | null)[][] = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    workingTiles.forEach(t => { grid[t.row][t.col] = t; });

    const originalGridForComparison = JSON.stringify(grid.map(r => r.map(t => t?.value || null)));

    let rotations = 0;
    switch (direction) {
        case 'up': rotations = 3; break;
        case 'right': rotations = 2; break;
        case 'down': rotations = 1; break;
        case 'left': rotations = 0; break;
    }
    
    for(let i = 0; i < rotations; i++) grid = rotateGrid(grid);

    let totalScoreIncrease = 0;
    const allMergedTiles: TileData[] = [];

    grid = grid.map((row, rowIndex) => {
        row.forEach(tile => { if (tile) tile.row = rowIndex; });
        const { newRow, scoreIncrease, mergedTiles } = slideAndMergeRow(row);
        totalScoreIncrease += scoreIncrease;
        allMergedTiles.push(...mergedTiles);
        return newRow;
    });

    for(let i = 0; i < (4 - rotations) % 4; i++) grid = rotateGrid(grid);

    const finalTiles: TileData[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const tile = grid[r][c];
            if (tile) {
                tile.row = r;
                tile.col = c;
                finalTiles.push(tile);
            }
        }
    }
    
    allMergedTiles.forEach(loser => {
      const winner = finalTiles.find(t => t.id === loser.winnerId);
      if (winner) {
          loser.row = winner.row;
          loser.col = winner.col;
      }
    });

    const hasMoved = originalGridForComparison !== JSON.stringify(grid.map(r => r.map(t => t?.value || null)));

    return {
        newTiles: finalTiles,
        mergedTiles: allMergedTiles,
        scoreIncrease: totalScoreIncrease,
        hasMoved
    };
};

export const isGameOver = (tiles: TileData[]): boolean => {
    if (tiles.length < GRID_SIZE * GRID_SIZE) return false;

    const grid = tilesToGrid(tiles);

    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const val = grid[r][c];
            if (val === null) return false;
            // Check for possible merges
            if (r + 1 < GRID_SIZE && grid[r + 1][c] === val) return false;
            if (c + 1 < GRID_SIZE && grid[r][c + 1] === val) return false;
        }
    }
    
    return true;
};