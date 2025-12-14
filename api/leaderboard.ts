
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
    // Step 1: Fetch the top 50 players. 
    // We use ROW_NUMBER() to generate unique ranks (1, 2, 3...)
    // Ties in score are broken by updated_at ASC (earlier score = better rank).
    const { rows: topScoresRows } = await sql`
      SELECT 
        fid, 
        score,
        username,
        primary_address,
        ROW_NUMBER() OVER (ORDER BY score DESC, updated_at ASC) as rank
      FROM scores 
      LIMIT 50;
    `;

    let leaderboard: LeaderboardEntry[] = topScoresRows.map(row => ({
      rank: Number(row.rank),
      displayName: row.username || `fid:${row.fid}`,
      fid: Number(row.fid),
      score: row.score,
      primaryAddress: row.primary_address || null,
      isCurrentUser: currentUserFid !== null && Number(row.fid) === currentUserFid,
    }));

    // Step 2: If the user is authenticated, check if they are in the top list.
    // If not, fetch their score and rank separately.
    if (currentUserFid) {
      const userInTopList = leaderboard.some(entry => entry.isCurrentUser);

      if (!userInTopList) {
        // Use two simple queries for reliability.
        // First, get the user's data including updated_at for tie-breaking.
        const { rows: userRows } = await sql`
          SELECT score, username, primary_address, updated_at FROM scores WHERE fid = ${currentUserFid};
        `;

        if (userRows.length > 0) {
          const user = userRows[0];
          
          // Second, calculate their rank by counting players with:
          // 1. A strictly higher score
          // 2. OR the same score but achieved earlier (smaller updated_at)
          const { rows: rankRows } = await sql`
            SELECT COUNT(*) + 1 as rank FROM scores 
            WHERE score > ${user.score}
            OR (score = ${user.score} AND updated_at < ${user.updated_at});
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
