
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
import { celoS0RewardShares } from './constants/rewards';
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
    if (!activeSeason || !leaderboardData || isLeaderboardLoading) return '****';

    if (activeSeason.id === 'farcaster') return '****';

    if (!['celo-s0', 'monad-s0', 'base-s0'].includes(activeSeason.id) || !activeSeason.prizePool) return null;

    const currentUserEntry = leaderboardData.find(entry => entry.isCurrentUser);
    if (!currentUserEntry || !currentUserEntry.rank) return null;

    const rank = currentUserEntry.rank;
    const totalPlayers = leaderboardData.length;
    let effectiveRank = rank;

    if (totalPlayers > 0 && totalPlayers < 100) {
      effectiveRank = 100 - totalPlayers + rank;
    }

    if (activeSeason.id === 'celo-s0' && effectiveRank > 0 && effectiveRank <= celoS0RewardShares.length) {
      const share = celoS0RewardShares[effectiveRank - 1];
      const reward = activeSeason.prizePool * share;
      const formattedReward = reward.toFixed(reward % 1 === 0 ? 0 : 5);
      return <><span className="text-orange-400">{formattedReward}</span><span className="text-white ml-1">{activeSeason.prizeUnit}</span></>;
    }
    
    // Placeholder for other seasons' reward logic
    return null;
  };

  const renderTimer = () => {
    if (activeSeason.id === 'monad-s0') {
      return <CountdownTimer dailyResetUtc={true} />;
    }
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
