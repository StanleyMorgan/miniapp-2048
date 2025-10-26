import React, { useEffect, useState, useCallback, useRef } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useGameLogic } from './hooks/useGameLogic';
import GameBoard from './components/GameBoard';
import GameControls from './components/GameControls';
import GameOver from './components/GameOver';
import Tabs from './components/Tabs';
import Leaderboard from './components/Leaderboard';
import SeasonSelector, { Season, seasons } from './components/SeasonSelector';
import RewardsDisplay from './components/RewardsDisplay';
import { useAccount, useSwitchChain } from 'wagmi';
import { onChainSeasonConfigs } from './constants/contract';
import { useLeaderboard } from './hooks/useLeaderboard';
import { celoS0RewardShares } from './constants/rewards';
import InfoDisplay from './components/InfoDisplay';
import CountdownTimer from './components/CountdownTimer';

const App: React.FC = () => {
  // --- Hooks must be at the top level ---
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [activeTab, setActiveTab] = useState<'game' | 'top'>('game');
  const [activeSeason, setActiveSeason] = useState<Season>('farcaster');
  
  // --- New Robust Initialization State Management ---
  const [isSdkReady, setIsSdkReady] = useState(false);
  const { isConnected, chain, status: wagmiStatus } = useAccount();
  const [isAppReady, setIsAppReady] = useState(false); // This will gate the whole app
  const appReadyTimeoutRef = useRef<number | null>(null);

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
    wasNewBestScore,
    userRank,
    isInitializing, // This is for game state, not app init
    userAddress,
    submissionStatus
  } = useGameLogic(isAppReady, activeSeason);
  
  const { data: leaderboardData, isLoading: isLeaderboardLoading } = useLeaderboard(isAppReady, activeSeason);

  // --- Effects for Initialization and Event Handling ---

  // Effect to determine when Farcaster SDK is ready
  useEffect(() => {
    sdk.actions.ready().then(() => {
        console.log('[SDK] Farcaster SDK is ready.');
        setIsSdkReady(true)
    });
  }, []);
  
  // Effect to determine when the entire app is ready to render, with a timeout and auto-reload for stuck states.
  useEffect(() => {
    // Always clear the previous timeout when this effect re-runs
    if (appReadyTimeoutRef.current) {
      clearTimeout(appReadyTimeoutRef.current);
      appReadyTimeoutRef.current = null;
    }

    console.log(`[APP] Readiness check: isSdkReady=${isSdkReady}, wagmiStatus=${wagmiStatus}`);

    if (isSdkReady) {
      if (wagmiStatus === 'connected' || wagmiStatus === 'disconnected') {
        // Ideal case: wagmi has a definitive status.
        console.log(`[APP] App is ready. WAGMI status: ${wagmiStatus}`);
        setIsAppReady(true);
      } else if (wagmiStatus === 'connecting' || wagmiStatus === 'reconnecting') {
        // Wagmi is trying to connect or reconnect. This can get stuck on cold starts.
        // Set a 3-second timeout. If it's still in this state, reload the app.
        console.log(`[APP] Wagmi is in '${wagmiStatus}' state. Setting a 3-second timeout to prevent getting stuck.`);
        appReadyTimeoutRef.current = window.setTimeout(() => {
          console.warn(`[APP] Timeout reached while in '${wagmiStatus}' state. Reloading the application to resolve the stuck state.`);
          window.location.reload();
        }, 3000); // 3-second timeout
      }
    }
    
    // Cleanup function to clear timeout if the component unmounts
    return () => {
      if (appReadyTimeoutRef.current) {
        clearTimeout(appReadyTimeoutRef.current);
      }
    };
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

    const seasonConfig = onChainSeasonConfigs[activeSeason as keyof typeof onChainSeasonConfigs];
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
              score={score} 
              onSubmitScore={submitScore}
              isSubmitting={isSubmitting}
              hasSubmittedScore={hasSubmittedScore}
              isNewBestScore={wasNewBestScore}
              userRank={userRank}
              submissionStatus={submissionStatus}
              activeSeason={activeSeason}
            />
          )}
        </div>
      </div>
    );
  }

  const activeSeasonData = seasons.find(s => s.id === activeSeason);
  const celoEndDate = '2025-12-01T00:00:00Z';

  const calculateYourRewards = () => {
    if (isLeaderboardLoading || !leaderboardData || !['celo-s0', 'monad-s0'].includes(activeSeason) || !activeSeasonData?.prize) {
        return null;
    }

    const currentUserEntry = leaderboardData.find(entry => entry.isCurrentUser);
    if (!currentUserEntry || !currentUserEntry.rank) {
        return null;
    }

    const rank = currentUserEntry.rank;
    const totalPlayers = leaderboardData.length;
    let effectiveRank = rank;

    // For early players, calculate rewards as if they are the last N players in the top 100.
    // Example: 3 players (ranks 1, 2, 3) get rewards for ranks 98, 99, 100.
    if (totalPlayers > 0 && totalPlayers < 100) {
      effectiveRank = 100 - totalPlayers + rank;
    }

    if (effectiveRank > 0 && effectiveRank <= celoS0RewardShares.length) {
        const share = celoS0RewardShares[effectiveRank - 1];
        const reward = activeSeasonData.prize * share;
        // Format to 4 decimal places if it's not an integer
        const formattedReward = reward.toFixed(reward % 1 === 0 ? 0 : 4);
        return <><span className="text-orange-400">{formattedReward}</span><span className="text-white ml-1">{activeSeasonData.prizeUnit}</span></>;
    }

    return null;
  };

  const renderTimer = () => {
    if (activeSeason === 'celo-s0' || activeSeason === 'base-s0') {
      return <CountdownTimer targetDate={celoEndDate} />;
    }
    if (activeSeason === 'monad-s0') {
      return <CountdownTimer dailyResetUtc={true} />;
    }
    return null;
  };

  return (
    <div className="min-h-screen w-screen text-white flex flex-col items-center p-4 font-sans">
      <div className="w-full sm:max-w-md mx-auto flex flex-col flex-grow">
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="flex flex-col w-full gap-2 mb-4">
          <div className="flex w-full gap-2 items-stretch">
            <div className="flex-1">
              <SeasonSelector activeSeason={activeSeason} onSeasonChange={setActiveSeason} />
            </div>
            <div className="flex-1">
              <RewardsDisplay prize={activeSeasonData?.prize} unit={activeSeasonData?.prizeUnit} />
            </div>
          </div>
          <div className="flex w-full gap-2 items-stretch">
              <div className="flex-1">
                  <InfoDisplay 
                      title="⏳" 
                      value={renderTimer()} 
                  />
              </div>
              <div className="flex-1">
                  <InfoDisplay 
                      title="🏆" 
                      value={calculateYourRewards()} 
                  />
              </div>
          </div>
        </div>
        
        <main className="flex-grow flex flex-col w-full items-center justify-center">
          {activeTab === 'game' 
            ? renderGameContent() 
            : <Leaderboard 
                isReady={isAppReady} 
                activeSeason={activeSeason} 
              />}
        </main>
      </div>
    </div>
  );
};

export default App;