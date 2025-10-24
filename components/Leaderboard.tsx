import React, { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useAccount } from 'wagmi'; // Keep for network checks
import { onChainSeasonConfigs } from '../constants/contract';
import { Season } from './SeasonSelector';

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  fid: number | null; // FID can be null for on-chain addresses without Farcaster accounts
  score: number;
  isCurrentUser?: boolean;
}

interface LeaderboardProps {
  isReady: boolean;
  activeSeason: Season;
  prize?: number;
  prizeUnit?: string;
}

// Type guard to check if a season is an on-chain season
const isOnChainSeason = (season: Season): season is keyof typeof onChainSeasonConfigs => {
  return onChainSeasonConfigs.hasOwnProperty(season);
};

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


const Leaderboard: React.FC<LeaderboardProps> = ({ isReady, activeSeason, prize, prizeUnit }) => {
  // --- State for both Leaderboard types ---
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- WAGMI Hooks for On-Chain UX (network checks) ---
  const { isConnected, chainId } = useAccount();
  const activeSeasonConfig = isOnChainSeason(activeSeason) ? onChainSeasonConfigs[activeSeason] : null;

  // --- Effect for fetching ALL Leaderboard Data ---
  useEffect(() => {
    if (!isReady) return;

    const fetchLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      setData([]);

      try {
        let url: string;
        if (isOnChainSeason(activeSeason)) {
          url = `/api/onchain-leaderboard?season=${activeSeason}`;
        } else {
          url = '/api/leaderboard';
        }
        
        const authResult = await sdk.quickAuth.getToken();
        const headers: HeadersInit = {};
        if ('token' in authResult) {
          headers['Authorization'] = `Bearer ${authResult.token}`;
        }
        
        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`Network response was not ok (${response.status})`);
        }
        const responseData: LeaderboardEntry[] = await response.json();
        setData(responseData);
      } catch (err: any) {
        console.error(`Failed to fetch leaderboard for season '${activeSeason}':`, err);
        setError('Could not load leaderboard. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [isReady, activeSeason]);

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
      {prize && prizeUnit && (
        <div className="text-center text-orange-400 font-semibold mb-4 text-lg">
          Season Prize Pool: {prize} {prizeUnit}
        </div>
      )}
      <div className="flex items-center gap-2 px-3 text-sm text-slate-400 font-bold mb-2">
        <span className="w-16 text-left">Rank</span>
        <span className="flex-1 text-center">Player</span>
        <span className="w-16 text-right">Score</span>
      </div>
      {renderContent()}
    </div>
  );
};

export default Leaderboard;