// Vercel Edge Functions are fast, but for database queries, a standard Serverless Function is often better.
// We can configure this in vercel.json if needed, but for now, the default is fine.
// This tells Vercel to not cache the response and always fetch the latest data.
export const dynamic = 'force-dynamic';

import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { Errors, createClient } from '@farcaster/quick-auth';

// Initialize the Farcaster Quick Auth client.
const quickAuthClient = createClient();

type LeaderboardEntry = {
  rank: number;
  displayName: string;
  fid: number;
  score: number;
  isCurrentUser?: boolean;
};

export async function GET(request: Request) {
  let currentUserFid: number | null = null;
  
  try {
    const authorization = request.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.split(' ')[1];
      // Use the VERCEL_URL provided by Vercel, which is more reliable than HOSTNAME.
      const domain = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.HOSTNAME || 'localhost');
      const payload = await quickAuthClient.verifyJwt({ token, domain });
      // The `payload.sub` value from the decoded JWT is the user's FID.
      currentUserFid = payload.sub;
    }
  } catch (error) {
    if (error instanceof Errors.InvalidTokenError) {
      console.warn('Invalid auth token for leaderboard request.');
    } else {
      console.error('Unexpected error during user auth verification:', error);
    }
    // Proceed without user-specific data if auth fails.
  }

  try {
    // Select the top 20 players, using username if it exists, otherwise fallback to fid.
    const { rows: topScores } = await sql`
      SELECT 
        fid, 
        score,
        username
      FROM scores 
      ORDER BY score DESC 
      LIMIT 20;
    `;

    // Format the data to match the frontend's expected structure.
    const leaderboard: LeaderboardEntry[] = topScores.map((row, index) => ({
      rank: index + 1,
      displayName: row.username || `fid:${row.fid}`, // Use username if available, else fallback
      fid: Number(row.fid),
      score: row.score,
      isCurrentUser: currentUserFid !== null && Number(row.fid) === currentUserFid,
    }));

    // If the current user is authenticated, find their rank and add them if they are not in the top 20.
    if (currentUserFid !== null) {
      const isUserInTop20 = leaderboard.some(entry => entry.isCurrentUser);

      if (!isUserInTop20) {
        const userFid = Number(currentUserFid);
        if (!isNaN(userFid)) {
            // Step 1: Get the user's score and username with a simple query.
            const { rows: userResult } = await sql`
              SELECT score, username FROM scores WHERE fid = ${userFid};
            `;

            if (userResult.length > 0) {
              const userScoreData = userResult[0];
              
              // Step 2: Calculate their rank with another simple query.
              const { rows: rankResult } = await sql`
                SELECT COUNT(*) FROM scores WHERE score > ${userScoreData.score};
              `;
              
              const higherRankCount = parseInt(rankResult[0].count, 10);
              const userRank = higherRankCount + 1;

              leaderboard.push({
                rank: userRank,
                displayName: userScoreData.username || `fid:${userFid}`,
                fid: userFid,
                score: userScoreData.score,
                isCurrentUser: true,
              });
            }
        }
      }
    }
    
    return NextResponse.json(leaderboard, { status: 200 });
  } catch (error) {
    console.error('Database error fetching leaderboard:', error);
    return NextResponse.json({ message: 'Error fetching leaderboard data from the database.' }, { status: 500 });
  }
}