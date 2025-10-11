// Vercel Edge Functions are fast, but for database queries, a standard Serverless Function is often better.
// We can configure this in vercel.json if needed, but for now, the default is fine.
// This tells Vercel to not cache the response and always fetch the latest data.
export const dynamic = 'force-dynamic';

import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Select the top 20 players, ordered by their score in descending order.
    const { rows } = await sql`
      SELECT fid, username, score 
      FROM scores 
      ORDER BY score DESC 
      LIMIT 20;
    `;

    // Format the data to match the frontend's expected structure.
    const leaderboardData = rows.map((row, index) => ({
      rank: index + 1,
      // If a username is not stored, fallback to displaying the Farcaster ID.
      username: row.username || `fid:${row.fid}`,
      fid: row.fid,
      score: row.score,
    }));
    
    // Return the formatted leaderboard data with a 200 OK status.
    return NextResponse.json(leaderboardData, { status: 200 });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    // In case of a database error, return a generic 500 server error.
    return NextResponse.json({ message: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
