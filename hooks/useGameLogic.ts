import { useState, useEffect, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import type { TileData } from '../types';
import {
  generateInitialTiles,
  move,
  isGameOver as checkIsGameOver,
} from '../utils/gridUtils';

const BEST_SCORE_KEY = 'bestScore2048';
const GAME_STATE_KEY = 'gameState2048';
const ANIMATION_DURATION = 200;

export const useGameLogic = (isSdkReady: boolean) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0); // Initialized lazily later
  const [serverBestScore, setServerBestScore] = useState<number | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmittedScore, setHasSubmittedScore] = useState(false);

  const newGame = useCallback(() => {
    // This function can now rely on `userAddress` being available in the hook's scope.
    // For example: const seed = createSeed(userAddress, Date.now());
    const { initialTiles } = generateInitialTiles();
    setTiles(initialTiles);
    setScore(0);
    setIsGameOver(false);
    setIsWon(false);
    setIsMoving(false);
    setHasSubmittedScore(false);
    setIsSubmitting(false);
    setUserRank(null);
  }, [userAddress]); // Dependency on userAddress for potential seed generation logic.

  useEffect(() => {
    if (!isSdkReady) return;

    const initializeGame = async () => {
      setIsInitializing(true);
      
      // Step 1: Fetch user info (including address)
      try {
        const res = await sdk.quickAuth.fetch('/api/user-info');
        if (res.ok) {
          const data = await res.json();
          setUserAddress(data.primaryAddress || null);
          console.log('User Address Initialized:', data.primaryAddress);
        } else {
          console.warn('Could not fetch user info.');
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      }

      // Step 2: Initialize scores (local and server)
      const localBest = parseInt(localStorage.getItem(BEST_SCORE_KEY) || '0', 10);
      let finalBestScore = localBest;

      try {
        const authResult = await sdk.quickAuth.getToken();
        if ('token' in authResult) {
          const response = await fetch('/api/leaderboard', {
            headers: { 'Authorization': `Bearer ${authResult.token}` },
          });
          if (response.ok) {
            const leaderboardData: { isCurrentUser?: boolean; score: number }[] = await response.json();
            const currentUserEntry = leaderboardData.find(entry => entry.isCurrentUser);
            if (currentUserEntry) {
              const serverScore = currentUserEntry.score || 0;
              setServerBestScore(serverScore);
              finalBestScore = Math.max(localBest, serverScore);
            } else {
              setServerBestScore(0); // Authenticated but no score yet.
            }
          }
        }
      } catch (error) {
        console.error('Error fetching server best score:', error);
        setServerBestScore(null); // Fallback to local
      }

      setBestScore(finalBestScore);
      if (finalBestScore > localBest) {
        localStorage.setItem(BEST_SCORE_KEY, finalBestScore.toString());
      }
      
      // Step 3: Load saved game state or start a new game
      const savedStateJSON = localStorage.getItem(GAME_STATE_KEY);
      let loadedFromSave = false;
      if (savedStateJSON) {
        try {
          const savedState = JSON.parse(savedStateJSON);
          if (savedState.tiles && Array.isArray(savedState.tiles) && typeof savedState.score === 'number') {
            setTiles(savedState.tiles);
            setScore(savedState.score);
            setIsGameOver(savedState.isGameOver || false);
            setIsWon(savedState.isWon || false);
            loadedFromSave = true;
          }
        } catch (e) {
          console.error("Failed to parse saved game state.", e);
          localStorage.removeItem(GAME_STATE_KEY);
        }
      }

      if (!loadedFromSave) {
        newGame();
      }

      setIsInitializing(false);
    };

    initializeGame();
  }, [isSdkReady, newGame]);
  
  // Save game state to localStorage whenever it changes.
  useEffect(() => {
    // Do not save during initialization or if tiles are not populated.
    if (!isInitializing && tiles.length > 0) {
      const gameState = {
        tiles,
        score,
        isGameOver,
        isWon,
      };
      localStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
    }
  }, [tiles, score, isGameOver, isWon, isInitializing]);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem(BEST_SCORE_KEY, score.toString());
    }
  }, [score, bestScore]);


  const submitScore = useCallback(async () => {
    if (hasSubmittedScore || isSubmitting) return;

    setIsSubmitting(true);
    const BACKEND_URL = '/api/submit-score';
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
        // Update serverBestScore with the new score to prevent saving a lower score later
        setServerBestScore(prev => Math.max(prev ?? 0, score));

        // Fetch the user's new rank after a successful submission
        try {
          const authResult = await sdk.quickAuth.getToken();
          if ('token' in authResult) {
            const response = await fetch('/api/leaderboard', {
              headers: { 'Authorization': `Bearer ${authResult.token}` },
            });
            if (response.ok) {
              const leaderboardData: { isCurrentUser?: boolean; rank: number }[] = await response.json();
              const currentUserEntry = leaderboardData.find(entry => entry.isCurrentUser);
              if (currentUserEntry) {
                console.log('Fetched new rank:', currentUserEntry.rank);
                setUserRank(currentUserEntry.rank);
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch user's new rank after score submission:", error);
        }

      } else {
        const errorText = await res.text();
        console.error('Failed to submit score to backend:', errorText);
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

  return { tiles, score, bestScore, serverBestScore, isGameOver, isWon, newGame, handleKeyDown, performMove, submitScore, isSubmitting, hasSubmittedScore, userRank, isInitializing, userAddress };
};

const GRID_SIZE = 4;
type Grid = (number | null)[][];
