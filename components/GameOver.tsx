import React from 'react';

interface GameOverProps {
  onRestart: () => void;
  score: number;
  onSubmitScore: () => void;
  isSubmitting: boolean;
  hasSubmittedScore: boolean;
  isNewBestScore: boolean;
  userRank: number | null;
}

const GameOver: React.FC<GameOverProps> = ({ onRestart, score, onSubmitScore, isSubmitting, hasSubmittedScore, isNewBestScore, userRank }) => {
  
  const handleShare = () => {
    let text = `I just set a new high score of ${score} in the 2048 Mini App! Can you beat it?`;
    if (userRank) {
      text = `I just reached rank #${userRank} with a score of ${score} in the 2048 Mini App! Can you beat it?`;
    }
    const encodedText = encodeURIComponent(text);
    const appUrl = 'https://2048-base.vercel.app/'; // URL of your mini app
    const encodedAppUrl = encodeURIComponent(appUrl);
    
    // Using warpcast.com is generally recommended for composing casts
    const shareUrl = `https://warpcast.com/~/compose?text=${encodedText}&embeds[]=${encodedAppUrl}`;
    
    window.open(shareUrl, '_blank');
  };

  return (
    <div className="absolute inset-0 bg-slate-800 bg-opacity-70 flex flex-col justify-center items-center rounded-lg animate-fade-in z-30">
      <h2 className="text-5xl font-extrabold text-white mb-2">Game Over!</h2>
      {isNewBestScore && <p className="text-xl text-orange-400 font-bold mb-1">New Best Score!</p>}
      <p className="text-lg text-slate-300 mb-6">Your score: {score}</p>
      <div className="flex gap-4">
        <button
          onClick={onRestart}
          className="bg-slate-500 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 text-lg"
        >
          Try Again
        </button>
        {isNewBestScore && (
          hasSubmittedScore ? (
             <button
              onClick={handleShare}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 text-lg"
            >
              Share on Farcaster
            </button>
          ) : (
            <button
              onClick={onSubmitScore}
              disabled={isSubmitting}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 text-lg disabled:bg-orange-700 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Score'}
            </button>
          )
        )}
      </div>
    </div>
  );
};

export default GameOver;