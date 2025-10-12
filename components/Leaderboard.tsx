import React, { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

interface LeaderboardProps {
  isReady: boolean;
}

type LeaderboardEntry = {
  rank: number;
  displayName: string; 
  fid: number;
  score: number;
  isCurrentUser?: boolean;
};

// A simple skeleton loader component for a better UX
const LeaderboardSkeleton: React.FC = () => (
  <div className="flex flex-col gap-2 animate-pulse">
    <div className="grid grid-cols-3 gap-2 px-3">
      <div className="h-4 bg-slate-700 rounded w-1/4"></div>
      <div className="h-4 bg-slate-700 rounded w-1/3 mx-auto"></div>
      <div className="h-4 bg-slate-700 rounded w-1/4 ml-auto"></div>
    </div>
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="p-3 rounded-md bg-slate-700 h-[52px]"></div>
    ))}
  </div>
);

const Leaderboard: React.FC<LeaderboardProps> = ({ isReady }) => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      const BACKEND_URL = '/api/leaderboard'; // Use relative path for Vercel deployment

      try {
        let authToken: string | undefined;
        try {
          // Gracefully attempt to get the auth token. This may fail if not in a Farcaster client.
          // FIX: The `getToken` method returns an object, not a string directly. We need to check for the `token` property.
          const authResult = await sdk.quickAuth.getToken();
          if ('token' in authResult) {
            authToken = authResult.token;
          } else {
            // FIX: The type of authResult in the else branch is inferred as 'never' by TypeScript,
            // likely due to an incomplete type definition for `getToken()`. Logging the whole object
            // is safer, fixes the compilation error, and provides more informative debug output.
            console.warn("Could not get Farcaster auth token:", authResult);
          }
        } catch (sdkError) {
          console.warn("Could not get Farcaster auth token, proceeding without it.", sdkError);
        }

        const headers: HeadersInit = {};
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(BACKEND_URL, { headers });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({ message: `Network response was not ok (${response.status})` }));
          throw new Error(errorBody.message);
        }
        
        const data: LeaderboardEntry[] = await response.json();
        setLeaderboardData(data);
      } catch (err: any) {
        console.error('Failed to fetch leaderboard:', err);
        setError('Could not load leaderboard. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    // Only attempt to fetch data once the SDK has signaled that it's ready.
    if (isReady) {
      fetchLeaderboard();
    }
  }, [isReady]);

  const renderContent = () => {
    if (isLoading) {
      return <LeaderboardSkeleton />;
    }

    if (error) {
      return <div className="text-center text-red-400 p-8" role="alert">{error}</div>;
    }

    if (leaderboardData.length === 0) {
        return <div className="text-center text-slate-400 p-8">No scores yet. Be the first!</div>;
    }
    
    // Sort data to ensure user's score is in the right place if added at the end
    const sortedData = [...leaderboardData].sort((a, b) => a.rank - b.rank);

    return (
      <div className="flex flex-col gap-2">
        {/* Header Row */}
        <div className="grid grid-cols-3 gap-2 text-slate-400 font-semibold uppercase text-sm px-3">
          <span>Rank</span>
          <span className="text-center">Player</span>
          <span className="text-right">Score</span>
        </div>
        
        {/* Score Rows */}
        {sortedData.map(({ rank, displayName, fid, score, isCurrentUser }) => (
          <div 
            key={`${rank}-${fid}`} 
            className={`
              grid grid-cols-3 gap-2 p-3 rounded-md items-center text-lg
              transition-colors duration-200
              ${isCurrentUser ? 'bg-orange-500/20 border border-orange-500' : 'bg-slate-700'}
            `}
          >
            <span className="font-bold text-orange-400">#{rank}</span>
            <span className="text-center text-white truncate" title={displayName}>
              {isCurrentUser ? 'You' : displayName}
            </span>
            <span className="text-right font-bold text-white">{score}</span>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="bg-slate-600 p-4 rounded-lg w-full animate-fade-in">
      <h2 className="text-2xl font-bold text-center text-white mb-4">Leaderboard</h2>
      {renderContent()}
    </div>
  );
};

export default Leaderboard;