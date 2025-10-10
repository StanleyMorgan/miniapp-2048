
import React, { useEffect } from 'react';
import { useGameLogic } from './hooks/useGameLogic';
import GameBoard from './components/GameBoard';
import GameControls from './components/GameControls';
import GameOver from './components/GameOver';

const App: React.FC = () => {
  const { tiles, score, bestScore, isGameOver, isWon, newGame, handleKeyDown } = useGameLogic();

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen text-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="relative flex flex-col items-center">
        <GameControls score={score} bestScore={bestScore} onNewGame={newGame} />
        
        <div className="relative">
          <GameBoard tiles={tiles} />
          {isGameOver && <GameOver onRestart={newGame} score={score} />}
        </div>
        
        <div className="text-center mt-8">
          <h2 className="text-lg font-bold text-slate-300">How to play:</h2>
          <p className="text-slate-400">Use your arrow keys to move the tiles.</p>
          <p className="text-slate-400">Tiles with the same number merge into one!</p>
        </div>

        <footer className="absolute -bottom-16 text-center text-slate-500 text-sm">
            <p>Built with React & Tailwind CSS.</p>
            <p className="mt-1">Future integration: High scores on the EVM blockchain.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
