import React, { useEffect, useState, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useGameLogic } from './hooks/useGameLogic';
import GameBoard from './components/GameBoard';
import GameControls from './components/GameControls';
import GameOver from './components/GameOver';
import Tabs from './components/Tabs';
import Leaderboard from './components/Leaderboard';
import SeasonSelector, { Season } from './components/SeasonSelector';

const App: React.FC = () => {
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [activeTab, setActiveTab] = useState<'game' | 'top'>('game');
  const [activeSeason, setActiveSeason] = useState<Season>('farcaster');
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [shouldShowSaveFlow, setShouldShowSaveFlow] = useState(false);

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
    isInitializing,
    userAddress
  } = useGameLogic(isSdkReady, activeSeason);

  const handleGlobalKeyDown = useCallback((event: KeyboardEvent) => {
    if (activeTab === 'game') {
      handleKeyDown(event);
    }
  }, [activeTab, handleKeyDown]);

  useEffect(() => {
    // Ensure the SDK is ready before we attempt to use any of its functionality.
    sdk.actions.ready().then(() => setIsSdkReady(true));

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [handleGlobalKeyDown]);

  const handleTouchStart = (e: React.TouchEvent) => {
    // No need to check activeTab here, as this handler is only on the game container
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
  
  // This logic determines if a new best score has been achieved.
  const isNewBestScore = serverBestScore !== null
    ? score > serverBestScore
    : score > bestScore;

  // This effect "latches" the decision to show the save/share flow.
  // When the game ends, we check if it's a new best score. If so, we set a state.
  // This state persists even if `isNewBestScore` becomes false after saving the score,
  // ensuring the "Share" button can be shown. It resets on a new game.
  useEffect(() => {
    if (isGameOver) {
      if (isNewBestScore && score > 0) {
        setShouldShowSaveFlow(true);
      }
    } else {
      setShouldShowSaveFlow(false);
    }
  }, [isGameOver, isNewBestScore, score]);

  // Determine which "best score" to display in the top controls.
  // If the user is authenticated (serverBestScore is not null), we show their official score from the leaderboard.
  // Otherwise, we fall back to the locally stored best score.
  const displayBestScore = serverBestScore !== null ? serverBestScore : bestScore;


  const renderGameContent = () => {
    if (isInitializing) {
      return (
        <div className="flex-grow flex flex-col items-center justify-center">
          <div className="animate-pulse text-slate-400">Initializing session...</div>
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
          {activeTab === 'game' ? renderGameContent() : <Leaderboard isReady={isSdkReady} />}
        </main>
      </div>
    </div>
  );
};

export default App;
