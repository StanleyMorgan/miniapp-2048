import type { TileData, Grid } from '../types';

const GRID_SIZE = 4;

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
    const result = this.seed / this.m;
    // CRITICAL FIX: The LCG calculation with a negative seed can produce a negative result
    // in JavaScript due to the behavior of the % operator. This ensures the output is
    // always in the correct [0, 1) range, preserving determinism while fixing the bug.
    return result < 0 ? result + 1 : result;
  }
}

/**
 * Asynchronously calculates the SHA-256 hash of a byte array.
 * @param data The data to hash.
 * @returns A promise that resolves to a '0x' prefixed hex string.
 */
export const sha256 = async (data: Uint8Array): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Converts a '0x' prefixed or non-prefixed hex string to a Uint8Array.
 * @param hexString The hex string to convert.
 * @returns The resulting Uint8Array.
 */
export const hexToUint8Array = (hexString: string): Uint8Array => {
    if (hexString.startsWith('0x')) {
        hexString = hexString.slice(2);
    }
    if (hexString.length % 2 !== 0) {
        throw new Error("Hex string must have an even number of characters");
    }
    const byteArray = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < byteArray.length; i++) {
        byteArray[i] = parseInt(hexString.substr(i * 2, 2), 16);
    }
    return byteArray;
};

const tilesToGrid = (tiles: TileData[]): Grid => {
  const grid: Grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
  
  if (!Array.isArray(tiles)) {
    console.error('[tilesToGrid] FATAL: input `tiles` is not an array. Received:', tiles);
    return grid;
  }

  tiles.forEach((tile, index) => {
    if (!tile || typeof tile.row === 'undefined' || typeof tile.col === 'undefined') {
        console.error(`[tilesToGrid] FATAL: Invalid tile object found at index ${index}. Tile data:`, JSON.stringify(tile), 'Full tiles array:', JSON.stringify(tiles));
        return;
    }

    if (grid[tile.row] && grid[tile.row][tile.col] === null) {
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
 * @param tileIdCounter The current ID to assign to the new tile.
 * @returns An object containing the new array of tiles and the next available tile ID.
 */
export const addRandomTile = (tiles: TileData[], prng: SeededRandom, tileIdCounter: number): { newTiles: TileData[], newCounter: number } => {
  const grid = tilesToGrid(tiles);
  const emptyCells = getEmptyCells(grid);
  if (emptyCells.length === 0) {
    return { newTiles: tiles, newCounter: tileIdCounter };
  }

  const cellIndex = Math.floor(prng.next() * emptyCells.length);
  const { row, col } = emptyCells[cellIndex];
  
  // The value is 2 with 90% probability, and 4 with 10% probability.
  const value = prng.next() < 0.9 ? 2 : 4;
  
  const newTile: TileData = { id: tileIdCounter, value, row, col, isNew: true };
  return { newTiles: [...tiles, newTile], newCounter: tileIdCounter + 1 };
};

/**
 * Generates the initial two tiles for a new game.
 * @param prng The seeded random number generator to ensure determinism.
 * @returns An object containing the array of initial tiles and the next available tile ID.
 */
export const generateInitialTiles = (prng: SeededRandom): { initialTiles: TileData[], newCounter: number } => {
  let tileIdCounter = 1;
  let initialTiles: TileData[] = [];
  
  const res1 = addRandomTile(initialTiles, prng, tileIdCounter);
  initialTiles = res1.newTiles;
  tileIdCounter = res1.newCounter;

  const res2 = addRandomTile(initialTiles, prng, tileIdCounter);

  return { initialTiles: res2.newTiles, newCounter: res2.newCounter };
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

  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i].value === filtered[i + 1].value) {
      const winner = filtered[i];
      const loser = filtered.splice(i + 1, 1)[0];
      
      winner.value *= 2;
      winner.isMerged = true;
      scoreIncrease += winner.value;

      loser.winnerId = winner.id;
      mergedTiles.push(loser);
    }
  }

  const newRow: (TileData | null)[] = Array(GRID_SIZE).fill(null);
  filtered.forEach((tile, i) => {
    tile.col = i;
    newRow[i] = tile;
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
            if (r + 1 < GRID_SIZE && grid[r + 1][c] === val) return false;
            if (c + 1 < GRID_SIZE && grid[r][c + 1] === val) return false;
        }
    }
    
    return true;
};

/**
 * Packs the final game board state into a compact hex string for on-chain submission.
 * Each of the 16 tiles is represented by its log2 value (e.g., 2048 -> 11).
 * An empty cell is 0. This requires 5 bits per tile (for values up to 131072).
 * Total bits: 16 * 5 = 80 bits, which fits into a uint128.
 * @param tiles The final array of tiles on the board.
 * @returns A hex string (e.g., '0x...').
 */
export const packBoard = (tiles: TileData[]): string => {
  const grid: number[][] = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
  tiles.forEach(tile => {
    if (tile && tile.value > 0) {
      grid[tile.row][tile.col] = Math.log2(tile.value);
    }
  });

  let packed = BigInt(0);
  let bitPosition = 0;
  // The order of packing must be consistent. Row by row, left to right.
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const tilePower = BigInt(grid[r][c]);
      packed |= (tilePower << BigInt(bitPosition));
      bitPosition += 5; // 5 bits per tile
    }
  }
  return '0x' + packed.toString(16);
};