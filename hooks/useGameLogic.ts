import { useState, useEffect, useCallback, useRef } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import type { TileData } from '../types';
import {
  generateInitialTiles,
  move,
  isGameOver as checkIsGameOver,
  addRandomTile,
  SeededRandom,
} from '../utils/gridUtils';

const BEST_SCORE_KEY = 'bestScore2048';
const GAME_STATE_KEY = 'gameState2048';
const ANIMATION_DURATION = 200;

export const useGameLogic = (isSdkReady: boolean) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [serverBestScore, setServerBestScore] = useState<number | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmittedScore, setHasSubmittedScore] = useState(false);
  
  const moveTimeoutRef = useRef<number | null>(null);
  const gameIdRef = useRef(0); // Used to invalidate stale async operations
  const newGameLoadingRef = useRef(false); // Used to prevent concurrent new game starts

  // State for deterministic gameplay, as per the new architecture
  const [seed, setSeed] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [moves, setMoves] = useState<number[]>([]); // 0:up, 1:right, 2:down, 3:left
  const [prng, setPrng] = useState<SeededRandom | null>(null);

  const newGame = useCallback(async () => {
    // Prevent multiple new games from starting concurrently.
    if (newGameLoadingRef.current) {
      return;
    }
    
    // Increment game ID to invalidate stale async operations from the previous game.
    gameIdRef.current++;
    
    // Cancel any pending animation timeout from the previous move.
    if (moveTimeoutRef.current) {
      clearTimeout(moveTimeoutRef.current);
      moveTimeoutRef.current = null;
    }

    // Immediately and synchronously reset the entire game state.
    // This provides a clean slate and prevents "ghost" tiles from persisting
    // during the async operations below. It also helps invalidate stale closures.
    setTiles([]);
    setScore(0);
    setIsGameOver(false);
    setIsWon(false);
    setHasSubmittedScore(false);
    setIsSubmitting(false);
    setUserRank(null);
    setMoves([]);
    setSeed(null);
    setPrng(null);
    
    // Set loading locks.
    newGameLoadingRef.current = true;
    setIsMoving(true); // Blocks new moves while game is being created.
    
    try {
      // 1. Fetch randomness and server time for seed generation
      const response = await fetch('/api/start-game');
      if (!response.ok) {
        throw new Error('Failed to start a new game session.');
      }
      const { randomness, startTime: newStartTime } = await response.json();

      // 2. Create the deterministic seed
      const dataToHash = `${randomness}${userAddress ?? ''}${newStartTime}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(dataToHash);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const newSeed = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      console.log("--- NEW GAME INITIALIZED ---");
      console.log("Drand Randomness:", randomness);
      console.log("Player Address:", userAddress);
      console.log("Start Time:", newStartTime);
      console.log("Generated Seed:", newSeed);
      console.log("--------------------------");

      // 3. Initialize PRNG with the new seed
      const newPrng = new SeededRandom(newSeed);

      // 4. Generate initial tiles using the PRNG
      const { initialTiles } = generateInitialTiles(newPrng);
      
      // 5. Set the final state for the new game.
      setSeed(newSeed);
      setStartTime(newStartTime);
      setPrng(newPrng);
      setMoves([]); // Redundant, but safe.
      setTiles(initialTiles);
      // Score, gameOver etc. are already reset from the sync part above.

    } catch (error) {
      console.error("Error starting new game:", error);
      // Handle error, maybe show a toast to the user
    } finally {
      setIsMoving(false);
      newGameLoadingRef.current = false;
    }
  }, [userAddress]);

  useEffect(() => {
    if (!isSdkReady) return;

    const initializeGame = async () => {
      setIsInitializing(true);
      
      try {
        const res = await sdk.quickAuth.fetch('/api/user-info');
        if (res.ok) {
          const data = await res.json();
          setUserAddress(data.primaryAddress || null);
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      }

      const localBest = parseInt(localStorage.getItem(BEST_SCORE_KEY) || '0', 10);
      let finalBestScore = localBest;

      try {
          const authResult = await sdk.quickAuth.getToken();
          if ('token' in authResult) {
            const response = await fetch('/api/leaderboard', { headers: { 'Authorization': `Bearer ${authResult.token}` } });
            if (response.ok) {
              const leaderboardData: { isCurrentUser?: boolean; score: number }[] = await response.json();
              const currentUserEntry = leaderboardData.find(entry => entry.isCurrentUser);
              if (currentUserEntry) {
                setServerBestScore(currentUserEntry.score || 0);
                finalBestScore = Math.max(localBest, currentUserEntry.score || 0);
              } else {
                setServerBestScore(0);
              }
            }
          }
      } catch (error) {
        console.error('Error fetching server best score:', error);
        setServerBestScore(null);
      }

      setBestScore(finalBestScore);
      if (finalBestScore > localBest) {
        localStorage.setItem(BEST_SCORE_KEY, finalBestScore.toString());
      }
      
      const savedStateJSON = localStorage.getItem(GAME_STATE_KEY);
      let loadedFromSave = false;
      if (savedStateJSON) {
        try {
          const savedState = JSON.parse(savedStateJSON);
          if (savedState.seed) { // Check for new state structure
            setTiles(savedState.tiles);
            setScore(savedState.score);
            setIsGameOver(savedState.isGameOver || false);
            setIsWon(savedState.isWon || false);
            setSeed(savedState.seed);
            setStartTime(savedState.startTime);
            setMoves(savedState.moves);
            
            // Re-create the PRNG and fast-forward it to the correct state
            const loadedPrng = new SeededRandom(savedState.seed);
            // Each new tile generation consumes 2 random numbers (position and value)
            // Initial generation is 2 tiles = 4 calls. Each subsequent move is 1 tile = 2 calls.
            const prngCalls = 4 + (savedState.moves.length * 2);
            for (let i = 0; i < prngCalls; i++) {
              loadedPrng.next();
            }
            setPrng(loadedPrng);

            loadedFromSave = true;
          }
        } catch (e) {
          console.error("Failed to parse saved game state.", e);
          localStorage.removeItem(GAME_STATE_KEY);
        }
      }

      if (!loadedFromSave) {
        await newGame();
      }

      setIsInitializing(false);
    };

    initializeGame();
  }, [isSdkReady, newGame]);
  
  useEffect(() => {
    // Do not save state if there's no seed yet (e.g., during the initial reset in newGame)
    if (!isInitializing && tiles.length > 0 && seed) {
      const gameState = {
        tiles,
        score,
        isGameOver,
        isWon,
        seed,
        startTime,
        moves,
      };
      localStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
    }
  }, [tiles, score, isGameOver, isWon, isInitializing, seed, startTime, moves]);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem(BEST_SCORE_KEY, score.toString());
    }
  }, [score, bestScore]);


  const submitScore = useCallback(async () => {
    if (hasSubmittedScore || isSubmitting) return;
    setIsSubmitting(true);
    // Here you would eventually send the seed, moves, startTime etc. to the contract
    // For now, it just submits the score to the backend leaderboard.
    console.log(`Submitting score ${score} to backend...`);
    console.log('Game Data:', { seed, startTime, moves });
    
    try {
      const res = await sdk.quickAuth.fetch('/api/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score }),
      });

      if (res.ok) {
        setHasSubmittedScore(true);
        setServerBestScore(prev => Math.max(prev ?? 0, score));
        // Fetch rank after submission
        try {
          const authResult = await sdk.quickAuth.getToken();
          if ('token' in authResult) {
            const response = await fetch('/api/leaderboard', { headers: { 'Authorization': `Bearer ${authResult.token}` } });
            if (response.ok) {
              const leaderboardData: { isCurrentUser?: boolean; rank: number }[] = await response.json();
              const currentUserEntry = leaderboardData.find(entry => entry.isCurrentUser);
              if (currentUserEntry) setUserRank(currentUserEntry.rank);
            }
          }
        } catch (e) { console.error("Failed to fetch new rank", e); }
      } else {
        console.error('Failed to submit score:', await res.text());
      }
    } catch (error) {
      console.error('Error during score submission:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [score, hasSubmittedScore, isSubmitting, seed, startTime, moves]);

  const performMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (isGameOver || isMoving || !prng) return;

    // Capture the game ID at the start of the move to handle race conditions.
    const gameIdAtMoveStart = gameIdRef.current;
    const { newTiles, mergedTiles, scoreIncrease, hasMoved } = move(tiles, direction);
    
    if (hasMoved) {
        setIsMoving(true);
        setScore(prev => prev + scoreIncrease);
        setTiles([...newTiles, ...mergedTiles]);

        const directionMap = { 'up': 0, 'right': 1, 'down': 2, 'left': 3 };
        const newMove = directionMap[direction];
        setMoves(prevMoves => {
          const updatedMoves = [...prevMoves, newMove];
          console.log("--- MOVE PERFORMED ---");
          console.log("Move:", direction, `(${newMove})`);
          console.log("Updated Moves Sequence:", updatedMoves);
          console.log("----------------------");
          return updatedMoves;
        });

        moveTimeoutRef.current = window.setTimeout(() => {
          // Before updating state, check if a new game has started in the meantime.
          // This prevents the animation callback from a previous game from corrupting
          // the state of the current game.
          if (gameIdRef.current !== gameIdAtMoveStart) {
            return;
          }

          const tilesAfterAnimation = newTiles.map(t => ({ ...t, isMerged: false }));
          const finalTiles = addRandomTile(tilesAfterAnimation, prng);
          setTiles(finalTiles);
          setIsMoving(false);

          if (!isWon && finalTiles.some(tile => tile.value === 2048)) {
              setIsWon(true);
          }
  
          if (checkIsGameOver(finalTiles)) {
              setIsGameOver(true);
          }
        }, ANIMATION_DURATION);
    }
  }, [tiles, isGameOver, isMoving, isWon, prng]);

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

  return { tiles, score, bestScore, serverBestScore, isGameOver, isWon, newGame, handleKeyDown, performMove, submitScore, isSubmitting, hasSubmittedScore, userRank, isInitializing, userAddress };
};