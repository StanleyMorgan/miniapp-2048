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

const Leaderboard: React.FC<LeaderboardProps> = ({ isReady }) => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      const BACKEND_URL = '/api/leaderboard';

      try {
        let authToken: string | undefined;
        try {
          const authResult = await sdk.quickAuth.getToken();
          if ('token' in authResult) {
            authToken = authResult.token;
          } else {
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

    if (isReady) {
      fetchLeaderboard();
    }
  }, [isReady]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-2 animate-pulse">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="p-3 rounded-md bg-slate-700 h-[52px]"></div>
          ))}
        </div>
      );
    }

    if (error) {
      return <div className="text-center text-red-400 p-8" role="alert">{error}</div>;
    }

    if (leaderboardData.length === 0) {
        return <div className="text-center text-slate-400 p-8">No scores yet. Be the first!</div>;
    }
    
    const sortedData = [...leaderboardData].sort((a, b) => a.rank - b.rank);

    return (
      <div className="flex flex-col gap-2">
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
    <div className="bg-slate-600 p-4 rounded-lg w-full animate-fade-in flex flex-col h-full">
      
      {/* --- STATIC HEADER --- */}
      <div className="flex-shrink-0">
        <h2 className="text-2xl font-bold text-center mb-4">Leaderboard</h2>
        <div className="grid grid-cols-3 gap-2 px-3 text-sm text-slate-400 font-bold mb-2">
          <span>Rank</span>
          <span className="text-center">Player</span>
          <span className="text-right">Score</span>
        </div>
      </div>

      {/* --- SCROLLABLE CONTENT --- */}
      <div className="flex-grow overflow-y-auto min-h-0">
        {renderContent()}
      </div>
    </div>
  );
};

export default Leaderboard;