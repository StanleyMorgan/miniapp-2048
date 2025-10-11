import { useState, useEffect, useCallback } from 'react';
import type { TileData } from '../types';
import {
  generateInitialTiles,
  move,
  isGameOver as checkIsGameOver,
} from '../utils/gridUtils';

const BEST_SCORE_KEY = 'bestScore2048';
const ANIMATION_DURATION = 200;

export const useGameLogic = () => {
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    const savedBestScore = localStorage.getItem(BEST_SCORE_KEY);
    return savedBestScore ? parseInt(savedBestScore, 10) : 0;
  });
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  const newGame = useCallback(() => {
    const { initialTiles } = generateInitialTiles();
    setTiles(initialTiles);
    setScore(0);
    setIsGameOver(false);
    setIsWon(false);
    setIsMoving(false);
  }, []);

  useEffect(() => {
    newGame();
  }, [newGame]);
  
  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem(BEST_SCORE_KEY, score.toString());
    }
  }, [score, bestScore]);

  const performMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (isGameOver || isMoving) return;

    const { newTiles, mergedTiles, scoreIncrease, hasMoved } = move(tiles, direction);
    
    if (hasMoved) {
        setIsMoving(true);
        setScore(prev => prev + scoreIncrease);
        // Render all tiles including the ones that were merged to let them animate to their new position
        setTiles([...newTiles, ...mergedTiles]);

        setTimeout(() => {
          // After the animation, remove the merged tiles and add a new one
          const finalTiles = addRandomTile(newTiles);
          setTiles(finalTiles);
          setIsMoving(false);

          const has2048 = finalTiles.some(tile => tile.value === 2048);
          if (!isWon && has2048) {
              setIsWon(true);
              // In a real scenario, you might show a "You Win!" message but allow play to continue.
          }
  
          if (checkIsGameOver(finalTiles)) {
              setIsGameOver(true);
          }
        }, ANIMATION_DURATION);
    }
  }, [tiles, isGameOver, score, isWon, isMoving]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    let direction: 'up' | 'down' | 'left' | 'right' | null = null;
    switch (e.key) {
      case 'ArrowUp':
        direction = 'up';
        break;
      case 'ArrowDown':
        direction = 'down';
        break;
      case 'ArrowLeft':
        direction = 'left';
        break;
      case 'ArrowRight':
        direction = 'right';
        break;
      default:
        return;
    }
    
    e.preventDefault();
    performMove(direction);
  }, [performMove]);

  // Helper function moved inside hook to encapsulate logic
  const addRandomTile = (currentTiles: TileData[]): TileData[] => {
    const grid = tilesToGrid(currentTiles);
    const emptyCells = getEmptyCells(grid);
    if (emptyCells.length === 0) return currentTiles;
  
    const { row, col } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    
    // Simple ID generation, assuming tileIdCounter is managed elsewhere or implicitly
    const newId = Math.max(0, ...currentTiles.map(t => t.id)) + 1;
    const newTile: TileData = { id: newId, value, row, col, isNew: true };
    return [...currentTiles, newTile];
  };

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

  return { tiles, score, bestScore, isGameOver, isWon, newGame, handleKeyDown, performMove };
};

// Constants used in the hook
const GRID_SIZE = 4;
type Grid = (number | null)[][];