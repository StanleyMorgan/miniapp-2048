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

  if (!season || !onChainSeasonConfigs[season]) {
    return new Response(JSON.stringify({ message: 'Invalid or missing season parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const seasonConfig = onChainSeasonConfigs[season];

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
      // Custom interface to handle the optional `primaryAddress` which might be in the payload.
      interface CustomJWTPayload {
        // FIX: The `sub` property (FID) from the JWT payload is a number, not a string.
        sub: number;
        primaryAddress?: string; // Add the optional property
        [key: string]: unknown; // Allow other properties
      }

      const payload = (await quickAuthClient.verifyJwt({ token, domain })) as CustomJWTPayload;
      
      // Prioritize primaryAddress from JWT if available, otherwise fetch it.
      if (payload.primaryAddress) {
        currentUserAddress = payload.primaryAddress.toLowerCase();
      } else {
        const fid = payload.sub;
        // Fetch primary address for the authenticated FID
        const addressResponse = await fetch(`https://api.farcaster.xyz/fc/primary-address?fid=${fid}&protocol=ethereum`);
        if (addressResponse.ok) {
          const addressData = await addressResponse.json();
          if (addressData?.result?.address?.address) {
            currentUserAddress = addressData.result.address.address.toLowerCase();
          }
        }
      }
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

    const client = createPublicClient({
      chain: chain,
      transport: http(),
    });

    // FIX: The previous fix of adding `args: []` seems to cause a type error.
    // Omitting `args` for contract functions that take no arguments is the standard approach.
    const leaderboardData = await client.readContract({
      address: seasonConfig.address,
      abi: seasonConfig.abi,
      functionName: 'getLeaderboard',
    });

    const enrichedLeaderboard = await Promise.all(
      leaderboardData.map(async (entry, index) => {
        let displayName = formatAddress(entry.player);
        let fid: number | null = null;

        try {
          // Use Warpcast's reliable API to find user by any verified address
          const userResponse = await fetch(`https://api.warpcast.com/v2/user-by-verified-address?address=${entry.player}`);
          if (userResponse.ok) {
            const userData = await userResponse.json();
            if (userData.result && userData.result.user) {
              displayName = userData.result.user.displayName;
              fid = userData.result.user.fid;
            }
          }
        } catch (fetchError) {
          console.warn(`[onchain-leaderboard] Could not fetch Farcaster profile for address ${entry.player}:`, fetchError);
        }

        return {
          rank: index + 1,
          displayName,
          fid,
          score: Number(entry.score),
          isCurrentUser: !!currentUserAddress && entry.player.toLowerCase() === currentUserAddress,
        };
      })
    );
    
    // Sort the final result to ensure the current user (if not in top results) is placed correctly.
    enrichedLeaderboard.sort((a, b) => b.score - a.score);
    // Re-assign ranks after sorting
    const finalLeaderboard = enrichedLeaderboard.map((entry, index) => ({ ...entry, rank: index + 1 }));

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
