import React, { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useReadContract, useAccount } from 'wagmi';
import { onChainSeasonConfigs } from '../constants/contract';
import { Season } from './SeasonSelector';

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  fid: number;
  score: number;
  isCurrentUser?: boolean;
}

interface LeaderboardProps {
  isReady: boolean;
  activeSeason: Season;
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


const Leaderboard: React.FC<LeaderboardProps> = ({ isReady, activeSeason }) => {
  // --- State for Farcaster (off-chain) Leaderboard ---
  const [farcasterData, setFarcasterData] = useState<LeaderboardEntry[]>([]);
  const [isFarcasterLoading, setIsFarcasterLoading] = useState(true);
  const [farcasterError, setFarcasterError] = useState<string | null>(null);

  // --- WAGMI Hooks for On-Chain Leaderboard ---
  const { address: userAddress, chainId, isConnected } = useAccount();
  const activeSeasonConfig = isOnChainSeason(activeSeason) ? onChainSeasonConfigs[activeSeason] : null;

  const isQueryEnabled = isReady && !!activeSeasonConfig && isConnected && chainId === activeSeasonConfig.chainId;

  const {
    data: onChainLeaderboard,
    error: onChainError,
    isLoading: isOnChainLoading,
  } = useReadContract({
    address: activeSeasonConfig?.address,
    abi: activeSeasonConfig?.abi,
    functionName: 'getLeaderboard',
    query: {
      enabled: isQueryEnabled,
    },
  });

  // --- Effect for fetching Farcaster Leaderboard Data ---
  useEffect(() => {
    if (!isReady || activeSeason !== 'farcaster') {
      return;
    }

    const fetchFarcasterLeaderboard = async () => {
      setIsFarcasterLoading(true);
      setFarcasterError(null);
      setFarcasterData([]);

      try {
        const authResult = await sdk.quickAuth.getToken();
        const headers: HeadersInit = {};
        if ('token' in authResult) {
          headers['Authorization'] = `Bearer ${authResult.token}`;
        }
        const response = await fetch('/api/leaderboard', { headers });
        if (!response.ok) {
          throw new Error(`Network response was not ok (${response.status})`);
        }
        const data: LeaderboardEntry[] = await response.json();
        setFarcasterData(data);
      } catch (err: any) {
        console.error('Failed to fetch Farcaster leaderboard:', err);
        setFarcasterError('Could not load leaderboard. Please try again later.');
      } finally {
        setIsFarcasterLoading(false);
      }
    };

    fetchFarcasterLeaderboard();
  }, [isReady, activeSeason]);


  const renderContent = () => {
    // --- On-Chain Season Logic ---
    if (activeSeasonConfig) {
      if (!isConnected) {
        return <div className="text-center text-slate-400 p-8">Waiting for wallet connection...</div>;
      }
      if (chainId !== activeSeasonConfig.chainId) {
        return (
          <div className="text-center text-yellow-300 p-8" role="alert">
            Please switch to the {activeSeasonConfig.chainName} network to view the leaderboard.
          </div>
        );
      }
      if (isOnChainLoading) {
        return <SkeletonLoader />;
      }
      if (onChainError) {
        return <div className="text-center text-red-400 p-8" role="alert">Could not load on-chain leaderboard.</div>;
      }
      if (!onChainLeaderboard || !Array.isArray(onChainLeaderboard) || onChainLeaderboard.length === 0) {
        return <div className="text-center text-slate-400 p-8">No scores yet. Be the first!</div>;
      }
      
      const formattedData = (onChainLeaderboard as { player: string; score: bigint }[])
        .map((entry, index) => ({
          rank: index + 1,
          displayName: `${entry.player.slice(0, 6)}...${entry.player.slice(-4)}`,
          fid: index, // Not a real FID, just a unique key
          score: Number(entry.score),
          isCurrentUser: !!userAddress && userAddress.toLowerCase() === entry.player.toLowerCase(),
        }))
        .sort((a, b) => b.score - a.score)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      return <LeaderboardList data={formattedData} />;
    }

    // --- Farcaster Season Logic ---
    if (activeSeason === 'farcaster') {
      if (isFarcasterLoading) {
        return <SkeletonLoader />;
      }
      if (farcasterError) {
        return <div className="text-center text-red-400 p-8" role="alert">{farcasterError}</div>;
      }
      if (farcasterData.length === 0) {
        return <div className="text-center text-slate-400 p-8">No scores yet. Be the first!</div>;
      }
      return <LeaderboardList data={farcasterData} />;
    }

    return null; // Should not be reached
  };

  return (
    <div className="bg-slate-600 p-4 rounded-lg w-full animate-fade-in">
      <h2 className="text-2xl font-bold text-center mb-4">Leaderboard</h2>
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
