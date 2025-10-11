import React, { useState, useEffect } from 'react';

interface LeaderboardProps {
  bestScore: number;
}

type LeaderboardEntry = {
  rank: number;
  // In a real app, your backend would resolve the FID to a username and profile picture.
  username: string; 
  fid?: number; // Farcaster ID
  score: number;
  isCurrentUser?: boolean;
};

const Leaderboard: React.FC<LeaderboardProps> = ({ bestScore }) => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      // IMPORTANT: Replace this with your actual backend endpoint URL.
      const BACKEND_URL = '/api/leaderboard'; 

      try {
        const response = await fetch(BACKEND_URL);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data: LeaderboardEntry[] = await response.json();
        setLeaderboardData(data);
      } catch (err) {
        console.warn('Failed to fetch leaderboard from backend. Using mock data as a fallback.', err);
        setError('Could not load leaderboard.');

        // MOCK DATA: Used as a fallback since the backend doesn't exist yet.
        // This shows how the component will look with real data.
        const mockData: LeaderboardEntry[] = [
          { rank: 1, username: 'You', score: bestScore, isCurrentUser: true },
          { rank: 2, username: 'vitalik.eth', fid: 2, score: 8192 },
          { rank: 3, username: 'dwr.eth', fid: 3, score: 4096 },
          { rank: 4, username: 'v', fid: 1, score: 2048 },
          { rank: 5, username: 'player.eth', fid: 123, score: 1024 },
        ];
        
        // Ensure the user's score is correctly placed and the list is sorted.
        const sortedData = mockData
          .sort((a, b) => b.score - a.score)
          .map((item, index) => ({ ...item, rank: index + 1 }));

        setLeaderboardData(sortedData);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [bestScore]); // Re-fetch if bestScore changes to update the user's score in the mock data.

  const renderContent = () => {
    if (isLoading) {
      return <div className="text-center text-slate-400 p-8">Loading...</div>;
    }

    if (error && leaderboardData.length === 0) {
      return <div className="text-center text-red-400 p-8">{error}</div>;
    }
    
    return (
      <div className="flex flex-col gap-2">
        {/* Header Row */}
        <div className="grid grid-cols-3 gap-2 text-slate-400 font-semibold uppercase text-sm px-3">
          <span>Rank</span>
          <span className="text-center">Player</span>
          <span className="text-right">Score</span>
        </div>
        
        {/* Score Rows */}
        {leaderboardData.map(({ rank, username, score, isCurrentUser }) => (
          <div 
            key={rank} 
            className={`
              grid grid-cols-3 gap-2 p-3 rounded-md items-center text-lg
              ${isCurrentUser ? 'bg-orange-500/20 border border-orange-500' : 'bg-slate-700'}
            `}
          >
            <span className="font-bold text-orange-400">#{rank}</span>
            <span className="text-center text-white truncate">{username}</span>
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