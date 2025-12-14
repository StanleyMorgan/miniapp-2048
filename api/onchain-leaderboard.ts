
import { createPublicClient, http, defineChain, type Chain, type Abi } from 'viem';
import { getAbiForVersion } from '../constants/contract.js';
import { createClient, Errors } from '@farcaster/quick-auth';
import { sql } from '@vercel/postgres';
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

const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.base.org'] },
  },
  testnet: true,
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
  [baseSepolia.id]: baseSepolia,
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
  console.log('[onchain-leaderboard] Found season config:', { address: seasonConfig.contractAddress, chainId: seasonConfig.chainId, version: seasonConfig.contractVersion });

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
    
    const contractAbi = getAbiForVersion(seasonConfig.contractVersion);

    console.log('[onchain-leaderboard] Public VIEM client created.');
    console.log('[onchain-leaderboard] Attempting to read contract...');

    const leaderboardData = await client.readContract({
        address: seasonConfig.contractAddress as `0x${string}`,
        abi: contractAbi,
        functionName: 'getLeaderboard',
    } as any) as any[];

    console.log(`[onchain-leaderboard] Successfully read from contract. Raw data length: ${leaderboardData.length}`);
    console.log('[onchain-leaderboard] Enriching leaderboard data...');

    const addresses = leaderboardData.map(entry => entry.player.toLowerCase());
    const userProfileMap = new Map<string, { displayName: string; fid: number }>();

    if (addresses.length > 0) {
      // 1. Try to fetch known users from our local database first
      try {
        // Postgres ANY takes an array literal formatted like {a,b,c} or we can use array parameters depending on driver
        // @vercel/postgres uses standard pg template tagging. 
        // We cast the array to a string array for postgres query.
        
        // Note: We need to handle the case where addresses array is empty or large.
        // For 'ANY', we pass the array directly.
        const { rows: dbUsers } = await sql`
          SELECT lower(primary_address) as address, username, fid 
          FROM scores 
          WHERE lower(primary_address) = ANY(${addresses as any})
        `;

        dbUsers.forEach(user => {
          if (user.address && user.username) {
            userProfileMap.set(user.address, {
              displayName: user.username,
              fid: user.fid,
            });
          }
        });
        console.log(`[Enrichment] Found ${dbUsers.length} profiles in local DB.`);

      } catch (dbError) {
        console.error('[Enrichment] Database lookup failed:', dbError);
        // Continue, we will fallback to Neynar
      }

      // 2. Identify missing addresses
      const missingAddresses = addresses.filter(addr => !userProfileMap.has(addr));
      
      // 3. Fetch missing from Neynar
      if (missingAddresses.length > 0) {
        console.log(`[Enrichment] Fetching ${missingAddresses.length} missing profiles from Neynar.`);
        const neynarApiKey = process.env.NEYNAR_API_KEY;

        if (neynarApiKey) {
          try {
            const addressesString = missingAddresses.join(',');
            const neynarUrl = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${addressesString}`;

            const userResponse = await fetch(neynarUrl, {
              headers: { 'accept': 'application/json', 'api_key': neynarApiKey },
            });
            
            if (userResponse.ok) {
              const userData = await userResponse.json();
              const usersToCache: { fid: number, username: string, primary_address: string }[] = [];

              for (const addressKey in userData) {
                const userArray = userData[addressKey];
                const lowerAddr = addressKey.toLowerCase();
                
                if (userArray && userArray.length > 0) {
                  const user = userArray[0];
                  
                  userProfileMap.set(lowerAddr, {
                    displayName: user.username,
                    fid: user.fid,
                  });
                  
                  // Prepare for DB cache
                  usersToCache.push({
                    fid: user.fid,
                    username: user.username,
                    primary_address: lowerAddr
                  });
                }
              }

              // 4. Cache new results to DB (Point-wise population)
              if (usersToCache.length > 0) {
                 console.log(`[Enrichment] Caching ${usersToCache.length} new profiles to DB.`);
                 // We execute these in parallel. We use ON CONFLICT to update metadata 
                 // without overwriting the score if a record exists.
                 // We rely on Promise.all for speed.
                 await Promise.all(usersToCache.map(u => {
                    return sql`
                      INSERT INTO scores (fid, username, primary_address, score, updated_at)
                      VALUES (${u.fid}, ${u.username}, ${u.primary_address}, 0, NOW())
                      ON CONFLICT (fid) 
                      DO UPDATE SET 
                        username = EXCLUDED.username,
                        primary_address = EXCLUDED.primary_address,
                        updated_at = NOW();
                    `;
                 }));
              }

            } else {
               console.warn(`[Enrichment] Neynar API call failed. Status: ${userResponse.status}`);
            }
          } catch (fetchError) {
            console.error(`[Enrichment] Neynar fetch error:`, fetchError);
          }
        } else {
             console.warn('[Enrichment] NEYNAR_API_KEY missing, skipping external fetch.');
        }
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
