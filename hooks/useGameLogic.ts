import { useState, useEffect, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
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
  const [hasSubmittedScore, setHasSubmittedScore] = useState(false);

  const newGame = useCallback(() => {
    const { initialTiles } = generateInitialTiles();
    setTiles(initialTiles);
    setScore(0);
    setIsGameOver(false);
    setIsWon(false);
    setIsMoving(false);
    setHasSubmittedScore(false); // Reset submission status for new game
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

  const submitScore = useCallback(async (finalScore: number) => {
    // IMPORTANT: Replace this with your actual backend endpoint URL.
    const BACKEND_URL = '/api/submit-score'; 
    console.log(`Submitting score ${finalScore} to backend...`);
    
    try {
      const res = await sdk.quickAuth.fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: finalScore }),
      });

      if (res.ok) {
        console.log('Score submitted successfully!');
      } else {
        const errorText = await res.text();
        console.error('Failed to submit score to backend:', errorText);
      }
    } catch (error) {
      console.error('An error occurred during score submission:', error);
      // This is expected to fail in the current setup without a real backend.
    }
  }, []);

  useEffect(() => {
    if (isGameOver && !hasSubmittedScore) {
      submitScore(score);
      setHasSubmittedScore(true);
    }
  }, [isGameOver, hasSubmittedScore, score, submitScore]);

  const performMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (isGameOver || isMoving) return;

    const { newTiles, mergedTiles, scoreIncrease, hasMoved } = move(tiles, direction);
    
    if (hasMoved) {
        setIsMoving(true);
        setScore(prev => prev + scoreIncrease);
        setTiles([...newTiles, ...mergedTiles]);

        setTimeout(() => {
          const tilesAfterAnimation = newTiles.map(t => ({ ...t, isMerged: false }));
          const finalTiles = addRandomTile(tilesAfterAnimation);
          setTiles(finalTiles);
          setIsMoving(false);

          const has2048 = finalTiles.some(tile => tile.value === 2048);
          if (!isWon && has2048) {
              setIsWon(true);
          }
  
          if (checkIsGameOver(finalTiles)) {
              setIsGameOver(true);
          }
        }, ANIMATION_DURATION);
    }
  }, [tiles, isGameOver, isMoving, isWon]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    let direction: 'up' | 'down' | 'left' | 'right' | null = null;
    switch (e.key) {
      case 'ArrowUp': direction = 'up'; break;
      case 'ArrowDown': direction = 'down'; break;
      case 'ArrowLeft': direction = 'left'; break;
      case 'ArrowRight': direction = 'right'; break;
      default: return;
    }
    e.preventDefault();
    performMove(direction);
  }, [performMove]);

  const addRandomTile = (currentTiles: TileData[]): TileData[] => {
    const grid = tilesToGrid(currentTiles);
    const emptyCells = getEmptyCells(grid);
    if (emptyCells.length === 0) return currentTiles;
  
    const { row, col } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    
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

const GRID_SIZE = 4;
type Grid = (number | null)[][];