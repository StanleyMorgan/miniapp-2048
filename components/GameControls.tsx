
import React from 'react';

interface GameControlsProps {
  score: number;
  bestScore: number;
  onNewGame: () => void;
}

const ScoreBox: React.FC<{ title: string; score: number }> = ({ title, score }) => (
  <div className="bg-slate-700 p-3 rounded-lg text-center w-28">
    <div className="text-sm text-slate-400 uppercase tracking-wider">{title}</div>
    <div className="text-2xl font-bold">{score}</div>
  </div>
);

const GameControls: React.FC<GameControlsProps> = ({ score, bestScore, onNewGame }) => {
  return (
    <div className="flex justify-between items-center w-full max-w-md mb-4 px-1">
      <h1 className="text-5xl md:text-6xl font-extrabold text-white">2048</h1>
      <div className="flex items-center space-x-2">
        <ScoreBox title="Score" score={score} />
        <ScoreBox title="Best" score={bestScore} />
      </div>
      <button
        onClick={onNewGame}
        className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 self-end h-14"
      >
        New Game
      </button>
    </div>
  );
};

export default GameControls;
