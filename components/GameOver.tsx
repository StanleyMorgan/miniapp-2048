import React from 'react';
import { Season, seasons } from './SeasonSelector';

interface GameOverProps {
  onRestart: () => void;
  score: number;
  onSubmitScore: () => void;
  isSubmitting: boolean;
  hasSubmittedScore: boolean;
  isNewBestScore: boolean;
  userRank: number | null;
  submissionStatus: string;
  activeSeason: Season;
}

const GameOver: React.FC<GameOverProps> = ({ onRestart, score, onSubmitScore, isSubmitting, hasSubmittedScore, isNewBestScore, userRank, submissionStatus, activeSeason }) => {
  
  const handleShare = () => {
    let text: string;
    const seasonName = seasons.find(s => s.id === activeSeason)?.name;

    if (activeSeason !== 'farcaster' && seasonName) {
      // On-chain season message
      if (userRank) {
        text = `I just reached rank #${userRank} with a score of ${score} in the 2048 Mini App during ${seasonName}! Can you beat it?`;
      } else {
        text = `I just set a new high score of ${score} in the 2048 Mini App during ${seasonName}! Can you beat it?`;
      }
    } else {
      // Default Farcaster season message
      if (userRank) {
        text = `I just reached rank #${userRank} with a score of ${score} in the 2048 Mini App! Can you beat it?`;
      } else {
        text = `I just set a new high score of ${score} in the 2048 Mini App! Can you beat it?`;
      }
    }

    const encodedText = encodeURIComponent(text);
    const appUrl = 'https://2048-base.vercel.app/'; // URL of your mini app
    const encodedAppUrl = encodeURIComponent(appUrl);
    
    // Using warpcast.com is generally recommended for composing casts
    const shareUrl = `https://warpcast.com/~/compose?text=${encodedText}&embeds[]=${encodedAppUrl}`;
    
    window.open(shareUrl, '_blank');
  };

  const getButtonText = () => {
    if (isSubmitting) {
      return submissionStatus || 'Saving...';
    }
    return 'Save Score';
  }

  return (
    <div className="absolute inset-0 bg-slate-800 bg-opacity-70 flex flex-col justify-center items-center rounded-lg animate-fade-in z-30 p-4">
      <h2 className="text-5xl font-extrabold text-white mb-2 text-center">Game Over!</h2>
      {isNewBestScore && <p className="text-xl text-orange-400 font-bold mb-1">New Best Score!</p>}
      <p className="text-lg text-slate-300 mb-6">Your score: {score}</p>
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-4">
          {/* Show "Try Again" if it's not a new best score, OR if the new score has already been submitted. */}
          {(!isNewBestScore || hasSubmittedScore) && (
            <button
              onClick={onRestart}
              className="bg-slate-500 hover:bg-slate-600 text-white font-bold py-3 px-5 rounded-lg transition-colors duration-200 text-base whitespace-nowrap"
            >
              Try Again
            </button>
          )}
          
          {/* Show "Save Score" or "Share" flow only when it's a new best score. */}
          {isNewBestScore && (
            hasSubmittedScore ? (
              <button
                onClick={handleShare}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-5 rounded-lg transition-colors duration-200 text-base whitespace-nowrap"
              >
                Share
              </button>
            ) : (
              <button
                onClick={onSubmitScore}
                disabled={isSubmitting}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-5 rounded-lg transition-colors duration-200 text-base whitespace-nowrap disabled:bg-orange-700 disabled:cursor-not-allowed"
              >
                {getButtonText()}
              </button>
            )
          )}
        </div>
        {isSubmitting && submissionStatus && (
          <p className="text-sm text-slate-300 mt-2 text-center">{submissionStatus}</p>
        )}
      </div>
    </div>
  );
};

export default GameOver;