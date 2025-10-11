import React from 'react';

interface GameControlsProps {
  score: number;
  bestScore: number;
  onNewGame: () => void;
}

const ScoreBox: React.FC<{ title: string; score: number }> = ({ title, score }) => (
  <div className="bg-slate-700 p-2 rounded-lg text-center w-24">
    <div className="text-xs text-slate-400 uppercase tracking-wider">{title}</div>
    <div className="text-xl font-bold">{score}</div>
  </div>
);

const GameControls: React.FC<GameControlsProps> = ({ score, bestScore, onNewGame }) => {
  return (
    <div className="flex flex-wrap justify-between items-center w-full mb-4 px-1 gap-2">
      <h1 className="text-5xl sm:text-6xl font-extrabold text-white">2048</h1>
      <div className="flex items-center space-x-2 order-3 sm:order-2 w-full sm:w-auto justify-center">
        <ScoreBox title="Score" score={score} />
        <ScoreBox title="Best" score={bestScore} />
      </div>
      <button
        onClick={onNewGame}
        className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 self-center order-2 sm:order-3 h-12"
      >
        New Game
      </button>
    </div>
  );
};

export default GameControls;