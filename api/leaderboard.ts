// Vercel Edge Functions are fast, but for database queries, a standard Serverless Function is often better.
// We can configure this in vercel.json if needed, but for now, the default is fine.
// This tells Vercel to not cache the response and always fetch the latest data.
export const dynamic = 'force-dynamic';

import { sql } from '@vercel/postgres';
import { createClient, Errors } from '@farcaster/quick-auth';

type LeaderboardEntry = {
  rank: number;
  displayName: string;
  fid: number;
  score: number;
  primaryAddress: string | null;
  isCurrentUser?: boolean;
};

export async function GET(request: Request) {
  const quickAuthClient = createClient();
  const authorization = request.headers.get('Authorization');
  let currentUserFid: number | null = null;

  if (authorization && authorization.startsWith('Bearer ')) {
    const token = authorization.split(' ')[1];
    
    // Determine the domain from the request's Host header for reliable verification.
    const host = request.headers.get('Host');
    if (!host) {
      console.error(`[leaderboard] Missing Host header.`);
      return new Response(JSON.stringify({ message: 'Bad Request: Missing Host header' }), { status: 400 });
    }
    const domain = host;
    
    try {
      const payload = await quickAuthClient.verifyJwt({ token, domain });
      currentUserFid = Number(payload.sub);
    } catch (e) {
      if (e instanceof Errors.InvalidTokenError) {
        // Enhanced logging for debugging
        console.error(`[leaderboard] Invalid token error for domain "${domain}". Full error:`, e);
      } else {
        console.error(`[leaderboard] Unexpected error verifying JWT for domain "${domain}":`, e);
      }
      // In either case, treat as unauthenticated but don't fail the request.
    }
  }

  try {
    // Step 1: Fetch the top 20 players. Using RANK() is efficient for the top list.
    const { rows: topScoresRows } = await sql`
      SELECT 
        fid, 
        score,
        username,
        primary_address,
        RANK() OVER (ORDER BY score DESC) as rank
      FROM scores 
      LIMIT 20;
    `;

    let leaderboard: LeaderboardEntry[] = topScoresRows.map(row => ({
      rank: Number(row.rank),
      displayName: row.username || `fid:${row.fid}`,
      fid: Number(row.fid),
      score: row.score,
      primaryAddress: row.primary_address || null,
      isCurrentUser: currentUserFid !== null && Number(row.fid) === currentUserFid,
    }));

    // Step 2: If the user is authenticated, check if they are in the top 20.
    // If not, fetch their score and rank separately.
    if (currentUserFid) {
      const userInTop20 = leaderboard.some(entry => entry.isCurrentUser);

      if (!userInTop20) {
        // Use two simple queries for reliability.
        // First, get the user's data.
        const { rows: userRows } = await sql`
          SELECT score, username, primary_address FROM scores WHERE fid = ${currentUserFid};
        `;

        if (userRows.length > 0) {
          const user = userRows[0];
          
          // Second, calculate their rank by counting players with a higher score.
          const { rows: rankRows } = await sql`
            SELECT COUNT(*) + 1 as rank FROM scores WHERE score > ${user.score};
          `;
          const userRank = Number(rankRows[0].rank);

          leaderboard.push({
            rank: userRank,
            displayName: user.username || `fid:${currentUserFid}`,
            fid: currentUserFid,
            score: user.score,
            primaryAddress: user.primary_address || null,
            isCurrentUser: true,
          });
        }
      }
    }
    
    return new Response(JSON.stringify(leaderboard), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Database error fetching leaderboard:', error);
    const errorResponse = { message: 'Error fetching leaderboard data from the database.' };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}