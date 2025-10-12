// Vercel Edge Functions are fast, but for database queries, a standard Serverless Function is often better.
// We can configure this in vercel.json if needed, but for now, the default is fine.
// This tells Vercel to not cache the response and always fetch the latest data.
export const dynamic = 'force-dynamic';

import { sql } from '@vercel/postgres';

type LeaderboardEntry = {
  rank: number;
  displayName: string;
  fid: number;
  score: number;
};

export async function GET(request: Request) {
  try {
    // DEBUG: Temporarily removed all authentication and user-specific logic to isolate the problem.
    // This simplified query just fetches the top scores.
    const { rows } = await sql`
      SELECT 
        fid, 
        score,
        username
      FROM scores 
      ORDER BY score DESC 
      LIMIT 20;
    `;

    // Format the data into the structure the frontend expects.
    const leaderboard: LeaderboardEntry[] = rows.map((row, index) => ({
      rank: index + 1,
      displayName: row.username || `fid:${row.fid}`, // Use username, fallback to fid
      fid: Number(row.fid),
      score: row.score,
    }));
    
    return new Response(JSON.stringify(leaderboard), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // If this part is reached, there is a fundamental issue with the database connection or the basic query.
    console.error('Database error fetching leaderboard:', error);
    const errorResponse = { message: 'Error fetching leaderboard data from the database.' };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
