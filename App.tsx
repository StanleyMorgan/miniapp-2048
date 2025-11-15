
import React, { useEffect, useState, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useGameLogic } from './hooks/useGameLogic';
import GameBoard from './components/GameBoard';
import GameControls from './components/GameControls';
import GameOver from './components/GameOver';
import Tabs from './components/Tabs';
import Leaderboard from './components/Leaderboard';
import SeasonSelector, { Season, seasons } from './components/SeasonSelector';
import RewardsDisplay from './components/RewardsDisplay';
import { useAccount, useSwitchChain, useConnect, WagmiProvider } from 'wagmi';
import { config } from './wagmiConfig'; // импортируем config
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // импортируем провайдер
import { onChainSeasonConfigs } from './constants/contract';
import { useLeaderboard } from './hooks/useLeaderboard';
import { celoS0RewardShares } from './constants/rewards';
import InfoDisplay from './components/InfoDisplay';
import CountdownTimer from './components/CountdownTimer';

// Создаем клиент для TanStack Query один раз
const queryClient = new QueryClient();

// 'Game' содержит всю логику и UI, которые зависят от провайдеров
const Game: React.FC = () => {
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [activeTab, setActiveTab] = useState<'mining' | 'stats'>('mining');
  const [activeSeason, setActiveSeason] = useState<Season>('farcaster');
  
  // Состояние готовности приложения теперь управляется здесь
  const [isAppReady, setIsAppReady] = useState(false);
  
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
  } = useGameLogic(isAppReady, activeSeason);
  
  const { data: leaderboardData, isLoading: isLeaderboardLoading } = useLeaderboard(isAppReady, activeSeason);

  // Этот эффект теперь просто ждет, пока wagmi подключится
  useEffect(() => {
    console.log(`[APP] Readiness check: wagmiStatus=${wagmiStatus}`);
    if (wagmiStatus === 'connected' || wagmiStatus === 'disconnected') {
      console.log(`[APP] App is ready. WAGMI status: ${wagmiStatus}.`);
      setIsAppReady(true);
    } else {
      console.log(`[APP] Waiting for connection. WAGMI status: ${wagmiStatus}`);
    }
  }, [wagmiStatus]);
  
  // Эффект для автоматического подключения кошелька
  useEffect(() => {
    if (wagmiStatus === 'disconnected' && connectors.length > 0 && connectors[0].id === 'farcasterMiniApp') {
      console.log('[WAGMI] Wallet disconnected. Attempting to auto-connect with Farcaster connector...');
      connect({ connector: connectors[0] });
    }
  }, [wagmiStatus, connect, connectors]);
  
  useEffect(() => {
    console.log(`[WAGMI] Connection status changed to: ${wagmiStatus}. ChainID: ${chain?.id}`);
  }, [wagmiStatus, chain?.id]);

  const handleGlobalKeyDown = useCallback((event: KeyboardEvent) => {
    if (activeTab === 'mining') {
      handleKeyDown(event);
    }
  }, [activeTab, handleKeyDown]);

  useEffect(() => {
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
    const minSwipeDistance = 40;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > minSwipeDistance) performMove(dx > 0 ? 'right' : 'left');
    } else {
      if (Math.abs(dy) > minSwipeDistance) performMove(dy > 0 ? 'down' : 'up');
    }
    setTouchStart(null);
  };
  
  const displayBestScore = serverBestScore !== null ? serverBestScore : bestScore;

  if (!isAppReady) {
    let loadingMessage = 'Connecting...';
    if (wagmiStatus === 'connecting' || wagmiStatus === 'reconnecting') {
      loadingMessage = 'Connecting wallet...';
    }
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center">
        <div className="animate-pulse text-slate-400">{loadingMessage}</div>
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

  const activeSeasonData = seasons.find(s => s.id === activeSeason);
  const celoEndDate = '2025-12-01T00:00:00Z';

  const calculateYourRewards = () => {
    if (activeSeason === 'farcaster') return '****';
    if (isLeaderboardLoading || !leaderboardData || !['celo-s0', 'monad-s0', 'base-s0'].includes(activeSeason) || !activeSeasonData?.prize) return null;
    const currentUserEntry = leaderboardData.find(entry => entry.isCurrentUser);
    if (!currentUserEntry || !currentUserEntry.rank) return null;
    const rank = currentUserEntry.rank;
    const totalPlayers = leaderboardData.length;
    let effectiveRank = rank;
    if (totalPlayers > 0 && totalPlayers < 100) {
      effectiveRank = 100 - totalPlayers + rank;
    }
    if (effectiveRank > 0 && effectiveRank <= celoS0RewardShares.length) {
      const share = celoS0RewardShares[effectiveRank - 1];
      const reward = activeSeasonData.prize * share;
      const formattedReward = reward.toFixed(reward % 1 === 0 ? 0 : 5);
      return <><span className="text-orange-400">{formattedReward}</span><span className="text-white ml-1">{activeSeasonData.prizeUnit}</span></>;
    }
    return null;
  };

  const renderTimer = () => {
    if (activeSeason === 'farcaster' || activeSeason === 'celo-s0' || activeSeason === 'base-s0') {
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
            : <Leaderboard isReady={isAppReady} activeSeason={activeSeason} />}
        </main>
      </div>
    </div>
  );
};

// 'App' теперь является оберткой, которая управляет инициализацией SDK
const App: React.FC = () => {
  const [isSdkInitialized, setIsSdkInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[SDK] Starting Farcaster SDK initialization...');
        const res = await sdk.quickAuth.fetch('/api/user-info');
        if (!res.ok) throw new Error(`User info fetch failed: ${res.status}`);
        await res.json();
        console.log('[SDK] Authenticated fetch successful.');
        await sdk.actions.ready();
        console.log('[SDK] Farcaster SDK is ready.');
        setIsSdkInitialized(true);
      } catch (error) {
        console.error('[SDK] Critical initialization failed:', error);
      }
    };
    initializeApp();
  }, []);

  // Рендерим загрузчик, пока SDK не готов
  if (!isSdkInitialized) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center">
        <div className="animate-pulse text-slate-400">Initializing...</div>
      </div>
    );
  }

  // Только после готовности SDK мы рендерим провайдеры и основное приложение
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <Game />
      </WagmiProvider>
    </QueryClientProvider>
  );
};

export default App;
