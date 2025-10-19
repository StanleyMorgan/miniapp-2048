import { useState, useEffect, useCallback, useRef } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import type { TileData } from '../types';
import {
  generateInitialTiles,
  move,
  isGameOver as checkIsGameOver,
  addRandomTile,
  SeededRandom,
  verifyGame,
  packMoves,
  packBoard,
} from '../utils/gridUtils';
import { Season } from '../components/SeasonSelector';

const BEST_SCORE_KEY = 'bestScore2048';
const GAME_STATE_KEY = 'gameState2048';
const ANIMATION_DURATION = 200;

export const useGameLogic = (isSdkReady: boolean, activeSeason: Season) => {
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
  
  const tileIdCounterRef = useRef(1); // Manages unique tile IDs safely within the hook.
  const moveTimeoutRef = useRef<number | null>(null);
  const gameIdRef = useRef(0); // Used to invalidate stale async operations
  const newGameLoadingRef = useRef(false); // Used to prevent concurrent new game starts

  // State for deterministic gameplay, as per the new architecture
  const [randomness, setRandomness] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [moves, setMoves] = useState<number[]>([]); // 0:up, 1:right, 2:down, 3:left
  const [prng, setPrng] = useState<SeededRandom | null>(null);

  const newGame = useCallback(async () => {
    // Prevent multiple new games from starting concurrently.
    if (newGameLoadingRef.current) {
      return;
    }
    
    gameIdRef.current++;
    const currentGameId = gameIdRef.current;
    
    // Cancel any pending animation timeout from the previous move.
    if (moveTimeoutRef.current) {
      clearTimeout(moveTimeoutRef.current);
      moveTimeoutRef.current = null;
    }

    // Immediately and synchronously reset the entire game state.
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
    setRandomness(null);
    
    // Set loading locks.
    newGameLoadingRef.current = true;
    setIsMoving(true); // Blocks new moves while game is being created.
    
    try {
      // 1. Fetch randomness and server time for seed generation
      const response = await fetch('/api/start-game');
      if (!response.ok) {
        throw new Error(`Failed to start a new game session. Status: ${response.status}`);
      }
      const { randomness: newRandomness, startTime: newStartTime } = await response.json();

      // 2. Create the deterministic seed
      const dataToHash = `${newRandomness}${userAddress ?? ''}${newStartTime}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(dataToHash);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const newSeed = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // 3. Initialize PRNG with the new seed
      const newPrng = new SeededRandom(newSeed);

      // 4. Generate initial tiles using the PRNG and reset the tile ID counter
      const { initialTiles, newCounter } = generateInitialTiles(newPrng);
      
      if (!Array.isArray(initialTiles) || initialTiles.some(t => typeof t !== 'object' || t === null)) {
        console.error(`[GAME #${currentGameId}] FATAL: generateInitialTiles returned invalid data.`, initialTiles);
        throw new Error("Invalid initial tiles generated.");
      }
      
      tileIdCounterRef.current = newCounter;
      
      // 5. Set the final state for the new game.
      setRandomness(newRandomness);
      setSeed(newSeed);
      setStartTime(newStartTime);
      setPrng(newPrng);
      setMoves([]); // Redundant, but safe.
      setTiles(initialTiles);

    } catch (error) {
      console.error(`[GAME #${currentGameId}] Error starting new game:`, error);
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
            setRandomness(savedState.randomness || null);
            
            // Re-create the PRNG and fast-forward it to the correct state
            const loadedPrng = new SeededRandom(savedState.seed);
            // Each new tile generation consumes 2 random numbers (position and value)
            // Initial generation is 2 tiles = 4 calls. Each subsequent move is 1 tile = 2 calls.
            const prngCalls = 4 + (savedState.moves.length * 2);
            for (let i = 0; i < prngCalls; i++) {
              loadedPrng.next();
            }
            setPrng(loadedPrng);

            // Restore the tile ID counter to the next available ID
            const maxId = savedState.tiles.reduce((max: number, t: TileData) => Math.max(max, t.id), 0);
            tileIdCounterRef.current = maxId + 1;

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
        randomness,
      };
      localStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
    }
  }, [tiles, score, isGameOver, isWon, isInitializing, seed, startTime, moves, randomness]);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem(BEST_SCORE_KEY, score.toString());
    }
  }, [score, bestScore]);


  const submitScore = useCallback(async () => {
    if (hasSubmittedScore || isSubmitting) return;
    setIsSubmitting(true);
    
    if (activeSeason === 'monad-s0') {
      try {
        console.log("Verifying MONAD S0 submission...");
        
        // Log values for debugging before the check
        console.log("--- MONAD S0 Submission - Debug Values ---");
        console.log(`seed: ${seed}`);
        console.log(`moves: ${JSON.stringify(moves)}`);
        console.log(`randomness: ${randomness}`);
        console.log(`userAddress: ${userAddress}`);
        console.log(`startTime: ${startTime}`);
        console.log("------------------------------------------");

        if (!seed || !moves || !randomness || !userAddress || !startTime) {
          throw new Error("Missing data for on-chain submission. Seed, moves, randomness, user address, or startTime is null.");
        }

        const verificationResult = verifyGame(seed, moves);
        if (verificationResult.finalScore !== score) {
            console.error("!!! VERIFICATION FAILED !!!");
            console.error(`Client Score: ${score}, Verified Score: ${verificationResult.finalScore}`);
            // In a real app, you would show an error to the user here.
        } else {
            console.log("Game verification successful!");
        }

        const packedMoves = packMoves(moves);
        const packedBoard = packBoard(tiles); // Use current tiles state for final board
        const endTime = Date.now();

        console.log("--- MONAD S0 On-Chain Submission Data ---");
        console.log(`Player Address: ${userAddress}`);
        console.log(`Randomness (from Drand): ${randomness}`);
        console.log(`Game Seed (SHA-256): ${seed}`);
        console.log(`Packed Moves (hex): ${packedMoves}`);
        console.log(`Packed Final Board (hex): ${packedBoard}`);
        console.log(`Final Score: ${score}`);
        console.log(`Start Time (ms): ${startTime}`);
        console.log(`End Time (ms): ${endTime}`);
        console.log("-----------------------------------------");
        
        setHasSubmittedScore(true); // Mark as "submitted" to update UI
      } catch (error) {
        console.error("Error during Monad S0 submission process:", error);
      } finally {
        setIsSubmitting(false);
      }
      return; // End execution for Monad season
    }

    // Original Farcaster leaderboard submission logic
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
  }, [score, hasSubmittedScore, isSubmitting, seed, startTime, moves, activeSeason, randomness, userAddress, tiles]);

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
        setMoves(prevMoves => [...prevMoves, newMove]);

        moveTimeoutRef.current = window.setTimeout(() => {
          // Before updating state, check if a new game has started in the meantime.
          // This prevents the animation callback from a previous game from corrupting
          // the state of the current game.
          if (gameIdRef.current !== gameIdAtMoveStart) {
            return;
          }

          const tilesAfterAnimation = newTiles.map(t => ({ ...t, isMerged: false }));
          const { newTiles: finalTiles, newCounter } = addRandomTile(
            tilesAfterAnimation, 
            prng,
            tileIdCounterRef.current
          );
          tileIdCounterRef.current = newCounter;
          
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
