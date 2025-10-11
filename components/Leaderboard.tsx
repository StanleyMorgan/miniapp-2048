import React from 'react';

interface LeaderboardProps {
  bestScore: number;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ bestScore }) => {
  return (
    <div className="bg-slate-600 p-4 rounded-lg w-full animate-fade-in">
      <h2 className="text-2xl font-bold text-center text-white mb-4">Top Score</h2>
      <div className="flex flex-col gap-2">
        {/* Header Row */}
        <div className="grid grid-cols-3 gap-2 text-slate-400 font-semibold uppercase text-sm px-2">
          <span>Rank</span>
          <span className="text-center">Player</span>
          <span className="text-right">Score</span>
        </div>
        
        {/* Score Row */}
        <div className="grid grid-cols-3 gap-2 bg-slate-700 p-3 rounded-md items-center text-lg">
          <span className="font-bold text-orange-400">#1</span>
          <span className="text-center text-white">You</span>
          <span className="text-right font-bold text-white">{bestScore}</span>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
