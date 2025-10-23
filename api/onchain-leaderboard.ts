// api/onchain-leaderboard.ts

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Cache for 60 seconds

import { createPublicClient, http, defineChain } from 'viem';
import { base, celo } from 'viem/chains';
import { onChainSeasonConfigs, OnChainSeasonConfig } from '../constants/contract.js';
// FIX: Import JWTPayload to extend it for custom claims.
import { createClient, Errors, type JWTPayload } from '@farcaster/quick-auth';
import type { Season } from '../components/SeasonSelector';

// --- Chain Definitions (ensure they are available server-side) ---
const monad = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MONAD', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://monad-testnet.drpc.org'] },
  },
});

const chainMap = {
  [monad.id]: monad,
  [base.id]: base,
  [celo.id]: celo,
};
// --- End of Chain Definitions ---

type LeaderboardEntry = {
  rank: number;
  displayName: string;
  fid: number | null;
  score: number;
  isCurrentUser?: boolean;
};

type RawLeaderboardEntry = {
  player: `0x${string}`;
  score: bigint;
};

// FIX: Define a custom interface for the JWT payload to include the optional primaryAddress.
interface CustomJWTPayload extends JWTPayload {
  primaryAddress?: string;
}

// Cache for Farcaster user data to reduce API calls
const userCache = new Map<string, { data: { displayName: string; fid: number | null }, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getFarcasterUser(address: string): Promise<{ displayName: string; fid: number | null }> {
  const cachedEntry = userCache.get(address.toLowerCase());
  if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL)) {
    return cachedEntry.data;
  }

  try {
    // Using the fnames API which is better at resolving any verified address to a username.
    const response = await fetch(`https://fnames.farcaster.xyz/transfers/current?address=${address}`);
    if (response.ok) {
      const data = await response.json();
      // The API returns an array of transfers, we want the most recent one's username.
      if (data.transfers && data.transfers.length > 0) {
        const username = data.transfers[0].username;
        const fid = data.transfers[0].to; // The 'to' field is the FID
        const result = {
          displayName: username, // Use the fname as the display name
          fid: fid ? Number(fid) : null,
        };
        userCache.set(address.toLowerCase(), { data: result, timestamp: Date.now() });
        return result;
      }
    }
  } catch (error) {
    console.warn(`[onchain-leaderboard] Failed to fetch Farcaster fname for address ${address}:`, error);
  }

  // Fallback for addresses not on Farcaster or if API fails
  return {
    displayName: `${address.slice(0, 6)}...${address.slice(-4)}`,
    fid: null
  };
}


async function getCurrentUserPrimaryAddress(request: Request): Promise<string | null> {
    const quickAuthClient = createClient();
    const authorization = request.headers.get('Authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) return null;

    const token = authorization.split(' ')[1];
    const host = request.headers.get('Host');
    if (!host) return null;

    try {
        // FIX: Use the custom payload type to safely access primaryAddress.
        const payload = await quickAuthClient.verifyJwt({ token, domain: host }) as CustomJWTPayload;
        // The quick-auth JWT payload itself might contain the primary address.
        if (payload.primaryAddress) {
            return payload.primaryAddress;
        }
        
        // Fallback to fetching it if not in JWT
        const fid = Number(payload.sub);
        const addressResponse = await fetch(`https://api.farcaster.xyz/fc/primary-address?fid=${fid}&protocol=ethereum`);
        if (addressResponse.ok) {
            const addressData = await addressResponse.json();
            if (addressData?.result?.address?.address) {
                return addressData.result.address.address;
            }
        }
    } catch (e) {
        if (e instanceof Errors.InvalidTokenError) {
            console.warn(`[onchain-leaderboard] Invalid token error while getting user address.`);
        } else {
            console.error(`[onchain-leaderboard] Unexpected error verifying JWT:`, e);
        }
    }
    return null;
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get('season') as Season | null;

  console.log(`[onchain-leaderboard] Received request for season: ${season}`);

  if (!season || !onChainSeasonConfigs.hasOwnProperty(season)) {
    console.error(`[onchain-leaderboard] Invalid or missing season parameter.`);
    return new Response(JSON.stringify({ message: 'Missing or invalid season' }), { status: 400 });
  }

  const seasonConfig: OnChainSeasonConfig = onChainSeasonConfigs[season as keyof typeof onChainSeasonConfigs];
  console.log('[onchain-leaderboard] Found season config:', { address: seasonConfig.address, chainId: seasonConfig.chainId });

  const chain = chainMap[seasonConfig.chainId];
  if (!chain) {
      console.error(`[onchain-leaderboard] Configuration error: Chain with ID ${seasonConfig.chainId} not found in chainMap.`);
      return new Response(JSON.stringify({ message: `Configuration error: Chain with ID ${seasonConfig.chainId} not found.` }), { status: 500 });
  }
  console.log(`[onchain-leaderboard] Mapped to chain: ${chain.name}`);

  try {
    const publicClient = createPublicClient({
      chain: chain,
      transport: http(),
    });
    console.log('[onchain-leaderboard] Public VIEM client created.');

    console.log('[onchain-leaderboard] Attempting to read contract and get current user...');
    // FIX: The `args` property must be omitted for contract functions that take no arguments.
    // Some versions of viem have type inference issues when `args` is passed (even as an empty array),
    // leading to it expecting transaction-related properties like `authorizationList`.
    const [rawLeaderboard, currentUserAddress] = await Promise.all([
        publicClient.readContract({
            address: seasonConfig.address,
            abi: seasonConfig.abi,
            functionName: 'getLeaderboard',
        }) as Promise<RawLeaderboardEntry[]>,
        getCurrentUserPrimaryAddress(request)
    ]);
    console.log(`[onchain-leaderboard] Successfully read from contract. Raw data length: ${rawLeaderboard?.length ?? 'N/A'}`);
    
    if (!rawLeaderboard || !Array.isArray(rawLeaderboard)) {
        console.error('[onchain-leaderboard] Invalid data received from smart contract. Expected an array.');
        throw new Error("Invalid data received from smart contract.");
    }
    
    console.log('[onchain-leaderboard] Enriching leaderboard data with Farcaster profiles...');
    const enrichedDataPromises = rawLeaderboard.map(async (entry) => {
        const farcasterUser = await getFarcasterUser(entry.player);
        return {
            ...farcasterUser,
            score: Number(entry.score),
            isCurrentUser: !!currentUserAddress && currentUserAddress.toLowerCase() === entry.player.toLowerCase(),
        };
    });

    const enrichedLeaderboard = await Promise.all(enrichedDataPromises);
    console.log('[onchain-leaderboard] Data enrichment complete.');

    const sortedLeaderboard = enrichedLeaderboard
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({
          ...entry,
          rank: index + 1,
      }));
    console.log('[onchain-leaderboard] Leaderboard sorted. Sending response.');

    return new Response(JSON.stringify(sortedLeaderboard), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': `public, s-maxage=60, stale-while-revalidate=120`
      },
    });

  } catch (error) {
    console.error(`[onchain-leaderboard] FATAL ERROR for season ${season}:`, error);
    const errorResponse = { message: 'Error fetching on-chain leaderboard.' };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
