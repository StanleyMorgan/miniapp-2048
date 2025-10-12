import React from 'react';

interface GameOverProps {
  onRestart: () => void;
  score: number;
  onSubmitScore: () => void;
  isSubmitting: boolean;
  hasSubmittedScore: boolean;
}

const GameOver: React.FC<GameOverProps> = ({ onRestart, score, onSubmitScore, isSubmitting, hasSubmittedScore }) => {
  const getSubmitButtonText = () => {
    if (isSubmitting) return 'Saving...';
    if (hasSubmittedScore) return 'Saved!';
    return 'Save Score';
  };
  
  return (
    <div className="absolute inset-0 bg-slate-800 bg-opacity-70 flex flex-col justify-center items-center rounded-lg animate-fade-in z-30">
      <h2 className="text-5xl font-extrabold text-white mb-2">Game Over!</h2>
      <p className="text-lg text-slate-300 mb-6">Your score: {score}</p>
      <div className="flex gap-4">
        <button
          onClick={onRestart}
          className="bg-slate-500 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 text-lg"
        >
          Try Again
        </button>
        <button
          onClick={onSubmitScore}
          disabled={isSubmitting || hasSubmittedScore}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 text-lg disabled:bg-orange-700 disabled:cursor-not-allowed"
        >
          {getSubmitButtonText()}
        </button>
      </div>
    </div>
  );
};

export default GameOver;