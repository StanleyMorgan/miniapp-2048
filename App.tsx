import React, { useEffect, useState, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useGameLogic } from './hooks/useGameLogic';
import GameBoard from './components/GameBoard';
import GameControls from './components/GameControls';
import GameOver from './components/GameOver';
import Tabs from './components/Tabs';
import Leaderboard from './components/Leaderboard';

const App: React.FC = () => {
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [activeTab, setActiveTab] = useState<'game' | 'top'>('game');
  const [isSdkReady, setIsSdkReady] = useState(false);

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
    hasSubmittedScore
  } = useGameLogic(isSdkReady);

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
  
  // A new best score is achieved if the server score is known and beaten,
  // otherwise, it falls back to comparing against the local best score.
  // This correctly handles logged-in users vs. anonymous users.
  const isNewBestScore = serverBestScore !== null
    ? score > serverBestScore
    : score > bestScore;

  return (
    <div className="min-h-screen w-screen text-white flex flex-col items-center p-4 font-sans">
      <div className="w-full sm:max-w-md mx-auto flex flex-col flex-grow">
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
        
        <main className={`flex-grow flex flex-col w-full ${activeTab === 'game' ? 'items-center justify-center' : ''}`}>
          {activeTab === 'game' ? (
            <div 
              className="w-full flex flex-col items-center animate-fade-in"
              style={{ touchAction: 'none' }} // Prevents browser from scrolling on touch devices
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <GameControls score={score} bestScore={bestScore} onNewGame={newGame} />
              
              <div className="relative w-full">
                <GameBoard tiles={tiles} />
                {isGameOver && (
                  <GameOver 
                    onRestart={newGame} 
                    score={score} 
                    onSubmitScore={submitScore}
                    isSubmitting={isSubmitting}
                    hasSubmittedScore={hasSubmittedScore}
                    isNewBestScore={isNewBestScore && score > 0}
                  />
                )}
              </div>
            </div>
          ) : (
            <Leaderboard isReady={isSdkReady} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;