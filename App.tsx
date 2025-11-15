

import React, { useEffect, useState, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useGameLogic } from './hooks/useGameLogic';
import GameBoard from './components/GameBoard';
import GameControls from './components/GameControls';
import GameOver from './components/GameOver';
import Tabs from './components/Tabs';
import Leaderboard from './components/Leaderboard';
import SeasonSelector from './components/SeasonSelector';
import RewardsDisplay from './components/RewardsDisplay';
import { useAccount, useSwitchChain, useConnect, WagmiProvider } from 'wagmi';
import { config } from './wagmiConfig';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLeaderboard } from './hooks/useLeaderboard';
import { TOP_100_REWARD_SHARES } from './constants/rewards';
import InfoDisplay from './components/InfoDisplay';
import CountdownTimer from './components/CountdownTimer';
import type { SeasonInfo } from './types';

const queryClient = new QueryClient();

const Game: React.FC<{ seasons: SeasonInfo[], activeSeason: SeasonInfo | undefined, onSeasonChange: (id: string) => void }> = ({ seasons, activeSeason, onSeasonChange }) => {
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [activeTab, setActiveTab] = useState<'mining' | 'stats'>('mining');
  
  const { isConnected, chain, status: wagmiStatus } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

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
    isInitializing,
    submissionStatus
  } = useGameLogic(!!activeSeason, activeSeason);
  
  const { data: leaderboardData, isLoading: isLeaderboardLoading } = useLeaderboard(!!activeSeason, activeSeason?.id || null);

  useEffect(() => {
    console.log(`[WAGMI] Connection status changed to: ${wagmiStatus}. ChainID: ${chain?.id}`);
  }, [wagmiStatus, chain?.id]);

  const handleGlobalKeyDown = useCallback((event: KeyboardEvent) => {
    if (activeTab === 'mining') {
      handleKeyDown(event);
    }
  }, [activeTab, handleKeyDown]);

  useEffect(() => {
    if (!activeSeason) return;
    const seasonConfig = activeSeason;
    if (isConnected && seasonConfig.contractAddress && chain?.id !== seasonConfig.chainId && switchChain && !isSwitchingChain) {
      console.log(`[ONCHAIN] Requesting network switch from chain ${chain?.id} to ${seasonConfig.chainId} for season ${activeSeason.id}`);
      switchChain({ chainId: seasonConfig.chainId });
    }
  }, [activeSeason, isConnected, chain, switchChain, isSwitchingChain]);

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
    const minSwipeDistance = 40;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > minSwipeDistance) performMove(dx > 0 ? 'right' : 'left');
    } else {
      if (Math.abs(dy) > minSwipeDistance) performMove(dy > 0 ? 'down' : 'up');
    }
    setTouchStart(null);
  };
  
  const displayBestScore = serverBestScore !== null ? serverBestScore : bestScore;

  if (!activeSeason) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading seasons...</div>
      </div>
    );
  }

  const renderGameContent = () => {
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
        style={{ touchAction: 'none' }}
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

  const calculateYourRewards = () => {
    // A season must be on-chain (have a contract address) and have a prize pool to have rewards.
    if (!activeSeason || !leaderboardData || isLeaderboardLoading || !activeSeason.prizePool || !activeSeason.contractAddress) {
      return '****';
    }

    const currentUserEntry = leaderboardData.find(entry => entry.isCurrentUser);
    if (!currentUserEntry || !currentUserEntry.rank) {
      return null; // User not on leaderboard or rank is 0
    }

    const rank = currentUserEntry.rank;
    const totalPlayers = leaderboardData.length;
    let effectiveRank = rank;

    // This logic ensures that if there are fewer than 100 players, the rewards are still
    // distributed from the "end" of the reward share table.
    // E.g., if 10 players, 1st place gets the reward for rank 91, 2nd for 92, etc.
    if (totalPlayers > 0 && totalPlayers < 100) {
      effectiveRank = 100 - totalPlayers + rank;
    }

    if (effectiveRank > 0 && effectiveRank <= TOP_100_REWARD_SHARES.length) {
      const share = TOP_100_REWARD_SHARES[effectiveRank - 1];
      const reward = activeSeason.prizePool * share;
      
      // Smart formatting for decimals
      let decimalPlaces;
      if (reward >= 1) {
          decimalPlaces = 2;
      } else if (reward > 0.001) {
          decimalPlaces = 4;
      } else {
          decimalPlaces = 6;
      }
      const formattedReward = parseFloat(reward.toFixed(decimalPlaces));

      return <><span className="text-orange-400">{formattedReward}</span><span className="text-white ml-1">{activeSeason.prizeUnit}</span></>;
    }

    // Fallback for ranks outside the reward zone (e.g., rank > 100)
    return null;
  };

  const renderTimer = () => {
    if (activeSeason.endDate) {
      return <CountdownTimer targetDate={activeSeason.endDate} />;
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
              <SeasonSelector seasons={seasons} activeSeasonId={activeSeason.id} onSeasonChange={onSeasonChange} />
            </div>
            <div className="flex-1">
              <RewardsDisplay prize={activeSeason.prizePool} unit={activeSeason.prizeUnit} />
            </div>
          </div>
          <div className="flex w-full gap-2 items-stretch">
              <div className="flex-1">
                  <InfoDisplay title="⏳" value={renderTimer()} />
              </div>
              <div className="flex-1">
                  <InfoDisplay title="🏆" value={calculateYourRewards()} />
              </div>
          </div>
        </div>
        <main className="flex-grow flex flex-col w-full items-center justify-center">
          {activeTab === 'mining' 
            ? renderGameContent() 
            : <Leaderboard isReady={!!activeSeason} activeSeasonId={activeSeason.id} />}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [initializationState, setInitializationState] = useState<'sdk' | 'seasons' | 'ready'>('sdk');
  const [seasons, setSeasons] = useState<SeasonInfo[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  
  const { status: wagmiStatus } = useAccount();
  const { connect, connectors } = useConnect();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setInitializationState('sdk');
        console.log('[SDK] Starting Farcaster SDK initialization...');
        await sdk.quickAuth.fetch('/api/user-info');
        console.log('[SDK] Authenticated fetch successful.');
        await sdk.actions.ready();
        console.log('[SDK] Farcaster SDK is ready.');

        setInitializationState('seasons');
        console.log('[APP] Fetching seasons...');
        const seasonsResponse = await fetch('/api/seasons');
        if (!seasonsResponse.ok) throw new Error('Failed to fetch seasons');
        const seasonsData: SeasonInfo[] = await seasonsResponse.json();
        
        const defaultSeason = seasonsData.find(s => s.isDefault) || seasonsData[0];
        if (!defaultSeason) throw new Error('No seasons available');

        setSeasons(seasonsData);
        setActiveSeasonId(defaultSeason.id);
        setInitializationState('ready');
        console.log('[APP] Seasons loaded, app is ready.');

      } catch (error) {
        console.error('[APP] Critical initialization failed:', error);
      }
    };
    initializeApp();
  }, []);
  
  // Auto-connect Farcaster wallet
  useEffect(() => {
    if (initializationState === 'ready' && wagmiStatus === 'disconnected' && connectors.length > 0 && connectors[0].id === 'farcasterMiniApp') {
      console.log('[WAGMI] Wallet disconnected. Attempting to auto-connect with Farcaster connector...');
      connect({ connector: connectors[0] });
    }
  }, [initializationState, wagmiStatus, connect, connectors]);


  if (initializationState !== 'ready') {
    let message = 'Initializing...';
    if (initializationState === 'seasons') message = 'Loading seasons...';
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center">
        <div className="animate-pulse text-slate-400">{message}</div>
      </div>
    );
  }

  const activeSeason = seasons.find(s => s.id === activeSeasonId);

  return (
    <Game seasons={seasons} activeSeason={activeSeason} onSeasonChange={setActiveSeasonId} />
  );
};


const AppWrapper: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <App />
      </WagmiProvider>
    </QueryClientProvider>
  )
}

export default AppWrapper;