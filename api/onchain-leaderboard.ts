
import { createPublicClient, http, defineChain, type Chain } from 'viem';
import { LEADERBOARD_ABI } from '../constants/contract.js';
import { createClient, Errors } from '@farcaster/quick-auth';
import type { SeasonInfo } from '../types';

export const dynamic = 'force-dynamic';

const monad = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MONAD', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://monad-testnet.drpc.org'] },
  },
});

const base = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.base.org'] },
  },
});

const celo = defineChain({
  id: 42220,
  name: 'Celo',
  nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://forno.celo.org'] },
  },
});

const chains: { [key: number]: Chain } = {
  [monad.id]: monad,
  [base.id]: base,
  [celo.id]: celo,
};

type LeaderboardEntry = {
  rank: number;
  displayName: string;
  fid: number | null;
  score: number;
  isCurrentUser?: boolean;
};

const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const seasonId = searchParams.get('season');

  console.log(`[onchain-leaderboard] Received request for season: ${seasonId}`);

  if (!seasonId) {
    return new Response(JSON.stringify({ message: 'Missing season parameter' }), { status: 400 });
  }
  
  // Fetch season config from our new seasons API
  // Construct the absolute URL for the seasons API endpoint
  const seasonsApiUrl = new URL('/api/seasons', url.origin);
  const seasonsResponse = await fetch(seasonsApiUrl.toString());
  if (!seasonsResponse.ok) {
    throw new Error('Failed to fetch seasons configuration');
  }
  const allSeasons: SeasonInfo[] = await seasonsResponse.json();
  const seasonConfig = allSeasons.find(s => s.id === seasonId);


  if (!seasonConfig || !seasonConfig.contractAddress || !seasonConfig.chainId) {
    return new Response(JSON.stringify({ message: 'Invalid or non-onchain season specified' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  console.log('[onchain-leaderboard] Found season config:', { address: seasonConfig.contractAddress, chainId: seasonConfig.chainId });

  const quickAuthClient = createClient();
  const authorization = request.headers.get('Authorization');
  let currentUserAddress: string | null = null;

  if (authorization && authorization.startsWith('Bearer ')) {
    const token = authorization.split(' ')[1];
    const host = request.headers.get('Host');
    if (!host) {
      return new Response(JSON.stringify({ message: 'Bad Request: Missing Host header' }), { status: 400 });
    }
    const domain = host;
    
    try {
      const payload = await quickAuthClient.verifyJwt({ token, domain });
      const fid = Number(payload.sub);

      const addressResponse = await fetch(`https://api.farcaster.xyz/fc/primary-address?fid=${fid}&protocol=ethereum`);
      if (addressResponse.ok) {
        const addressData = await addressResponse.json();
        if (addressData?.result?.address?.address) {
          currentUserAddress = addressData.result.address.address.toLowerCase();
        }
      }
      console.log(`[onchain-leaderboard] Authenticated user address: ${currentUserAddress}`);
    } catch (e) {
      if (e instanceof Errors.InvalidTokenError) {
        console.warn(`[onchain-leaderboard] Invalid token for domain "${domain}".`);
      } else {
        console.error(`[onchain-leaderboard] Error verifying JWT for domain "${domain}":`, e);
      }
    }
  }

  try {
    const chain = chains[seasonConfig.chainId];
    if (!chain) {
      throw new Error(`Chain configuration not found for chainId: ${seasonConfig.chainId}`);
    }
    console.log(`[onchain-leaderboard] Mapped to chain: ${chain.name}`);

    const client = createPublicClient({ chain: chain, transport: http() });
    console.log('[onchain-leaderboard] Public VIEM client created.');
    console.log('[onchain-leaderboard] Attempting to read contract...');

    // FIX: The `as const` on the parameter object was causing a type mismatch with viem's
    // ReadContractParameters type, which does not expect readonly properties. Removing
    // it allows TypeScript to correctly infer the parameters for a read operation.
    const leaderboardData = await client.readContract({
        address: seasonConfig.contractAddress,
        abi: LEADERBOARD_ABI,
        functionName: 'getLeaderboard',
        args: [],
    });

    console.log(`[onchain-leaderboard] Successfully read from contract. Raw data length: ${leaderboardData.length}`);
    console.log('[onchain-leaderboard] Enriching leaderboard data with Farcaster profiles via Neynar API...');

    const neynarApiKey = process.env.NEYNAR_API_KEY;
    if (!neynarApiKey) {
      console.error('[Enrichment] NEYNAR_API_KEY is not set. Cannot fetch user profiles.');
      return new Response(JSON.stringify({ message: 'Server configuration error: NEYNAR_API_KEY is missing.' }), {
        status: 500
      });
    }

    const addresses = leaderboardData.map(entry => entry.player);
    const userProfileMap = new Map<string, { displayName: string; fid: number }>();

    if (addresses.length > 0) {
      try {
        const addressesString = addresses.join(',');
        const neynarUrl = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${addressesString}`;

        const userResponse = await fetch(neynarUrl, {
          headers: { 'accept': 'application/json', 'api_key': neynarApiKey },
        });
        
        console.log(`[Enrichment] Neynar API response status: ${userResponse.status}`);

        if (userResponse.ok) {
          const userData = await userResponse.json();
          for (const address in userData) {
            const userArray = userData[address];
            if (userArray && userArray.length > 0) {
              const user = userArray[0];
              userProfileMap.set(address.toLowerCase(), {
                displayName: user.username,
                fid: user.fid,
              });
              console.log(`[Enrichment] Found profile for ${address}: ${user.username}`);
            }
          }
        } else {
            const errorBody = await userResponse.text();
            console.warn(`[Enrichment] Neynar API call failed. Status: ${userResponse.status}, Body: ${errorBody}`);
        }
      } catch (fetchError) {
        console.error(`[Enrichment] Neynar fetch error:`, fetchError);
      }
    }

    const enrichedLeaderboard = leaderboardData.map(entry => {
        const address = entry.player.toLowerCase();
        const profile = userProfileMap.get(address);

        return {
          rank: 0,
          displayName: profile ? profile.displayName : formatAddress(entry.player),
          fid: profile ? profile.fid : null,
          score: Number(entry.score),
          isCurrentUser: !!currentUserAddress && address === currentUserAddress,
        };
    });
    console.log('[onchain-leaderboard] Data enrichment complete.');
    
    enrichedLeaderboard.sort((a, b) => b.score - a.score);
    const finalLeaderboard = enrichedLeaderboard.map((entry, index) => ({ ...entry, rank: index + 1 }));

    console.log('[onchain-leaderboard] Leaderboard sorted. Sending response.');
    return new Response(JSON.stringify(finalLeaderboard), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[onchain-leaderboard] Error fetching on-chain leaderboard for season ${seasonId}:`, error);
    const errorResponse = { message: 'Error fetching leaderboard data from the blockchain.' };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}