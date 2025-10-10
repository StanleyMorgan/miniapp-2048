import type { TileData, Grid } from '../types';

const GRID_SIZE = 4;
let tileIdCounter = 1;

const tilesToGrid = (tiles: TileData[]): Grid => {
  const grid: Grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
  tiles.forEach(tile => {
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

const addInitialTile = (tiles: TileData[]): TileData[] => {
  const grid = tilesToGrid(tiles);
  const emptyCells = getEmptyCells(grid);
  if (emptyCells.length === 0) return tiles;

  const { row, col } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  
  const newTile: TileData = { id: tileIdCounter++, value, row, col, isNew: true };
  return [...tiles, newTile];
};

export const generateInitialTiles = () => {
  tileIdCounter = 1;
  let initialTiles: TileData[] = [];
  initialTiles = addInitialTile(initialTiles);
  initialTiles = addInitialTile(initialTiles);
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

  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i].value === filtered[i + 1].value) {
      const winner = filtered[i];
      const loser = filtered.splice(i + 1, 1)[0];
      
      winner.value *= 2;
      winner.isMerged = true;
      scoreIncrease += winner.value;

      loser.row = winner.row;
      loser.col = winner.col;
      mergedTiles.push(loser);
    }
  }

  const newRow: (TileData | null)[] = Array(GRID_SIZE).fill(null);
  filtered.forEach((tile, i) => {
    tile.col = i; // Update column for sliding
    newRow[i] = tile;
  });

  return { newRow, scoreIncrease, mergedTiles };
};

export const move = (
    tiles: TileData[], 
    direction: 'up' | 'down' | 'left' | 'right'
) => {
    const workingTiles = tiles.map(t => ({ ...t, isNew: false, isMerged: false }));

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
        // Update row property for all tiles before sliding
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
      const winner = finalTiles.find(t => t.id === loser.id);
      if(winner) {
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
            if (val === null) return false; // Should not happen if length is 16, but good for safety
            if (r + 1 < GRID_SIZE && grid[r + 1][c] === val) return false;
            if (c + 1 < GRID_SIZE && grid[r][c + 1] === val) return false;
        }
    }
    
    return true;
};