import React, { useEffect, useState, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useGameLogic } from './hooks/useGameLogic';
import GameBoard from './components/GameBoard';
import GameControls from './components/GameControls';
import GameOver from './components/GameOver';
import Tabs from './components/Tabs';
import Leaderboard from './components/Leaderboard';
import SeasonSelector, { Season } from './components/SeasonSelector';
import { useAccount, useSwitchChain } from 'wagmi';
import { onChainSeasonConfigs } from './constants/contract';

const App: React.FC = () => {
  // --- Hooks must be at the top level ---
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [activeTab, setActiveTab] = useState<'game' | 'top'>('game');
  const [activeSeason, setActiveSeason] = useState<Season>('farcaster');
  
  // --- New Robust Initialization State Management ---
  const [isSdkReady, setIsSdkReady] = useState(false);
  const { isConnected, chain, status: wagmiStatus } = useAccount();
  const [isAppReady, setIsAppReady] = useState(false); // This will gate the whole app

  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  // Pass `isAppReady` to the game logic hook. It will now wait for the app to be fully
  // initialized before fetching game state, preventing race conditions.
  const { 
    tiles, 
    score, 
    bestScore,
    serverBestScore,
    isGameOver, 
    newGame, 
    handleKeyDown, 
    performMove,
    submitScore,
    isSubmitting,
    hasSubmittedScore,
    userRank,
    isInitializing, // This is for game state, not app init
    userAddress,
    submissionStatus
  } = useGameLogic(isAppReady, activeSeason);

  // --- Effects for Initialization and Event Handling ---

  // Effect to determine when Farcaster SDK is ready
  useEffect(() => {
    sdk.actions.ready().then(() => {
        console.log('[SDK] Farcaster SDK is ready.');
        setIsSdkReady(true)
    });
  }, []);
  
  // Effect to determine when the entire app is ready to render.
  useEffect(() => {
    // We are ready only when the SDK is ready AND wagmi has a definitive status.
    // 'reconnecting' is a transient state; we wait until it resolves to 'connected' or 'disconnected'.
    if (isSdkReady && (wagmiStatus === 'connected' || wagmiStatus === 'disconnected')) {
      console.log(`[APP] App is ready. WAGMI status: ${wagmiStatus}`);
      setIsAppReady(true);
    }
  }, [isSdkReady, wagmiStatus]);


  // Log for detailed WAGMI connection status
  useEffect(() => {
    console.log(`[WAGMI] Connection status changed to: ${wagmiStatus}. ChainID: ${chain?.id}`);
  }, [wagmiStatus, chain?.id]);

  const handleGlobalKeyDown = useCallback((event: KeyboardEvent) => {
    if (activeTab === 'game') {
      handleKeyDown(event);
    }
  }, [activeTab, handleKeyDown]);

  // Effect to automatically switch network when an on-chain season is selected
  useEffect(() => {
    // This crucial effect will now only run when the app is fully ready.
    if (!isAppReady) return;

    const seasonConfig = onChainSeasonConfigs[activeSeason];
    if (isConnected && seasonConfig && chain?.id !== seasonConfig.chainId && switchChain && !isSwitchingChain) {
      console.log(`[ONCHAIN] Requesting network switch from chain ${chain?.id} to ${seasonConfig.chainId} for season ${activeSeason}`);
      switchChain({ chainId: seasonConfig.chainId });
    }
  }, [activeSeason, isConnected, chain, switchChain, isSwitchingChain, isAppReady]);

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [handleGlobalKeyDown]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || e.changedTouches.length !== 1) {
      setTouchStart(null);
      return;
    }

    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const dx = touchEnd.x - touchStart.x;
    const dy = touchEnd.y - touchStart.y;
    const minSwipeDistance = 40; // Minimum distance for a swipe to be registered

    if (Math.abs(dx) > Math.abs(dy)) { // Horizontal swipe
      if (Math.abs(dx) > minSwipeDistance) {
        performMove(dx > 0 ? 'right' : 'left');
      }
    } else { // Vertical swipe
      if (Math.abs(dy) > minSwipeDistance) {
        performMove(dy > 0 ? 'down' : 'up');
      }
    }

    setTouchStart(null);
  };
  
  const [shouldShowSaveFlow, setShouldShowSaveFlow] = useState(false);

  const isNewBestScore = serverBestScore !== null
    ? score > serverBestScore
    : score > bestScore;

  useEffect(() => {
    if (isGameOver) {
      if (isNewBestScore && score > 0) {
        setShouldShowSaveFlow(true);
      }
    } else {
      setShouldShowSaveFlow(false);
    }
  }, [isGameOver, isNewBestScore, score]);

  const displayBestScore = serverBestScore !== null ? serverBestScore : bestScore;

  // --- Render Logic ---

  // Render a global initializing screen until the app is ready.
  if (!isAppReady) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center">
        <div className="animate-pulse text-slate-400">Initializing...</div>
      </div>
    );
  }

  const renderGameContent = () => {
    // This `isInitializing` is for loading the specific game state for a season.
    if (isInitializing) {
      return (
        <div className="flex-grow flex flex-col items-center justify-center">
          <div className="animate-pulse text-slate-400">Loading season...</div>
        </div>
      );
    }
    return (
      <div 
        className="w-full flex flex-col items-center animate-fade-in"
        style={{ touchAction: 'none' }} // Prevents browser from scrolling on touch devices
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <GameControls score={score} bestScore={displayBestScore} onNewGame={newGame} />
        
        <div className="relative w-full">
          <GameBoard tiles={tiles} />
          {isGameOver && (
            <GameOver 
              onRestart={newGame} 
              score={score} 
              onSubmitScore={submitScore}
              isSubmitting={isSubmitting}
              hasSubmittedScore={hasSubmittedScore}
              isNewBestScore={shouldShowSaveFlow}
              userRank={userRank}
              submissionStatus={submissionStatus}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen text-white flex flex-col items-center p-4 font-sans">
      <div className="w-full sm:max-w-md mx-auto flex flex-col flex-grow">
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
        <SeasonSelector activeSeason={activeSeason} onSeasonChange={setActiveSeason} />
        
        <main className="flex-grow flex flex-col w-full items-center justify-center">
          {activeTab === 'game' ? renderGameContent() : <Leaderboard isReady={isAppReady} activeSeason={activeSeason} />}
        </main>
      </div>
    </div>
  );
};

export default App;