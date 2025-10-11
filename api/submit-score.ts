import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { Errors, createClient } from '@farcaster/quick-auth';

// Initialize the Farcaster Quick Auth client.
const quickAuthClient = createClient();

export async function POST(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Missing or invalid authorization token' }, { status: 401 });
  }

  try {
    // Step 1: Verify the JWT from the request header.
    const token = authorization.split(' ')[1];
    const payload = await quickAuthClient.verifyJwt({
      token: token,
      // The domain is read from the HOSTNAME environment variable set in Vercel.
      domain: process.env.HOSTNAME || '', 
    });

    // The 'sub' property of the JWT payload contains the user's Farcaster ID (FID).
    const fid = payload.sub;
    const { score } = await request.json();

    // Basic validation for the score.
    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json({ message: 'Invalid score provided' }, { status: 400 });
    }
    
    // Step 2: Save the score to the database using an "UPSERT" operation.
    // This SQL command will INSERT a new row if the FID doesn't exist.
    // If the FID already exists (ON CONFLICT), it will UPDATE the existing row,
    // but only if the new score is greater than the current score.
    // This prevents users from submitting lower scores.
    await sql`
      INSERT INTO scores (fid, score, updated_at)
      VALUES (${fid}, ${score}, NOW())
      ON CONFLICT (fid)
      DO UPDATE SET
        score = EXCLUDED.score,
        updated_at = NOW()
      WHERE
        scores.score < EXCLUDED.score;
    `;

    return NextResponse.json({ success: true, message: `Score for FID ${fid} has been processed.` }, { status: 200 });

  } catch (e) {
    if (e instanceof Errors.InvalidTokenError) {
      // If the token is invalid, return a 401 Unauthorized error.
      console.warn('Invalid token received:', e.message);
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }
    // For any other unexpected errors, return a 500 Internal Server Error.
    console.error('An unexpected error occurred during score submission:', e);
    return NextResponse.json({ message: 'An unexpected error occurred' }, { status: 500 });
  }
}
