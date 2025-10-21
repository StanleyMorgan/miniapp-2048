

import { useState, useEffect, useCallback, useRef } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSwitchChain } from 'wagmi';
import type { TileData } from '../types';
import {
  generateInitialTiles,
  move,
  isGameOver as checkIsGameOver,
  addRandomTile,
  SeededRandom,
  packBoard,
  sha256,
  hexToUint8Array,
} from '../utils/gridUtils';
import { Season } from '../components/SeasonSelector';
import { 
    LEADERBOARD_ABI,
    onChainSeasonConfigs
} from '../constants/contract';


const BEST_SCORE_KEY = 'bestScore2048';
const ANIMATION_DURATION = 200;
const INITIAL_MOVES_HASH = '0x' + '0'.repeat(64);

export const useGameLogic = (isSdkReady: boolean, activeSeason: Season) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [farcasterBestScore, setFarcasterBestScore] = useState<number | null>(null);
  const [serverBestScore, setServerBestScore] = useState<number | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmittedScore, setHasSubmittedScore] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState('');
  
  const tileIdCounterRef = useRef(1);
  const moveTimeoutRef = useRef<number | null>(null);
  const gameIdRef = useRef(0);
  const newGameLoadingRef = useRef(false);
  const userAddressRef = useRef(userAddress);
  const seasonTransitionRef = useRef(false); // Ref to prevent saving during season transitions

  useEffect(() => {
    userAddressRef.current = userAddress;
  }, [userAddress]);

  const [randomness, setRandomness] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [moves, setMoves] = useState<number[]>([]);
  const [finalMovesHash, setFinalMovesHash] = useState<string>(INITIAL_MOVES_HASH);
  const [prng, setPrng] = useState<SeededRandom | null>(null);

  // Get the config for the current season, if it's an on-chain one
  const activeSeasonConfig = activeSeason in onChainSeasonConfigs ? onChainSeasonConfigs[activeSeason as keyof typeof onChainSeasonConfigs] : undefined;

  // --- WAGMI HOOKS FOR ON-CHAIN INTERACTION ---
  const { address: wagmiAddress, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const { data: hash, writeContract, isPending, error: writeContractError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: txReceiptError } = useWaitForTransactionReceipt({ hash });
  
  const { data: onChainResult } = useReadContract({
    address: activeSeasonConfig?.address,
    abi: activeSeasonConfig?.abi,
    functionName: 'results',
    args: [userAddress as `0x${string}`],
    query: {
      enabled: isSdkReady && !!userAddress && !!activeSeasonConfig && isConnected && chain?.id === activeSeasonConfig.chainId,
    }
  });

  // Effect to switch the displayed server best score based on the active season
  useEffect(() => {
    if (activeSeasonConfig) {
      const onChainScore = onChainResult?.[1]; // score is at index 1
      setServerBestScore(typeof onChainScore === 'bigint' ? Number(onChainScore) : 0);
    } else {
      setServerBestScore(farcasterBestScore);
    }
  }, [activeSeason, onChainResult, farcasterBestScore, activeSeasonConfig]);

  // Effect to manage submission status based on wagmi state changes
  useEffect(() => {
    if (isPending) {
      setSubmissionStatus('Confirm in your wallet...');
    } else if (isConfirming) {
      setSubmissionStatus('Submitting on-chain...');
    } else if (isConfirmed) {
      setSubmissionStatus('Success! Score submitted on-chain.');
      setHasSubmittedScore(true);
      setIsSubmitting(false);
    } else if (writeContractError || txReceiptError) {
      const error = writeContractError || txReceiptError;
      const message = (error as any)?.shortMessage || error?.message || 'Transaction failed.';
      setSubmissionStatus(message);
      setIsSubmitting(false);
    }
  }, [isPending, isConfirming, isConfirmed, writeContractError, txReceiptError]);


  const newGame = useCallback(async () => {
    console.log('[newGame] CALLED.');
    if (newGameLoadingRef.current) {
        console.log('[newGame] Aborting: already loading.');
        return;
    }
    gameIdRef.current++;
    if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);

    console.log('[newGame] Resetting state.');
    setTiles([]);
    setScore(0);
    setIsGameOver(false);
    setIsWon(false);
    setHasSubmittedScore(false);
    setIsSubmitting(false);
    setSubmissionStatus('');
    setUserRank(null);
    setMoves([]);
    setSeed(null);
    setPrng(null);
    setRandomness(null);
    setFinalMovesHash(INITIAL_MOVES_HASH);
    
    newGameLoadingRef.current = true;
    setIsMoving(true);
    
    try {
      console.log('[newGame] Fetching new game data from /api/start-game.');
      const response = await fetch('/api/start-game');
      if (!response.ok) throw new Error(`Failed to start a new game session. Status: ${response.status}`);
      const { randomness: newRandomness, startTime: newStartTime } = await response.json();

      const dataToHash = `${newRandomness}${userAddressRef.current ?? ''}${newStartTime}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(dataToHash);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const newSeed = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      console.log('[newGame] Generating seed and initial tiles.');
      const newPrng = new SeededRandom(newSeed);
      const { initialTiles, newCounter } = generateInitialTiles(newPrng);
      
      if (!Array.isArray(initialTiles) || initialTiles.some(t => typeof t !== 'object' || t === null)) {
        throw new Error("Invalid initial tiles generated.");
      }
      
      tileIdCounterRef.current = newCounter;
      
      console.log('[newGame] Setting new game state.');
      setRandomness(newRandomness);
      setSeed(newSeed);
      setStartTime(newStartTime);
      setPrng(newPrng);
      setTiles(initialTiles);

    } catch (error) {
      console.error(`[newGame] Error starting new game:`, error);
    } finally {
      setIsMoving(false);
      newGameLoadingRef.current = false;
      console.log('[newGame] FINISHED.');
    }
  }, []);

  // Main initialization effect. This is the orchestrator for loading games when the season changes.
  useEffect(() => {
    if (!isSdkReady) {
      console.log(`[MainEffect] Skip: SDK not ready for season '${activeSeason}'.`);
      return;
    }

    console.log(`[MainEffect] START for season: ${activeSeason}`);
    seasonTransitionRef.current = true; // Set flag to block saving during transition
    
    // STEP 1: Immediately set initializing flag and synchronously clear the board state.
    // This is a CRITICAL FIX to prevent the previous season's state from "bleeding"
    // into the new season and being incorrectly saved by the save effect.
    setIsInitializing(true);
    setTiles([]);
    setScore(0);
    setIsGameOver(false);
    setIsWon(false);

    const initializeGameForSeason = async () => {
      // Fetch user data and best scores. This can happen while we prepare the game board.
      try {
        const res = await sdk.quickAuth.fetch('/api/user-info');
        if (res.ok) {
          const data = await res.json();
          setUserAddress(data.primaryAddress || null);
        }
        const localBest = parseInt(localStorage.getItem(BEST_SCORE_KEY) || '0', 10);
        let finalBestScore = localBest;
        const authResult = await sdk.quickAuth.getToken();
        if ('token' in authResult) {
          const response = await fetch('/api/leaderboard', { headers: { 'Authorization': `Bearer ${authResult.token}` } });
          if (response.ok) {
            const leaderboardData: { isCurrentUser?: boolean; score: number }[] = await response.json();
            const currentUserEntry = leaderboardData.find(entry => entry.isCurrentUser);
            setFarcasterBestScore(currentUserEntry?.score ?? 0);
            finalBestScore = Math.max(localBest, currentUserEntry?.score ?? 0);
          }
        }
        setBestScore(finalBestScore);
        if (finalBestScore > localBest) localStorage.setItem(BEST_SCORE_KEY, finalBestScore.toString());
      } catch (error) {
        console.error('[MainEffect] Error fetching user/leaderboard data:', error);
        setFarcasterBestScore(null);
      }
      
      // STEP 2: Attempt to load the game state for the currently active season.
      const GAME_STATE_KEY = `gameState2048_${activeSeason}`;
      const savedStateJSON = localStorage.getItem(GAME_STATE_KEY);
      let loadedFromSave = false;

      if (savedStateJSON) {
        try {
          const savedState = JSON.parse(savedStateJSON);
          if (savedState.randomness && savedState.finalMovesHash) {
            console.log(`[MainEffect] Loading saved state for ${activeSeason}:`, {score: savedState.score, tilesCount: savedState.tiles.length});
            setTiles(savedState.tiles);
            setScore(savedState.score);
            setIsGameOver(savedState.isGameOver || false);
            setIsWon(savedState.isWon || false);
            setSeed(savedState.seed);
            setStartTime(savedState.startTime);
            setMoves(savedState.moves);
            setRandomness(savedState.randomness);
            setFinalMovesHash(savedState.finalMovesHash);
            
            const loadedPrng = new SeededRandom(savedState.seed);
            const prngCalls = 4 + (savedState.moves.length * 2);
            for (let i = 0; i < prngCalls; i++) loadedPrng.next();
            setPrng(loadedPrng);

            const maxId = savedState.tiles.reduce((max: number, t: TileData) => Math.max(max, t.id), 0);
            tileIdCounterRef.current = maxId + 1;
            loadedFromSave = true;
          } else {
            console.warn(`[MainEffect] Found invalid saved state for ${activeSeason}. Discarding.`);
            localStorage.removeItem(GAME_STATE_KEY);
          }
        } catch (e) {
          console.error(`[MainEffect] Failed to parse saved state for ${activeSeason}, starting new game.`, e);
          localStorage.removeItem(GAME_STATE_KEY);
        }
      }

      // STEP 3: If no valid save state was found, start a completely new game.
      if (!loadedFromSave) {
        console.log(`[MainEffect] No saved state for ${activeSeason}. Calling newGame().`);
        await newGame();
      }

      // STEP 4: All loading and setup is complete.
      setIsInitializing(false);
      console.log(`[MainEffect] FINISH for season: ${activeSeason}.`);
      
      // Schedule the ref reset to happen after this render cycle completes,
      // ensuring the save effect for the new state runs correctly on the next update.
      setTimeout(() => {
        console.log(`[MainEffect] Resetting season transition flag for ${activeSeason}.`);
        seasonTransitionRef.current = false;
      }, 0);
    };

    initializeGameForSeason();
  }, [isSdkReady, activeSeason]);
  
  // Game state saving effect
  useEffect(() => {
    // CRITICAL FIX: Do not save while a season transition is in progress.
    if (seasonTransitionRef.current) {
      console.log(`[SaveEffect] SKIPPING save for ${activeSeason} during season transition.`);
      return;
    }

    const shouldSave = !isInitializing && tiles.length > 0 && seed;
    console.log(`[SaveEffect] Check. season=${activeSeason}, isInitializing=${isInitializing}, shouldSave=${shouldSave}`);

    if (shouldSave) {
      const GAME_STATE_KEY = `gameState2048_${activeSeason}`;
      const gameState = { tiles, score, isGameOver, isWon, seed, startTime, moves, randomness, finalMovesHash };
      console.log(`[SaveEffect] SAVING state for ${activeSeason}:`, { score: gameState.score, tilesCount: gameState.tiles.length });
      localStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
    }
  }, [tiles, score, isGameOver, isWon, isInitializing, seed, startTime, moves, randomness, finalMovesHash, activeSeason]);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem(BEST_SCORE_KEY, score.toString());
    }
  }, [score, bestScore]);


  const submitScore = useCallback(async () => {
    if (hasSubmittedScore || isSubmitting) return;
    setIsSubmitting(true);
    
    // Check if the current season is an on-chain season
    if (activeSeasonConfig) {
      try {
        if (!activeSeasonConfig.address || activeSeasonConfig.address.startsWith('0xYour')) {
          throw new Error(`Contract address is not configured for ${activeSeasonConfig.chainName}.`);
        }
        if (!seed || !randomness || !userAddress || !startTime || !finalMovesHash) {
          throw new Error("Missing critical game data for on-chain submission.");
        }

        if (!isConnected) {
          setSubmissionStatus('Connecting wallet...');
          connect({ connector: connectors[0] });
          setIsSubmitting(false);
          return;
        }

        if (wagmiAddress?.toLowerCase() !== userAddress.toLowerCase()) {
           throw new Error(`Wallet mismatch. Please connect with ${userAddress.slice(0,6)}...${userAddress.slice(-4)}`);
        }

        if (chain?.id !== activeSeasonConfig.chainId) {
          setSubmissionStatus(`Switching to ${activeSeasonConfig.chainName}...`);
          switchChain({ chainId: activeSeasonConfig.chainId }, {
            onSuccess: () => {
              setSubmissionStatus(`Network switched. Please "Save Score" again.`);
              setIsSubmitting(false);
            },
            onError: (error) => {
              console.error("Failed to switch network:", error);
              setSubmissionStatus(`Please switch to ${activeSeasonConfig.chainName} in your wallet.`);
              setIsSubmitting(false);
            }
          });
          return;
        }

        const packedBoard = packBoard(tiles);
        const endTime = Date.now();
        const args = [
            BigInt(packedBoard),
            BigInt(score),
            BigInt(startTime),
            BigInt(endTime),
            ('0x' + seed) as `0x${string}`,
            ('0x' + randomness) as `0x${string}`,
            finalMovesHash as `0x${string}`
        ];

        writeContract({
          address: activeSeasonConfig.address,
          abi: activeSeasonConfig.abi,
          functionName: 'submitGame',
          args: args,
          account: wagmiAddress,
          chain: chain,
        });

      } catch (error: any) {
        console.error("On-chain submission failed:", error);
        setSubmissionStatus(error.message || 'An unknown error occurred.');
        setIsSubmitting(false);
      }
      return;
    }

    // --- Original Farcaster leaderboard submission logic ---
    try {
      const res = await sdk.quickAuth.fetch('/api/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score }),
      });

      if (res.ok) {
        setHasSubmittedScore(true);
        setFarcasterBestScore(prev => Math.max(prev ?? 0, score));
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
        setSubmissionStatus('Failed to save score.');
      }
    } catch (error) {
      console.error('Error during score submission:', error);
      setSubmissionStatus('An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  }, [score, hasSubmittedScore, isSubmitting, activeSeasonConfig, tiles, seed, startTime, randomness, finalMovesHash, userAddress, isConnected, wagmiAddress, connect, connectors, writeContract, chain, activeSeason, switchChain]);

  const performMove = useCallback(async (direction: 'up' | 'down' | 'left' | 'right') => {
    if (isGameOver || isMoving || !prng || !finalMovesHash) return;
    const gameIdAtMoveStart = gameIdRef.current;
    const { newTiles, mergedTiles, scoreIncrease, hasMoved } = move(tiles, direction);
    
    if (hasMoved) {
        setIsMoving(true);
        setScore(prev => prev + scoreIncrease);
        setTiles([...newTiles, ...mergedTiles]);

        const directionMap = { 'up': 0, 'right': 1, 'down': 2, 'left': 3 };
        const newMove = directionMap[direction];
        setMoves(prevMoves => [...prevMoves, newMove]);

        try {
          const prevHashBytes = hexToUint8Array(finalMovesHash);
          const moveByte = new Uint8Array([newMove]);
          const dataToHash = new Uint8Array(prevHashBytes.length + moveByte.length);
          dataToHash.set(prevHashBytes);
          dataToHash.set(moveByte, prevHashBytes.length);
          const newHash = await sha256(dataToHash);
          setFinalMovesHash(newHash);
        } catch (error) {
          console.error("Failed to update moves hash:", error);
        }

        moveTimeoutRef.current = window.setTimeout(() => {
          if (gameIdRef.current !== gameIdAtMoveStart) return;
          const tilesAfterAnimation = newTiles.map(t => ({ ...t, isMerged: false }));
          const { newTiles: finalTiles, newCounter } = addRandomTile(
            tilesAfterAnimation, prng, tileIdCounterRef.current
          );
          tileIdCounterRef.current = newCounter;
          setTiles(finalTiles);
          setIsMoving(false);
          if (!isWon && finalTiles.some(tile => tile.value === 2048)) setIsWon(true);
          if (checkIsGameOver(finalTiles)) setIsGameOver(true);
        }, ANIMATION_DURATION);
    }
  }, [tiles, isGameOver, isMoving, isWon, prng, finalMovesHash]);

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

  return { tiles, score, bestScore, serverBestScore, isGameOver, isWon, newGame, handleKeyDown, performMove, submitScore, isSubmitting, hasSubmittedScore, userRank, isInitializing, userAddress, submissionStatus };
};
