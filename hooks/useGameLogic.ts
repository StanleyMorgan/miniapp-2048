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

export const useGameLogic = (isSdkReady: boolean) => {
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    const savedBestScore = localStorage.getItem(BEST_SCORE_KEY);
    return savedBestScore ? parseInt(savedBestScore, 10) : 0;
  });
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmittedScore, setHasSubmittedScore] = useState(false);

  const newGame = useCallback(() => {
    const { initialTiles } = generateInitialTiles();
    setTiles(initialTiles);
    setScore(0);
    setIsGameOver(false);
    setIsWon(false);
    setIsMoving(false);
    setHasSubmittedScore(false);
    setIsSubmitting(false);
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

  useEffect(() => {
    const fetchUserBestScore = async () => {
      try {
        const authResult = await sdk.quickAuth.getToken();
        if (!('token' in authResult)) {
          console.warn("Could not get auth token to fetch best score.");
          return;
        }

        const response = await fetch('/api/leaderboard', {
          headers: { 'Authorization': `Bearer ${authResult.token}` },
        });

        if (response.ok) {
          const leaderboardData: { isCurrentUser?: boolean; score: number }[] = await response.json();
          const currentUserEntry = leaderboardData.find(entry => entry.isCurrentUser);

          if (currentUserEntry) {
            setBestScore(prevBest => {
              const serverScore = currentUserEntry.score || 0;
              const newBest = Math.max(prevBest, serverScore);
              if (newBest > prevBest) {
                localStorage.setItem(BEST_SCORE_KEY, newBest.toString());
              }
              return newBest;
            });
          }
        } else {
          console.error('Failed to fetch user best score:', await response.text());
        }
      } catch (error) {
        console.error('Error fetching user best score:', error);
      }
    };

    if (isSdkReady) {
        fetchUserBestScore();
    }
  }, [isSdkReady]);

  const submitScore = useCallback(async () => {
    if (hasSubmittedScore || isSubmitting) return;

    setIsSubmitting(true);
    const BACKEND_URL = '/api/submit-score'; // Use relative path for portability
    console.log(`Submitting score ${score} to backend...`);
    
    try {
      const res = await sdk.quickAuth.fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score }),
      });

      if (res.ok) {
        console.log('Score submitted successfully!');
        setHasSubmittedScore(true);
      } else {
        const errorText = await res.text();
        console.error('Failed to submit score to backend:', errorText);
        // Optionally, you could set an error state here to show in the UI
      }
    } catch (error) {
      console.error('An error occurred during score submission:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [score, hasSubmittedScore, isSubmitting]);

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

  return { tiles, score, bestScore, isGameOver, isWon, newGame, handleKeyDown, performMove, submitScore, isSubmitting, hasSubmittedScore };
};

const GRID_SIZE = 4;
type Grid = (number | null)[][];