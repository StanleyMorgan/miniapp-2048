import { useState, useEffect, useCallback, useRef } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
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
import { MONAD_LEADERBOARD_ADDRESS, MONAD_LEADERBOARD_ABI } from '../constants/contract';


const BEST_SCORE_KEY = 'bestScore2048';
const ANIMATION_DURATION = 200;
const INITIAL_MOVES_HASH = '0x' + '0'.repeat(64);

export const useGameLogic = (isSdkReady: boolean, activeSeason: Season) => {
  console.log('useGameLogic hook initialized.');
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
  useEffect(() => {
    userAddressRef.current = userAddress;
  }, [userAddress]);

  const [randomness, setRandomness] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [moves, setMoves] = useState<number[]>([]);
  const [finalMovesHash, setFinalMovesHash] = useState<string>(INITIAL_MOVES_HASH);
  const [prng, setPrng] = useState<SeededRandom | null>(null);

  // --- WAGMI HOOKS FOR ON-CHAIN INTERACTION ---
  const { address: wagmiAddress, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { data: hash, writeContract, isPending, error: writeContractError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: txReceiptError } = useWaitForTransactionReceipt({ hash });
  
  const { data: onChainResult } = useReadContract({
    address: MONAD_LEADERBOARD_ADDRESS,
    abi: MONAD_LEADERBOARD_ABI,
    functionName: 'results',
    args: [userAddress as `0x${string}`],
    query: {
      enabled: isSdkReady && !!userAddress && activeSeason === 'monad-s0',
    }
  });

  // Effect to switch the displayed server best score based on the active season
  useEffect(() => {
    if (activeSeason === 'monad-s0') {
      const onChainScore = onChainResult?.[1]; // score is at index 1
      setServerBestScore(typeof onChainScore === 'bigint' ? Number(onChainScore) : 0);
    } else {
      setServerBestScore(farcasterBestScore);
    }
  }, [activeSeason, onChainResult, farcasterBestScore]);

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
    console.log('newGame: starting.');
    if (newGameLoadingRef.current) {
        console.log('newGame: already loading, returning.');
        return;
    }
    gameIdRef.current++;
    if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);

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
      console.log('newGame: fetching /api/start-game');
      const response = await fetch('/api/start-game');
      if (!response.ok) throw new Error(`Failed to start a new game session. Status: ${response.status}`);
      const { randomness: newRandomness, startTime: newStartTime } = await response.json();
      console.log('newGame: received randomness and startTime.');

      const dataToHash = `${newRandomness}${userAddressRef.current ?? ''}${newStartTime}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(dataToHash);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const newSeed = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      console.log('newGame: generating seed and initial tiles.');

      const newPrng = new SeededRandom(newSeed);
      const { initialTiles, newCounter } = generateInitialTiles(newPrng);
      
      if (!Array.isArray(initialTiles) || initialTiles.some(t => typeof t !== 'object' || t === null)) {
        throw new Error("Invalid initial tiles generated.");
      }
      
      tileIdCounterRef.current = newCounter;
      
      setRandomness(newRandomness);
      setSeed(newSeed);
      setStartTime(newStartTime);
      setPrng(newPrng);
      setTiles(initialTiles);
      console.log('newGame: finished successfully.');

    } catch (error) {
      console.error(`Error starting new game:`, error);
    } finally {
      setIsMoving(false);
      newGameLoadingRef.current = false;
      console.log('newGame: finally block executed.');
    }
  }, []);

  useEffect(() => {
    if (!isSdkReady) {
        console.log('useGameLogic useEffect: waiting for SDK to be ready.');
        return;
    }
    const initializeGame = async () => {
      console.log('initializeGame: starting.');
      setIsInitializing(true);
      try {
        console.log('initializeGame: fetching user info...');
        const res = await sdk.quickAuth.fetch('/api/user-info');
        if (res.ok) {
          const data = await res.json();
          setUserAddress(data.primaryAddress || null);
          console.log('initializeGame: user info fetched.', data);
        } else {
            console.warn('initializeGame: failed to fetch user info.', res.status);
        }
      } catch (error) { console.error('Error fetching user info:', error); }

      const localBest = parseInt(localStorage.getItem(BEST_SCORE_KEY) || '0', 10);
      let finalBestScore = localBest;
      console.log(`initializeGame: local best score is ${localBest}`);

      try {
          console.log('initializeGame: fetching server best score...');
          const authResult = await sdk.quickAuth.getToken();
          if ('token' in authResult) {
            const response = await fetch('/api/leaderboard', { headers: { 'Authorization': `Bearer ${authResult.token}` } });
            if (response.ok) {
              const leaderboardData: { isCurrentUser?: boolean; score: number }[] = await response.json();
              const currentUserEntry = leaderboardData.find(entry => entry.isCurrentUser);
              if (currentUserEntry) {
                setFarcasterBestScore(currentUserEntry.score || 0);
                finalBestScore = Math.max(localBest, currentUserEntry.score || 0);
                console.log(`initializeGame: server best score is ${currentUserEntry.score}. Final best: ${finalBestScore}`);
              } else { 
                setFarcasterBestScore(0); 
                console.log('initializeGame: user not on leaderboard. Server best score is 0.');
              }
            }
          } else {
            console.warn('initializeGame: could not get auth token.');
          }
      } catch (error) {
        console.error('Error fetching server best score:', error);
        setFarcasterBestScore(null);
      }
      setBestScore(finalBestScore);
      if (finalBestScore > localBest) localStorage.setItem(BEST_SCORE_KEY, finalBestScore.toString());
      
      const GAME_STATE_KEY = `gameState2048_${activeSeason}`;
      const savedStateJSON = localStorage.getItem(GAME_STATE_KEY);
      let loadedFromSave = false;
      console.log(`initializeGame: checking for saved game state for season ${activeSeason}. Found: ${!!savedStateJSON}`);
      if (savedStateJSON) {
        try {
          const savedState = JSON.parse(savedStateJSON);
          if (savedState.randomness && savedState.finalMovesHash) {
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
            console.log('initializeGame: loaded game from saved state.');
            loadedFromSave = true;
          } else {
            console.warn("Saved game state is invalid. Starting a new game.");
            localStorage.removeItem(GAME_STATE_KEY);
          }
        } catch (e) {
          console.error("Failed to parse saved game state.", e);
          localStorage.removeItem(GAME_STATE_KEY);
        }
      }
      if (!loadedFromSave) {
        console.log('initializeGame: no saved state, starting new game.');
        await newGame();
      }
      setIsInitializing(false);
      console.log('initializeGame: finished.');
    };
    initializeGame();
  }, [isSdkReady, newGame, activeSeason]);
  
  useEffect(() => {
    if (!isInitializing && tiles.length > 0 && seed) {
      const GAME_STATE_KEY = `gameState2048_${activeSeason}`;
      const gameState = { tiles, score, isGameOver, isWon, seed, startTime, moves, randomness, finalMovesHash };
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
    
    if (activeSeason === 'monad-s0') {
      try {
        if (!MONAD_LEADERBOARD_ADDRESS || MONAD_LEADERBOARD_ADDRESS.startsWith('0xYour')) {
          throw new Error("Contract address is not configured. Set VITE_MONAD_CONTRACT_ADDRESS in your .env file.");
        }
        if (!seed || !randomness || !userAddress || !startTime || !finalMovesHash) {
          throw new Error("Missing critical game data for on-chain submission.");
        }

        if (!isConnected) {
          setSubmissionStatus('Connecting wallet...');
          connect({ connector: connectors[0] });
          // The submission will be re-triggered by the user after connecting.
          // Or we could use an effect to watch for `isConnected` to become true.
          // For now, let the user re-click.
          setIsSubmitting(false); // Allow re-click after connection.
          return;
        }

        if (wagmiAddress?.toLowerCase() !== userAddress.toLowerCase()) {
           throw new Error(`Wallet mismatch. Please connect with ${userAddress.slice(0,6)}...${userAddress.slice(-4)}`);
        }

        if (!chain) {
          throw new Error('Please switch to the Monad network in your wallet.');
        }

        const packedBoard = packBoard(tiles);
        const endTime = Date.now();
        const args = [
            BigInt(packedBoard), // uint128
            BigInt(score), // uint64
            BigInt(startTime), // uint64
            BigInt(endTime), // uint64
            ('0x' + seed) as `0x${string}`, // bytes32
            ('0x' + randomness) as `0x${string}`, // bytes32
            finalMovesHash as `0x${string}` // bytes32
        ];

        writeContract({
          address: MONAD_LEADERBOARD_ADDRESS,
          abi: MONAD_LEADERBOARD_ABI,
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
  }, [score, hasSubmittedScore, isSubmitting, activeSeason, tiles, seed, startTime, randomness, finalMovesHash, userAddress, isConnected, wagmiAddress, connect, connectors, writeContract, chain]);

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