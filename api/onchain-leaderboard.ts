import { createPublicClient, http, defineChain } from 'viem';
import { onChainSeasonConfigs, LEADERBOARD_ABI } from '../../constants/contract';
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
      const payload = await quickAuthClient.verifyJwt({ token, domain });
      const fid = Number(payload.sub);
      // Fetch primary address for the authenticated FID
      const addressResponse = await fetch(`https://api.farcaster.xyz/fc/primary-address?fid=${fid}&protocol=ethereum`);
      if (addressResponse.ok) {
        const addressData = await addressResponse.json();
        if (addressData?.result?.address?.address) {
          currentUserAddress = addressData.result.address.address.toLowerCase();
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

    const leaderboardData = await client.readContract({
      address: seasonConfig.address,
      abi: LEADERBOARD_ABI,
      functionName: 'getLeaderboard',
    });

    // The contract returns players sorted by score, so rank is their index + 1
    const leaderboard: LeaderboardEntry[] = leaderboardData.map((entry, index) => ({
      rank: index + 1,
      displayName: formatAddress(entry.player),
      fid: null, // We don't have FID from on-chain data without an indexer
      score: Number(entry.score),
      isCurrentUser: !!currentUserAddress && entry.player.toLowerCase() === currentUserAddress,
    }));

    return new Response(JSON.stringify(leaderboard), {
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
