import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { Season } from '../components/SeasonSelector';
import { onChainSeasonConfigs } from '../constants/contract';
import type { LeaderboardEntry } from '../types';

// Type guard to check if a season is an on-chain season
export const isOnChainSeason = (season: Season): season is keyof typeof onChainSeasonConfigs => {
  return onChainSeasonConfigs.hasOwnProperty(season);
};

export const useLeaderboard = (isReady: boolean, activeSeason: Season) => {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return { data, isLoading, error };
};
