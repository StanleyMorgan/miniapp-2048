

import { createPublicClient, http, defineChain } from 'viem';
// FIX: Added .js extension, which is mandatory for module resolution in Vercel's Node.js environment.
import { onChainSeasonConfigs } from '../constants/contract.js';
import { createClient, Errors } from '@farcaster/quick-auth';

export const dynamic = 'force-dynamic';

// Define chains for viem client, mirroring wagmiConfig.ts
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

const chains: { [key: number]: any } = {
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

// Helper to format address for display
const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get('season') as keyof typeof onChainSeasonConfigs | null;

  console.log(`[onchain-leaderboard] Received request for season: ${season}`);

  if (!season || !onChainSeasonConfigs[season]) {
    return new Response(JSON.stringify({ message: 'Invalid or missing season parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const seasonConfig = onChainSeasonConfigs[season];
  console.log('[onchain-leaderboard] Found season config:', { address: seasonConfig.address, chainId: seasonConfig.chainId });


  // --- Handle Authentication to identify current user ---
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
      interface CustomJWTPayload {
        sub: number;
        [key: string]: unknown;
      }

      const payload = (await quickAuthClient.verifyJwt({ token, domain })) as CustomJWTPayload;
      const fid = payload.sub;

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

    const client = createPublicClient({
      chain: chain,
      transport: http(),
    });
    console.log('[onchain-leaderboard] Public VIEM client created.');
    console.log('[onchain-leaderboard] Attempting to read contract...');

    // FIX: The `args` property should be omitted for contract functions that take no arguments.
    // Including `args: []` can cause TypeScript to select an incorrect overload for `readContract`
    // with certain versions of `viem`, leading to type errors about missing properties.
    const leaderboardData = await client.readContract({
        address: seasonConfig.address,
        abi: seasonConfig.abi,
        functionName: 'getLeaderboard',
    });

    console.log(`[onchain-leaderboard] Successfully read from contract. Raw data length: ${leaderboardData.length}`);
    console.log('[onchain-leaderboard] Enriching leaderboard data with Farcaster profiles via Neynar API...');

    // --- NEYNAR BATCH ENRICHMENT LOGIC ---
    const neynarApiKey = process.env.NEYNAR_API_KEY;
    if (!neynarApiKey) {
      console.error('[Enrichment] NEYNAR_API_KEY is not set. Cannot fetch user profiles.');
      return new Response(JSON.stringify({ message: 'Server configuration error: NEYNAR_API_KEY is missing.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const addresses = leaderboardData.map(entry => entry.player);
    const userProfileMap = new Map<string, { displayName: string; fid: number }>();

    if (addresses.length > 0) {
      try {
        const addressesString = addresses.join(',');
        const neynarUrl = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${addressesString}`;

        const userResponse = await fetch(neynarUrl, {
          headers: {
            'accept': 'application/json',
            'api_key': neynarApiKey,
          },
        });
        
        console.log(`[Enrichment] Neynar API response status: ${userResponse.status}`);

        if (userResponse.ok) {
          const userData = await userResponse.json();
          // The response format is { "0x...": [user], ... }
          for (const address in userData) {
            const userArray = userData[address];
            if (userArray && userArray.length > 0) {
              const user = userArray[0];
              userProfileMap.set(address.toLowerCase(), {
                displayName: user.username, // Use username for consistency with the Farcaster leaderboard
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
          rank: 0, // Will be set after sorting
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
    console.error(`[onchain-leaderboard] Error fetching on-chain leaderboard for season ${season}:`, error);
    const errorResponse = { message: 'Error fetching leaderboard data from the blockchain.' };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}