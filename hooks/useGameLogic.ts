

import { useState, useEffect, useCallback, useRef } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSwitchChain } from 'wagmi';
import type { TileData, SeasonInfo } from '../types';
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
import { getAbiForVersion } from '../constants/contract';

const BEST_SCORE_KEY = 'bestScore2048';
const ANIMATION_DURATION = 200;
const INITIAL_MOVES_HASH = '0x' + '0'.repeat(64);

export const useGameLogic = (isAppReady: boolean, activeSeason: SeasonInfo | undefined) => {
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
  const [wasNewBestScore, setWasNewBestScore] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState('');
  
  const tileIdCounterRef = useRef(1);
  const moveTimeoutRef = useRef<number | null>(null);
  const gameIdRef = useRef(0);
  const newGameLoadingRef = useRef(false);
  const userAddressRef = useRef(userAddress);
  const seasonTransitionRef = useRef(false);

  useEffect(() => {
    userAddressRef.current = userAddress;
  }, [userAddress]);

  const [randomness, setRandomness] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [moves, setMoves] = useState<number[]>([]);
  const [finalMovesHash, setFinalMovesHash] = useState<string>(INITIAL_MOVES_HASH);
  const [prng, setPrng] = useState<SeededRandom | null>(null);
  
  const { address: wagmiAddress, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const { data: hash, writeContract, isPending, error: writeContractError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: txReceiptError } = useWaitForTransactionReceipt({ hash });
  
  const isBestScoreQueryEnabled = isAppReady && !!userAddress && !!activeSeason?.contractAddress && isConnected && chain?.id === activeSeason.chainId;

  // Select the correct ABI based on the season version
  const contractAbi = getAbiForVersion(activeSeason?.contractVersion);
  const isV2 = activeSeason?.contractVersion === 'v2';

  // For V2 contracts, fetch the required fee amount
  const { data: feeAmount, isLoading: isFeeLoading } = useReadContract({
    address: activeSeason?.contractAddress,
    abi: contractAbi,
    functionName: 'feeAmount',
    query: {
      enabled: isV2 && !!activeSeason?.contractAddress,
    }
  });

  useEffect(() => {
    if (activeSeason?.contractAddress) {
        console.log(`[DEBUG] Best Score Query State for season '${activeSeason.id}':`, {
            isAppReady: isAppReady,
            hasUserAddress: !!userAddress,
            isWalletConnected: isConnected,
            currentChainId: chain?.id,
            expectedChainId: activeSeason.chainId,
            isCorrectChain: chain?.id === activeSeason.chainId,
            isQueryEnabled: isBestScoreQueryEnabled,
            contractVersion: activeSeason.contractVersion
        });
    }
  }, [isAppReady, userAddress, isConnected, chain?.id, activeSeason, isBestScoreQueryEnabled]);
  
  const { data: onChainResult, error: onChainResultError } = useReadContract({
    address: activeSeason?.contractAddress,
    abi: contractAbi,
    functionName: 'results',
    args: [userAddress as `0x${string}`],
    query: {
      enabled: isBestScoreQueryEnabled,
    }
  });

  useEffect(() => {
    if (onChainResult) {
      const score = (onChainResult as any)?.[1]; // Use any cast to handle potential abi differences, though structure matches
      console.log(`[ONCHAIN] Successfully fetched best score for ${userAddress} on season ${activeSeason?.id}: ${score}`);
    }
    if (onChainResultError) {
      console.error(`[ONCHAIN] Error fetching best score for ${userAddress} on season ${activeSeason?.id}:`, onChainResultError);
    }
  }, [onChainResult, onChainResultError, userAddress, activeSeason]);

  useEffect(() => {
    if (activeSeason?.contractAddress) {
      const onChainScore = (onChainResult as any)?.[1];
      setServerBestScore(typeof onChainScore === 'bigint' ? Number(onChainScore) : 0);
    } else {
      setServerBestScore(farcasterBestScore);
    }
  }, [activeSeason, onChainResult, farcasterBestScore]);

  useEffect(() => {
    if (isPending) {
      setSubmissionStatus('Confirm in your wallet...');
      console.log('[ONCHAIN] Transaction pending user confirmation...');
    } else if (isConfirming) {
      setSubmissionStatus('Submitting on-chain...');
      console.log(`[ONCHAIN] Transaction submitted with hash: ${hash}. Waiting for confirmation...`);
    } else if (isConfirmed) {
      setSubmissionStatus('Success! Score submitted on-chain.');
      console.log(`[ONCHAIN] Transaction confirmed for hash: ${hash}.`);
      setHasSubmittedScore(true);
      setIsSubmitting(false);
    } else if (writeContractError || txReceiptError) {
      const error = writeContractError || txReceiptError;
      const message = (error as any)?.shortMessage || error?.message || 'Transaction failed.';
      setSubmissionStatus(message);
      console.error('[ONCHAIN] Transaction failed.', { writeContractError, txReceiptError });
      setIsSubmitting(false);
    }
  }, [isPending, isConfirming, isConfirmed, writeContractError, txReceiptError, hash]);
  
  useEffect(() => {
    if (isGameOver && !wasNewBestScore) {
      const currentBest = serverBestScore ?? bestScore;
      if (score > currentBest && score > 0) {
        setWasNewBestScore(true);
      }
    }
  }, [isGameOver, score, bestScore, serverBestScore, wasNewBestScore]);


  const newGame = useCallback(async () => {
    if (newGameLoadingRef.current) return;

    gameIdRef.current++;
    if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);

    setTiles([]);
    setScore(0);
    setIsGameOver(false);
    setIsWon(false);
    setHasSubmittedScore(false);
    setWasNewBestScore(false);
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
      const response = await fetch('/api/start-game');
      if (!response.ok) throw new Error(`Failed to start a new game session. Status: ${response.status}`);
      const { randomness: newRandomness, startTime: newStartTime } = await response.json();

      const dataToHash = `${newRandomness}${userAddressRef.current ?? ''}${newStartTime}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(dataToHash);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const newSeed = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

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

    } catch (error) {
      console.error(`[newGame] Error starting new game:`, error);
    } finally {
      setIsMoving(false);
      newGameLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isAppReady || !activeSeason) return;

    seasonTransitionRef.current = true;
    
    setIsInitializing(true);
    setTiles([]);
    setScore(0);
    setIsGameOver(false);
    setIsWon(false);

    const initializeGameForSeason = async () => {
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
      
      const GAME_STATE_KEY = `gameState2048_${activeSeason.id}`;
      const savedStateJSON = localStorage.getItem(GAME_STATE_KEY);
      let loadedFromSave = false;

      if (savedStateJSON) {
        try {
          const savedState = JSON.parse(savedStateJSON);
          if (savedState.randomness && savedState.finalMovesHash) {
            setTiles(savedState.tiles);
            setScore(savedState.score);
            setIsGameOver(savedState.isGameOver || false);
            setIsWon(savedState.isWon || false);
            setHasSubmittedScore(savedState.hasSubmittedScore || false);
            setWasNewBestScore(savedState.wasNewBestScore || false);
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
            console.warn(`[MainEffect] Found invalid saved state for ${activeSeason.id}. Discarding.`);
            localStorage.removeItem(GAME_STATE_KEY);
          }
        } catch (e) {
          console.error(`[MainEffect] Failed to parse saved state for ${activeSeason.id}, starting new game.`, e);
          localStorage.removeItem(GAME_STATE_KEY);
        }
      }

      if (!loadedFromSave) {
        await newGame();
      }

      setIsInitializing(false);
      
      setTimeout(() => {
        seasonTransitionRef.current = false;
      }, 0);
    };

    initializeGameForSeason();
  }, [isAppReady, activeSeason]);
  
  useEffect(() => {
    if (seasonTransitionRef.current || !activeSeason) return;

    const shouldSave = !isInitializing && tiles.length > 0 && seed;

    if (shouldSave) {
      const GAME_STATE_KEY = `gameState2048_${activeSeason.id}`;
      const gameState = { tiles, score, isGameOver, isWon, seed, startTime, moves, randomness, finalMovesHash, hasSubmittedScore, wasNewBestScore };
      localStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
    }
  }, [tiles, score, isGameOver, isWon, isInitializing, seed, startTime, moves, randomness, finalMovesHash, activeSeason, hasSubmittedScore, wasNewBestScore]);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem(BEST_SCORE_KEY, score.toString());
    }
  }, [score, bestScore]);


  const submitScore = useCallback(async () => {
    if (hasSubmittedScore || isSubmitting || !activeSeason) return;
    
    // Safety check: Prevent submission if season has ended
    if (activeSeason.endDate && new Date(activeSeason.endDate).getTime() < Date.now()) {
      setSubmissionStatus('Season has ended');
      return;
    }

    setIsSubmitting(true);
    
    if (activeSeason.contractAddress) {
      try {
        if (activeSeason.contractAddress.startsWith('0xYour')) {
          throw new Error(`Contract address is not configured for ${activeSeason.chainName}.`);
        }
        if (!seed || !randomness || !userAddress || !startTime || !finalMovesHash) {
          throw new Error("Missing critical game data for on-chain submission.");
        }

        // Check if v2 fee is still loading
        if (isV2 && isFeeLoading) {
             setSubmissionStatus('Fetching fee data...');
             // Wait briefly? Or just fail? Let's assume if user clicked, we can wait a moment or fail.
             // Ideally we shouldn't enable the button if loading, but for now:
             if (feeAmount === undefined) {
                 throw new Error("Unable to determine transaction fee. Please try again.");
             }
        }

        if (!isConnected) {
          console.log('[ONCHAIN] Wallet not connected. Prompting user to connect.');
          setSubmissionStatus('Connecting wallet...');
          connect({ connector: connectors[0] });
          setIsSubmitting(false);
          return;
        }

        if (wagmiAddress?.toLowerCase() !== userAddress.toLowerCase()) {
           throw new Error(`Wallet mismatch. Please connect with ${userAddress.slice(0,6)}...${userAddress.slice(-4)}`);
        }

        if (chain?.id !== activeSeason.chainId) {
          console.log(`[ONCHAIN] Incorrect network. Current: ${chain?.id}, Required: ${activeSeason.chainId}. Requesting switch.`);
          setSubmissionStatus(`Switching to ${activeSeason.chainName}...`);
          switchChain({ chainId: activeSeason.chainId! }, {
            onSuccess: () => {
              console.log('[ONCHAIN] Network switch successful.');
              setSubmissionStatus(`Network switched. Please "Confirm Blocks" again.`);
              setIsSubmitting(false);
            },
            onError: (error) => {
              console.error("[ONCHAIN] Failed to switch network:", error);
              setSubmissionStatus(`Please switch to ${activeSeason.chainName} in your wallet.`);
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
        ] as any[];

        let valueToSend: bigint | undefined = undefined;

        if (isV2) {
             // V2 requires referrer and potentially a fee
             // We use 0x00...00 as referrer for now as we don't have a referral UI
             args.push('0x0000000000000000000000000000000000000000');
             
             if (feeAmount) {
                 valueToSend = feeAmount as bigint;
                 console.log(`[ONCHAIN] V2 Contract detected. Attaching fee: ${valueToSend.toString()}`);
             }
        }
        
        console.log(`[ONCHAIN] Preparing to submit score to ${activeSeason.contractAddress} on chain ${activeSeason.chainId} using version ${activeSeason.contractVersion}`);
        console.log('[ONCHAIN] Submission args:', args);

        writeContract({
          address: activeSeason.contractAddress,
          abi: contractAbi,
          functionName: 'submitGame',
          args: args,
          account: wagmiAddress,
          chain: chain,
          value: valueToSend
        });

      } catch (error: any) {
        console.error("[ONCHAIN] On-chain submission failed:", error);
        setSubmissionStatus(error.message || 'An unknown error occurred.');
        setIsSubmitting(false);
      }
      return;
    }

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
  }, [score, hasSubmittedScore, isSubmitting, activeSeason, tiles, seed, startTime, randomness, finalMovesHash, userAddress, isConnected, wagmiAddress, connect, connectors, writeContract, chain, switchChain, contractAbi, isV2, feeAmount, isFeeLoading]);

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

  return { tiles, score, bestScore, serverBestScore, isGameOver, isWon, newGame, handleKeyDown, performMove, submitScore, isSubmitting, hasSubmittedScore, wasNewBestScore, userRank, isInitializing, userAddress, submissionStatus };
};
