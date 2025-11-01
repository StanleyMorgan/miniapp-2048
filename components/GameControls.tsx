import React from 'react';

interface GameControlsProps {
  score: number;
  bestScore: number;
  onNewGame: () => void;
}

const ScoreBox: React.FC<{ title: string; score: number }> = ({ title, score }) => (
  <div className="bg-slate-700 p-2 rounded-lg text-center w-24 h-12 flex flex-col justify-center">
    <div className="text-xs text-slate-400 uppercase tracking-wider">{title}</div>
    <div className="text-xl font-bold">{score}</div>
  </div>
);

const GameControls: React.FC<GameControlsProps> = ({ score, bestScore, onNewGame }) => {
  return (
    <div className="flex justify-end items-center w-full mb-4 px-1 gap-2">
      <button
        disabled
        className="bg-slate-500 text-slate-400 font-bold py-2 px-4 rounded-lg cursor-not-allowed h-12 flex items-center"
      >
        Claim
      </button>
      <ScoreBox title="Hashrate" score={score} />
      <ScoreBox title="Peak Rate" score={bestScore} />
      <button
        onClick={onNewGame}
        className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 h-12 flex items-center"
      >
        New
      </button>
    </div>
  );
};

export default GameControls;