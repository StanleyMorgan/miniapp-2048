import React, { useState, useEffect, useRef } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useReadContract, useAccount } from 'wagmi';
import {
    onChainSeasonConfigs
} from '../constants/contract';
import { Season } from './SeasonSelector';

interface LeaderboardProps {
  isReady: boolean;
  activeSeason: Season;
}

type LeaderboardEntry = {
  rank: number;
  displayName: string; 
  fid: number;
  score: number;
  isCurrentUser?: boolean;
};

// Type guard to check if a season is an on-chain season
const isOnChainSeason = (season: Season): season is keyof typeof onChainSeasonConfigs => {
  return onChainSeasonConfigs.hasOwnProperty(season);
};


const Leaderboard: React.FC<LeaderboardProps> = ({ isReady, activeSeason }) => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { address: userAddress, chainId, isConnected } = useAccount();
  const [initialLoad, setInitialLoad] = useState(true);

  // This effect runs only once on component mount to set the initial load flag to false after a delay.
  // This is a workaround for a race condition on the Farcaster desktop client where the wallet/network
  // info might not be immediately available on a full page reload.
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoad(false);
    }, 500); // Wait 500ms before attempting to check network status
    return () => clearTimeout(timer);
  }, []);

  const activeSeasonConfig = isOnChainSeason(activeSeason) ? onChainSeasonConfigs[activeSeason] : null;

  const isQueryEnabled = isReady && !!activeSeasonConfig && isConnected && chainId === activeSeasonConfig.chainId && !initialLoad;

  // New detailed log for query state, runs on every render for on-chain seasons
  useEffect(() => {
      if (isOnChainSeason(activeSeason)) {
          console.log(`[DEBUG] Leaderboard Query State for season '${activeSeason}':`, {
              isSdkReady: isReady,
              hasActiveSeasonConfig: !!activeSeasonConfig,
              isWalletConnected: isConnected,
              currentChainId: chainId,
              expectedChainId: activeSeasonConfig?.chainId,
              isCorrectChain: chainId === activeSeasonConfig?.chainId,
              initialLoadComplete: !initialLoad,
              isQueryEnabled: isQueryEnabled,
          });
      }
  });


  // FIX: `onSuccess` and `onError` callbacks are deprecated in wagmi/TanStack Query v5.
  // Replaced with `useEffect` to handle side-effects like logging.
  const { 
    data: onChainLeaderboard, 
    error: onChainError, 
    isLoading: isOnChainLoading 
  } = useReadContract({
    address: activeSeasonConfig?.address,
    abi: activeSeasonConfig?.abi,
    functionName: 'getLeaderboard',
    query: { 
      // Only enable the query if the user is connected to the correct chain for the selected season.
      // We also wait for the initialLoad delay to pass to avoid premature checks.
      enabled: isQueryEnabled,
    }
  });

  // Log on-chain leaderboard fetch status
  useEffect(() => {
    // FIX: The `useReadContract` hook returns data of type `unknown`. We must verify it's an array before accessing properties like `length`.
    if (onChainLeaderboard && Array.isArray(onChainLeaderboard)) {
      console.log(`[ONCHAIN] Successfully fetched leaderboard for ${activeSeason}. Found ${onChainLeaderboard.length} entries.`);
    }
    if (onChainError) {
      console.error(`[ONCHAIN] Error fetching leaderboard for ${activeSeason}:`, onChainError);
    }
  }, [onChainLeaderboard, onChainError, activeSeason]);

  // Effect for fetching the Farcaster leaderboard
  useEffect(() => {
    const fetchFarcasterLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      setLeaderboardData([]); // Clear previous data
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
    
    // For on-chain seasons, we depend on the other useEffect. This one handles Farcaster.
    if (isReady && activeSeason === 'farcaster') {
        fetchFarcasterLeaderboard();
    }
  }, [isReady, activeSeason]);

  // Effect for processing on-chain leaderboard data from the wagmi hook
  useEffect(() => {
    // This logic handles the state changes for on-chain seasons specifically.
    if (isReady && activeSeasonConfig) {
      setIsLoading(isOnChainLoading);
      setError(onChainError ? 'Could not load on-chain leaderboard.' : null);

      if (Array.isArray(onChainLeaderboard)) {
        const formattedData = (onChainLeaderboard as { player: string; score: bigint }[])
          .map((entry, index) => ({
            rank: index + 1, // Placeholder rank
            displayName: `${entry.player.slice(0, 6)}...${entry.player.slice(-4)}`,
            fid: index + 1, // Not a real FID, just a unique key for React
            score: Number(entry.score),
            isCurrentUser: !!userAddress && userAddress.toLowerCase() === entry.player.toLowerCase(),
          }))
          .sort((a, b) => b.score - a.score) // Sort by score descending
          .map((entry, index) => ({ ...entry, rank: index + 1 })); // Re-assign rank after sorting
        
        setLeaderboardData(formattedData);
      } else {
        // Clear data when switching to an on-chain season before data is loaded or if there's an error.
        setLeaderboardData([]);
      }
    }
  }, [isReady, activeSeasonConfig, onChainLeaderboard, userAddress, isOnChainLoading, onChainError]);


  const renderContent = () => {
    const isSeasonOnChain = !!activeSeasonConfig;
    
    // If it's an on-chain season and the user is connected to the wrong network, show a helpful message.
    // The `initialLoad` check prevents showing this message prematurely on desktop client full reloads.
    if (isSeasonOnChain && isConnected && chainId !== activeSeasonConfig.chainId && !initialLoad) {
        return (
            <div className="text-center text-yellow-300 p-8" role="alert">
                Please switch to the {activeSeasonConfig.chainName} network to view the leaderboard.
            </div>
        );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col gap-2 animate-pulse" role="status">
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
        // Provide a more specific message if the season is on-chain but the contract call is not yet enabled/loading
        if (isSeasonOnChain) {
            return <div className="text-center text-slate-400 p-8">Connecting to on-chain leaderboard...</div>
        }
        return <div className="text-center text-slate-400 p-8">No scores yet. Be the first!</div>;
    }
    
    const currentUserEntry = leaderboardData.find(entry => entry.isCurrentUser);
    const otherEntries = leaderboardData
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