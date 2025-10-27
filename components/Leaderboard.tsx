import React from 'react';
import { useAccount } from 'wagmi';
import { onChainSeasonConfigs } from '../constants/contract';
import { Season } from './SeasonSelector';
import type { LeaderboardEntry } from '../types';
import { useLeaderboard, isOnChainSeason } from '../hooks/useLeaderboard';

interface LeaderboardProps {
  isReady: boolean;
  activeSeason: Season;
}

// A reusable component to render the list of players
const LeaderboardList: React.FC<{ data: LeaderboardEntry[] }> = ({ data }) => {
  const currentUserEntry = data.find(entry => entry.isCurrentUser);
  const otherEntries = data
    .filter(entry => !entry.isCurrentUser)
    .sort((a, b) => a.rank - b.rank);

  const finalLeaderboard = currentUserEntry ? [currentUserEntry, ...otherEntries] : otherEntries;

  return (
    <div className="flex flex-col gap-2">
      {finalLeaderboard.map(({ rank, displayName, fid, score, isCurrentUser }) => (
        <div
          key={`${rank}-${fid}-${displayName}`}
          className={`
            flex items-center gap-2 p-3 rounded-md text-lg
            transition-colors duration-200
            ${isCurrentUser ? 'bg-orange-500/20 border border-orange-500' : 'bg-slate-700'}
          `}
        >
          <span className="w-16 text-left font-bold text-orange-400">#{rank}</span>
          <span className="flex-1 text-center text-white truncate" title={displayName}>
            {displayName}
          </span>
          <span className="w-16 text-right font-bold text-white">{score}</span>
        </div>
      ))}
    </div>
  );
};

// A reusable skeleton loader
const SkeletonLoader: React.FC = () => (
  <div className="flex flex-col gap-2 animate-pulse" role="status">
    {Array.from({ length: 15 }).map((_, i) => (
      <div key={i} className="p-3 rounded-md bg-slate-700 h-[52px]"></div>
    ))}
  </div>
);


const Leaderboard: React.FC<LeaderboardProps> = ({ isReady, activeSeason }) => {
  const { data, isLoading, error } = useLeaderboard(isReady, activeSeason);

  // --- WAGMI Hooks for On-Chain UX (network checks) ---
  const { isConnected, chainId } = useAccount();
  const activeSeasonConfig = isOnChainSeason(activeSeason) ? onChainSeasonConfigs[activeSeason] : null;

  const renderContent = () => {
    // --- UX for On-Chain Seasons ---
    if (activeSeasonConfig) {
      if (!isConnected) {
        return <div className="text-center text-slate-400 p-8">Connect your wallet to see your rank.</div>;
      }
      if (chainId !== activeSeasonConfig.chainId) {
        return (
          <div className="text-center text-yellow-300 p-8" role="alert">
            Please switch to the {activeSeasonConfig.chainName} network.
          </div>
        );
      }
    }
    
    // --- General Data Display Logic ---
    if (isLoading) {
      return <SkeletonLoader />;
    }
    if (error) {
      return <div className="text-center text-red-400 p-8" role="alert">{error}</div>;
    }
    if (data.length === 0) {
      return <div className="text-center text-slate-400 p-8">No scores yet. Be the first!</div>;
    }
    return <LeaderboardList data={data} />;
  };

  return (
    <div className="bg-slate-600 p-4 rounded-lg w-full animate-fade-in">
      <div className="text-center text-white font-semibold mb-4 text-lg">
        Pool Statistics
      </div>
      <div className="flex items-center gap-2 px-3 text-sm text-slate-400 font-bold mb-2">
        <span className="w-16 text-left">Rank</span>
        <span className="flex-1 text-center">Miner</span>
        <span className="w-16 text-right">Hashrate</span>
      </div>
      {renderContent()}
    </div>
  );
};

export default Leaderboard;