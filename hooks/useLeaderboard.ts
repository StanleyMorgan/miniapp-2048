
import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import type { SeasonInfo, LeaderboardEntry } from '../types';

export const useLeaderboard = (isReady: boolean, activeSeasonId: string | null) => {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !activeSeasonId) return;

    const fetchLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      setData([]);

      try {
        // We determine the endpoint based on the season ID format.
        // This is a simplification. A better way is to pass the full SeasonInfo object.
        // For now, we assume non-'farcaster' seasons are on-chain.
        const isOnChain = activeSeasonId !== 'farcaster';
        let url: string;
        
        if (isOnChain) {
          url = `/api/onchain-leaderboard?season=${activeSeasonId}`;
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
        console.error(`Failed to fetch leaderboard for season '${activeSeasonId}':`, err);
        setError('Could not load pool statistics. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [isReady, activeSeasonId]);

  return { data, isLoading, error };
};
