import React from 'react';
import { Season, seasons } from './SeasonSelector';

interface GameOverProps {
  score: number;
  onSubmitScore: () => void;
  isSubmitting: boolean;
  hasSubmittedScore: boolean;
  isNewBestScore: boolean;
  userRank: number | null;
  submissionStatus: string;
  activeSeason: Season;
}

const GameOver: React.FC<GameOverProps> = ({ score, onSubmitScore, isSubmitting, hasSubmittedScore, isNewBestScore, userRank, submissionStatus, activeSeason }) => {
  
  const handleShare = () => {
    let text: string;
    const seasonInfo = seasons.find(s => s.id === activeSeason);
    const seasonShareName = seasonInfo?.shareName || seasonInfo?.name;

    if (activeSeason !== 'farcaster' && seasonShareName) {
      // On-chain season message
      if (userRank) {
        text = `I just reached rank #${userRank} with a score of ${score} in the 2048 Mining App during ${seasonShareName}! Can you beat it?`;
      } else {
        text = `I just set a new high score of ${score} in the 2048 Mining App during ${seasonShareName}! Can you beat it?`;
      }
    } else {
      // Default Farcaster season message
      if (userRank) {
        text = `I just reached rank #${userRank} with a score of ${score} in the 2048 Mining App! Can you beat it?`;
      } else {
        text = `I just set a new high score of ${score} in the 2048 Mining App! Can you beat it?`;
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
    return 'Confirm Blocks';
  }
  
  // FIX: Cast import.meta to any to access Vite environment variables.
  const followUrl = ((import.meta as any).env.VITE_FOLLOW_URL as string) || '#';

  return (
    <div className="absolute inset-0 bg-slate-800 bg-opacity-70 flex flex-col justify-center items-center rounded-lg animate-fade-in z-30 p-4">
      <h2 className="text-5xl font-extrabold text-white mb-2 text-center">Overload!</h2>
      {isNewBestScore && <p className="text-xl text-orange-400 font-bold mb-1">New Best Score!</p>}
      <p className="text-lg text-slate-300 mb-6">Your score: {score}</p>
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-4 items-start h-[66px]">
          {/* Show "Follow" instead of the old gray "Try Again" button */}
          {(!isNewBestScore || hasSubmittedScore) && (
            <div className="flex flex-col items-center">
              <a
                href={followUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-5 rounded-lg transition-colors duration-200 text-base whitespace-nowrap"
              >
                Follow
              </a>
              <span className="text-xs text-slate-400 mt-1">latest news</span>
            </div>
          )}
          
          {/* Show "Save Score" or "Share" flow only when it's a new best score. */}
          {isNewBestScore && (
            hasSubmittedScore ? (
              <div className="flex flex-col items-center">
                <button
                  onClick={handleShare}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-5 rounded-lg transition-colors duration-200 text-base whitespace-nowrap"
                >
                  Share
                </button>
                <span className="text-xs text-slate-400 mt-1">boost your rewards</span>
              </div>
            ) : (
              <button
                onClick={onSubmitScore}
                disabled={isSubmitting}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-5 rounded-lg transition-colors duration-200 text-base whitespace-nowrap disabled:bg-orange-700 disabled:cursor-not-allowed self-center"
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